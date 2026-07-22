// lib/ecommerceMetrics.ts
//
// نفس فلسفة "Truth Layer" اللي بنينا بيها الـ leads، لكن للإيكومرس:
// مش "الإيراد الظاهري"، لكن "الربح الحقيقي" بعد خصم كل التكاليف الفعلية،
// بما فيها المرتجعات (RTO) اللي بتاكل هامش الربح بصمت في السوق العربي.

import { t, Locale } from "@/lib/i18n/dictionary";

export interface RawEcommerceMetrics {
  platform: string;
  cost: number;              // تكلفة الإعلان
  ordersCount: number;
  revenue: number;           // إجمالي قيمة الطلبات (قبل أي خصومات)
  cogs: number;               // تكلفة المنتجات المباعة
  shippingCost: number;
  returnedOrdersCount: number;
}

export interface ComputedEcommerceMetrics extends RawEcommerceMetrics {
  cpa: number;                 // Cost Per Order (تكلفة الطلب الواحد، بغض النظر عن نتيجته)
  rtoRate: number;             // % الطلبات المرتجعة من إجمالي الطلبات
  grossProfit: number;         // الربح قبل خصم الإعلانات = Revenue - COGS - Shipping - قيمة المرتجعات
  netProfitAfterAds: number;   // الربح الحقيقي بعد خصم تكلفة الإعلان نفسها
  trueRoas: number;            // netProfitAfterAds / cost (المقياس الحقيقي، مش revenue/cost الساذج)
  displacedRoas: number;       // revenue / cost - الرقم "الوهمي" اللي أغلب لوحات التحكم بتوريه
}

export function computeEcommerceMetrics(
  raw: RawEcommerceMetrics
): ComputedEcommerceMetrics {
  const cpa = raw.ordersCount > 0 ? round2(raw.cost / raw.ordersCount) : 0;

  const rtoRate =
    raw.ordersCount > 0
      ? round2((raw.returnedOrdersCount / raw.ordersCount) * 100)
      : 0;

  // متوسط قيمة الطلب - بنستخدمه نقدر بيه خسارة المرتجعات
  const avgOrderValue = raw.ordersCount > 0 ? raw.revenue / raw.ordersCount : 0;
  const returnedValueLoss = raw.returnedOrdersCount * avgOrderValue;

  const grossProfit = round2(
    raw.revenue - raw.cogs - raw.shippingCost - returnedValueLoss
  );

  const netProfitAfterAds = round2(grossProfit - raw.cost);

  const trueRoas = raw.cost > 0 ? round2((grossProfit) / raw.cost) : 0;
  const displacedRoas = raw.cost > 0 ? round2(raw.revenue / raw.cost) : 0;

  return {
    ...raw,
    cpa,
    rtoRate,
    grossProfit,
    netProfitAfterAds,
    trueRoas,
    displacedRoas,
  };
}

