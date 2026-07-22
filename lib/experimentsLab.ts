// lib/experimentsLab.ts
//
// بيثبت إن تعديلات النظام (أو تعديلات الميديا باير نفسه) فعلاً بتحسّن حاجة،
// مش مجرد ادعاء. التسجيل يبدأ فوراً من لحظة أي تعديل، لكن "الثقة" في
// النتيجة بتتأخر لحد ما تتوفر عينة كافية - نفس فلسفة AI Forecast بالظبط.

import { t, Locale } from "@/lib/i18n/dictionary";

const MIN_DAYS_FOR_PRELIMINARY = 3;
const MIN_DAYS_FOR_RELIABLE = 7;
const MIN_VERIFIED_CONVERSIONS_FOR_RELIABLE = 15; // العدد المطلق أهم من عدد الأيام وحده

export type ExperimentConfidence = "INSUFFICIENT_DATA" | "PRELIMINARY" | "RELIABLE";

export interface ExperimentMeasurement {
  daysSinceChange: number;
  verifiedConversionsSinceChange: number;
}

// بتحدد مستوى الثقة بناءً على معيارين مع بعض (وقت + حجم عينة)، مش وقت بس -
// لأن تعديل على كامبين كبير الحجم ممكن يجمع عينة كافية في يومين، وتعديل
// على كامبين صغير ممكن يحتاج أسبوعين لنفس العينة
export function computeExperimentConfidence(
  m: ExperimentMeasurement
): ExperimentConfidence {
  if (
    m.daysSinceChange >= MIN_DAYS_FOR_RELIABLE &&
    m.verifiedConversionsSinceChange >= MIN_VERIFIED_CONVERSIONS_FOR_RELIABLE
  ) {
    return "RELIABLE";
  }

  if (m.daysSinceChange >= MIN_DAYS_FOR_PRELIMINARY) {
    return "PRELIMINARY";
  }

  return "INSUFFICIENT_DATA";
}

export interface ImpactResult {
  changePct: number; // موجب = تحسّن (حسب اتجاه المقياس)، سالب = تدهور
  confidence: ExperimentConfidence;
  headline: string; // الجملة الجاهزة للعرض، بتختلف حسب مستوى الثقة
}

// isLowerBetter: بعض المقاييس التحسّن فيها = نزول الرقم (CPL)، وبعضها
// التحسّن = زيادة الرقم (ROAS) - لازم نحدد الاتجاه الصح لكل مقياس
export function computeExperimentImpact(
  beforeValue: number,
  afterValue: number,
  isLowerBetter: boolean,
  measurement: ExperimentMeasurement,
  metricLabel: string,
  locale: Locale = "ar"
): ImpactResult {
  const confidence = computeExperimentConfidence(measurement);

  const rawChangePct =
    beforeValue !== 0 ? ((afterValue - beforeValue) / beforeValue) * 100 : 0;

  // لو التحسّن معناه نزول الرقم (زي CPL)، نعكس الإشارة عشان "موجب" دايماً
  // يعني تحسّن، بغض النظر عن اتجاه المقياس نفسه
  const changePct = isLowerBetter ? -rawChangePct : rawChangePct;
  const rounded = Math.round(changePct * 10) / 10;

  const direction =
    rounded > 0 ? t(locale, "experiments.improved") : t(locale, "experiments.worsened");

  let headline: string;
  if (confidence === "INSUFFICIENT_DATA") {
    headline = t(locale, "experiments.insufficientData", { days: measurement.daysSinceChange });
  } else if (confidence === "PRELIMINARY") {
    headline = t(locale, "experiments.preliminary", {
      metric: metricLabel,
      direction,
      pct: Math.abs(rounded),
    });
  } else {
    headline = t(locale, "experiments.reliable", {
      metric: metricLabel,
      direction,
      pct: Math.abs(rounded),
    });
  }

  return { changePct: rounded, confidence, headline };
}
