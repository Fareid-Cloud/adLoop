// lib/creativeAnalysis.ts
//
// بيجاوب السؤال اللي محدش كان بيقدر يجاوبه قبل كده: "أنهي إعلان بالذات
// (مش حملة) هو اللي بيجيب النتيجة؟". بيستخدم نفس محرك كشف الشذوذ
// الإحصائي (anomalyDetection.ts) على مستوى الإعلان الفردي، مش الحملة.

import { detectAnomaly } from "@/lib/anomalyDetection";

export interface CreativePerformance {
  adId: string;
  adGroupId?: string | null; // مطلوب لجوجل بس - بناء اسم مصدر صحيح لإيقاف الإعلان
  adName: string | null;
  creativeType: string;
  platform: string;
  headline: string | null;
  thumbnailUrl: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  rawConversions: number;
  verifiedConversions: number | null;
  conversionsValue: number | null; // مؤكدة لجوجل بس دلوقتي - ميتا وتيك توك null لحد ما يتأكدوا
  ctr: number;
  cpa: number; // تكلفة التحويل - بتستخدم verified لو متاحة، وإلا raw
  roas: number | null; // العائد على الصرف - null لو مفيش بيانات قيمة تحويل (ميتا/تيك توك حالياً)
  usingVerifiedData: boolean;
}

export interface CreativeRanking {
  best: CreativePerformance[]; // أعلى 3 أداءً - "إيه اللي شغال"
  worst: CreativePerformance[]; // أضعف 3 أداءً بميزانية معتبرة - "إيه اللي بيسرّب فلوس"
  fatigued: Array<CreativePerformance & { zScore: number }>; // إعلانات أداءها بيتراجع إحصائياً عن خط أساسها
}

export function computeCreativePerformance(raw: {
  adId: string;
  adGroupId?: string | null;
  adName: string | null;
  creativeType: string;
  platform: string;
  headline: string | null;
  thumbnailUrl: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  rawConversions: number;
  verifiedConversions: number | null;
  conversionsValue?: number | null;
}): CreativePerformance {
  const ctr = raw.impressions > 0 ? round2((raw.clicks / raw.impressions) * 100) : 0;
  const conversionsValue = raw.conversionsValue ?? null;
  const roas = conversionsValue !== null && raw.cost > 0 ? round2(conversionsValue / raw.cost) : null;

  const usingVerifiedData = raw.verifiedConversions !== null && raw.verifiedConversions > 0;
  const conversionsForCpa = usingVerifiedData ? raw.verifiedConversions! : raw.rawConversions;
  const cpa = conversionsForCpa > 0 ? round2(raw.cost / conversionsForCpa) : 0;

  return { ...raw, conversionsValue, ctr, cpa, roas, usingVerifiedData };
}

// عتبة إنفاق أدنى - مينفعش نحكم على إعلان صرف عليه فلوس قليلة جداً، العينة
// مش كافية إحصائياً. إصلاح باگ مشابه للي في checkCatalogSpendAlertsForWorkspace:
// كانت 20 رقم ثابت من غير وعي بالعملة - بقت نسبة من متوسط تكلفة التحويل
// الفعلي في نفس مجموعة الإعلانات، مش رقم مستورد بعملة مش معروفة
function getMinCostForRanking(creatives: CreativePerformance[]): number {
  const withCpa = creatives.filter((c) => c.cpa > 0);
  if (withCpa.length === 0) return 0;
  const avgCpa = withCpa.reduce((sum, c) => sum + c.cpa, 0) / withCpa.length;
  // لازم الإعلان يكون صرف على الأقل قيمة تحويل واحد متوسط، عشان نقدر
  // نحكم عليه بمنطقية - أقل من كده، مفيش عينة كافية أصلاً
  return avgCpa;
}

// "أفضل إعلان" لازم يكون مبنياً على عينة حقيقية - إعلان بتحويل واحد
// محظوظ بتكلفة منخفضة مش "أفضل إعلان"، ده ضجيج. نفس فلسفة عتبة الـScale
// (الإثبات قبل الحكم)، بس أخف لأن ده ترتيب عرض مش قرار تنفيذي.
const MIN_CONVERSIONS_FOR_BEST = 3;

