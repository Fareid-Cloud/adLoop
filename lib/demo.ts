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
import { seedDemoData, DEMO_SEED_VERSION } from "@/lib/demoSeed";

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
//
// 🔴 حُذف من هنا تعريفٌ كاملٌ ثانٍ للبذرة (`SeedCampaign` و`CAMPAIGNS`
// و`DAYS` و`wave` و`weekendFactor`) لم يكن يُستدعى من أيّ موضع - نسخةٌ
// ميّتة **بأرقام مختلفة** عن البذرة العاملة في `demoSeed.ts`، وبأسماء
// حملات عربية بقيت بعد نقل الديمو إلى الإنجليزية.
//
// وهو أخطر أنواع الكود الميّت: مَن يأتي ليصحّح أرقام الديمو يجدها هنا
// أوّلاً - في ملفٍّ اسمه `demo.ts` - فيعدّلها ولا يتغيّر شيء. البذرة
// الحقيقية الوحيدة في `lib/demoSeed.ts`.

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

export async function seedDemoWorkspace(
  userId: string,
  locale: "ar" | "en",
  /** عملة العرض. اختلافها عن المبذورة يُعيد البذر بأرقامٍ محوَّلة فعلاً. */
  currency = "SAR",
): Promise<string> {
  const existing = await prisma.workspace.findFirst({
    where: { userId, isDemo: true },
    select: { id: true, demoLocale: true, demoSeedVersion: true, demoCurrency: true },
  });

  if (existing) {
    // 🔴 مساحة بُذرت بلغة أخرى: أسماء الحملات والمنتجات والتنبيهات نصوص
    // مخزَّنة، وإعادة البذر فوقها لا تبدّلها لأنّها تتخطّى المكرّر. الحلّ
    // حذف المساحة كاملةً وإنشاؤها من جديد - وهو آمن هنا وحده لأنّ بياناتها
    // أمثلة مولَّدة لا شيء فيها للمستخدم. الحذف يجرّ كلّ صفوفها بالتتالي.
    if (
      (existing.demoLocale ?? "en") !== locale ||
      (existing.demoSeedVersion ?? 1) !== DEMO_SEED_VERSION ||
      // العملة كاللغة تماماً: الأرقام مخزَّنة لا محسوبة عند العرض، فتبديلُها
      // بلا إعادة بذرٍ يترك الأرقام كما هي ويبدّل لافتتها وحدها.
      (existing.demoCurrency ?? "SAR") !== currency
    ) {
      // `AttributionResult` تحمل `workspaceId` بلا علاقةٍ في المخطّط، فلا
      // يجرّها حذفُ المساحة بالتتالي - نفس ما يفعله مسار حذف الحساب.
      await prisma.attributionResult.deleteMany({ where: { workspaceId: existing.id } });
      await prisma.workspace.delete({ where: { id: existing.id } });
    } else {
      // البذر يتخطّى المكرّر، فإعادته على مساحة مكتملة لا تُضاعف شيئاً،
      // وعلى مساحة ناقصة تُكملها بدل تركها فارغة إلى الأبد.
      if (!(await isDemoPopulated(existing.id))) {
        await seedDemoData(existing.id, locale, currency);
      }
      return existing.id;
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEMO_DAYS);

  const workspace = await prisma.workspace.create({
    data: {
      userId,
      name: locale === "en" ? DEMO_WORKSPACE_NAME_EN : DEMO_WORKSPACE_NAME_AR,
      currency,
      isDemo: true,
      demoExpiresAt: expiresAt,
      demoLocale: locale,
      demoSeedVersion: DEMO_SEED_VERSION,
      demoCurrency: currency,
      profitMarginPct: 32,
    },
  });

  await seedDemoData(workspace.id, locale, currency);

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
