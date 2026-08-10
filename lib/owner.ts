// lib/owner.ts
//
// **مَن المالك؟ سؤالٌ بجواب واحد في المنتج كلّه.**
//
// كان الجواب مكتوباً بيده في خمسة مواضع: `app/admin/layout.tsx`،
// `api/admin/support`، `api/support/upload`، `dashboard/layout.tsx`،
// ثمّ الاستحقاقات. وكلّها تقارن `user.email === process.env.OWNER_EMAIL`
// مباشرةً - وهي مقارنةٌ **حسّاسة لحالة الأحرف وبلا قيمة افتراضية**:
//   • بريدٌ سُجِّل بحرفٍ كبير لا يطابق المتغيّر المكتوب صغيراً، فيُحرَم
//     صاحبه من لوحته وهو مالكها.
//   • ومتغيّرٌ غير مضبوط في بيئةٍ ما يجعل الشرط كلّه `undefined`، فتُغلق
//     اللوحة بلا رسالة تشرح لماذا.
//
// ملفٌّ بلا أيّ استيراد عمداً: يُستدعى من مكوّنات خادم ومسارات واجهة
// برمجية على السواء، فأيّ استيراد فيه (Prisma مثلاً) يجرّ معه ما لا
// يلزم إلى حيث لا يصحّ.

/**
 * بريد المالك. القيمة المدمجة تجعل المنتج يعمل بلا إعداد، والمتغيّر
 * يسمح بتدوير البريد دون نشرٍ جديد.
 */
export const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "manfareiduwk@gmail.com")
  .trim()
  .toLowerCase();

/** مقارنةٌ غير حسّاسة لحالة الأحرف - البريد نفسه غير حسّاس لها. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
