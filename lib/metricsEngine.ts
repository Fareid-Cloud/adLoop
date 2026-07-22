// lib/metricsEngine.ts
//
// ده قلب المنتج. مش مجرد جمع أرقام - هنا بيتحسب الفرق بين
// "اللي المنصة بتقوله" و"اللي فعلاً حصل"، وبيتحسب المقارنة العادلة
// بين المنصات المختلفة.

export interface RawMetrics {
  // إصلاح فجوة حقيقية: كان النوع مقصور على GOOGLE_ADS/META_ADS/MANUAL_UPLOAD
  // بس - تيك توك وسناب شات مكنوش موجودين خالص، رغم إنهم منصات حقيقية
  // مدعومة في باقي المشروع كله
  platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS" | "SNAPCHAT_ADS" | "MANUAL_UPLOAD";
  impressions: number;
  clicks: number;
  cost: number;
  rawConversions: number;      // اللي المنصة بتقوله (dashboard conversion)
  verifiedConversions: number; // اللي فعلاً اتأكد (رسالة واتساب حقيقية)
}

export interface ComputedMetrics extends RawMetrics {
  ctr: number;                 // Click-through rate %
  cpc: number;                 // Cost per click
  cplRaw: number;              // Cost per lead (حسب المنصة)
  cplVerified: number;         // Cost per lead (حقيقي، بعد التحقق)
  // نسبة الفجوة بين اللي المنصة بتقوله واللي حصل فعلاً
  // (مؤشر أساسي: كل ما زادت، يبقى المنصة دي بتدي بيانات "متفائلة" أكتر من اللازم)
  inflationRate: number;
  roas: number;                // Return on Ad Spend
  roi: number;                 // Return on Investment %
}

interface ConversionValueConfig {
  avgLeadToClientRate: number;
  avgClientValue: number;
}

export function computeMetrics(
  raw: RawMetrics,
  valueConfig: ConversionValueConfig
): ComputedMetrics {
  const ctr = raw.impressions > 0 ? (raw.clicks / raw.impressions) * 100 : 0;
  const cpc = raw.clicks > 0 ? raw.cost / raw.clicks : 0;

  const cplRaw = raw.rawConversions > 0 ? raw.cost / raw.rawConversions : 0;
  const cplVerified =
    raw.verifiedConversions > 0 ? raw.cost / raw.verifiedConversions : 0;

  // نسبة "التضخم" في أرقام المنصة مقارنة بالواقع
  // مثال: لو المنصة قالت 100 conversion وفعلياً 40 بس اتأكدوا -> inflation 150%
  const inflationRate =
    raw.verifiedConversions > 0
      ? ((raw.rawConversions - raw.verifiedConversions) /
          raw.verifiedConversions) *
        100
      : raw.rawConversions > 0
      ? Infinity // كل الـ conversions وهمية، مفيش ولا واحدة اتأكدت
      : 0;

  // القيمة المتوقعة = عدد الـ leads الحقيقية × نسبة التحويل لعميل × قيمة العميل
  const expectedRevenue =
    raw.verifiedConversions *
    valueConfig.avgLeadToClientRate *
    valueConfig.avgClientValue;

  const roas = raw.cost > 0 ? expectedRevenue / raw.cost : 0;
  const roi = raw.cost > 0 ? ((expectedRevenue - raw.cost) / raw.cost) * 100 : 0;

  return {
    ...raw,
    ctr: round2(ctr),
    cpc: round2(cpc),
    cplRaw: round2(cplRaw),
    cplVerified: round2(cplVerified),
    inflationRate: isFinite(inflationRate) ? round2(inflationRate) : 999,
    roas: round2(roas),
    roi: round2(roi),
  };
}

import { t, Locale } from "@/lib/i18n/dictionary";

// مقارنة كل المنصات مع بعض داخل نفس الـ Workspace، وترتيبهم حسب
// الأداء الحقيقي (CPL Verified) مش حسب أرقام المنصة الخام
export function comparePlatforms(
  metricsPerPlatform: ComputedMetrics[],
  locale: Locale = "ar"
): {
  ranked: ComputedMetrics[];
  bestPlatform: ComputedMetrics | null;
  insight: string;
} {
  // بنستبعد المنصات اللي معندهاش ولا verified conversion واحدة من الترتيب
  // (مفيش بيانات كافية نحكم بيها)
  const withData = metricsPerPlatform.filter((m) => m.verifiedConversions > 0);

  const ranked = [...withData].sort((a, b) => a.cplVerified - b.cplVerified);

  const bestPlatform = ranked[0] ?? null;

  let insight = t(locale, "insights.noData");
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const savingsPct = round2(
      ((worst.cplVerified - best.cplVerified) / worst.cplVerified) * 100
    );
    insight = t(locale, "insights.platformComparison", {
      best: best.platform,
      worst: worst.platform,
      pct: savingsPct,
      bestValue: best.cplVerified,
      worstValue: worst.cplVerified,
    });
  }

  return { ranked, bestPlatform, insight };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== دمج Verified + Modeled (لو الـ toggle شغال) ====================
//
// لو useModeledAttribution = false: بترجع نفس raw.verifiedConversions زي ما هي
// لو true: بتضيف نصيب المنصة دي من المحادثات المجهولة (من AttributionResult)

export function applyModeledAttribution(
  raw: RawMetrics,
  modeledContribution: number, // مجموع الاحتمالات اللي رجعت للمنصة دي من المجهول
  useModeled: boolean
): RawMetrics & { modeledConversions: number } {
  if (!useModeled) {
    return { ...raw, modeledConversions: 0 };
  }
  return {
    ...raw,
    verifiedConversions: raw.verifiedConversions, // بيفضل زي ما هو، منفصل في العرض
    modeledConversions: Math.round(modeledContribution * 100) / 100,
  };
}
