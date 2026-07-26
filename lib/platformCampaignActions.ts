// lib/platformCampaignActions.ts
//
// تنفيذ حقيقي على مستوى الحملة للمنصات الثلاث: إيقاف الحملة، وتغيير
// الميزانية اليومية بنسبة.
//
// السياق: محرّك الأتمتة كان يقيّم القواعد على بيانات حقيقية ثم يدفع
// **اقتراحاً نصياً فقط** - لا نداء واحد لأي منصة. حتى الضغط على "موافق"
// لم يكن ينفّذ شيئاً لأن الاقتراح لم يكن يحمل actionType أصلاً. هذا الملف
// يسدّ الفجوة على مستوى الحملة (إيقاف الإعلان الفردي كان مبنياً سابقاً).
//
// كل الدوال تستخدم نفس نمط المصادقة المستخدم في دوال القراءة، بما فيه
// login_customer_id لحسابات الوكالة (MCC) - إغفاله يُفشل كل حساب تحت وكالة.

import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";

const META_API_VERSION = "v25.0";
const TIKTOK_API_VERSION = "v1.3";

async function getConnection(workspaceId: string, platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS") {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find((c: any) => c.platform === platform);
  if (!connection) throw new Error(`حساب ${platform} غير متصل`);
  return connection;
}

async function getLink(workspaceId: string, platform: string, campaignId: string) {
  const link = await prisma.campaignLink.findFirst({
    where: { workspaceId, platform: platform as any, externalCampaignId: campaignId },
  });
  if (!link) throw new Error("الحملة غير مرتبطة بمساحة العمل");
  return link;
}

function googleClient() {
  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

async function googleCustomer(workspaceId: string, campaignId: string) {
  const connection = await getConnection(workspaceId, "GOOGLE_ADS");
  const link = await getLink(workspaceId, "GOOGLE_ADS", campaignId);
  const customer = googleClient().Customer({
    customer_id: link.externalAccountId,
    // الوكالة اختيارية: حساب مباشر بلا MCC لا يملك managerAccountId
    ...(connection.managerAccountId ? { login_customer_id: connection.managerAccountId } : {}),
    refresh_token: decryptToken(connection.refreshToken!),
  });
  return { customer, link };
}

// ==================== إيقاف الحملة ====================

export async function pauseGoogleCampaign(workspaceId: string, campaignId: string) {
  const { ResourceNames } = await import("google-ads-api");
  const { customer, link } = await googleCustomer(workspaceId, campaignId);

  await customer.mutateResources([{
    entity: "campaign",
    operation: "update",
    // صيغة اسم المصدر مؤكدة من توثيق المكتبة: customers/{id}/campaigns/{campaignId}
    resource: { resource_name: ResourceNames.campaign(link.externalAccountId, campaignId), status: "PAUSED" },
  }]);
}

export async function pauseMetaCampaign(workspaceId: string, campaignId: string) {
  const connection = await getConnection(workspaceId, "META_ADS");
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PAUSED", access_token: decryptToken(connection.accessToken) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? "تعذّر إيقاف حملة ميتا");
  }
}

