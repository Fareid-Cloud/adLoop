// lib/demoGate.ts
//
// **أيّ صفحات تُحجب حين تنتهي مدّة العرض التجريبي، وأيّها تبقى مفتوحة.**
//
// البوابة كانت تحجب `/dashboard` كلَّه: بطاقةٌ في وسط شاشةٍ فارغة، وزرّاها
// يشيران إلى `/dashboard/integrations` و`/dashboard/billing` - وهما داخل
// الحجب نفسه. فكانت كلّ ضغطةٍ تُعيد رسم البطاقة ذاتها، أي زرّان لا يفعلان
// شيئاً بالمرّة، وشاشةٌ بلا مخرج.
//
// والتمييز الصحيح ليس «لوحة أو لا لوحة» بل «هل في الصفحة رقمٌ من بيانات
// الأمثلة؟». صفحات الحساب - الربط والاشتراك والباقات والإعدادات والمساعدة -
// لا تقرأ من بذرة الديمو أصلاً: مصدرها المستخدم وباقته، لا مساحة العمل.
// فحجبها لا يحمي من شيء، ويمنع بالضبط الخطوةَ التي تدلّ عليها البوابة.
//
// ملفٌّ بلا أيّ استيراد عمداً: يُقرأ من `middleware.ts` (بيئة Edge لا تحمّل
// Prisma ولا Node) ومن تخطيط اللوحة على السواء.

/**
 * المسار في ترويسة الطلب. الأطر لا تمرّر المسار إلى التخطيطات (layouts)،
 * و`app/dashboard/layout.tsx` يلفّ الصفحات كلّها فلا يعرف أيّها يُصيَّر -
 * فيضعه الوسيط في ترويسةٍ داخلية لا تصل إلى العميل.
 */
export const PATHNAME_HEADER = "x-adloop-pathname";

/**
 * ما يبقى مفتوحاً بعد انتهاء العرض. المطابقة على المقطع كاملاً أو على ما
 * تحته (`/dashboard/settings/security`)، لا `startsWith` على النصّ: مسارٌ
 * مثل `/dashboard/billing-history` ليس ابناً لـ`/dashboard/billing`.
 */
const OPEN_AFTER_DEMO = [
  "/dashboard/integrations",
  "/dashboard/billing",
  "/dashboard/pricing",
  "/dashboard/settings",
  "/dashboard/help",
] as const;

export function isOpenAfterDemo(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return OPEN_AFTER_DEMO.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
