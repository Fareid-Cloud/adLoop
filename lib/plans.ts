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

export type PlanKey = "free" | "starter" | "pro" | "agency" | "enterprise";
export type BillingCurrency = "EGP" | "SAR" | "USD";
export type BillingCycle = "monthly" | "yearly";

export interface PlanLimits {
  workspaces: number;
  platforms: number | "all";
  /**
   * الحسابات الإعلانية **لكلّ منصّة** - لا مجموعها. الباقة الاحترافية
   * تعني ثلاثة حسابات جوجل وثلاثة ميتا وثلاثة تيك توك، لا ثلاثة موزّعة
   * عليها. وهو ما يفهمه المشترك من «ثلاثة حسابات» حين يقرأ الجدول.
   *
   * **يُعَدّ الحساب الإعلانيّ لا تسجيل الدخول.** منحة جوجل عبر حساب
   * إدارة (MCC) تصل إلى عشرات الحسابات بتوكن واحد، فلو كان العدّ على
   * تسجيلات الدخول لأخذ صاحب MCC عدداً بلا حدّ مجّاناً بينما يدفع
   * صاحب ميتا عن كلّ حساب - تسعيرٌ يعاقب على منصّةٍ لا على استعمال.
   */
  adAccounts: number;
  /** سقف الإنفاق المُدار شهرياً بالدولار - القيمة التي نحاسب عليها فعلاً */
  monthlySpendUsd: number;
  verifiedConversions: number;
  historyMonths: number;
  conversionSync: "none" | "one" | "all";
  automationRules: number;
  scaleKill: "view" | "apply";
  /**
   * قنوات البيع المربوطة - **لا تُعَدّ لأنّها تكلّف، بل لتؤطّر الاستعمال.**
   *
   * المتجر مستقبِل ويب هوك، وتكلفته تقارب الصفر: ما يكلّفنا فعلاً مزامنةُ
   * الحسابات الإعلانية ونداءات Claude، وكلاهما محدودٌ بحقله. وكان الحدّ
   * `1` على الباقة الأساسية يمنع استعمالاً مشروعاً تماماً - تاجرٌ واحد
   * يبيع على سلّة وشوبيفاي بنفس المنتجات ونفس الحملات.
   *
   * فالنسبة **قنواتان إلى ثلاث لكلّ مساحة عمل**، وهو النمط الحقيقيّ:
   * أغلب التجّار على قناةٍ أو اثنتين، وقليلٌ على ثلاث.
   */
  stores: number;
  aiCredits: number;
  deepScans: number;
  /** نموذج Claude لهذه الباقة. الباقات الأعلى على الأحدث - الفرق يظهر في
   *  عمق التحليل، وهو ما تدفع الباقة الأعلى من أجله. */
  aiModel: string;
  /**
   * مقاعد الاطّلاع - **مجّانية عمداً، ولا تُسعَّر أبداً.**
   *
   * غايتها أمنيّة لا تجارية: صاحبُ المتجر ومعه محاسبٌ سيُدخله بحسابه هو إن
   * لم يجد له مقعداً، فنخسر سجلَّ من فعل ماذا، والتحقّقَ بخطوتين للثاني،
   * والمقعدَ الذي رفضنا بيعه ثمّ استُعمل مجّاناً. **ووضعُ ثمنٍ عليه يعيد
   * السلوكَ نفسَه** - يشارك كلمةَ المرور ليوفّر الرسم، فندفع ثمن البناء
   * ونكسب صفراً.
   */
  seatsViewer: number;
  /**
   * مقاعد التنفيذ - تُباع.
   *
   * قيمتُها تشغيلية لا أمنيّة: من ينفّذ قرارات الأتمتة ويربط الحسابات
   * يمثّل عملاً حقيقياً يحتمل ثمناً، بخلاف من يقرأ فحسب.
   */
  seatsOperator: number;
  savedViews: number;
  scheduledReports: boolean;
  /**
   * ربطُ ذكاءِ المشترك الخاصّ بـMCP.
   *
   * **منطقُه معكوسٌ عن كلّ حدٍّ آخر هنا:** بقيّةُ الحدود تُقنِّن ما يكلّفنا،
   * وهذا **يوفّر** - المشترك يحلّل برصيده هو لا برصيدنا. فحصرُه في
   * الباقات العليا يعاقبنا قبله. ويبقى خارج المجّانية وحدها، وإلّا صار
   * الطريق: حسابٌ مجّانيّ + اشتراك ذكاءٍ شخصيّ = المنتج كاملاً بلا دفع.
   */
  mcp: boolean;
}