export function rankCreatives(
  creatives: CreativePerformance[],
  historicalCtrByAdId: Map<string, number[]> // آخر N يوم من CTR لكل إعلان - لفحص التعب
): CreativeRanking {
  const minCost = getMinCostForRanking(creatives);
  const eligible = creatives.filter((c) => c.cost >= minCost && c.cpa > 0);
  const convsOf = (c: CreativePerformance) =>
    c.usingVerifiedData ? c.verifiedConversions! : c.rawConversions;

  const sortedByCpa = [...eligible].sort((a, b) => a.cpa - b.cpa);
  // "الأفضل" من الإعلانات ذات العينة الكافية فقط - مش أرخص تكلفة بأي عينة
  const sortedBest = sortedByCpa.filter((c) => convsOf(c) >= MIN_CONVERSIONS_FOR_BEST);

  const fatigued = creatives
    .map((c) => {
      const history = historicalCtrByAdId.get(c.adId) ?? [];
      const anomaly = detectAnomaly(c.ctr, history);
      return { ...c, zScore: anomaly.zScore, isAnomaly: anomaly.isAnomaly && anomaly.direction === "below" };
    })
    .filter((c) => c.isAnomaly)
    .map(({ isAnomaly, ...rest }) => rest);

  return {
    best: sortedBest.slice(0, 3),
    worst: sortedByCpa.slice(-3).reverse(),
    fatigued,
  };
}

// ==================== أفضل إعلان وثاني أفضل إعلان ====================
//
// "أفضل إعلان" ليس أرخص تكلفة في الجدول. أرخص تكلفة بتحويلين محظوظين ليست
// أفضل شيء لديك - هي أقل شيء نعرف عنه. القاعدة هنا تشترط أربعة أمور معاً
// قبل أن يُسمّى إعلان "الأفضل":
//   ١) عينة حقيقية (٣ تحويلات على الأقل)
//   ٢) إنفاق يكفي للحكم (قيمة تحويل متوسط واحد على الأقل)
//   ٣) امتداد زمني (٣ أيام مختلفة على الأقل، لا يوم حظّ واحد)
//   ٤) ألّا يكون في حالة تعب إحصائي مؤكَّد
// ثم يُرتَّب المؤهَّلون بتكلفة العميل، ويؤكَّد الترتيب بالعائد حين يتوفّر:
// إعلان أرخص بعائد أضعف بكثير ليس أفضل فعلاً، بل أرخص وأفرغ.

const MIN_DAYS_ACTIVE_FOR_BEST = 3;
/** فارق أقل من ذلك بين الأول والثاني لا يُعدّ تفوّقاً حقيقياً بل تذبذباً */
const MEANINGFUL_LEAD_PCT = 10;

export interface TopCreativePick {
  best: CreativePerformance | null;
  runnerUp: CreativePerformance | null;
  /** نسبة تفوّق الأول على الثاني في تكلفة العميل */
  leadPct: number | null;
  /** هل الفارق ذو دلالة أم أن الاثنين متعادلان عملياً */
  isDecisiveLead: boolean;
  /** عدد الإعلانات التي اجتازت شروط الأهلية */
  eligibleCount: number;
  /** سبب عدم وجود ترشيح - يُعرض بدل إظهار فراغ أو رقم مضلِّل */
  insufficientReason: string | null;
}