export async function pauseTikTokCampaign(workspaceId: string, campaignId: string) {
  const connection = await getConnection(workspaceId, "TIKTOK_ADS");
  const link = await getLink(workspaceId, "TIKTOK_ADS", campaignId);

  const res = await fetch(`https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/campaign/status/update/`, {
    method: "POST",
    headers: { "Access-Token": decryptToken(connection.accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      advertiser_id: link.externalAccountId,
      campaign_ids: [campaignId],
      operation_status: "DISABLE",
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message ?? "تعذّر إيقاف حملة تيك توك");
}

// ==================== تغيير الميزانية بنسبة ====================
//
// نقرأ الميزانية الحالية من المنصة نفسها (لا من نسخة مخزّنة) لأن المستخدم
// قد يكون غيّرها يدوياً - البناء على رقم قديم يعني كتابة قيمة خاطئة.

export async function changeGoogleCampaignBudget(workspaceId: string, campaignId: string, pct: number) {
  const { customer, link } = await googleCustomer(workspaceId, campaignId);

  const rows = await customer.query(`
    SELECT campaign.id, campaign_budget.resource_name, campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id = ${campaignId}
    LIMIT 1
  `);
  const row: any = rows[0];
  const budgetResource = row?.campaign_budget?.resource_name;
  const current = Number(row?.campaign_budget?.amount_micros ?? 0);
  if (!budgetResource || current <= 0) throw new Error("تعذّر قراءة ميزانية الحملة الحالية");

  const next = Math.max(1, Math.round(current * (1 + pct / 100)));

  await customer.mutateResources([{
    entity: "campaign_budget",
    operation: "update",
    resource: { resource_name: budgetResource, amount_micros: next },
  }]);

  return { previous: current / 1_000_000, next: next / 1_000_000 };
}

export async function changeMetaCampaignBudget(workspaceId: string, campaignId: string, pct: number) {
  const connection = await getConnection(workspaceId, "META_ADS");
  const token = decryptToken(connection.accessToken);

  const readRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${campaignId}?fields=daily_budget,lifetime_budget&access_token=${token}`
  );
  const info = await readRes.json();
  if (!readRes.ok) throw new Error(info.error?.message ?? "تعذّر قراءة ميزانية حملة ميتا");

  // ميتا تعيد المبالغ بأصغر وحدة للعملة (قروش/هللات)
  const isDaily = !!info.daily_budget;
  const current = Number(info.daily_budget ?? info.lifetime_budget ?? 0);
  if (current <= 0) {
    // الميزانية مضبوطة على مستوى المجموعة الإعلانية لا الحملة (ABO)
    throw new Error("ميزانية هذه الحملة مضبوطة على مستوى المجموعة الإعلانية - غيّرها من هناك");
  }

  const next = Math.max(1, Math.round(current * (1 + pct / 100)));
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [isDaily ? "daily_budget" : "lifetime_budget"]: next, access_token: token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? "تعذّر تعديل ميزانية حملة ميتا");
  }

  return { previous: current / 100, next: next / 100 };
}

export async function changeTikTokCampaignBudget(workspaceId: string, campaignId: string, pct: number) {
  const connection = await getConnection(workspaceId, "TIKTOK_ADS");
  const link = await getLink(workspaceId, "TIKTOK_ADS", campaignId);
  const token = decryptToken(connection.accessToken);

  const readRes = await fetch(
    `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/campaign/get/` +
      `?advertiser_id=${link.externalAccountId}&filtering=${encodeURIComponent(JSON.stringify({ campaign_ids: [campaignId] }))}`,
    { headers: { "Access-Token": token, "Content-Type": "application/json" } }
  );
  const info = await readRes.json();
  if (info.code !== 0) throw new Error(info.message ?? "تعذّر قراءة ميزانية حملة تيك توك");

  const current = Number(info.data?.list?.[0]?.budget ?? 0);
  if (current <= 0) throw new Error("تعذّر قراءة ميزانية الحملة الحالية");

  const next = Math.max(1, Math.round(current * (1 + pct / 100) * 100) / 100);
  const res = await fetch(`https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/campaign/update/`, {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ advertiser_id: link.externalAccountId, campaign_id: campaignId, budget: next }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message ?? "تعذّر تعديل ميزانية حملة تيك توك");

  return { previous: current, next };
}

// ==================== موجّه موحّد ====================

export async function pauseCampaignOnPlatform(workspaceId: string, platform: string, campaignId: string) {
  switch (platform) {
    case "GOOGLE_ADS": return pauseGoogleCampaign(workspaceId, campaignId);
    case "META_ADS": return pauseMetaCampaign(workspaceId, campaignId);
    case "TIKTOK_ADS": return pauseTikTokCampaign(workspaceId, campaignId);
    default: throw new Error(`إيقاف الحملة غير مدعوم للمنصة ${platform}`);
  }
}

export async function changeCampaignBudgetOnPlatform(
  workspaceId: string, platform: string, campaignId: string, pct: number
) {
  switch (platform) {
    case "GOOGLE_ADS": return changeGoogleCampaignBudget(workspaceId, campaignId, pct);
    case "META_ADS": return changeMetaCampaignBudget(workspaceId, campaignId, pct);
    case "TIKTOK_ADS": return changeTikTokCampaignBudget(workspaceId, campaignId, pct);
    default: throw new Error(`تعديل الميزانية غير مدعوم للمنصة ${platform}`);
  }
}
