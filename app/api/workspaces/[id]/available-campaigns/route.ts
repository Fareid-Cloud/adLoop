// app/api/workspaces/[id]/available-campaigns/route.ts
//
// لما المستخدم يكون جوه Workspace ويدوس "اربط حملات"، الـ route ده بيرجعله
// كل الحسابات والكامبينز المتاحة، عشان يختار مين منهم يتحط في الـ Workspace
// ده. بيدعم جوجل وميتا الاتنين عن طريق ?platform= (افتراضي: GOOGLE_ADS).
//
// ═══ منحةٌ واحدة لم تعد الحالة الوحيدة ═══
//
// كان كلّ فرعٍ هنا يقرأ **منحةً واحدة** (`findUnique` على `userId_platform`)
// لأنّ القيد كان يضمن أنّها الوحيدة. وبعد أن صار للمشترك أكثر من تسجيل
// دخولٍ للمنصّة الواحدة، صار ذلك يعني أنّ **حسابات المنحة الثانية لا تظهر
// إطلاقاً**: يربط الوكيلُ حساب عميله الثاني بنجاح، ثمّ يفتح «اختر الحملات»
// فلا يجد شيئاً - ربطٌ تمّ ولا أثر له.
//
// ولذلك يمرّ كلّ فرعٍ على **كلّ** المنح، ويجمع حصائلها. وفشلُ منحةٍ لا
// يُسقط الباقي: منحةٌ انتهت صلاحيتها كانت ستُخفي حسابات منحةٍ سليمة معها،
// فتصير رسالة الخطأ أسوأ من نصف النتيجة.

import { NextRequest, NextResponse } from "next/server";
import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { decryptToken } from "@/lib/encryption";
import { recordDiscoveredAccounts } from "@/lib/oauthGrant";
import { t, type Locale } from "@/lib/i18n/dictionary";

const META_API_VERSION = "v25.0";

/** حسابٌ إعلانيّ كما تعرضه نافذة الاختيار، منسوباً إلى المنحة التي وصلته. */
interface AccountResult {
  accountId: string;
  accountName: string;
  /** المنحة التي وصلت هذا الحساب - تفرّق بين حسابين متشابهي الاسم */
  connectionId: string;
  connectionLabel: string | null;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    recentlyActive: boolean;
  }>;
}

/**
 * حسابٌ واحد قد تصله منحتان (تسجيلا دخولٍ لهما الصلاحية نفسها). عرضُه
 * مرّتين يجعل المشترك يظنّ أنّهما حسابان، ويربط الحملة نفسها مرّتين.
 * الأولى تفوز - وهي الأقدم لأنّ المنح مرتّبة بتاريخ الربط.
 */
function dedupeAccounts(accounts: AccountResult[]): AccountResult[] {
  const seen = new Set<string>();
  const out: AccountResult[] = [];
  for (const a of accounts) {
    if (seen.has(a.accountId)) continue;
    seen.add(a.accountId);
    out.push(a);
  }
  return out;
}

async function grantsFor(userId: string, platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS") {
  return prisma.connectedPlatform.findMany({
    where: { userId, platform },
    orderBy: { connectedAt: "asc" },
  });
}

/**
 * الردّ الموحَّد بعد المرور على كلّ المنح.
 *
 * **الخطأ يُرفَع فقط حين لا يكون معنا شيءٌ نعرضه.** فلو نجحت منحةٌ وفشلت
 * أخرى، عرضُ ما نجح مع ذكر ما فشل أنفعُ من حجب الاثنين - والمشترك يرى
 * حساباته ويعرف أنّ منحةً منها تحتاج إعادة ربط.
 */