export function selectTopTwoCreatives(
  creatives: CreativePerformance[],
  daysActiveByAdId: Map<string, number>,
  fatiguedAdIds: Set<string>
): TopCreativePick {
  const empty = (reason: string): TopCreativePick => ({
    best: null, runnerUp: null, leadPct: null, isDecisiveLead: false,
    eligibleCount: 0, insufficientReason: reason,
  });

  if (creatives.length === 0) return empty("لا توجد بيانات على مستوى الإعلان الفردي بعد.");

  const minCost = getMinCostForRanking(creatives);
  const convsOf = (c: CreativePerformance) =>
    c.usingVerifiedData ? c.verifiedConversions! : c.rawConversions;

  const eligible = creatives.filter(
    (c) =>
      c.cpa > 0 &&
      c.cost >= minCost &&
      convsOf(c) >= MIN_CONVERSIONS_FOR_BEST &&
      (daysActiveByAdId.get(c.adId) ?? 0) >= MIN_DAYS_ACTIVE_FOR_BEST &&
      !fatiguedAdIds.has(c.adId)
  );

  if (eligible.length === 0) {
    return empty(
      `لا يوجد إعلان استوفى شروط الترشيح بعد (${MIN_CONVERSIONS_FOR_BEST} تحويلات على الأقل عبر ` +
        `${MIN_DAYS_ACTIVE_FOR_BEST} أيام مختلفة، بإنفاق كافٍ، دون تعب إحصائي). ` +
        `الترشيح بعينة أصغر يسمّي الحظّ نجاحاً.`
    );
  }

  const sorted = [...eligible].sort((a, b) => {
    // العائد كمرجّح أول حين يتوفّر للطرفين: الأرخص بعائد أضعف بكثير ليس الأفضل
    if (a.roas !== null && b.roas !== null) {
      const cpaGapPct = ((b.cpa - a.cpa) / Math.max(a.cpa, b.cpa)) * 100;
      const roasGapPct = ((b.roas - a.roas) / Math.max(a.roas, b.roas, 0.0001)) * 100;
      // فارق التكلفة طفيف بينما فارق العائد كبير ⇒ العائد يحسم
      if (Math.abs(cpaGapPct) < MEANINGFUL_LEAD_PCT && Math.abs(roasGapPct) >= MEANINGFUL_LEAD_PCT) {
        return b.roas - a.roas;
      }
    }
    return a.cpa - b.cpa;
  });

  const best = sorted[0];
  const runnerUp = sorted[1] ?? null;
  const leadPct =
    runnerUp && runnerUp.cpa > 0
      ? Math.round(((runnerUp.cpa - best.cpa) / runnerUp.cpa) * 1000) / 10
      : null;

  return {
    best,
    runnerUp,
    leadPct,
    isDecisiveLead: leadPct !== null && leadPct >= MEANINGFUL_LEAD_PCT,
    eligibleCount: eligible.length,
    insufficientReason: null,
  };
}

// ==================== Scale / Kill / Watch - الإطار الكلاسيكي ====================
// "اعمل إسكيل لإيه، وأوقف إيه؟" - أهم سؤال بيسأله أي Performance Media
// Buyer محترف كل يوم. مش رقم جديد مخترع - نفس معيار الـ20%/5 تحويلات
// المتفق عليه في باقي المنتج كله (bidStrategyAudit، metaBidStrategyAudit،
// تيك توك). الفرق هنا إننا بنقارن الإعلان بمتوسط الحساب نفسه (مش هدف
// خارجي)، وبنحوّل النتيجة لقرار فعلي (SUGGESTION له Apply/Dismiss)،
// مش رقم ترتيب بس المستخدم لازم يفسّره بنفسه.
// إعادة تفكير كاملة بعد ملاحظة صحيحة 100%: "5 تحويلات ممكن تيجي في يوم
// واحد" - كان الشرط بيعد العدد بس، مش الانتشار الزمني. 5 تحويلات في
// يوم واحد حظ، مش نمط. وكمان: إعلان "مُجهَد" (تعبه مؤكد إحصائياً) ميستاهلش
// Scale أبداً حتى لو متوسط تكلفته لسه شكله كويس - الاتجاه العام أهم من
// اللقطة الحالية. ميديا باير محترف بيبص للاتنين مع بعض، مش رقم واحد.
// إعادة ضبط بعد بحث في ممارسات ميديا باير محترفين حقيقيين (8 مصادر
// مستقلة متفقة): نسبة الزيادة الآمنة 20% مش 25% (اتفاق قوي عبر أكتر من
// مصدر: "مش أكتر من 20%")، وعدد التحويلات المطلوب لـScale أعلى بكتير
// من Kill - المصادر بتقول 20-50 تحويل قبل الـScale، مقابل عتبة أخف
// لـKill (إيقاف صرف واضح مينفعش يستنى نفس المدة اللي الـScale محتاجها)
const DECISION_THRESHOLD_PCT = 20; // نفس المعيار المستخدم في كل مكان تاني بالمنتج
const MIN_CONVERSIONS_FOR_KILL = 5;
const MIN_CONVERSIONS_FOR_SCALE = 20; // أعلى بكتير من Kill - نفس نطاق الـ20-50 اللي المصادر متفقة عليه
const MIN_DAYS_ACTIVE_FOR_SCALE = 4; // لازم يثبت نفسه عبر أيام مختلفة، مش يوم حظ واحد
const MIN_DAYS_ACTIVE_FOR_KILL = 3; // أقل تشدداً من Scale - إيقاف مبكر لصرف واضح أضمن من التسرّع بزيادة ميزانية
const SAFE_SCALE_INCREASE_PCT = 20; // كان 25% - مصادر متعددة متفقة على 20% كحد أقصى آمن

