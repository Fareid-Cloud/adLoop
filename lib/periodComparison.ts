// lib/periodComparison.ts
//
// مقارنة فترة بفترة - يوم بيوم، أسبوع بأسبوع، شهر بشهر، سنة بسنة، أو
// فترة مخصصة. بيرجع الفترتين (الحالية والسابقة) جاهزتين للاستعلام، بدل
// ما كل صفحة تحسب التواريخ دي بمنطقها الخاص.

export type PeriodPreset = "today" | "yesterday" | "this_week" | "last_week" |
  "this_month" | "last_month" | "this_year" | "last_year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PeriodComparisonResult {
  current: DateRange;
  previous: DateRange; // نفس طول الفترة، فوراً قبلها - عشان تكون المقارنة عادلة
  label: string;
}

export function resolvePeriodComparison(
  preset: PeriodPreset,
  customFrom?: Date,
  customTo?: Date
): PeriodComparisonResult {
  const now = new Date();

  switch (preset) {
    case "today": {
      const from = startOfDay(now);
      const to = endOfDay(now);
      return {
        current: { from, to },
        previous: { from: addDays(from, -1), to: addDays(to, -1) },
        label: "اليوم مقابل أمس",
      };
    }
    case "yesterday": {
      const from = startOfDay(addDays(now, -1));
      const to = endOfDay(addDays(now, -1));
      return {
        current: { from, to },
        previous: { from: addDays(from, -1), to: addDays(to, -1) },
        label: "أمس مقابل اللي قبله",
      };
    }
    case "this_week": {
      const from = startOfWeek(now);
      const to = endOfDay(now);
      const lengthDays = daysBetween(from, to);
      return {
        current: { from, to },
        previous: { from: addDays(from, -(lengthDays + 1)), to: addDays(from, -1) },
        label: "هذا الأسبوع مقابل الأسبوع اللي فات",
      };
    }
    case "last_week": {
      const thisWeekStart = startOfWeek(now);
      const from = addDays(thisWeekStart, -7);
      const to = addDays(thisWeekStart, -1);
      return {
        current: { from, to },
        previous: { from: addDays(from, -7), to: addDays(to, -7) },
        label: "الأسبوع اللي فات مقابل اللي قبله",
      };
    }
    case "this_month": {
      const from = startOfMonth(now);
      const to = endOfDay(now);
      const prevMonthStart = startOfMonth(addMonths(now, -1));
      const prevMonthEquivalentDay = addDays(prevMonthStart, daysBetween(from, to));
      return {
        current: { from, to },
        previous: { from: prevMonthStart, to: prevMonthEquivalentDay },
        label: "هذا الشهر مقابل الشهر اللي فات",
      };
    }
    case "last_month": {
      const from = startOfMonth(addMonths(now, -1));
      const to = endOfMonth(addMonths(now, -1));
      const prevFrom = startOfMonth(addMonths(now, -2));
      const prevTo = endOfMonth(addMonths(now, -2));
      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        label: "الشهر اللي فات مقابل اللي قبله",
      };
    }
    case "this_year": {
      const from = startOfYear(now);
      const to = endOfDay(now);
      const prevYearStart = startOfYear(addYears(now, -1));
      const prevYearEquivalentDay = addDays(prevYearStart, daysBetween(from, to));
      return {
        current: { from, to },
        previous: { from: prevYearStart, to: prevYearEquivalentDay },
        label: "هذه السنة مقابل السنة اللي فاتت",
      };
    }
    case "last_year": {
      const from = startOfYear(addYears(now, -1));
      const to = endOfYear(addYears(now, -1));
      const prevFrom = startOfYear(addYears(now, -2));
      const prevTo = endOfYear(addYears(now, -2));
      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        label: "السنة اللي فاتت مقابل اللي قبلها",
      };
    }
    case "custom": {
      if (!customFrom || !customTo) {
        throw new Error("الفترة المخصصة محتاجة تاريخ بداية ونهاية");
      }
      const lengthDays = daysBetween(customFrom, customTo);
      return {
        current: { from: customFrom, to: customTo },
        previous: { from: addDays(customFrom, -(lengthDays + 1)), to: addDays(customFrom, -1) },
        label: "الفترة المخصصة مقابل نفس الطول قبلها",
      };
    }
  }
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  changePct: number | null; // null لو previous صفر (مينفعش نحسب نسبة تغيّر)
}

