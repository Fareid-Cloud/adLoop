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

/** حالاتُ الطلب في اللوحة. مافيش حارسُ نوعٍ معاها: المسارُ بيتحقّق
 *  بـ`z.enum(ENQUIRY_STATUSES)` فالقائمةُ نفسها هي التحقّق. */
export const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "WON", "LOST"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