export interface ScaleKillDecision {
  adId: string;
  adGroupId?: string | null; // مطلوب لجوجل بس
  adName: string | null;
  platform: string;
  cpa: number;
  accountAvgCpa: number;
  divergencePct: number;
  decision: "SCALE" | "KILL" | "WATCH";
  reason: string;
  /** السبب بالإنجليزية - مكتوب بلغته لا مترجَماً حرفياً */
  reasonEn: string;
}

// معامل أمان فوق نقطة التعادل - "established brands target 3.5x-5x على
// ميتا" (بحث حقيقي) يعني الهدف الصحي أعلى من التعادل بمسافة، مش عليه
// بالظبط. 1.3 معقول ومتحفظ من غير ما يكون تعسفي - مبني على نقطة التعادل
// نفسها (الرقم الحقيقي للحساب ده)، مش رقم عالمي مستورد
const SCALE_ROAS_SAFETY_MULTIPLIER = 1.3;

export function classifyScaleKillWatch(
  creatives: CreativePerformance[],
  daysActiveByAdId: Map<string, number>, // كام يوم مختلف عنده بيانات فيه - مش عدد التحويلات
  fatiguedAdIds: Set<string>, // نفس النتيجة اللي rankCreatives بيحسبها - مشترَكة، مش محسوبة مرتين
  profitMarginPct: number | null = null // من إعدادات الـWorkspace - لو موجود، نقطة التعادل = 1 ÷ الهامش (بحث حقيقي، مش رقم ROAS ثابت للكل)
): ScaleKillDecision[] {
  const eligible = creatives.filter((c) => c.cpa > 0);
  if (eligible.length < 2) return []; // محتاجين على الأقل إعلانين نقارن بينهم

  const accountAvgCpa = eligible.reduce((sum, c) => sum + c.cpa, 0) / eligible.length;
  const breakEvenRoas = profitMarginPct && profitMarginPct > 0 ? 1 / (profitMarginPct / 100) : null;

  // ترتيب نسبي - "هو ده فعلاً الأضعف/الأقوى بين كل الإعلانات، مش بس
  // بعيد عن المتوسط رقمياً؟" إشارة تأكيد إضافية، مش بديلة عن العتبة
  const sortedByCpa = [...eligible].sort((a, b) => a.cpa - b.cpa); // الأرخص أول
  const rankById = new Map(sortedByCpa.map((c, i) => [c.adId, i]));
  const worstRankCutoff = Math.floor(sortedByCpa.length * 0.7); // أغلى 30%
  const bestRankCutoff = Math.floor(sortedByCpa.length * 0.3); // أرخص 30%

  // ROAS - إشارة تأكيد/نقض إضافية لو البيانات متاحة (جوجل/ميتا/تيك توك دلوقتي).
  // تكلفة رخيصة لكن قيمة تحويل ضعيفة مش نجاح حقيقي، والعكس ممكن يبرر
  // تكلفة أعلى شوية
  const withRoas = eligible.filter((c) => c.roas !== null);
  const accountAvgRoas = withRoas.length >= 2
    ? withRoas.reduce((sum, c) => sum + (c.roas ?? 0), 0) / withRoas.length
    : null;

  return creatives.map((c): ScaleKillDecision => {
    const base = {
      adId: c.adId, adGroupId: c.adGroupId, adName: c.adName, platform: c.platform,
      cpa: c.cpa, accountAvgCpa: Math.round(accountAvgCpa * 100) / 100,
    };
    const daysActive = daysActiveByAdId.get(c.adId) ?? 0;
    const rank = rankById.get(c.adId);
    const conversionsForConfidence = c.usingVerifiedData ? c.verifiedConversions! : c.rawConversions;

    // فحص الربحية المطلقة - أهم وأساسي من أي مقارنة نسبية. لو عارفين
    // نقطة التعادل الحقيقية (من هامش الربح المُدخل)، إعلان تحت النقطة دي
    // بيخسر فلوس فعلياً بغض النظر عن ترتيبه بين باقي الإعلانات
    if (breakEvenRoas !== null && c.roas !== null && conversionsForConfidence >= MIN_CONVERSIONS_FOR_KILL) {
      if (c.roas < breakEvenRoas && daysActive >= MIN_DAYS_ACTIVE_FOR_KILL) {
        return {
          ...base, divergencePct: Math.round(((c.roas - breakEvenRoas) / breakEvenRoas) * 100), decision: "KILL",
          reason: `العائد (ROAS ${c.roas}x) تحت نقطة التعادل الحقيقية لحسابك (${Math.round(breakEvenRoas * 100) / 100}x، محسوبة من هامش ربح ${profitMarginPct}%) - هذا الإعلان يُخسّرك مالاً فعلياً لا تقريباً.`, reasonEn: `Return (ROAS ${c.roas}x) is below your account's real break-even (${Math.round(breakEvenRoas * 100) / 100}x, from a ${profitMarginPct}% margin) - this ad is losing you money outright, not nearly.`,
        };
      }
    }


    // عبر أيام كافية (مش نوقف إعلان لسه شغال من ساعتين)
    if (c.cpa === 0 && c.cost > accountAvgCpa) {
      if (daysActive < MIN_DAYS_ACTIVE_FOR_KILL) {
        return { ...base, divergencePct: -100, decision: "WATCH", reason: `أنفق بلا تحويل، لكنه يعمل منذ ${daysActive} يوم فقط - يحتاج ${MIN_DAYS_ACTIVE_FOR_KILL} أيام على الأقلّ قبل الحكم.` , reasonEn: `Spending with no conversions, but it has only run ${daysActive} days - it needs at least ${MIN_DAYS_ACTIVE_FOR_KILL} before a verdict.` };
      }
      return {
        ...base, divergencePct: -100, decision: "KILL",
        reason: `أنفق ${c.cost} دون تحويل واحد عبر ${daysActive} يوم - أكثر من متوسط تكلفة التحويل في حسابك (${Math.round(accountAvgCpa * 100) / 100}).`, reasonEn: `Spent ${c.cost} without a single conversion across ${daysActive} days - more than your account's average cost per conversion (${Math.round(accountAvgCpa * 100) / 100}).`,
      };
    }

    // بوابة أولى بأقل عتبة (Kill) - عشان نقدر نكمل نفحص. لو الاتجاه Scale،
    // فيه فحص إضافي بعتبة أعلى (20) جوه الفرع نفسه تحت
    if (conversionsForConfidence < MIN_CONVERSIONS_FOR_KILL) {
      return { ...base, divergencePct: 0, decision: "WATCH", reason: "لا توجد عيّنة كافية للحكم بثقة." , reasonEn: "Not a large enough sample to judge with confidence." };
    }

    const divergencePct = Math.round(((c.cpa - accountAvgCpa) / accountAvgCpa) * 100);

    if (divergencePct <= -DECISION_THRESHOLD_PCT) {
      // Scale محتاج إثبات أقوى بكتير من Kill - مصادر متعددة متفقة على
      // 20-50 تحويل قبل ما تثق في زيادة ميزانية، مش 5 بس
      if (conversionsForConfidence < MIN_CONVERSIONS_FOR_SCALE) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن بعيّنة ${conversionsForConfidence} تحويل فقط - التوسيع يحتاج ${MIN_CONVERSIONS_FOR_SCALE} تحويلاً على الأقلّ ليُوثق به، بخلاف الإيقاف الذي يُقرَّر بعيّنة أصغر.` , reasonEn: `Cheaper than average, but on a sample of only ${conversionsForConfidence} conversions - scaling needs at least ${MIN_CONVERSIONS_FOR_SCALE} to be trusted, unlike pausing, which can be decided on less.` };
      }
      // إعلان مُجهَد (اتجاهه بيتراجع إحصائياً) - ميستاهلش Scale حتى لو
      // متوسط تكلفته لسه كويس، لأن الاتجاه أهم من اللقطة الحالية
      if (fatiguedAdIds.has(c.adId)) {
        return { ...base, divergencePct, decision: "WATCH", reason: "التكلفة أرخص من المتوسط، لكن الأداء بدأ يتراجع إحصائياً - لا تزد الميزانية حتى يستقرّ." , reasonEn: "Cheaper than average, but performance has begun to decline statistically - hold the budget until it settles." };
      }
      if (daysActive < MIN_DAYS_ACTIVE_FOR_SCALE) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن عبر ${daysActive} يوم فقط - يحتاج ${MIN_DAYS_ACTIVE_FOR_SCALE} أيام على الأقلّ ليُثبت نفسه، لا يوم حظّ واحد.` , reasonEn: `Cheaper than average, but across only ${daysActive} days - it needs at least ${MIN_DAYS_ACTIVE_FOR_SCALE} to prove itself, not one lucky day.` };
      }
      // تأكيد الترتيب النسبي - لازم يكون فعلاً من أرخص 30% من الإعلانات،
      // مش بس بعيد عن المتوسط رقمياً (ممكن المتوسط نفسه متأثر بإعلان شاذ)
      if (rank !== undefined && rank > bestRankCutoff) {
        return { ...base, divergencePct, decision: "WATCH", reason: "التكلفة أرخص من المتوسط، لكنه ليس فعلاً ضمن أرخص إعلاناتك - قد يكون المتوسط متأثّراً بإعلان شاذّ." , reasonEn: "Cheaper than average, but not genuinely among your cheapest ads - the average may be skewed by one outlier." };
      }
      // ROAS كنقض: تكلفة رخيصة لكن قيمة العميل ضعيفة (لو البيانات متاحة) -
      // مش نجاح حقيقي، رخيص وفاضي مش نفس رخيص وقيّم
      if (accountAvgRoas !== null && c.roas !== null && c.roas < accountAvgRoas * 0.8) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن العائد (ROAS ${c.roas}x) أضعف من متوسط حسابك (${Math.round(accountAvgRoas * 100) / 100}x) - عملاء أرخص لكن قيمتهم أقلّ، وليس نجاحاً كاملاً.` , reasonEn: `Cheaper than average, but the return (ROAS ${c.roas}x) is weaker than your account average (${Math.round(accountAvgRoas * 100) / 100}x) - cheaper customers worth less, not a full win.` };
      }
      // فحص نقطة التعادل - لو هامش الربح متحدد، الـScale محتاج ROAS
      // فوق نقطة التعادل بمسافة أمان حقيقية (30%)، مش بس فوق الصفر
      if (breakEvenRoas !== null && c.roas !== null && c.roas < breakEvenRoas * SCALE_ROAS_SAFETY_MULTIPLIER) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن العائد (ROAS ${c.roas}x) قريب جداً من نقطة التعادل (${Math.round(breakEvenRoas * 100) / 100}x) - هامش الأمان لا يكفي لزيادة الميزانية.` , reasonEn: `Cheaper than average, but the return (ROAS ${c.roas}x) sits very close to break-even (${Math.round(breakEvenRoas * 100) / 100}x) - too thin a margin to raise the budget on.` };
      }
      const roasNote = c.roas !== null ? ` والعائد ${c.roas}x` : "";
      return {
        ...base, divergencePct, decision: "SCALE",
        reason: `تكلفة العميل (${c.cpa}) أرخص من متوسط حسابك بـ${Math.abs(divergencePct)}%${roasNote} عبر ${daysActive} يوم وعيّنة ${conversionsForConfidence} تحويل - زد الميزانية ${SAFE_SCALE_INCREASE_PCT}% فقط، وانتظر ثلاثة إلى أربعة أيام قبل أي زيادة تالية.`, reasonEn: `Cost per customer (${c.cpa}) is ${Math.abs(divergencePct)}% below your account average${roasNote}, across ${daysActive} days and ${conversionsForConfidence} conversions - raise the budget by ${SAFE_SCALE_INCREASE_PCT}% only, then wait three to four days before the next increase.`,
      };
    }

    if (divergencePct >= DECISION_THRESHOLD_PCT) {
      if (daysActive < MIN_DAYS_ACTIVE_FOR_KILL) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أعلى من المتوسط، لكن عبر ${daysActive} يوم فقط - يحتاج مدّة أطول قبل الحكم عليه.` , reasonEn: `Costlier than average, but across only ${daysActive} days - it needs longer before a verdict.` };
      }
      if (rank !== undefined && rank < worstRankCutoff) {
        return { ...base, divergencePct, decision: "WATCH", reason: "التكلفة أعلى من المتوسط، لكنه ليس فعلاً ضمن أضعف إعلاناتك - يستحقّ المراقبة لا الإيقاف الفوري." , reasonEn: "Costlier than average, but not genuinely among your weakest ads - worth watching, not pausing yet." };
      }
      // ROAS كتأكيد إضافي هنا (مش نقض) - لو العائد كمان أضعف من المتوسط،
      // ده يقوّي قرار الإيقاف. لو العائد لسه كويس رغم التكلفة الأعلى،
      // العميل غالي بس قيّم - يستاهل مراجعة بشرية مش إيقاف تلقائي
      if (accountAvgRoas !== null && c.roas !== null && c.roas >= accountAvgRoas) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أعلى من المتوسط، لكن العائد (ROAS ${c.roas}x) ما زال جيّداً - عميل مكلف لكنه قيّم، يستحقّ مراجعة بشرية لا إيقافاً تلقائياً.` , reasonEn: `Costlier than average, but the return (ROAS ${c.roas}x) is still good - an expensive customer who is nonetheless valuable, worth a human look rather than an automatic pause.` };
      }
      return {
        ...base, divergencePct, decision: "KILL",
        reason: `تكلفة العميل (${c.cpa}) أعلى من متوسط حسابك بـ${divergencePct}% عبر ${daysActive} يوم، وهو فعلاً ضمن أضعف إعلاناتك - يستحقّ الإيقاف أو خفضاً كبيراً في الميزانية.`, reasonEn: `Cost per customer (${c.cpa}) is ${divergencePct}% above your account average across ${daysActive} days, and it genuinely ranks among your weakest ads - it deserves a pause or a sharp budget cut.`,
      };
    }

    return { ...base, divergencePct, decision: "WATCH", reason: "أداء قريب من متوسط حسابك - لا يستدعي قراراً حاسماً الآن." , reasonEn: "Performance is close to your account average - no decisive action needed right now." };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== دالة تجميع مشتركة - نقطة حقيقة وحيدة ====================
