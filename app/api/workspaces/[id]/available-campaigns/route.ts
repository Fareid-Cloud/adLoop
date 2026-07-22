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

const META_API_VERSION = "v25.0";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? "GOOGLE_ADS";

  if (platform === "META_ADS") {
    return getMetaCampaigns(user.id);
  }
  if (platform === "TIKTOK_ADS") {
    return getTikTokCampaigns(user.id);
  }
  return getGoogleCampaigns(user.id);
}

const TIKTOK_API_VERSION = "v1.3";

async function getTikTokCampaigns(userId: string) {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: "TIKTOK_ADS" } },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "TikTok Ads غير مربوط. اربطه الأول من إعدادات الحساب." },
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

async function getGoogleCampaigns(userId: string) {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: "GOOGLE_ADS" } },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Google Ads غير مربوط. اربطه الأول من إعدادات الحساب." },
      { status: 400 }
    );
  }

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  // بنجيب كل الحسابات الفرعية تحت الـ MCC (login-customer-id)
  const manager = client.Customer({
    customer_id: connection.managerAccountId!,
    refresh_token: decryptToken(connection.refreshToken!),
  });

  const subAccounts = await manager.query(`
    SELECT customer_client.id, customer_client.descriptive_name
    FROM customer_client
    WHERE customer_client.manager = false
  `);

  // لكل حساب فرعي، بنجيب الكامبينز بتاعته + نتأكد أيهم فعلاً نشط في آخر
  // 10 أيام (عشان الافتراضي في الواجهة يبقى نظيف - لا داعي نوري كامبين
  // واقف من شهور ومحدش محتاجه، لكن مش بنخفيه نهائياً، بنعلّمه بس)
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10);

  const result = [];
  for (const acc of subAccounts) {
    const customerId = String(acc.customer_client?.id);
    const customer = client.Customer({
      customer_id: customerId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
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
        WHERE segments.date >= '${tenDaysAgoStr}'
      `),
    ]);

    const activeIds = new Set(
      recentActivity
        .filter((r: any) => Number(r.metrics?.impressions ?? 0) > 0)
        .map((r: any) => String(r.campaign?.id))
    );

    result.push({
      accountId: customerId,
      accountName: acc.customer_client?.descriptive_name,
      campaigns: campaigns.map((c: any) => ({
        id: String(c.campaign?.id),
        name: c.campaign?.name,
        status: c.campaign?.status,
        recentlyActive: activeIds.has(String(c.campaign?.id)),
      })),
    });
  }

  return NextResponse.json({ accounts: result });
}

async function getMetaCampaigns(userId: string) {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { userId_platform: { userId, platform: "META_ADS" } },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Meta Ads غير مربوط. اربطه الأول من إعدادات الحساب." },
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
