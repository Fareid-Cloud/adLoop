// lib/healthScore.ts
//
// درجة واحدة من 100 بتجمع كل الأنظمة الفرعية (Tracking, Landing, Ads,
// Audience, Creatives) - بنفس فلسفة "Optimization Score" بتاع Google Ads.
//
// الفرق المهم عن انتظار كل الأنظمة تكتمل: الدرجة بتظهر من أول يوم، لكن
// بحساب جزئي شفاف - أي مكوّن لسه مش جاهز (null) بيتستبعد رياضياً من
// الحساب (مش بيتحسب كصفر، وده كان هيظلم الدرجة ظلماً)، ووزنه بيتوزع
// تناسبياً على المكونات الجاهزة. نفس آلية weightedAverage اللي استخدمناها
// في تدقيق صفحة الهبوط بالظبط - مبدأ موحّد عبر النظام كله.

export interface HealthComponents {
  tracking: number | null;   // من TRACKING_HEALTH + verified/raw gap
  landing: number | null;    // من آخر Landing Page Audit (overallScore)
  ads: number | null;        // من نسبة الإعلانات المرفوضة + Quality Score
  audience: number | null;   // من Unattributed rate + Frequency
  creatives: number | null;  // من Ad Fatigue signals
}

export interface HealthScoreResult {
  overallScore: number;
  isComplete: boolean; // false لو لسه فيه مكونات مش جاهزة
  missingComponents: string[];
  componentScores: HealthComponents;
}

const WEIGHTS: Record<keyof HealthComponents, number> = {
  tracking: 0.3,  // الأهم - لو التتبع غلط، كل حاجة تانية مبنية على بيانات غلط
  landing: 0.2,
  ads: 0.2,
  audience: 0.15,
  creatives: 0.15,
};

export function computeHealthScore(components: HealthComponents): HealthScoreResult {
  const entries = Object.entries(components) as Array<
    [keyof HealthComponents, number | null]
  >;

  const applicable = entries.filter(([, score]) => score !== null) as Array<
    [keyof HealthComponents, number]
  >;
  const missingComponents = entries
    .filter(([, score]) => score === null)
    .map(([key]) => key);

  const totalWeight = applicable.reduce((sum, [key]) => sum + WEIGHTS[key], 0);

  const overallScore =
    totalWeight > 0
      ? Math.round(
          applicable.reduce((sum, [key, score]) => sum + score * WEIGHTS[key], 0) /
            totalWeight
        )
      : 0;

  return {
    overallScore,
    isComplete: missingComponents.length === 0,
    missingComponents,
    componentScores: components,
  };
}
