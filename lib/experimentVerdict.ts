// lib/experimentVerdict.ts
//
// **الحكم على التجربة - وأصعب سؤالٍ فيه: حين تتعارض المؤشّرات.**
//
// 🔴 الحكمُ السابق كان يقرأ **أوّل مؤشّرٍ متتبَّع** ويحكم به. وهذا عشوائيّ:
// ترتيبُ القائمة ليس ترتيبَ الأهمّية، فتجربةٌ أوّلُ مؤشّرها «النقرات»
// تُحكَم بالنقرات ولو انهارت أرباحُها.
//
// والسؤال الذي كسره: **الإنفاق ارتفع، والتحويلات ارتفعت. أيُّهما يحكم؟**
//
// ═══ الجواب: لا هذا ولا ذاك ═══
//
// أيٌّ منهما وحدَه لا يقول شيئاً. إنفاقٌ يرتفع ليس سيّئاً - أنت تشتري
// نتيجة. وتحويلاتٌ ترتفع ليست نجاحاً - يمكن شراؤها دائماً بمزيدٍ من
// المال. **السؤال الوحيد ذو المعنى هو السعر: كم دفعتَ في العميل الواحد
// قبل وبعد؟** وهو مؤشّرٌ يجمع الاثنين في رقمٍ واحد (`cpl_verified`).
//
// فإن كان متتبَّعاً، حَكَم وحدَه وانتهى الأمر.
// وإن لم يكن، يُشتقّ الجواب: هل نمت التحويلات **أسرع** من الإنفاق؟
//   +٣٠٪ تحويلات مقابل +١٠٪ إنفاق ← اشتريتَ أكثر بسعرٍ أفضل.
//   +١٠٪ تحويلات مقابل +٣٠٪ إنفاق ← اشتريتَ أكثر بسعرٍ أسوأ.
//
// ═══ ولماذا مراتب لا مؤشّرٌ واحد ═══
//
// المؤشّرات ليست سواءً في هذا المنتج. الربحُ يعلو الكفاءة، والكفاءةُ تعلو
// الحجم، والحجمُ يعلو ما تدّعيه المنصّة. و**الإنفاق ليس حَكَماً أبداً**:
// هو المقام في كلّ كسر، لا نتيجةٌ تُقاس وحدها - وهذه دعوى المنتج نفسها.
//
// وحين لا يوجد حَكَمٌ من مرتبةٍ كافية، يُقال «متعارضة» ويُسمّى التعارض،
// ولا يُختلَق فائز. الادّعاءُ بحكمٍ لا يسنده مؤشّر هو ما جاء هذا المنتج
// ليكشفه في غيره.

import { EXPERIMENT_METRICS } from "@/lib/experimentMetrics";

/** ما دون هذه النسبة ضجيجُ قياسٍ لا أثرُ تغيير. */
export const NOISE_FLOOR_PCT = 2;

/**
 * مرتبةُ المؤشّر في الحكم. الأصغرُ أعلى.
 *
 *   ١ ربحٌ صريح - يجيب عن السؤال كلِّه وحدَه.
 *   ٢ كفاءةٌ متحقَّقة - سعرُ النتيجة الحقيقيّة، وهو ما يجمع الإنفاق بالعائد.
 *   ٣ حجمٌ متحقَّق - نتيجةٌ حقيقيّة لكنّها لا ترى السعر.
 *   ٤ سياقٌ لا يحكم - نقراتٌ وظهورٌ وأرقامٌ تدّعيها المنصّة، والإنفاق نفسه.
 */
const TIER: Record<string, number> = {
  profit_estimate: 1,
  roas: 1,

  cpl_verified: 2,
  verified_share_of_spend: 2,

  conversions_verified: 3,
  orders: 3,
  revenue: 3,
  conversion_rate: 3,
};
const CONTEXT_TIER = 4;

const tierOf = (key: string) => TIER[key] ?? CONTEXT_TIER;

export type VerdictKey = "verdictBetter" | "verdictWorse" | "verdictFlat" | "verdictMixed" | "verdictPending";

export interface VerdictResult {
  key: VerdictKey;
  /** المؤشّر الذي حَكَم - يُعرَض كي لا يكون الحكم صندوقاً مغلقاً. */
  basisMetric: string | null;
  /** نسبةُ تغيّر المؤشّر الحاكم. */
  basisPct: number | null;
  /** مؤشّرٌ يشدّ في الاتّجاه المضادّ، إن وُجد - يُسمّى ولا يُخفى. */
  conflictMetric?: string;
  conflictPct?: number;
  /** اشتُقّ الحكمُ من مقارنة الحجم بالإنفاق لا من مؤشّرٍ جاهز. */
  derived?: boolean;
}

interface MetricResult { before: number; after: number; changePct: number | null }