export function compareMetric(current: number, previous: number): ComparisonMetric {
  const changePct = previous !== 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
  return { current, previous, changePct };
}

// ==================== مدة استقرار الأداء بعد تغيير كبير (Learning Phase) ====================
// السؤال: "لو زودت الميزانية، هياخد قد إيه لحد ما يستقر الأداء؟" - بدل
// ما نرجّع رقم عام من الصناعة (7 أيام مثلاً، مش دقيق لكل حساب)، بنستخدم
// تاريخ الحساب ده تحديداً من ExperimentLog (اللي أصلاً بيسجل كل تعديل)
// عشان نقول "عندك تحديداً، التعديلات الكبيرة بتاخد X يوم" - لو مفيش
// تاريخ كافي، بنرجع لمعيار صناعي موثّق مع توضيح صريح إنه تقدير عام

export interface LearningPhaseEstimate {
  estimatedDays: number;
  basis: "account_history" | "industry_benchmark"; // مصدر الرقم - لازم يكون واضح للمستخدم
  sampleSize: number; // كام تعديل سابق اتبني عليه التقدير (لو account_history)
}

const INDUSTRY_BENCHMARK_DAYS = 7; // معيار موثّق عام لخوارزميات المزايدة الذكية (Smart Bidding/CBO)
const MIN_SAMPLE_FOR_ACCOUNT_ESTIMATE = 3; // أقل عدد تعديلات سابقة قبل ما نثق في نمط الحساب نفسه

export function estimateLearningPhaseDuration(
  pastSignificantChanges: Array<{ daysToStabilize: number }>
): LearningPhaseEstimate {
  if (pastSignificantChanges.length < MIN_SAMPLE_FOR_ACCOUNT_ESTIMATE) {
    return {
      estimatedDays: INDUSTRY_BENCHMARK_DAYS,
      basis: "industry_benchmark",
      sampleSize: pastSignificantChanges.length,
    };
  }

  const avg =
    pastSignificantChanges.reduce((sum, c) => sum + c.daysToStabilize, 0) / pastSignificantChanges.length;

  return {
    estimatedDays: Math.round(avg),
    basis: "account_history",
    sampleSize: pastSignificantChanges.length,
  };
}

// بيحدد "الاستقرار" فعلياً من سلسلة زمنية يومية - أول يوم يبدأ منه تقلب
// القيمة يوم لبعده يفضل تحت عتبة معقولة (15%) لمدة 3 أيام متتالية على الأقل
export function findStabilizationDay(dailyValues: number[]): number | null {
  const STABILITY_THRESHOLD_PCT = 15;
  const REQUIRED_STABLE_DAYS = 3;

  let stableStreak = 0;

  for (let i = 1; i < dailyValues.length; i++) {
    const prev = dailyValues[i - 1];
    const curr = dailyValues[i];
    const changePct = prev !== 0 ? Math.abs((curr - prev) / prev) * 100 : 0;

    if (changePct <= STABILITY_THRESHOLD_PCT) {
      stableStreak++;
      if (stableStreak >= REQUIRED_STABLE_DAYS) {
        return i - REQUIRED_STABLE_DAYS + 1; // اليوم اللي بدأ فيه الاستقرار فعلياً
      }
    } else {
      stableStreak = 0;
    }
  }

  return null; // لسه ما استقرش لحد آخر يوم في البيانات المتاحة
}

// ==== دوال مساعدة للتواريخ - بسيطة ومباشرة، مفيش داعي لمكتبة خارجية لحاجة بالبساطة دي ====

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}
function startOfWeek(d: Date): Date {
  // الأسبوع بيبدأ السبت (الأسبوع العربي/الخليجي)، مش الأحد الغربي
  const r = startOfDay(d);
  const day = r.getDay(); // 0 = الأحد
  const diff = (day + 1) % 7; // المسافة للسبت اللي فات
  return addDays(r, -diff);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), 11, 31));
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
