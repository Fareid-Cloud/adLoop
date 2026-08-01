// lib/demo.ts
//
// مساحة العمل التجريبية.
//
// **الخطر الوحيد الذي يستحقّ القلق هنا:** ضغطة داخل الديمو تُوقف إعلاناً
// حقيقياً. لذلك `assertNotDemo` تُستدعى في **نقطة اختناق واحدة** قبل أي
// أثر خارجي - لا متفرّقة في كل دالة، لأن واحدة تفوت تكفي.
//
// **البيانات ثابتة عمداً** (بذرة معروفة لا عشوائية): الفيديو التسويقي
// يجب أن يُظهر نفس الأرقام في كل تسجيل، والديمو يجب أن يحكي القصة نفسها
// لكل من يراه - قصّة فجوة، لا أرقاماً سليمة لا تعني شيئاً.

import { prisma } from "@/lib/prisma";
import { DEMO_DAYS } from "@/lib/entitlements";

export const DEMO_WORKSPACE_NAME_AR = "متجر النخبة — عرض تجريبي";
export const DEMO_WORKSPACE_NAME_EN = "Elite Store — Demo";

/**
 * يرفع خطأً إن كانت مساحة العمل تجريبية. يُستدعى قبل كل عملية لها أثر
 * خارج قاعدتنا: إيقاف إعلان، تعديل ميزانية، رفع تحويل، إرسال بريد.
 */
export async function assertNotDemo(workspaceId: string): Promise<void> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { isDemo: true },
  });
  if (ws?.isDemo) {
    throw new DemoWriteBlocked();
  }
}

export class DemoWriteBlocked extends Error {
  readonly isDemoBlock = true;
  constructor() {
    super("demo_write_blocked");
    this.name = "DemoWriteBlocked";
  }
}

export async function isDemoWorkspace(workspaceId: string): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { isDemo: true },
  });
  return ws?.isDemo ?? false;
}

// ==================== بذر البيانات ====================

interface SeedCampaign {
  id: string;
  name: string;
  platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";
  account: string;
  /** الإنفاق اليومي الأساسي - يتذبذب حوله بنمط ثابت لا عشوائي */
  baseCost: number;
  baseClicks: number;
  /** تحويلات المنصة المُعلَنة لكل يوم */
  baseRaw: number;
  /** نسبة ما يتحقّق فعلاً - هنا تعيش القصّة */
  verifyRate: number;
}

/**
 * القصّة: حملة جوجل البحثية تتحقّق ٨٥٪ (نيّة عالية)، وحملة ميتا للوعي
 * تتحقّق ٣١٪ فقط، وتيك توك ٢٢٪ - وهذه بالضبط الفجوة التي يبيعها المنتج.
 * حملة واحدة تصرف بصفر تحقّق: أوضح إشارة إهدار ممكنة.
 */
const CAMPAIGNS: SeedCampaign[] = [
  { id: "demo-g-search", name: "بحث — طلب عرض سعر", platform: "GOOGLE_ADS", account: "demo-google-1", baseCost: 640, baseClicks: 148, baseRaw: 21, verifyRate: 0.85 },
  { id: "demo-g-brand", name: "بحث — اسم العلامة", platform: "GOOGLE_ADS", account: "demo-google-1", baseCost: 180, baseClicks: 96, baseRaw: 14, verifyRate: 0.78 },
  { id: "demo-m-retarget", name: "ميتا — إعادة استهداف", platform: "META_ADS", account: "demo-meta-1", baseCost: 520, baseClicks: 310, baseRaw: 34, verifyRate: 0.44 },
  { id: "demo-m-awareness", name: "ميتا — وعي بالعلامة", platform: "META_ADS", account: "demo-meta-1", baseCost: 730, baseClicks: 690, baseRaw: 58, verifyRate: 0.31 },
  { id: "demo-t-video", name: "تيك توك — فيديو المنتج", platform: "TIKTOK_ADS", account: "demo-tiktok-1", baseCost: 410, baseClicks: 540, baseRaw: 46, verifyRate: 0.22 },
  { id: "demo-t-broad", name: "تيك توك — جمهور واسع", platform: "TIKTOK_ADS", account: "demo-tiktok-1", baseCost: 295, baseClicks: 380, baseRaw: 12, verifyRate: 0 },
];

const DAYS = 90;

/** تذبذب حتمي: نفس اليوم يعطي نفس الرقم دائماً، فالفيديو يعيد نفسه */
function wave(dayIndex: number, seed: number): number {
  const a = Math.sin((dayIndex + seed) * 0.7);
  const b = Math.sin((dayIndex + seed) * 0.23);
  return 1 + a * 0.18 + b * 0.11;
}

/** عطلة نهاية الأسبوع أهدأ - بلا هذا تبدو البيانات مصطنعة فوراً */
function weekendFactor(d: Date): number {
  const day = d.getDay();
  return day === 5 || day === 6 ? 0.72 : 1;
}

export async function seedDemoWorkspace(userId: string, locale: "ar" | "en"): Promise<string> {
  const existing = await prisma.workspace.findFirst({
    where: { userId, isDemo: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEMO_DAYS);

  const workspace = await prisma.workspace.create({
    data: {
      userId,
      name: locale === "en" ? DEMO_WORKSPACE_NAME_EN : DEMO_WORKSPACE_NAME_AR,
      currency: "SAR",
      isDemo: true,
      demoExpiresAt: expiresAt,
      profitMarginPct: 32,
    },
  });

  await prisma.campaignLink.createMany({
    data: CAMPAIGNS.map((c) => ({
      workspaceId: workspace.id,
      platform: c.platform,
      externalAccountId: c.account,
      externalCampaignId: c.id,
      campaignName: c.name,
    })),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: Array<Record<string, unknown>> = [];
  for (let i = DAYS; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const wf = weekendFactor(date);

    CAMPAIGNS.forEach((c, ci) => {
      const w = wave(i, ci * 3) * wf;
      const cost = Math.round(c.baseCost * w);
      const clicks = Math.round(c.baseClicks * w);
      const raw = Math.max(0, Math.round(c.baseRaw * w));
      const verified = Math.round(raw * c.verifyRate);

      rows.push({
        workspaceId: workspace.id,
        platform: c.platform,
        campaignId: c.id,
        date,
        impressions: clicks * 34,
        clicks,
        cost,
        rawConversions: raw,
        verifiedConversions: verified,
        // الإيراد للحملات التي تبيع فعلاً - حملة الوعي بلا إيراد مباشر
        revenue: verified > 0 ? Math.round(verified * 430 * (0.9 + (ci % 3) * 0.12)) : null,
        ordersCount: verified > 0 ? verified : null,
      });
    });
  }

  // نداء واحد لا ثلاثة: كل ذهاب وإياب إلى القاعدة عبر الـpooler يكلّف
  // مئات الميلي ثانية، و٥٤٠ صفّاً تمرّ في دفعة واحدة بلا مشكلة.
  await prisma.metricSnapshot.createMany({ data: rows as never, skipDuplicates: true });

  return workspace.id;
}

/** الديمو المنتهي يُقرأ ولا يُبذر من جديد - القراءة تبقى، والتجديد لا */
export async function isDemoExpired(workspaceId: string): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { isDemo: true, demoExpiresAt: true },
  });
  if (!ws?.isDemo) return false;
  return !!ws.demoExpiresAt && ws.demoExpiresAt < new Date();
}