function respond(accounts: AccountResult[], failures: string[], emptyError: string) {
  const deduped = dedupeAccounts(accounts);
  if (deduped.length === 0) {
    return NextResponse.json(
      { error: failures[0] ?? emptyError, accounts: [] },
      { status: failures.length > 0 ? 400 : 200 }
    );
  }
  return NextResponse.json({
    accounts: deduped,
    ...(failures.length > 0 ? { partialFailures: failures } : {}),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // الرسالة تُبنى بلغة القارئ لا بلغة مَن كتب الملفّ - وهي تُعرض كما هي
  // داخل نافذة اختيار الحملات.
  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? "GOOGLE_ADS";

  // قنوات البيع تُرسَل مع الحملات: بدونها لا تعرف النافذة ما تنسب إليه،
  // ونسبةُ الحملة إلى قناتها هي وحدها ما يجعل العائد لكلّ قناة ممكناً.
  const stores = await prisma.ecommerceConnection.findMany({
    where: { workspaceId: id, active: true },
    select: { id: true, storeName: true, storeUrl: true, platform: true },
    orderBy: { createdAt: "asc" },
  });
  const storeOptions = stores.map((s) => ({
    id: s.id,
    name: s.storeName ?? s.storeUrl ?? s.platform,
  }));
  const assigned = await prisma.campaignLink.findMany({
    where: { workspaceId: id, platform: platform as never },
    select: { externalCampaignId: true, connectionId: true },
  });
  const assignedMap = Object.fromEntries(
    assigned.filter((a) => a.connectionId).map((a) => [a.externalCampaignId, a.connectionId as string])
  );

  const withStores = async (r: Promise<NextResponse>) => {
    const res = await r;
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ...body, stores: storeOptions, assigned: assignedMap }, { status: res.status });
  };

  if (platform === "META_ADS") return withStores(getMetaCampaigns(user.id, locale));
  if (platform === "TIKTOK_ADS") return withStores(getTikTokCampaigns(user.id, locale));
  if (platform === "GOOGLE_ADS") return withStores(getGoogleCampaigns(user.id, locale));

  // 🔴 كان هذا السطر `return getGoogleCampaigns(...)` بلا شرط - أي أنّ **كلّ**
  // منصّة غير معروفة تسقط على جوجل بصمت. فمن فتح «اختر الحملات» من تكامل
  // متجر (شوبيفاي مثلاً) كان يُسأل عن حملات جوجل، ويُقال له إنّ جوجل غير
  // مربوط - رسالةٌ عن منصّة لم يذكرها أحد، تجعل التكامل يبدو معطّلاً وهو
  // ليس كذلك: المتاجر لا حملات إعلانية لها أصلاً.
  //
  // الافتراضيّ الصامت أخطر من الخطأ الصريح: الأوّل يُنتج جواباً خاطئاً عن
  // سؤال لم يُطرح، والثاني يقول ما حدث.
  return NextResponse.json(
    { error: t(locale, "adCell.noCampaignsForPlatform", { platform }) },
    { status: 400 }
  );
}

const TIKTOK_API_VERSION = "v1.3";

async function getTikTokCampaigns(userId: string, locale: Locale) {
  const connections = await grantsFor(userId, "TIKTOK_ADS");
  if (connections.length === 0) {
    return NextResponse.json(
      { error: t(locale, "adCell.notConnected", { platform: "TikTok Ads" }) },
      { status: 400 }
    );
  }

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const result: AccountResult[] = [];
  const failures: string[] = [];

  for (const connection of connections) {
    const accessToken = decryptToken(connection.accessToken);
    const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };

    // بنجيب حسابات الإعلانات المتاحة للتوكن ده - تيك توك بترجعها بنداء
    // منفصل تماماً عن جوجل/ميتا (advertiser/get)، مش جزء من رد OAuth نفسه
    const advertisersRes = await fetch(
      `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/oauth2/advertiser/get/` +
        `?app_id=${process.env.TIKTOK_APP_ID}&secret=${process.env.TIKTOK_APP_SECRET}&access_token=${accessToken}`
    );
    const advertisersData = await advertisersRes.json();

    if (advertisersData.code !== 0) {
      failures.push(advertisersData.message ?? t(locale, "apiErr.tiktokAccountsFailed"));
      continue; // منحةٌ متعطّلة لا تُسقط أخواتها
    }

    const discovered: Array<{ externalAccountId: string; name?: string | null }> = [];

    for (const advertiser of advertisersData.data?.list ?? []) {
      const advertiserId = String(advertiser.advertiser_id);
      discovered.push({
        externalAccountId: advertiserId,
        name: advertiser.advertiser_name ?? null,
      });

      const campaignsRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/campaign/get/` +
          `?advertiser_id=${advertiserId}&page_size=100`,
        { headers }
      );
      const campaignsData = await campaignsRes.json();
      if (campaignsData.code !== 0) continue; // حساب من غير صلاحية كافية - بنتخطاه، مش بنكسر الطلب كله

      // نشاط آخر 10 أيام - عبر endpoint التقارير نفسه، مش استعلام منفصل
      // كامل زي جوجل، تيك توك بتدمج كل حاجة في /report/integrated/get
      const activityRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/` +
          `?advertiser_id=${advertiserId}&report_type=BASIC&data_level=AUCTION_CAMPAIGN` +
          `&dimensions=${encodeURIComponent(JSON.stringify(["campaign_id"]))}` +
          `&metrics=${encodeURIComponent(JSON.stringify(["impressions"]))}` +
          `&start_date=${tenDaysAgoStr}&end_date=${todayStr}&page_size=200`,
        { headers }
      );
      const activityData = await activityRes.json();

      const activeIds = new Set(
        (activityData.data?.list ?? [])
          .filter((r: any) => Number(r.metrics?.impressions ?? 0) > 0)
          .map((r: any) => String(r.dimensions?.campaign_id))
      );

      result.push({
        accountId: advertiserId,
        accountName: advertiser.advertiser_name ?? advertiserId,
        connectionId: connection.id,
        connectionLabel: connection.label,
        campaigns: (campaignsData.data?.list ?? []).map((c: any) => ({
          id: String(c.campaign_id),
          name: c.campaign_name,
          status: c.operation_status,
          recentlyActive: activeIds.has(String(c.campaign_id)),
        })),
      });
    }

    await recordDiscoveredAccounts(connection.id, "TIKTOK_ADS", discovered);
  }

  return respond(result, failures, t(locale, "apiErr.tiktokAccountsFailed"));
}