// أهم دالة في الملف - بتوضح "الفجوة" بين الرقم اللي هيفرح بيه ميديا باير مبتدئ
// (displacedRoas) والرقم اللي فعلاً بيقول له يستمر ولا يوقف الكامبين (trueRoas)
export function explainRoasGap(
  m: ComputedEcommerceMetrics,
  locale: Locale = "ar"
): string {
  if (m.displacedRoas <= 0) return t(locale, "insights.noData");

  const gapPct = round2(
    ((m.displacedRoas - m.trueRoas) / m.displacedRoas) * 100
  );

  if (gapPct < 15) {
    return t(locale, "insights.roasGapSmall", { pct: gapPct });
  }

  return t(locale, "insights.roasGapWarning", {
    displaced: m.displacedRoas,
    pct: gapPct,
    trueRoas: m.trueRoas,
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== تشخيص تفريقي: ليه الهامش سالب؟ ====================
// مش قفزة مباشرة لـ "السعر غلط" - بيفحص 5 احتمالات أول، وبيرجع للسعر
// كاحتمال أخير لأنه أسهلهم حساباً (معادلة مباشرة) بس مش بالضرورة أرجحهم.

export type MarginIssueCause =
  | "RETURNS"           // مرتجعات أعلى من المعتاد لهذا المنتج تحديداً
  | "STALE_COGS"         // تكلفة المنتج المسجّلة قديمة/غير محدّثة
  | "SHIPPING_OUTLIER"   // تكلفة شحن هذا المنتج أعلى من المتوسط
  | "DISCOUNT_CODES"     // نسبة كبيرة من المبيعات بكود خصم غير محتسب
  | "MISSING_GATEWAY_FEE" // عمولة بوابة الدفع غير مدرجة في معادلة الهامش
  | "PRICING";            // بعد استبعاد كل ما سبق - السعر فعلاً قريب من التكلفة

export interface MarginDiagnosisInput {
  productRtoRate: number;      // % مرتجعات هذا المنتج
  avgRtoRateAllProducts: number; // % مرتجعات متوسط باقي المنتجات (خط أساس للمقارنة)
  cogsLastUpdatedDaysAgo: number | null; // null = لم يُحدَّث مطلقاً
  discountedOrdersPct: number;   // % الطلبات التي استخدمت كود خصم
  gatewayFeeIncludedInMargin: boolean; // هل معادلة الهامش تخصم عمولة الدفع فعلاً؟
  productShippingCost: number;
  avgShippingCostAllProducts: number;
}

export interface MarginDiagnosisResult {
  primaryCause: MarginIssueCause;
  confidence: number; // 0-100 - كلما زادت الإشارات المؤكدة لنفس السبب، زادت الثقة
  explanation: string;
  ruledOut: MarginIssueCause[]; // الاحتمالات التي تم فحصها واستبعادها قبل الوصول للسبب النهائي
}

export function diagnoseMarginIssue(
  input: MarginDiagnosisInput,
  locale: Locale = "ar"
): MarginDiagnosisResult {
  const ruledOut: MarginIssueCause[] = [];

  // 1) المرتجعات - أعلى بشكل واضح (أكثر من ضعف المتوسط) من باقي المنتجات؟
  if (input.productRtoRate > input.avgRtoRateAllProducts * 2 && input.productRtoRate > 10) {
    return {
      primaryCause: "RETURNS",
      confidence: 85,
      explanation: t(locale, "diagnosis.returns", {
        rate: input.productRtoRate,
        avg: input.avgRtoRateAllProducts,
      }),
      ruledOut,
    };
  }
  ruledOut.push("RETURNS");

  // 2) تكلفة المنتج (COGS) قديمة أو غير مسجّلة إطلاقاً
  if (input.cogsLastUpdatedDaysAgo === null || input.cogsLastUpdatedDaysAgo > 30) {
    return {
      primaryCause: "STALE_COGS",
      confidence: 75,
      explanation: t(locale, "diagnosis.staleCogs", {
        days: input.cogsLastUpdatedDaysAgo ?? "∞",
      }),
      ruledOut,
    };
  }
  ruledOut.push("STALE_COGS");

  // 3) تكلفة الشحن لهذا المنتج أعلى بوضوح من المتوسط (مناطق بعيدة، وزن زائد..)
  if (input.productShippingCost > input.avgShippingCostAllProducts * 1.5) {
    return {
      primaryCause: "SHIPPING_OUTLIER",
      confidence: 70,
      explanation: t(locale, "diagnosis.shippingOutlier", {
        cost: input.productShippingCost,
        avg: input.avgShippingCostAllProducts,
      }),
      ruledOut,
    };
  }
  ruledOut.push("SHIPPING_OUTLIER");

  // 4) نسبة كبيرة من المبيعات بكود خصم لم يُحتسب في معادلة الهامش
  if (input.discountedOrdersPct > 25) {
    return {
      primaryCause: "DISCOUNT_CODES",
      confidence: 65,
      explanation: t(locale, "diagnosis.discountCodes", {
        pct: input.discountedOrdersPct,
      }),
      ruledOut,
    };
  }
  ruledOut.push("DISCOUNT_CODES");

  // 5) عمولة بوابة الدفع غير مدرجة أصلاً في المعادلة - خطأ حسابي مش تسعير
  if (!input.gatewayFeeIncludedInMargin) {
    return {
      primaryCause: "MISSING_GATEWAY_FEE",
      confidence: 60,
      explanation: t(locale, "diagnosis.missingGatewayFee"),
      ruledOut,
    };
  }
  ruledOut.push("MISSING_GATEWAY_FEE");

  // 6) كل الاحتمالات الأخرى استُبعدت - السعر فعلاً هو السبب الأرجح
  return {
    primaryCause: "PRICING",
    confidence: 55, // ثقة متوسطة عمداً - لأنه احتمال بالاستبعاد مش بدليل مباشر
    explanation: t(locale, "diagnosis.pricing"),
    ruledOut,
  };
}

// ==================== اقتراح السعر الأمثل ====================
// معادلة بسيطة نسبياً بشكل مقصود - بتوزّع تكلفة المرتجعات (شحن الرجوع)
// وتكلفة الإعلان على الطلبات الناجحة بس (لأن الإيراد بييجي منها بس)،
// وبتضيف هامش الربح المطلوب وعمولة بوابة الدفع فوق التكلفة الكاملة.

export interface PricingInputs {
  cogs: number;                  // تكلفة المنتج
  outboundShippingCost: number;  // تكلفة الشحن للعميل
  returnShippingCost: number;    // تكلفة شحن الإرجاع (لو حصل مرتجع) - افتراضي = outboundShippingCost
  avgAdCostPerOrder: number;     // متوسط تكلفة الإعلان لكل طلب (CPA) - من بيانات الحملة الفعلية
  rtoRatePct: number;            // % المرتجعات لهذا المنتج (0-100)
  paymentGatewayFeePct: number;  // % عمولة بوابة الدفع (مثال: 2.85)
  paymentGatewayFixedFee: number; // رسم ثابت لكل عملية (مثال: 3 جنيه لـ Kashier)
  desiredMarginPct: number;      // هامش الربح الصافي المطلوب بعد كل التكاليف (مثال: 25)
}

export interface PricingSuggestion {
  suggestedPrice: number;
  currentPrice?: number;
  priceIncreasePct?: number;
  breakdown: {
    cogs: number;
    adjustedShippingLoss: number; // تكلفة الشحن + نصيب الطلب من خسارة شحن المرتجعات
    adCostPerSuccessfulOrder: number; // تكلفة الإعلان موزّعة على الطلبات الناجحة بس
    gatewayFee: number;
    targetMargin: number;
  };
}

// ==================== الفحص الاستباقي المستمر للتسعير ====================
// الفرق الجوهري عن diagnoseMarginIssue: ده مش بينتظر الهامش يبقى سالب.
// بيشتغل يومياً على كل منتج، ويقارن السعر الحالي بالسعر المطلوب لتحقيق
// الهامش المستهدف - ويتنبّه قبل حدوث الخسارة، مش بعدها.

export type PricingHealthStatus = "SAFE" | "WARNING" | "CRITICAL";

export interface PricingHealthCheckResult {
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  gapPct: number; // % الفرق بين السعر الحالي والمطلوب (سالب = السعر الحالي أقل من المطلوب)
  status: PricingHealthStatus;
  message: string;
  contributingFactors: MarginDiagnosisResult | null; // عوامل مساعدة (مرتجعات، تكلفة قديمة..) - سياق إضافي مش بديل عن فحص السعر
}

// يُستدعى يومياً (Cron) لكل منتج في كل Workspace - الفحص الافتراضي الأول
// دائماً، بغض النظر عن حالة الهامش الحالية
export function runPricingHealthCheck(
  productName: string,
  currentPrice: number,
  pricingInputs: PricingInputs,
  marginDiagnosisInput?: MarginDiagnosisInput,
  locale: Locale = "ar"
): PricingHealthCheckResult {
  const suggestion = suggestOptimalPrice(pricingInputs, currentPrice);
  const gapPct = round2(
    ((currentPrice - suggestion.suggestedPrice) / suggestion.suggestedPrice) * 100
  );

  // WARNING: السعر الحالي أقل من المطلوب لكن الفرق لسه صغير (منطقة تحذير مبكر)
  // CRITICAL: السعر الحالي أقل بشكل خطير - خسارة فعلية أو وشيكة
  let status: PricingHealthStatus = "SAFE";
  if (gapPct < -15) status = "CRITICAL";
  else if (gapPct < -5) status = "WARNING";

  const message =
    status === "SAFE"
      ? t(locale, "pricingHealth.safe", { price: currentPrice, suggested: suggestion.suggestedPrice })
      : t(locale, status === "CRITICAL" ? "pricingHealth.critical" : "pricingHealth.warning", {
          price: currentPrice,
          suggested: suggestion.suggestedPrice,
          gap: Math.abs(gapPct),
        });

  // العوامل المساعدة بتتفحص كمان (مش بديل عن فحص السعر، لكن سياق إضافي
  // يوضح "ليه" السعر المطلوب زاد، مش بس "إن" السعر غلط)
  const contributingFactors = marginDiagnosisInput
    ? diagnoseMarginIssue(marginDiagnosisInput, locale)
    : null;

  return {
    productName,
    currentPrice,
    suggestedPrice: suggestion.suggestedPrice,
    gapPct,
    status,
    message,
    contributingFactors,
  };
}

// يشتغل على كتالوج كامل مرة واحدة - بيرجع بس المنتجات اللي محتاجة انتباه،
// مرتبة من الأخطر للأقل خطورة
export function auditFullCatalogPricing(
  products: Array<{
    name: string;
    currentPrice: number;
    pricingInputs: PricingInputs;
    marginDiagnosisInput?: MarginDiagnosisInput;
  }>,
  locale: Locale = "ar"
): PricingHealthCheckResult[] {
  const results = products.map((p) =>
    runPricingHealthCheck(p.name, p.currentPrice, p.pricingInputs, p.marginDiagnosisInput, locale)
  );

  return results
    .filter((r) => r.status !== "SAFE")
    .sort((a, b) => a.gapPct - b.gapPct); // الأكثر سلبية (الأخطر) أولاً
}

// ==================== الشبكة الكاملة: قبل وبعد مع بعض ====================
// الطبقة 1 (قبل): runPricingHealthCheck - بتشتغل يومياً على كل منتج،
//   بتمسك المشكلة وهي لسه WARNING قبل ما تتحول لخسارة فعلية.
// الطبقة 2 (بعد): لو المشكلة فاتت من الطبقة 1 لأي سبب (تغيّر مفاجئ، خطأ
//   إدخال، إلخ) ووصل الهامش فعلياً للسالب، diagnoseMarginIssue بتشتغل
//   تلقائي كطبقة ثانية تشخّص السبب بعد وقوع الخسارة، مش بس تسجّلها.
//
// الدالة دي بتربط الاتنين مع بعض في مسار واحد، عشان محدش ينسى يستدعي
// الطبقة التانية لو الأولى فاتت حاجة.

export interface FullPricingSafetyNetResult {
  before: PricingHealthCheckResult;
  after: (ComputedEcommerceMetrics & { diagnosis: MarginDiagnosisResult }) | null;
  slippedThrough: boolean; // true = الطبقة الأولى ماكانتش كفاية، الخسارة حصلت فعلاً
}

export function runFullPricingSafetyNet(
  productName: string,
  currentPrice: number,
  pricingInputs: PricingInputs,
  actualMetrics: RawEcommerceMetrics,
  marginDiagnosisInput: MarginDiagnosisInput,
  locale: Locale = "ar"
): FullPricingSafetyNetResult {
  // الطبقة 1: الفحص الاستباقي (قبل) - بيشتغل دايماً بغض النظر عن النتيجة الفعلية
  const before = runPricingHealthCheck(
    productName,
    currentPrice,
    pricingInputs,
    marginDiagnosisInput,
    locale
  );

  // الطبقة 2: هل الخسارة حصلت فعلياً رغم الفحص الاستباقي؟
  const actualResult = computeEcommerceMetrics(actualMetrics);
  const slippedThrough = actualResult.grossProfit < 0;

  const after = slippedThrough
    ? { ...actualResult, diagnosis: diagnoseMarginIssue(marginDiagnosisInput, locale) }
    : null;

  return { before, after, slippedThrough };
}
export function suggestOptimalPrice(
  inputs: PricingInputs,
  currentPrice?: number
): PricingSuggestion {
  const successRate = Math.max(1 - inputs.rtoRatePct / 100, 0.01); // حماية من القسمة على صفر
  const rtoRate = inputs.rtoRatePct / 100;

  // تكلفة الإعلان اتصرفت على كل الطلبات (الناجحة والمرتجعة)، لكن الإيراد
  // بييجي من الناجحة بس - فلازم نوزّع التكلفة دي على الطلبات الناجحة فقط
  const adCostPerSuccessfulOrder = round2(inputs.avgAdCostPerOrder / successRate);

  // تكلفة الشحن: كل طلب بياخد شحن ذهاب، والمرتجع بياخد شحن رجوع كمان -
  // بنوزع خسارة شحن الرجوع على الطلبات الناجحة فقط بنفس المنطق
  const returnShippingLossPerSuccessfulOrder = round2(
    (rtoRate * inputs.returnShippingCost) / successRate
  );
  const adjustedShippingLoss = round2(
    inputs.outboundShippingCost + returnShippingLossPerSuccessfulOrder
  );

  const baseCost = round2(
    inputs.cogs + adjustedShippingLoss + adCostPerSuccessfulOrder
  );

  // نضيف عمولة بوابة الدفع وهامش الربح المطلوب فوق التكلفة الكاملة
  const priceBeforeFixedFee =
    baseCost /
    (1 - inputs.paymentGatewayFeePct / 100 - inputs.desiredMarginPct / 100);

  const suggestedPrice = round2(priceBeforeFixedFee + inputs.paymentGatewayFixedFee);

  const gatewayFee = round2(
    suggestedPrice * (inputs.paymentGatewayFeePct / 100) + inputs.paymentGatewayFixedFee
  );

  const targetMargin = round2(suggestedPrice * (inputs.desiredMarginPct / 100));

  return {
    suggestedPrice,
    currentPrice,
    priceIncreasePct: currentPrice
      ? round2(((suggestedPrice - currentPrice) / currentPrice) * 100)
      : undefined,
    breakdown: {
      cogs: inputs.cogs,
      adjustedShippingLoss,
      adCostPerSuccessfulOrder,
      gatewayFee,
      targetMargin,
    },
  };
}
