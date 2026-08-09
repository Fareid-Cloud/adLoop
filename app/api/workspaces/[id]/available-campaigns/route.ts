// app/api/workspaces/[id]/available-campaigns/route.ts
//
// لما المستخدم يكون جوه Workspace ويدوس "اربط حملات"، الـ route ده بيرجعله
// كل الحسابات والكامبينز المتاحة، عشان يختار مين منهم يتحط في الـ Workspace
// ده. بيدعم جوجل وميتا الاتنين عن طريق ?platform= (افتراضي: GOOGLE_ADS).

import { NextRequest, NextResponse } from "next/server";
import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { decryptToken } from "@/lib/encryption";
import { t, type Locale } from "@/lib/i18n/dictionary";

const META_API_VERSION = "v25.0";

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

  if (platform === "META_ADS") return getMetaCampaigns(user.id, locale);
  if (platform === "TIKTOK_ADS") return getTikTokCampaigns(user.id, locale);
  if (platform === "GOOGLE_ADS") return getGoogleCampaigns(user.id, locale);

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
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: "TIKTOK_ADS" } },
  });

  if (!connection) {
    return NextResponse.json(
      { error: t(locale, "adCell.notConnected", { platform: "TikTok Ads" }) },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      { error: advertisersData.message ?? "فشل جلب حسابات تيك توك" },
      { status: 400 }
    );
  }

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const result = [];
  for (const advertiser of advertisersData.data?.list ?? []) {
    const advertiserId = String(advertiser.advertiser_id);

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
      campaigns: (campaignsData.data?.list ?? []).map((c: any) => ({
        id: String(c.campaign_id),
        name: c.campaign_name,
        status: c.operation_status,
        recentlyActive: activeIds.has(String(c.campaign_id)),
      })),
    });
  }

  return NextResponse.json({ accounts: result });
}

async function getGoogleCampaigns(userId: string, locale: Locale) {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: "GOOGLE_ADS" } },
  });

  if (!connection) {
    return NextResponse.json(
      { error: t(locale, "adCell.notConnected", { platform: "Google Ads" }) },
      { status: 400 }
    );
  }

  if (!connection.refreshToken) {
    return NextResponse.json(
      { error: t(locale, "apiErr.googleTokenExpired") },
      { status: 400 }
    );
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const refreshToken = decryptToken(connection.refreshToken);

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    // الحسابات التي يملك هذا التوكن صلاحية عليها. سابقاً كان الكود يفترض
    // وجود حساب وكالة (MCC) مخزّن في managerAccountId - وهو حقل لا تكتبه
    // عملية الربط إطلاقاً، فكان الاستعلام يُرسل بمعرّف فارغ ويفشل دائماً،
    // ولذلك لم تظهر أي حملة. الآن نكتشف الحسابات فعلياً من جوجل نفسها.
    const accessible = await client.listAccessibleCustomers(refreshToken);
    const accessibleIds = (accessible.resource_names ?? []).map((rn: string) => rn.split("/")[1]);

    if (accessibleIds.length === 0) {
      return NextResponse.json(
        { error: t(locale, "apiErr.noGoogleAccounts"), accounts: [] },
        { status: 200 }
      );
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

    const result = [];
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

    return NextResponse.json({ accounts: result });
  } catch (err: any) {
    // سابقاً لم يكن هناك try/catch إطلاقاً، فكان أي خطأ من جوجل يتحول إلى
    // 500 صامت بلا رسالة - وهو ما جعل تشخيص المشكلة مستحيلاً على المستخدم.
    console.error("فشل جلب حملات Google Ads:", err);
    const detail = err?.errors?.[0]?.message ?? err?.message ?? "خطأ غير معروف";
    return NextResponse.json(
      { error: `تعذّر جلب حملات Google Ads: ${detail}` },
      { status: 400 }
    );
  }
}

async function getMetaCampaigns(userId: string, locale: Locale) {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: "META_ADS" } },
  });

  if (!connection) {
    return NextResponse.json(
      { error: t(locale, "adCell.notConnected", { platform: "Meta Ads" }) },
      { status: 400 }
    );
  }

  // /me/adaccounts بيرجّع كل الحسابات الإعلانية المتاحة للتوكن ده
  const accountsRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=name,account_id&access_token=${decryptToken(connection.accessToken)}`
  );
  const accountsData = await accountsRes.json();

  if (!accountsRes.ok) {
    return NextResponse.json(
      { error: accountsData.error?.message ?? "فشل جلب حسابات ميتا" },
      { status: 400 }
    );
  }

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);

  const result = [];
  for (const acc of accountsData.data ?? []) {
    // act_ prefix مطلوب في كل استعلامات الحملات - ده اسم الحقل الفعلي
    // اللي جوجل... آسف، ميتا بترجعه (account_id بدون البادئة)
    const accountId = `act_${acc.account_id}`;

    const [campaignsRes, activityRes] = await Promise.all([
      fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,status&access_token=${decryptToken(connection.accessToken)}`),
      fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights?level=campaign&fields=campaign_id,impressions&time_range=${JSON.stringify({ since: tenDaysAgoStr, until: new Date().toISOString().slice(0, 10) })}&access_token=${decryptToken(connection.accessToken)}`),
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
      campaigns: (campaignsData.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        recentlyActive: activeIds.has(c.id),
      })),
    });
  }

  return NextResponse.json({ accounts: result });
}