async function getGoogleCampaigns(userId: string, locale: Locale) {
  const connections = await grantsFor(userId, "GOOGLE_ADS");
  if (connections.length === 0) {
    return NextResponse.json(
      { error: t(locale, "adCell.notConnected", { platform: "Google Ads" }) },
      { status: 400 }
    );
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const result: AccountResult[] = [];
  const failures: string[] = [];

  for (const connection of connections) {
    if (!connection.refreshToken) {
      failures.push(t(locale, "apiErr.googleTokenExpired"));
      continue;
    }
    const refreshToken = decryptToken(connection.refreshToken);

    try {
      // الحسابات التي يملك هذا التوكن صلاحية عليها. سابقاً كان الكود يفترض
      // وجود حساب وكالة (MCC) مخزّن في managerAccountId - وهو حقل لا تكتبه
      // عملية الربط إطلاقاً، فكان الاستعلام يُرسل بمعرّف فارغ ويفشل دائماً،
      // ولذلك لم تظهر أي حملة. الآن نكتشف الحسابات فعلياً من جوجل نفسها.
      const accessible = await client.listAccessibleCustomers(refreshToken);
      const accessibleIds = (accessible.resource_names ?? []).map((rn: string) => rn.split("/")[1]);

      if (accessibleIds.length === 0) {
        failures.push(t(locale, "apiErr.noGoogleAccounts"));
        continue;
      }

      // حساب مباشر أم وكالة؟ الوكالة تُوسَّع إلى حساباتها الفرعية.
      const targets: { customerId: string; loginCustomerId?: string; name?: string }[] = [];
      let discoveredManagerId: string | null = null;

      for (const accountId of accessibleIds) {
        try {
          const cust = client.Customer({ customer_id: accountId, refresh_token: refreshToken });
          const info = await cust.query(
            `SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1`
          );
          const row: any = info[0];

          if (row?.customer?.manager) {
            discoveredManagerId = accountId;
            const children = await cust.query(`
              SELECT customer_client.id, customer_client.descriptive_name
              FROM customer_client
              WHERE customer_client.manager = false AND customer_client.status = 'ENABLED'
            `);
            for (const ch of children as any[]) {
              targets.push({
                customerId: String(ch.customer_client?.id),
                loginCustomerId: accountId,
                name: ch.customer_client?.descriptive_name,
              });
            }
          } else {
            targets.push({ customerId: accountId, name: row?.customer?.descriptive_name });
          }
        } catch {
          continue; // حساب بلا صلاحية كافية - نتخطاه ولا نُسقط الطلب كله
        }
      }

      // نحفظ معرّف الوكالة عند اكتشافه لأول مرة - المزامنة اليومية تعتمد عليه
      if (discoveredManagerId && connection.managerAccountId !== discoveredManagerId) {
        await prisma.connectedPlatform.update({
          where: { id: connection.id },
          data: { managerAccountId: discoveredManagerId },
        });
      }

      await recordDiscoveredAccounts(
        connection.id,
        "GOOGLE_ADS",
        targets.map((tg) => ({ externalAccountId: tg.customerId, name: tg.name ?? null }))
      );

      for (const target of targets) {
        try {
          const customer = client.Customer({
            customer_id: target.customerId,
            ...(target.loginCustomerId ? { login_customer_id: target.loginCustomerId } : {}),
            refresh_token: refreshToken,
          });

          const [campaigns, recentActivity] = await Promise.all([
            customer.query(`
              SELECT campaign.id, campaign.name, campaign.status
              FROM campaign
              WHERE campaign.status != 'REMOVED'
            `),
            customer.query(`
              SELECT campaign.id, metrics.impressions
              FROM campaign
              WHERE segments.date BETWEEN '${tenDaysAgoStr}' AND '${todayStr}'
            `),
          ]);

          const activeIds = new Set(
            (recentActivity as any[])
              .filter((r) => Number(r.metrics?.impressions ?? 0) > 0)
              .map((r) => String(r.campaign?.id))
          );

          result.push({
            accountId: target.customerId,
            accountName: target.name ?? target.customerId,
            connectionId: connection.id,
            connectionLabel: connection.label,
            campaigns: (campaigns as any[]).map((c) => ({
              id: String(c.campaign?.id),
              name: c.campaign?.name,
              status: c.campaign?.status,
              recentlyActive: activeIds.has(String(c.campaign?.id)),
            })),
          });
        } catch {
          continue; // حساب فرعي تعذّر قراءته - نُكمل الباقي
        }
      }
    } catch (err: any) {
      // سابقاً لم يكن هناك try/catch إطلاقاً، فكان أي خطأ من جوجل يتحول إلى
      // 500 صامت بلا رسالة - وهو ما جعل تشخيص المشكلة مستحيلاً على المستخدم.
      console.error("فشل جلب حملات Google Ads:", err);
      const detail = err?.errors?.[0]?.message ?? err?.message ?? "";
      failures.push(t(locale, "apiErr.googleCampaignsFailed", { detail }));
    }
  }

  return respond(result, failures, t(locale, "apiErr.noGoogleAccounts"));
}

async function getMetaCampaigns(userId: string, locale: Locale) {
  const connections = await grantsFor(userId, "META_ADS");
  if (connections.length === 0) {
    return NextResponse.json(
      { error: t(locale, "adCell.notConnected", { platform: "Meta Ads" }) },
      { status: 400 }
    );
  }

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);

  const result: AccountResult[] = [];
  const failures: string[] = [];

  for (const connection of connections) {
    const token = decryptToken(connection.accessToken);

    // /me/adaccounts بيرجّع كل الحسابات الإعلانية المتاحة للتوكن ده
    const accountsRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=name,account_id&access_token=${token}`
    );
    const accountsData = await accountsRes.json();

    if (!accountsRes.ok) {
      failures.push(accountsData.error?.message ?? t(locale, "apiErr.metaAccountsFailed"));
      continue;
    }

    const discovered: Array<{ externalAccountId: string; name?: string | null }> = [];

    for (const acc of accountsData.data ?? []) {
      // act_ prefix مطلوب في كل استعلامات الحملات - ده اسم الحقل الفعلي
      // اللي ميتا بترجعه (account_id بدون البادئة)
      const accountId = `act_${acc.account_id}`;
      discovered.push({ externalAccountId: accountId, name: acc.name ?? null });

      const [campaignsRes, activityRes] = await Promise.all([
        fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,status&access_token=${token}`),
        fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights?level=campaign&fields=campaign_id,impressions&time_range=${JSON.stringify({ since: tenDaysAgoStr, until: new Date().toISOString().slice(0, 10) })}&access_token=${token}`),
      ]);

      const campaignsData = await campaignsRes.json();
      const activityData = await activityRes.json();

      if (!campaignsRes.ok) continue; // حساب من غير صلاحية وصول كافية - بنتخطاه، مش بنكسر الطلب كله

      const activeIds = new Set(
        (activityData.data ?? [])
          .filter((r: any) => Number(r.impressions ?? 0) > 0)
          .map((r: any) => r.campaign_id)
      );

      result.push({
        accountId,
        accountName: acc.name,
        connectionId: connection.id,
        connectionLabel: connection.label,
        campaigns: (campaignsData.data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          recentlyActive: activeIds.has(c.id),
        })),
      });
    }

    await recordDiscoveredAccounts(connection.id, "META_ADS", discovered);
  }

  return respond(result, failures, t(locale, "apiErr.metaAccountsFailed"));
}