export interface Plan {
  key: PlanKey;
  /** الترتيب في صفحة الباقات - الأصغر أوّلاً */
  order: number;
  /** الباقة المُبرَزة: الأكثر ملاءمة لأغلب العملاء، لا الأغلى */
  highlighted: boolean;
  price: Record<BillingCurrency, number>;
  /**
   * السعر الأساسي - **ما يُدفع حين ينتهي عرض الإطلاق**.
   *
   * 🔴 ليس رقماً تسويقياً مخترعاً: لو لم يكن هذا هو السعر الذي ستتقاضاه
   * فعلاً بعد العرض، فعرضُه مشطوباً **سعرٌ مرجعيّ كاذب** - وهي ممارسةٌ
   * مضلِّلة يحظرها قانون حماية المستهلك صراحةً. المفتاح في اللوحة يرفع
   * السعر إلى هذا الرقم فعلياً، فيبقى الادّعاء صحيحاً.
   */
  listPrice: Record<BillingCurrency, number>;
  limits: PlanLimits;
  /**
   * باقةٌ لا تُشترى بضغطة بل باتّفاق - يُعرض «تواصل معنا» مكان السعر.
   *
   * **وسعرها صفر في الجدول، فمنعُها في مسار الدفع شرطٌ لا تحسين:** بغيره
   * يكفي أن يبعث أحدٌ اسمها إلى `/api/billing/checkout` ليأخذ اشتراكاً
   * بلا حدود بلا مقابل.
   */
  contactOnly?: boolean;
}

/** الشهران المجّانيان في الاشتراك السنوي - الخصم الدائم الوحيد */
export const YEARLY_MONTHS_CHARGED = 10;

