// lib/plans.ts
//
// كتالوج الباقات - **بيانات ثابتة فقط، صفر استيراد**، حتى يُستورد في
// مكوّنات المتصفّح دون جرّ Prisma معه.
//
// **الأسعار في الكود لا في متغيّرات البيئة.** النسخة السابقة كانت تقرأ
// `PLAN_PRICE_STARTER_CENTS` من البيئة، فمتغيّر ناقص = سعر صفر = اشتراك
// مجاني صامت. السعر جزء من المنتج لا من إعداد الخادم.
//
// **سعران منفصلان: مصر والخليج/الدولي.** تسعير حسب القوة الشرائية ممارسة
// قياسية لا تنازل - سعر دولاري واحد يقصي السوق المصري كلّه.

export type PlanKey = "free" | "starter" | "pro" | "agency";
export type BillingCurrency = "EGP" | "SAR" | "USD";
export type BillingCycle = "monthly" | "yearly";

export interface PlanLimits {
  workspaces: number;
  platforms: number | "all";
  /** سقف الإنفاق المُدار شهرياً بالدولار - القيمة التي نحاسب عليها فعلاً */
  monthlySpendUsd: number;
  verifiedConversions: number;
  historyMonths: number;
  conversionSync: "none" | "one" | "all";
  automationRules: number;
  scaleKill: "view" | "apply";
  stores: number;
  aiCredits: number;
  deepScans: number;
  /** نموذج Claude لهذه الباقة. الباقات الأعلى على الأحدث - الفرق يظهر في
   *  عمق التحليل، وهو ما تدفع الباقة الأعلى من أجله. */
  aiModel: string;
  savedViews: number;
  scheduledReports: boolean;
}

export interface Plan {
  key: PlanKey;
  /** الترتيب في صفحة الباقات - الأصغر أوّلاً */
  order: number;
  /** الباقة المُبرَزة: الأكثر ملاءمة لأغلب العملاء، لا الأغلى */
  highlighted: boolean;
  price: Record<BillingCurrency, number>;
  limits: PlanLimits;
}

/** الشهران المجّانيان في الاشتراك السنوي - الخصم الدائم الوحيد */
export const YEARLY_MONTHS_CHARGED = 10;

export const PLANS: Plan[] = [
  {
    key: "free",
    order: 0,
    highlighted: false,
    price: { EGP: 0, SAR: 0, USD: 0 },
    limits: {
      workspaces: 1, platforms: 1, monthlySpendUsd: 2_000, verifiedConversions: 200,
      historyMonths: 1, conversionSync: "none", automationRules: 0, scaleKill: "view",
      stores: 0, aiCredits: 0, deepScans: 0, aiModel: "claude-sonnet-4-6", savedViews: 1, scheduledReports: false,
    },
  },
  {
    key: "starter",
    order: 1,
    highlighted: false,
    price: { EGP: 899, SAR: 189, USD: 49 },
    limits: {
      workspaces: 1, platforms: "all", monthlySpendUsd: 15_000, verifiedConversions: 2_000,
      historyMonths: 12, conversionSync: "one", automationRules: 3, scaleKill: "apply",
      stores: 1, aiCredits: 50, deepScans: 0, aiModel: "claude-sonnet-4-6", savedViews: 5, scheduledReports: true,
    },
  },
  {
    key: "pro",
    order: 2,
    // المُبرَزة: تغطّي أغلب المعلنين الجادّين، وإبرازها يرفع متوسّط
    // قيمة الاشتراك أكثر من إبراز الأغلى الذي يبدو بعيداً فيُتجاهَل.
    highlighted: true,
    price: { EGP: 2_499, SAR: 559, USD: 149 },
    limits: {
      workspaces: 3, platforms: "all", monthlySpendUsd: 60_000, verifiedConversions: 10_000,
      historyMonths: 24, conversionSync: "all", automationRules: 15, scaleKill: "apply",
      stores: 3, aiCredits: 200, deepScans: 5, aiModel: "claude-sonnet-5", savedViews: -1, scheduledReports: true,
    },
  },
  {
    key: "agency",
    order: 3,
    highlighted: false,
    price: { EGP: 6_999, SAR: 1_499, USD: 399 },
    limits: {
      workspaces: 15, platforms: "all", monthlySpendUsd: 250_000, verifiedConversions: 50_000,
      historyMonths: 24, conversionSync: "all", automationRules: -1, scaleKill: "apply",
      stores: 15, aiCredits: 600, deepScans: 20, aiModel: "claude-sonnet-5", savedViews: -1, scheduledReports: true,
    },
  },
];

