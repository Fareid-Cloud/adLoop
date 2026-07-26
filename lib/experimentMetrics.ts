// lib/experimentMetrics.ts
//
// **بيانات ثابتة فقط - صفر استيراد.** الملف مفصول عن experimentEngine.ts
// عمداً: ذاك يستورد Prisma وactionFeed، وهما يجرّان google-ads-api (gRPC،
// تحتاج fs/tls/net) فيفشل البناء إن استورده مكوّن يعمل في المتصفح.
// نفس النمط المتّبع مع automationRuleDefinitions.ts وautomationCatalog.ts.

export const EXPERIMENT_METRICS = [
  { key: "cost", labelAr: "الإنفاق", labelEn: "Spend", lowerIsBetter: false },
  { key: "clicks", labelAr: "النقرات", labelEn: "Clicks", lowerIsBetter: false },
  { key: "impressions", labelAr: "مرات الظهور", labelEn: "Impressions", lowerIsBetter: false },
  { key: "ctr", labelAr: "نسبة النقر", labelEn: "CTR", lowerIsBetter: false },
  { key: "cpc", labelAr: "تكلفة النقرة", labelEn: "Cost per click", lowerIsBetter: true },
  { key: "cpm", labelAr: "تكلفة الألف ظهور", labelEn: "CPM", lowerIsBetter: true },
  { key: "conversions_reported", labelAr: "تحويلات مُعلنة", labelEn: "Reported conversions", lowerIsBetter: false },
  { key: "conversions_verified", labelAr: "تحويلات محقّقة", labelEn: "Verified conversions", lowerIsBetter: false },
  { key: "verification_rate", labelAr: "نسبة التحقّق", labelEn: "Verification rate", lowerIsBetter: false },
  { key: "inflation_rate", labelAr: "تضخيم المنصة", labelEn: "Platform inflation", lowerIsBetter: true },
  { key: "cpl_raw", labelAr: "تكلفة العميل المُعلنة", labelEn: "Cost per reported", lowerIsBetter: true },
  { key: "cpl_verified", labelAr: "تكلفة العميل الحقيقية", labelEn: "Cost per verified", lowerIsBetter: true },
  { key: "conversion_rate", labelAr: "نسبة التحويل", labelEn: "Conversion rate", lowerIsBetter: false },
  { key: "revenue", labelAr: "الإيراد", labelEn: "Revenue", lowerIsBetter: false },
  { key: "roas", labelAr: "العائد", labelEn: "ROAS", lowerIsBetter: false },
  { key: "orders", labelAr: "الطلبات", labelEn: "Orders", lowerIsBetter: false },
  { key: "aov", labelAr: "متوسط قيمة الطلب", labelEn: "Average order value", lowerIsBetter: false },
  { key: "returned_orders", labelAr: "الطلبات المرتجعة", labelEn: "Returned orders", lowerIsBetter: true },
  { key: "profit_estimate", labelAr: "الربح التقديري", labelEn: "Estimated profit", lowerIsBetter: false },
  { key: "verified_share_of_spend", labelAr: "كفاءة الإنفاق المحقّق", labelEn: "Verified spend efficiency", lowerIsBetter: false },
] as const;

export type ExperimentMetricKey = (typeof EXPERIMENT_METRICS)[number]["key"];

/** المؤشرات المقاسة افتراضياً لأي تجربة تلقائية. */
export const DEFAULT_TRACKED_METRICS: ExperimentMetricKey[] = [
  "cost", "conversions_verified", "cpl_verified", "verification_rate", "ctr",
];
