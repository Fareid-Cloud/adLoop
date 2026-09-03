// lib/salesEnquiry.ts
//
// ثابتاتُ طلب الباقة الاتفاقية - **ملفٌّ بلا أيّ استيراد** عشان الكلاينت
// كومبوننت ياخد منه من غير ما يجرّ Prisma للمتصفّح.

/** شرائحُ الصرف الشهريّ. مغلقةٌ لا رقمٌ حرّ: الشريحةُ كافيةٌ للتأهيل،
 *  والرقمُ الحرّ مابيتجمّعش في تقرير وأغلبُ الناس بتكتبه تقريبيّاً أصلاً. */
export const SPEND_BANDS = [
  "under_10k",
  "10k_50k",
  "50k_200k",
  "over_200k",
] as const;

export type SpendBand = (typeof SPEND_BANDS)[number];

export function isSpendBand(v: unknown): v is SpendBand {
  return typeof v === "string" && (SPEND_BANDS as readonly string[]).includes(v);
}

/** حالاتُ الطلب في اللوحة. */
export const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "WON", "LOST"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** لفلترةِ قيمةٍ جاية من رابط. مسارُ التحديث بيستعمل `z.enum` بدلَها
 *  لأنّه بيتحقّق من جسمٍ كامل، ومسارُ التصدير بياخد بارامتراً مفرداً. */
export function isEnquiryStatus(v: unknown): v is EnquiryStatus {
  return typeof v === "string" && (ENQUIRY_STATUSES as readonly string[]).includes(v);
}