interface VerdictInput {
  status: string;
  trackedMetrics: string[];
  metricResults: Record<string, MetricResult> | null;
}

/** هل تحرّك المؤشّر في الاتّجاه المطلوب؟ */
function isGood(key: string, pct: number): boolean {
  const def = EXPERIMENT_METRICS.find((m) => m.key === key);
  return def?.lowerIsBetter ? pct < 0 : pct > 0;
}

export function judgeExperiment(exp: VerdictInput): VerdictResult {
  const pending: VerdictResult = { key: "verdictPending", basisMetric: null, basisPct: null };
  if (exp.status === "RUNNING" || !exp.metricResults) return pending;

  // المؤشّرات التي لها رقمٌ فعليّ، مرتّبةً بالمرتبة لا بترتيب القائمة
  const usable = exp.trackedMetrics
    .map((k) => ({ key: k, pct: exp.metricResults![k]?.changePct ?? null }))
    .filter((m): m is { key: string; pct: number } => m.pct !== null)
    .sort((a, b) => tierOf(a.key) - tierOf(b.key));

  if (usable.length === 0) return pending;

  const top = usable[0];

  // ── حَكَمٌ من مرتبةٍ كافية: يقرّر وحدَه ────────────────────────────
  //
  // المرتبتان الأولى والثانية **تريان الإنفاق داخلهما**: الربح يطرحه،
  // وسعرُ العميل يقسم عليه. فارتفاعُ الإنفاق مع تحسّنهما ليس تعارضاً -
  // هو بالضبط ما يعنيه «اشتريتَ أكثر بسعرٍ أفضل».
  if (tierOf(top.key) <= 2) {
    if (Math.abs(top.pct) < NOISE_FLOOR_PCT) {
      return { key: "verdictFlat", basisMetric: top.key, basisPct: top.pct };
    }
    const good = isGood(top.key, top.pct);

    // مؤشّرٌ من المرتبة نفسها يشدّ عكسه: يُسمّى، ولا يُلغي الحكم.
    const conflict = usable.find(
      (m) => m.key !== top.key && tierOf(m.key) <= 3 &&
        Math.abs(m.pct) >= NOISE_FLOOR_PCT && isGood(m.key, m.pct) !== good
    );

    return {
      key: good ? "verdictBetter" : "verdictWorse",
      basisMetric: top.key,
      basisPct: top.pct,
      ...(conflict ? { conflictMetric: conflict.key, conflictPct: conflict.pct } : {}),
    };
  }

  // ── لا حَكَم: يُشتقّ السعر من الحجم والإنفاق ───────────────────────
  //
  // هذا جوابُ السؤال المطروح حرفياً - الإنفاق ارتفع والتحويلات ارتفعت.
  // النموّ وحدَه لا يكفي: يُقارَن بما دُفع فيه.
  const volume = usable.find((m) => tierOf(m.key) === 3);
  const spend = usable.find((m) => m.key === "cost");

  if (volume && spend) {
    // الفارقُ بين نموّ النتيجة ونموّ تكلفتها = تغيّرُ السعر ضمناً.
    const efficiency = volume.pct - spend.pct;
    if (Math.abs(efficiency) < NOISE_FLOOR_PCT) {
      return {
        key: "verdictFlat", basisMetric: volume.key, basisPct: volume.pct,
        conflictMetric: spend.key, conflictPct: spend.pct, derived: true,
      };
    }
    return {
      key: efficiency > 0 ? "verdictBetter" : "verdictWorse",
      basisMetric: volume.key,
      basisPct: volume.pct,
      conflictMetric: spend.key,
      conflictPct: spend.pct,
      derived: true,
    };
  }

  // حجمٌ بلا إنفاق: نتيجةٌ حقيقيّة لكن بلا سعرٍ يُقارَن به.
  if (volume) {
    if (Math.abs(volume.pct) < NOISE_FLOOR_PCT) {
      return { key: "verdictFlat", basisMetric: volume.key, basisPct: volume.pct };
    }
    return {
      key: isGood(volume.key, volume.pct) ? "verdictBetter" : "verdictWorse",
      basisMetric: volume.key,
      basisPct: volume.pct,
    };
  }

  // ── سياقٌ وحده: لا يُختلَق حكم ─────────────────────────────────────
  //
  // نقراتٌ وظهورٌ وأرقامٌ تدّعيها المنصّة لا تقول إن كان التغيير مربحاً.
  // وقولُ «متعارضة» أصدقُ من فائزٍ مصنوع.
  const moved = usable.filter((m) => Math.abs(m.pct) >= NOISE_FLOOR_PCT);
  if (moved.length === 0) {
    return { key: "verdictFlat", basisMetric: top.key, basisPct: top.pct };
  }
  return { key: "verdictMixed", basisMetric: moved[0].key, basisPct: moved[0].pct };
}
