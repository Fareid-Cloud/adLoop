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
import { seedDemoData } from "@/lib/demoSeed";

// اسم واحد قصير في اللغتين: الاسم يظهر في مبدّل مساحات العمل وعنوان كل
// صفحة، و«متجر النخبة — عرض تجريبي» كان يُقصّ في الاثنين. الشريط العلوي
// يشرح ما هو الديمو أصلاً، فلا حاجة لأن يحمله الاسم أيضاً.
export const DEMO_WORKSPACE_NAME_AR = "DEMO";
export const DEMO_WORKSPACE_NAME_EN = "DEMO";

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
// **المدى مضغوط عمداً.** النسخة الأولى تركت الأحجام تتباعد بمقدار سبعة
// أضعاف (٩٦ نقرة مقابل ٦٩٠)، فعند رسمها على محور واحد تلتصق الحملات
// الصغيرة بقاع الرسم كخطّ مستقيم بينما تأخذ الكبيرة كل الارتفاع - فيبدو
// نصف الديمو ميّتاً وهو ليس كذلك.
//
// القصّة لا تعيش في الأحجام بل في `verifyRate`: جوجل تتحقّق ٨٥٪ وتيك توك
// ٢٢٪ وحملة كاملة بصفر. لذلك ضُغطت الأحجام إلى نحو الضعف بين الأصغر
// والأكبر، وبقي مدى التحقّق كما هو - الفجوة تظهر أوضح حين لا يشوّشها
// فارق حجم لا معنى له.
const CAMPAIGNS: SeedCampaign[] = [
  { id: "demo-g-search", name: "بحث — طلب عرض سعر", platform: "GOOGLE_ADS", account: "demo-google-1", baseCost: 610, baseClicks: 240, baseRaw: 34, verifyRate: 0.85 },
  { id: "demo-g-brand", name: "بحث — اسم العلامة", platform: "GOOGLE_ADS", account: "demo-google-1", baseCost: 395, baseClicks: 205, baseRaw: 28, verifyRate: 0.78 },
  { id: "demo-m-retarget", name: "ميتا — إعادة استهداف", platform: "META_ADS", account: "demo-meta-1", baseCost: 540, baseClicks: 300, baseRaw: 38, verifyRate: 0.44 },
  { id: "demo-m-awareness", name: "ميتا — وعي بالعلامة", platform: "META_ADS", account: "demo-meta-1", baseCost: 700, baseClicks: 415, baseRaw: 52, verifyRate: 0.31 },
  { id: "demo-t-video", name: "تيك توك — فيديو المنتج", platform: "TIKTOK_ADS", account: "demo-tiktok-1", baseCost: 480, baseClicks: 350, baseRaw: 42, verifyRate: 0.22 },
  { id: "demo-t-broad", name: "تيك توك — جمهور واسع", platform: "TIKTOK_ADS", account: "demo-tiktok-1", baseCost: 430, baseClicks: 285, baseRaw: 30, verifyRate: 0 },
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

/**
 * مساحة الديمو ليست جاهزة لمجرّد وجود صفّها. البذر يكتب عشرة جداول، وأي
 * انقطاع في منتصفه يترك مساحة موجودة وفارغة - وهذا بالضبط ما كان يحدث:
 * الصفّ يُنشأ، ثمّ يفشل البذر، ثمّ يعود كل دخول لاحق بالمساحة الفارغة
 * نفسها لأن الفحص كان على الوجود لا على المحتوى. الفحص هنا على المحتوى.
 */
async function isDemoPopulated(workspaceId: string): Promise<boolean> {
  const [snapshots, creatives, products] = await Promise.all([
    prisma.metricSnapshot.count({ where: { workspaceId } }),
    prisma.creativeSnapshot.count({ where: { workspaceId } }),
    prisma.product.count({ where: { workspaceId } }),
  ]);
  return snapshots > 0 && creatives > 0 && products > 0;
}

export async function seedDemoWorkspace(userId: string, locale: "ar" | "en"): Promise<string> {
  const existing = await prisma.workspace.findFirst({
    where: { userId, isDemo: true },
    select: { id: true },
  });

  if (existing) {
    // البذر يتخطّى المكرّر، فإعادته على مساحة مكتملة لا تُضاعف شيئاً،
    // وعلى مساحة ناقصة تُكملها بدل تركها فارغة إلى الأبد.
    if (!(await isDemoPopulated(existing.id))) {
      await seedDemoData(existing.id, locale);
    }
    return existing.id;
  }

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

  await seedDemoData(workspace.id, locale);

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

/**
 * ردّ موحَّد لمنع نداء الذكاء الاصطناعي في مساحة العرض التجريبية.
 *
 * أرقام العرض أمثلة، فتحليلها بنداء مدفوع يشتري رأياً في بيانات مخترعة
 * ويخصم من رصيد المشترك. يُعاد `null` حين يُسمح بالمتابعة، وإلّا استجابة
 * جاهزة تُعاد كما هي.
 *
 * **لماذا رسالة لا صمت:** الزرّ يبقى ظاهراً في العرض - فزرٌّ يُضغَط ولا
 * يردّ أسوأ من زرٍّ يقول سببه ويدلّ على الخطوة التالية.
 */
export async function blockAiInDemo(
  workspaceId: string,
  locale: "ar" | "en",
): Promise<Response | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { isDemo: true },
  });
  if (!ws?.isDemo) return null;

  return Response.json(
    {
      error:
        locale === "en"
          ? "AI analysis is disabled in the demo workspace — its figures are examples, not real data. Connect an ad account to run it on yours."
          : "تحليل الذكاء الاصطناعي معطَّل في مساحة العرض التجريبية - أرقامها أمثلة لا بيانات حقيقية. اربط حساب إعلانات لتشغيله على أرقامك.",
    },
    { status: 403 },
  );
}
