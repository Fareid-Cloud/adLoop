// lib/demoCurrency.ts
//
// معامل تحويل أرقام مساحة العرض التجريبية.
//
// **لماذا جدولٌ ثابت لا سعر صرفٍ حيّ:** بذرة العرض **حتمية بقرار**
// (`demoSeed.ts`: «بذرة معروفة، فالفيديو يعيد نفس الأرقام في كل تسجيل»).
// وسعرٌ حيّ يُجلب من الشبكة ينقض ذلك: التسجيل الذي صُوِّر أمس تختلف أرقامه
// عن الذي يُصوَّر اليوم، والعرضان يرويان قصّتين. فالثبات هنا شرطٌ في
// الميزة لا تقصيرٌ في التنفيذ.
//
// **وهذه أرقام عرضٍ لا أسعار صرفٍ تُنقل عنها.** لا تُستعمل في حسابٍ ماليّ
// واحد: مساحة العرض بياناتها من صنعنا كلّها. الحساب الحقيقيّ لا يمرّ من
// هنا إطلاقاً - عملته تأتي من حسابه الإعلانيّ نفسه، وهي وحدها الحقيقة.
//
// الأساس: الريال السعوديّ، وهو عملة البذرة الأصلية.

const SCALE_FROM_SAR: Record<string, number> = {
  SAR: 1,
  AED: 0.98,
  QAR: 0.97,
  EGP: 13,
  KWD: 0.082,
  OMR: 0.103,
  BHD: 0.1,
  USD: 0.267,
  EUR: 0.245,
  GBP: 0.208,
};

/** معامل ضربٍ يحوّل رقم البذرة إلى عملة المساحة. الافتراضيّ ١ لعملة غير مدرجة. */
export function demoCurrencyScale(currency: string): number {
  return SCALE_FROM_SAR[currency?.toUpperCase()] ?? 1;
}

/**
 * تقريبٌ يناسب حجم الرقم: مبلغٌ بالجنيه يُقرأ بلا كسور، وبالدينار الكويتيّ
 * يفقد معناه بلا خانتين. تقريبٌ واحد للجميع كان يُخرج «٠ د.ك» أو «١٣٬٤٥٦٫٧٨ ج.م».
 */
export function roundForCurrency(value: number, currency: string): number {
  const scale = demoCurrencyScale(currency);
  if (scale <= 0.15) return Math.round(value * 100) / 100; // الدينار والريال العُمانيّ
  if (scale < 0.5) return Math.round(value * 10) / 10; // الدولار واليورو والجنيه الإسترلينيّ
  return Math.round(value);
}

/**
 * الرقم بعد التحويل والتقريب، جاهزاً للعرض بفواصل الآلاف.
 *
 * `en-US` في اللغتين عمداً: المنتج كلّه يعرض الأرقام بالخانات اللاتينية
 * (`num` في عشرات المكوّنات)، وأرقامٌ هنديّة في جواب الوكيل وحده كانت
 * ستجعله يبدو قادماً من مكانٍ آخر.
 */
export function demoMoney(sarValue: number, currency: string): string {
  const converted = roundForCurrency(sarValue * demoCurrencyScale(currency), currency);
  return converted.toLocaleString("en-US");
}
