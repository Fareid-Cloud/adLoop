// lib/dashboardDefaults.ts
//
// بيحول إجابات الـ Onboarding (المجال + المنصات) لقائمة مقاييس افتراضية ذكية،
// بدل ما نوري كل المقاييس لكل الناس ونعمل زحمة. المستخدم يقدر يعدلها بعدين
// من إعدادات الـ Workspace في أي وقت.

import { t, Locale } from "@/lib/i18n/dictionary";

export type MetricKey =
  | "impressions" | "clicks" | "ctr" | "cpc"
  | "cpl_raw" | "cpl_verified" | "inflation_rate"
  | "roas" | "roi"
  | "video_view_rate" | "video_hook_rate" | "video_cost_per_thruplay"
  | "response_time" | "unattributed_rate"
  | "cogs_margin" | "rto_rate" | "shipping_cost_impact";

const BASE_METRICS: MetricKey[] = ["impressions", "clicks", "ctr", "cpc"];

const VERTICAL_METRICS: Record<string, MetricKey[]> = {
  ecommerce: ["roas", "roi", "cogs_margin", "rto_rate", "shipping_cost_impact"],
  recruitment: ["cpl_raw", "cpl_verified", "inflation_rate", "response_time", "unattributed_rate"],
  clinic: ["cpl_raw", "cpl_verified", "response_time", "unattributed_rate"],
  real_estate: ["cpl_raw", "cpl_verified", "roas", "response_time"],
  b2b: ["cpl_raw", "cpl_verified", "roi", "response_time"],
};

const PLATFORM_EXTRA_METRICS: Partial<Record<string, MetricKey[]>> = {
  GOOGLE_ADS: ["video_view_rate", "video_hook_rate", "video_cost_per_thruplay"], // لو فيه يوتيوب
  TIKTOK_ADS: ["video_hook_rate", "video_cost_per_thruplay"],
  SNAPCHAT_ADS: ["video_hook_rate", "video_cost_per_thruplay"],
};

export function computeSmartDefaults(
  industryVertical: string | null,
  activePlatforms: string[]
): MetricKey[] {
  const metrics = new Set<MetricKey>(BASE_METRICS);

  const verticalMetrics = industryVertical ? VERTICAL_METRICS[industryVertical] : null;
  if (verticalMetrics) {
    verticalMetrics.forEach((m) => metrics.add(m));
  } else {
    // مالوشفناش المجال أو مجال غير معروف - نديله كل حاجة أساسية بدل ما نفترض
    metrics.add("cpl_verified");
    metrics.add("roas");
  }

  for (const platform of activePlatforms) {
    const extra = PLATFORM_EXTRA_METRICS[platform];
    if (extra) extra.forEach((m) => metrics.add(m));
  }

  return Array.from(metrics);
}

// يديك عنوان المقياس باللغة المطلوبة - يُستخدم في الواجهة عند بناء قائمة
// "اختار المقاييس اللي عايز تشوفها". بيسحب من القاموس المركزي (dictionary.ts)
// بدل نص ثابت، عشان يشتغل بالعربي والإنجليزي زي باقي النظام.
export function getMetricLabel(key: MetricKey, locale: Locale = "ar"): string {
  return t(locale, `metricLabels.${key}`);
}