// كانت منطق التجميع ده مكرر في مكانين (creatives/page.tsx و
// scaleKillAlerts.ts) - بدل ما نكرره تالت مرة لصفحات المنصة الفردية،
// استخرجناه هنا. أي تعديل مستقبلي هيتعمل مرة واحدة، مش في 3+ أماكن.
export async function getWorkspaceCreativePerformances(
  workspaceId: string,
  platform?: string
): Promise<{
  performances: CreativePerformance[];
  daysActiveByAdId: Map<string, number>;
  historicalCtrByAdId: Map<string, number[]>;
  fatiguedAdIds: Set<string>;
  campaignIdByAdId: Map<string, string>;
}> {
  const { prisma } = await import("@/lib/prisma");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 🔴 **`CreativeSnapshot.verifiedConversions` عمره ما كُتب** (GAP-1): الثلاث
  // مزامنات تكتب `cost` و`rawConversions` فقط، فكان `usingVerifiedData` أدناه
  // **دائماً `false` في الإنتاج** - فترتيبُ الإبداعات وقرارُ Scale/Kill على
  // مستوى الإعلان يرجعان أبداً إلى رقم المنصّة الخام. وكان `demoSeed` يكتبه،
  // فتبدو الميزة عاملةً في العرض وميتةً عند المشترك.
  //
  // التحقّق الحقيقيّ يعيش في `ConversionVerification`، وما يحمل معرّف إعلانٍ
  // منه (ماسنجر: `referral.ad_id`) يُنسَب هنا إلى إبداعه. وما لا يحمله
  // (`adId: "ALL"` - نقرات واتساب) **لا يُوزَّع على الإعلانات تخميناً**:
  // يبقى تحقّقاً على مستوى الحملة، ويظلّ هذا الإعلان على رقمه الخام.
  const [snapshots, adVerifications] = await Promise.all([
    prisma.creativeSnapshot.findMany({
      where: { workspaceId, date: { gte: thirtyDaysAgo }, ...(platform ? { platform: platform as any } : {}) },
    }),
    prisma.conversionVerification.groupBy({
      by: ["adId"],
      where: {
        workspaceId,
        date: { gte: thirtyDaysAgo },
        adId: { not: "ALL" },
        ...(platform ? { platform: platform as any } : {}),
      },
      _sum: { verifiedCount: true },
    }),
  ]);

  const verifiedByAdId = new Map<string, number>(
    adVerifications.map((v) => [v.adId, v._sum.verifiedCount ?? 0])
  );

  const byAd = new Map<string, any[]>();
  for (const s of snapshots) {
    const arr = byAd.get(s.adId) ?? [];
    arr.push(s);
    byAd.set(s.adId, arr);
  }

  const performances: CreativePerformance[] = [];
  const historicalCtrByAdId = new Map<string, number[]>();
  const daysActiveByAdId = new Map<string, number>();
  const campaignIdByAdId = new Map<string, string>();

  for (const [adId, rows] of byAd.entries()) {
    campaignIdByAdId.set(adId, rows[0].campaignId);
    const totals = rows.reduce(
      (acc: any, r: any) => ({
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        cost: acc.cost + r.cost,
        rawConversions: acc.rawConversions + r.rawConversions,
        verifiedConversions: (acc.verifiedConversions ?? 0) + (r.verifiedConversions ?? 0),
        conversionsValue: r.conversionsValue !== null
          ? (acc.conversionsValue ?? 0) + r.conversionsValue
          : acc.conversionsValue,
      }),
      { impressions: 0, clicks: 0, cost: 0, rawConversions: 0, verifiedConversions: 0, conversionsValue: null as number | null }
    );
    // التحقّق المنسوب لهذا الإعلان بعينه يُضاف إلى ما في اللقطة (وهو صفر
    // للحسابات الحقيقية، ومبذورٌ في العرض) - جمعٌ لا استبدال.
    totals.verifiedConversions += verifiedByAdId.get(adId) ?? 0;

    performances.push(
      computeCreativePerformance({
        adId,
        adGroupId: rows[0].adGroupId,
        adName: rows[0].adName,
        creativeType: rows[0].creativeType,
        platform: rows[0].platform,
        headline: rows[0].headline,
        thumbnailUrl: rows[0].thumbnailUrl,
        ...totals,
      })
    );

    historicalCtrByAdId.set(
      adId,
      rows.filter((r: any) => r.impressions > 0).map((r: any) => (r.clicks / r.impressions) * 100)
    );
    daysActiveByAdId.set(adId, new Set(rows.map((r: any) => r.date.toISOString().slice(0, 10))).size);
  }

  const ranking = rankCreatives(performances, historicalCtrByAdId);
  const fatiguedAdIds = new Set(ranking.fatigued.map((f) => f.adId));

  return { performances, daysActiveByAdId, historicalCtrByAdId, fatiguedAdIds, campaignIdByAdId };
}
