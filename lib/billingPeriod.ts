// lib/billingPeriod.ts
//
// **حسابُ نهاية الفترة - مصدرٌ واحد، لأنّ حسابين لتاريخٍ واحد يفترقان.**
//
// 🔴 **`setMonth(getMonth() + 1)` يتخطّى شهراً كاملاً في نهايات الشهور.**
//
// جافاسكريبت لا تُقصّر التاريخ الفائض، بل تُدحرجه: ٣١ يناير + شهر تصير
// «٣١ فبراير» فتُقرأ **٣ مارس**. والأثر ليس تجميلياً:
//
//   • المشترك يأخذ واحداً وثلاثين يوماً زائدةً بلا مقابل، لأنّ فبراير
//     سقط من الحساب.
//   • وموعدُ التجديد **يزحف إلى الأمام كلّ دورة** (٣١ يناير ← ٣ مارس ←
//     ٣ أبريل)، فيخسر الاشتراكُ السنويُّ شهراً كاملاً مع الوقت.
//
// والعلاجُ أن يُقصَّر اليومُ إلى آخر يومٍ حقيقيّ في الشهر الهدف: ٣١ يناير
// ← ٢٨ فبراير (أو ٢٩ في الكبيسة). والتقصيرُ ينقص أياماً ولا يزيدها -
// وهذا هو الاتجاه الآمن: خطؤه في صالح المشترك لا في جيبه.
//
// ⚠️ حدٌّ معروفٌ ومقبول: التقصير يُفقد «مرساةَ» اليوم الأصليّ، فمن بدأ في
// الحادي والثلاثين يستقرّ على الثامن والعشرين بعد أوّل فبراير. تثبيتُها
// يحتاج تخزينَ يوم البداية، وهو تعقيدٌ لا يشتريه أحدٌ اليوم - بخلاف
// الزحف إلى الأمام، الذي يكلّف مالاً حقيقياً.

export type BillingCycleName = "monthly" | "yearly";

/** آخرُ يومٍ في شهرٍ بعينه (١-١٢ ليست لازمة: `Date` تتولّى الالتفاف). */
function lastDayOfMonth(year: number, monthIndex: number): number {
  // اليوم صفر من الشهر التالي = آخر يومٍ في هذا الشهر.
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * نهايةُ الفترة التالية ابتداءً من `from`.
 *
 * تحافظ على الوقت من اليوم كما هو، وتُقصّر اليوم عند الحاجة وحدها.
 */
export function addBillingPeriod(from: Date, cycle: BillingCycleName): Date {
  const months = cycle === "yearly" ? 12 : 1;

  const year = from.getFullYear();
  const monthIndex = from.getMonth();
  const day = from.getDate();

  const targetMonthAbsolute = monthIndex + months;
  const targetYear = year + Math.floor(targetMonthAbsolute / 12);
  const targetMonth = ((targetMonthAbsolute % 12) + 12) % 12;

  // هنا يقع التقصير: ٣١ في شهرٍ من ثلاثين يوماً تصير ٣٠، ومن ٢٨ تصير ٢٨.
  const clampedDay = Math.min(day, lastDayOfMonth(targetYear, targetMonth));

  const next = new Date(from);
  // الترتيب مقصود: يُضبَط اليوم إلى واحدٍ أوّلاً كي لا يفيض الشهرُ أثناء
  // ضبطه، ثمّ يوضع الشهر والسنة، ثمّ اليوم المقصَّر.
  next.setDate(1);
  next.setFullYear(targetYear, targetMonth, clampedDay);
  return next;
}