export const PLAN_BY_KEY = new Map(PLANS.map((p) => [p.key, p]));

/** الصفوف المعروضة في جدول المقارنة، بترتيب الأهمّية لا بترتيب الحقول */
export const COMPARISON_ROWS: Array<{ key: keyof PlanLimits; kind: "number" | "text" | "bool" }> = [
  { key: "workspaces", kind: "number" },
  { key: "platforms", kind: "text" },
  { key: "monthlySpendUsd", kind: "number" },
  { key: "verifiedConversions", kind: "number" },
  { key: "conversionSync", kind: "text" },
  { key: "scaleKill", kind: "text" },
  { key: "automationRules", kind: "number" },
  { key: "aiCredits", kind: "number" },
  { key: "deepScans", kind: "number" },
  { key: "stores", kind: "number" },
  { key: "historyMonths", kind: "number" },
  { key: "savedViews", kind: "number" },
  { key: "scheduledReports", kind: "bool" },
];

// ==================== كريدت الذكاء الاصطناعي ====================

export interface CreditPack {
  credits: number;
  price: Record<BillingCurrency, number>;
}

/**
 * هامش ثلاثة أضعاف لا ستّة. الكريدت ليس مركز ربح بل مزيل احتكاك: من
 * يبلغ السقف هو أكثر عملائك تفاعلاً، ومحاسبته ستّة أضعاف عقاب على
 * التفاعل. كريدت أرخص ← استخدام أكثر ← بقاء أطول ← قيمة عمر أعلى.
 */
export const CREDIT_PACKS: CreditPack[] = [
  { credits: 100, price: { EGP: 299, SAR: 22, USD: 6 } },
  { credits: 500, price: { EGP: 1_399, SAR: 101, USD: 27 } },
  { credits: 2_000, price: { EGP: 4_999, SAR: 371, USD: 99 } },
];

/** الحدّ الأدنى للشراء المخصّص - أقلّ منه رسوم البوّابة تلتهم المبلغ */
export const MIN_CUSTOM_CREDITS = 50;
export const MAX_CUSTOM_CREDITS = 10_000;

/**
 * سعر الكريدت الواحد عند الشراء المخصّص - يتبع أكبر باقة يبلغها العدد،
 * فالشراء الأكبر أرخص للوحدة دون جدول أسعار منفصل.
 */
export function creditUnitPrice(credits: number, currency: BillingCurrency): number {
  const tier = [...CREDIT_PACKS].reverse().find((p) => credits >= p.credits) ?? CREDIT_PACKS[0];
  return tier.price[currency] / tier.credits;
}

export function priceForCredits(credits: number, currency: BillingCurrency): number {
  const raw = creditUnitPrice(credits, currency) * credits;
  // التقريب لأعلى إلى وحدة كاملة: كسور العملة في صفحة دفع تبدو خطأً
  return Math.ceil(raw);
}

// ==================== العملة والدورة ====================

/** عملة الفوترة من سوق مساحة العمل - لا نعرض دولاراً لمن يدفع بالجنيه */
export function billingCurrencyFor(workspaceCurrency: string): BillingCurrency {
  if (workspaceCurrency === "EGP") return "EGP";
  if (workspaceCurrency === "SAR") return "SAR";
  return "USD";
}

export function planPrice(plan: Plan, currency: BillingCurrency, cycle: BillingCycle): number {
  const monthly = plan.price[currency];
  return cycle === "yearly" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** ما يُقارَن به السعر السنوي في الواجهة - قيمة الخصم لا نسبته المجرّدة */
export function yearlySaving(plan: Plan, currency: BillingCurrency): number {
  return plan.price[currency] * (12 - YEARLY_MONTHS_CHARGED);
}

/**
 * نموذج Claude الذي تستحقّه باقة هذا المستخدم.
 *
 * الباقات الأعلى على النموذج الأحدث: الفرق يظهر في عمق التحليل، وهو جزء
 * ممّا تدفع الباقة الأعلى ثمنه. والباقة المجهولة تقع على الأدنى لا الأعلى -
 * خطأ القراءة يجب أن يكلّف أقلّ، لا أن يمنح ما لم يُدفع فيه.
 */
export async function planModelFor(userId: string): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionPlan: true },
  });
  const plan = PLAN_BY_KEY.get((user?.subscriptionPlan as PlanKey) ?? "starter");
  return plan?.limits.aiModel ?? "claude-sonnet-4-6";
}
