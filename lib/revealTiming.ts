// lib/revealTiming.ts
//
// **سرعةُ ظهور الجواب - رقمٌ واحد لكلّ مكانٍ يتكلّم فيه الوكيل.**
//
// كانت السرعةُ محبوسةً في `AiAsk` وحده، وقسمُ الوكيل يعرض الجواب **دفعةً
// واحدة** بلا ظهورٍ تدريجيّ - فالمكانان اللذان يجيب فيهما المنتج نفسُه
// يبدوان منتجين مختلفين. وضبطُها في ملفٍّ واحد يمنع أن تُعدَّل هنا وتبقى
// هناك.
//
// المدّةُ ثابتةٌ لا لكلّ حرف: جوابٌ من سطرين وآخرُ من عشرين ينتهيان في
// الزمن نفسه، فلا ينتظر القارئ جواباً طويلاً يُكتَب أمامه حرفاً حرفاً.

/** الزمنُ الكلّيّ لظهور الجواب مهما طال. */
export const REVEAL_MS = 2200;

/** فاصلُ التحديث - ١٦ملّي ≈ ٦٠ إطاراً، فالحركةُ ناعمةٌ لا متقطّعة. */
export const REVEAL_TICK_MS = 16;

/** كم حرفاً يُكشَف في كلّ نبضة كي ينتهي النصّ في `REVEAL_MS`. */
export function charsPerTick(total: number): number {
  return Math.max(1, Math.ceil(total / (REVEAL_MS / REVEAL_TICK_MS)));
}

/** مَن طلب تقليل الحركة يرى الجواب كاملاً فوراً. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}
