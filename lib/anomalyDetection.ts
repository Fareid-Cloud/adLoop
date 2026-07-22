// lib/anomalyDetection.ts
//
// المشكلة اللي بنحلها: عتبة ثابتة (زي "لو CTR نزل 30%، نبّه") بتفترض إن كل
// الحسابات بتتصرف بنفس الشكل - غلط. حساب فيه تقلب طبيعي عالي (موسمي مثلاً)
// هيطلّع تنبيهات كاذبة كتير، وحساب مستقر جداً ممكن يفوّت مشكلة حقيقية لأن
// الانخفاض عنده أقل من العتبة الثابتة بس لسه غير طبيعي بالنسبة له هو.
//
// الحل: بدل عتبة ثابتة لكل الحسابات، بنحسب لكل حساب خط أساس خاص بيه
// (المتوسط + الانحراف المعياري لبياناته هو بس)، وبنعتبر القيمة "شاذة"
// لو بعيدة عن المتوسط بعدد معين من الانحرافات المعيارية (Z-Score) -
// نفس المبدأ المستخدم في مراقبة الأنظمة الصناعية والمالية الحقيقية.

export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number; // كام انحراف معياري بعيد عن المتوسط - كل ما زاد، زادت شذوذية القيمة
  baseline: { mean: number; stdDev: number };
  direction: "above" | "below" | "none";
}

// الحد الافتراضي: 2 انحراف معياري = تقريباً أعلى/أقل 5% من التوزيع
// الطبيعي إحصائياً - حساسية معقولة، مش مبالغ فيها (3 انحراف نادر أوي
// هيفوّت مشاكل حقيقية، وانحراف واحد هيغرقنا في تنبيهات كاذبة)
const DEFAULT_Z_THRESHOLD = 2;

// أقل عدد نقاط بيانات مطلوب قبل ما نثق في الخط الأساسي - أقل من كده،
// المتوسط والانحراف المعياري نفسهم مش موثوقين إحصائياً
const MIN_DATA_POINTS = 7;

export function detectAnomaly(
  currentValue: number,
  historicalValues: number[],
  zThreshold: number = DEFAULT_Z_THRESHOLD
): AnomalyResult {
  if (historicalValues.length < MIN_DATA_POINTS) {
    // مفيش تاريخ كافي نحسب عليه خط أساس موثوق - منقولش "شاذ" من غير أساس
    return {
      isAnomaly: false,
      zScore: 0,
      baseline: { mean: 0, stdDev: 0 },
      direction: "none",
    };
  }

  const mean = average(historicalValues);
  const stdDev = standardDeviation(historicalValues, mean);

  // لو التاريخ كله نفس القيمة بالظبط (انحراف معياري صفر)، أي فرق بسيط
  // هيتحسب "شاذ لا نهائي" رياضياً - ده غير منطقي عملياً، فبنحمي من القسمة
  // على صفر بحد أدنى صغير جداً بدل الصفر التام
  const safeStdDev = stdDev === 0 ? 0.0001 : stdDev;

  const zScore = (currentValue - mean) / safeStdDev;
  const isAnomaly = Math.abs(zScore) >= zThreshold;

  return {
    isAnomaly,
    zScore: Math.round(zScore * 100) / 100,
    baseline: { mean: round2(mean), stdDev: round2(stdDev) },
    direction: !isAnomaly ? "none" : zScore > 0 ? "above" : "below",
  };
}

function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function standardDeviation(nums: number[], mean: number): number {
  // انحراف العينة (÷ n−1، تصحيح Bessel) مش انحراف المجتمع (÷ n) - لأننا
  // بنقدّر التقلّب من عيّنة تاريخية محدودة، مش من كامل المجتمع. القسمة على n
  // بتقلّل تقدير التقلّب وبتضخّم الـ z-score (تنبيهات كاذبة أكتر) مع العينات
  // الصغيرة. detectAnomaly بيضمن n ≥ 7 قبل ما يوصل هنا، فـ n−1 آمنة.
  const denom = Math.max(nums.length - 1, 1);
  const variance = nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / denom;
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
