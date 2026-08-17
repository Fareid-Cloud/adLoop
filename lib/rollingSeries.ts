// lib/rollingSeries.ts
//
// **نسبةٌ يومية لا تُقرأ، ونسبةٌ متحرّكة تُقرأ.**
//
// عدُّ الطلبات يومياً خطٌّ يُقرأ اتّجاهاً: يومٌ بلا بيعٍ صفرٌ صادق، والخطّ
// يهبط ويصعد بهدوء. أمّا **النسبة** - تكلفة العميل، معدّل الإرجاع، هامش
// الربح - فيومُها الواحد لا يُقرأ:
//
//   يومٌ بصفر تحويل   ← قسمةٌ على صفر، لا رقمَ أصلاً
//   يومٌ بتحويلٍ واحد ← الرقم يقفز إلى إنفاق اليوم كلّه
//
// فيخرج خطٌّ مسنَّنٌ يوهم بتقلّبٍ لم يقع، ويُدفن الاتّجاه الحقيقيّ تحته.
//
// والشكل الصحيح لنسبةٍ نافذةٌ منزلقة: بسطُ آخر سبعة أيّام على مقامها،
// تزحف يوماً بيوم. صفرُ المقام يبقى `null` - لا يُخترَع له رقم.

/** نافذةٌ من سبعة أيّام: أقصرُ ما يُلغي أثرَ اليوم الواحد، وأطولُ ما
 *  يُبقي الخطّ متجاوباً مع تغيّرٍ حقيقيّ خلال أسبوع. */
export const ROLLING_WINDOW = 7;

/**
 * نسبةٌ متحرّكة من سلسلتين متساويتي الطول.
 *
 * تُعيد سلسلةً أقصر بمقدار النافذة ناقص واحد - لا تُحشى بالأصفار: يومٌ
 * لا تكتمل نافذتُه ليس نسبتُه صفراً، بل غيرَ محسوبةٍ بعد.
 */
export function rollingRatio(
  numerator: number[],
  denominator: number[],
  window = ROLLING_WINDOW
): number[] {
  const n = Math.min(numerator.length, denominator.length);
  if (n < window) return [];

  const out: number[] = [];
  for (let end = window; end <= n; end++) {
    let num = 0;
    let den = 0;
    for (let i = end - window; i < end; i++) {
      num += numerator[i] ?? 0;
      den += denominator[i] ?? 0;
    }
    // مقامٌ صفر: النسبة غير معرَّفة. تُحمل صفراً في السلسلة **ولا تُرسَم**
    // لأنّ `Sparkline` يرفض السلسلة المسطّحة - وهو ما نريده هنا: خطٌّ
    // من أصفارٍ خيرٌ من خطٍّ يقفز إلى ما لا نهاية.
    out.push(den > 0 ? num / den : 0);
  }
  return out;
}

/** مجموعٌ متحرّك - للأعداد التي يُراد تنعيمها كذلك (طلباتٌ يوميّة مثلاً
 *  في متجرٍ صغير تقفز بين ٠ و٣ فيبدو الخطّ ضجيجاً). */
export function rollingSum(values: number[], window = ROLLING_WINDOW): number[] {
  if (values.length < window) return [];
  const out: number[] = [];
  for (let end = window; end <= values.length; end++) {
    let sum = 0;
    for (let i = end - window; i < end; i++) sum += values[i] ?? 0;
    out.push(sum);
  }
  return out;
}