export const PLANS: Plan[] = [
  {
    key: "free",
    order: 0,
    highlighted: false,
    price: { EGP: 0, SAR: 0, USD: 0 },
    listPrice: { EGP: 0, SAR: 0, USD: 0 },
    limits: {
      seatsViewer: 0, seatsOperator: 0,
      workspaces: 1, platforms: 1, adAccounts: 1, monthlySpendUsd: 2_000, verifiedConversions: 200,
      historyMonths: 1, conversionSync: "none", automationRules: 0, scaleKill: "view",
      stores: 1, aiCredits: 0, deepScans: 0, aiModel: "claude-sonnet-4-6", savedViews: 1, scheduledReports: false, mcp: false,
    },
  },
  {
    key: "starter",
    order: 1,
    highlighted: false,
    price: { EGP: 899, SAR: 189, USD: 49 },
    listPrice: { EGP: 1_199, SAR: 249, USD: 69 },
    limits: {
      // 🔴 **البداية بلا فريق - صفر لا واحد.**
      // كانت `seatsViewer: 1`، فمشترك البداية يقدر يدعو زميلاً بينما
      // الباقة مصمَّمة لشخصٍ واحد. الجدول كان يقول «مقعد اطلاع واحد»
      // ويعطيه فعلاً - فالوعدُ صحيح والتصميمُ غلط، وهي أسوأ الحالتين:
      // ميزةٌ تُمنَح بلا قصد تُلغي سببَ الترقية للاحترافية.
      // **الفريق يبدأ من الاحترافية.**
      seatsViewer: 0, seatsOperator: 0,
      workspaces: 1, platforms: "all", adAccounts: 1, monthlySpendUsd: 15_000, verifiedConversions: 2_000,
      historyMonths: 12, conversionSync: "one", automationRules: 3, scaleKill: "apply",
      stores: 2, aiCredits: 50, deepScans: 0, aiModel: "claude-sonnet-4-6", savedViews: 5, scheduledReports: true, mcp: true,
    },
  },
  {
    key: "pro",
    order: 2,
    // المُبرَزة: تغطّي أغلب المعلنين الجادّين، وإبرازها يرفع متوسّط
    // قيمة الاشتراك أكثر من إبراز الأغلى الذي يبدو بعيداً فيُتجاهَل.
    highlighted: true,
    price: { EGP: 2_499, SAR: 559, USD: 149 },
    listPrice: { EGP: 3_299, SAR: 749, USD: 199 },
    limits: {
      seatsViewer: 3, seatsOperator: 0,
      workspaces: 3, platforms: "all", adAccounts: 3, monthlySpendUsd: 60_000, verifiedConversions: 10_000,
      historyMonths: 24, conversionSync: "all", automationRules: 15, scaleKill: "apply",
      stores: 9, aiCredits: 200, deepScans: 5, aiModel: "claude-sonnet-5", savedViews: -1, scheduledReports: true, mcp: true,
    },
  },
  {
    key: "agency",
    order: 3,
    highlighted: false,
    price: { EGP: 6_999, SAR: 1_499, USD: 399 },
    listPrice: { EGP: 9_299, SAR: 1_999, USD: 549 },
    limits: {
      seatsViewer: 10, seatsOperator: 3,
      workspaces: 15, platforms: "all", adAccounts: 15, monthlySpendUsd: 250_000, verifiedConversions: 50_000,
      historyMonths: 24, conversionSync: "all", automationRules: -1, scaleKill: "apply",
      stores: 30, aiCredits: 600, deepScans: 20, aiModel: "claude-sonnet-5", savedViews: -1, scheduledReports: true, mcp: true,
    },
  },
  {
    // 🔴 **الفجوة التي سدّتها هذه الباقة:** كان الجدول ينتهي عند خمس عشرة
    // مساحة عمل وخمسة عشر حساباً لكلّ منصّة. فوكالةٌ بخمسين عميلاً - وهي
    // أكبر عميل محتمَل لا أندره - كانت تُمنع عند ربط الحملات، ويُحسب لها
    // اقتراحُ ترقيةٍ **غير موجودة** فيعود فارغاً: رسالةٌ تقول «رقِّ باقتك»
    // ولا شيء فوقها. طريقٌ مسدود عند لحظة الشراء بالضبط.
    //
    // ولا سعر لها في الجدول لأنّ حجم كهذا يُسعَّر بالاتّفاق: عدد الحسابات
    // والمساحات ورصيد التحليل تُضبط لكلّ عميل في `User.planLimitOverrides`
    // بعد المكالمة. والحدود هنا سقفُ ما يمنحه المنتج، لا ما يُمنح تلقائياً.
    key: "enterprise",
    order: 4,
    highlighted: false,
    contactOnly: true,
    // صفران: السعر بالاتّفاق، والبطاقة تعرض «السعر عند الطلب» لا رقماً.
    price: { EGP: 0, SAR: 0, USD: 0 },
    listPrice: { EGP: 0, SAR: 0, USD: 0 },
    limits: {
      seatsViewer: -1, seatsOperator: -1,
      workspaces: -1, platforms: "all", adAccounts: -1, monthlySpendUsd: -1, verifiedConversions: -1,
      historyMonths: 24, conversionSync: "all", automationRules: -1, scaleKill: "apply",
      // **ليست بلا حدّ**: كلّ تحليلٍ نداءٌ مدفوع إلى Claude، وسقفٌ مفتوح
      // هنا سقفٌ مفتوح على فاتورتنا نحن. الرقم يُرفع بالاتّفاق لا بالجدول.
      stores: -1, aiCredits: 2_000, deepScans: 50, aiModel: "claude-sonnet-5",
      savedViews: -1, scheduledReports: true, mcp: true,
    },
  },
];

export const PLAN_BY_KEY = new Map(PLANS.map((p) => [p.key, p]));

/**
 * مستوى الموديل كما يُعرض للعميل، لا اسمه.
 *
 * أسماء Anthropic الداخلية (`claude-sonnet-4-6`) لا تعني للمشتري شيئاً،
 * وتتغيّر مع كلّ ترقية - فجدولٌ يعرضها يصير قديماً بلا أن يلمسه أحد.
 * المستوى ثابت: أساسيّ ومتقدّم.
 */
export function aiModelTier(model: string): "aiStandard" | "aiAdvanced" {
  return model === "claude-sonnet-4-6" ? "aiStandard" : "aiAdvanced";
}

/** الصفوف المعروضة في جدول المقارنة، بترتيب الأهمّية لا بترتيب الحقول */
export const COMPARISON_ROWS: Array<{ key: keyof PlanLimits; kind: "number" | "text" | "bool" | "model" }> = [
  { key: "workspaces", kind: "number" },
  { key: "platforms", kind: "text" },
  { key: "adAccounts", kind: "number" },
  { key: "monthlySpendUsd", kind: "number" },
  { key: "verifiedConversions", kind: "number" },
  { key: "conversionSync", kind: "text" },
  { key: "scaleKill", kind: "text" },
  { key: "automationRules", kind: "number" },
  { key: "aiCredits", kind: "number" },
  { key: "deepScans", kind: "number" },
  { key: "stores", kind: "number" },
  { key: "historyMonths", kind: "number" },
  // 🔴 **موديل الذكاء كان فرقاً بين الباقات لا يراه المشتري.**
  // الحقل موجود منذ البداية ويفرّق فعلاً (الأساس مقابل الأحدث من
  // الاحترافية فوق)، وكان خارج جدول المقارنة تماماً - أي أنّنا نفرّق في
  // شيء ندفع فيه فرقاً ولا نُحسَب عليه في قرار الشراء. عرضُه أصدق من
  // حذفه: الفرق حقيقيّ ومطبَّق في الكود بعد إصلاح الفحص العميق.
  { key: "aiModel", kind: "model" },
  { key: "seatsViewer", kind: "number" },
  { key: "seatsOperator", kind: "number" },
  { key: "savedViews", kind: "number" },
  { key: "scheduledReports", kind: "bool" },
  { key: "mcp", kind: "bool" },
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

/**
 * السعر المعروض والمُحصَّل - **الاثنان واحد دائماً**.
 *
 * `offerActive` يأتي من مفتاح `pricing.launchOffer` في اللوحة ويُمرَّر من
 * الخادم. حين يُطفأ، يصير السعر الأساسي هو السعر - في البطاقة وفي
 * الفاتورة معاً، لأنّ الدالّة واحدة. وفصلُهما كان سيسمح بشاشةٍ تعرض رقماً
 * وبوابةٍ تخصم غيره، وهو أسوأ عطلٍ ممكن في صفحة دفع.
 */
export function planPrice(
  plan: Plan,
  currency: BillingCurrency,
  cycle: BillingCycle,
  offerActive = true
): number {
  const monthly = offerActive ? plan.price[currency] : plan.listPrice[currency];
  return cycle === "yearly" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** السعر الأساسي مشطوباً في البطاقة - يُعرض حين يكون العرض قائماً فقط. */
export function planListPrice(plan: Plan, currency: BillingCurrency, cycle: BillingCycle): number {
  const monthly = plan.listPrice[currency];
  return cycle === "yearly" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** نسبة الخصم الفعلية محسوبةً من الرقمين، لا مكتوبةً بيد - رقمٌ مكتوبٌ
 *  بيد يفترق عن الحساب أوّل ما يتغيّر سعرٌ واحد. */
export function offerDiscountPct(plan: Plan, currency: BillingCurrency): number {
  const list = plan.listPrice[currency];
  const now = plan.price[currency];
  if (!list || list <= now) return 0;
  return Math.round(((list - now) / list) * 100);
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
