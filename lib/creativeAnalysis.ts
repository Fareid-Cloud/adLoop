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

export function rankCreatives(
  creatives: CreativePerformance[],
  historicalCtrByAdId: Map<string, number[]> // آخر N يوم من CTR لكل إعلان - لفحص التعب
): CreativeRanking {
  const minCost = getMinCostForRanking(creatives);
  const eligible = creatives.filter((c) => c.cost >= minCost && c.cpa > 0);

  const sortedByCpa = [...eligible].sort((a, b) => a.cpa - b.cpa);

  const fatigued = creatives
    .map((c) => {
      const history = historicalCtrByAdId.get(c.adId) ?? [];
      const anomaly = detectAnomaly(c.ctr, history);
      return { ...c, zScore: anomaly.zScore, isAnomaly: anomaly.isAnomaly && anomaly.direction === "below" };
    })
    .filter((c) => c.isAnomaly)
    .map(({ isAnomaly, ...rest }) => rest);

  return {
    best: sortedByCpa.slice(0, 3),
    worst: sortedByCpa.slice(-3).reverse(),
    fatigued,
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
// يوم واحد حظ، مش نمط. وكمان: إعلان "متعب" (تعبه مؤكد إحصائياً) ميستاهلش
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
          reason: `العائد (ROAS ${c.roas}x) تحت نقطة التعادل الحقيقية لحسابك (${Math.round(breakEvenRoas * 100) / 100}x، من هامش ربح ${profitMarginPct}%) - الإعلان ده بيخسّرك فلوس فعلياً، مش تقريباً.`,
        };
      }
    }


    // عبر أيام كافية (مش نوقف إعلان لسه شغال من ساعتين)
    if (c.cpa === 0 && c.cost > accountAvgCpa) {
      if (daysActive < MIN_DAYS_ACTIVE_FOR_KILL) {
        return { ...base, divergencePct: -100, decision: "WATCH", reason: `صرف بدون تحويل، لكن الإعلان شغال ${daysActive} يوم بس لسه - محتاج ${MIN_DAYS_ACTIVE_FOR_KILL} أيام على الأقل قبل الحكم.` };
      }
      return {
        ...base, divergencePct: -100, decision: "KILL",
        reason: `صرفت ${c.cost} من غير أي تحويل واحد عبر ${daysActive} يوم - أكتر من متوسط تكلفة تحويل في حسابك (${Math.round(accountAvgCpa * 100) / 100}).`,
      };
    }

    // بوابة أولى بأقل عتبة (Kill) - عشان نقدر نكمل نفحص. لو الاتجاه Scale،
    // فيه فحص إضافي بعتبة أعلى (20) جوه الفرع نفسه تحت
    if (conversionsForConfidence < MIN_CONVERSIONS_FOR_KILL) {
      return { ...base, divergencePct: 0, decision: "WATCH", reason: "لا توجد عينة كافية للحكم بثقة." };
    }

    const divergencePct = Math.round(((c.cpa - accountAvgCpa) / accountAvgCpa) * 100);

    if (divergencePct <= -DECISION_THRESHOLD_PCT) {
      // Scale محتاج إثبات أقوى بكتير من Kill - مصادر متعددة متفقة على
      // 20-50 تحويل قبل ما تثق في زيادة ميزانية، مش 5 بس
      if (conversionsForConfidence < MIN_CONVERSIONS_FOR_SCALE) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن بعينة ${conversionsForConfidence} تحويل بس - Scale محتاج ${MIN_CONVERSIONS_FOR_SCALE}+ عشان تثق فيه، عكس Kill اللي ممكن يتقرر بعينة أصغر.` };
      }
      // إعلان متعب (اتجاهه بيتراجع إحصائياً) - ميستاهلش Scale حتى لو
      // متوسط تكلفته لسه كويس، لأن الاتجاه أهم من اللقطة الحالية
      if (fatiguedAdIds.has(c.adId)) {
        return { ...base, divergencePct, decision: "WATCH", reason: "التكلفة أرخص من المتوسط، لكن الأداء بدأ يتعب إحصائياً - متزوّدش ميزانية لحد ما يستقر." };
      }
      if (daysActive < MIN_DAYS_ACTIVE_FOR_SCALE) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن على ${daysActive} يوم بس - محتاج ${MIN_DAYS_ACTIVE_FOR_SCALE} أيام على الأقل يثبت نفسه، مش يوم حظ واحد.` };
      }
      // تأكيد الترتيب النسبي - لازم يكون فعلاً من أرخص 30% من الإعلانات،
      // مش بس بعيد عن المتوسط رقمياً (ممكن المتوسط نفسه متأثر بإعلان شاذ)
      if (rank !== undefined && rank > bestRankCutoff) {
        return { ...base, divergencePct, decision: "WATCH", reason: "التكلفة أرخص من المتوسط، لكن مش من ضمن أرخص الإعلانات فعلياً - المتوسط ممكن يكون متأثر بإعلان شاذ." };
      }
      // ROAS كنقض: تكلفة رخيصة لكن قيمة العميل ضعيفة (لو البيانات متاحة) -
      // مش نجاح حقيقي، رخيص وفاضي مش نفس رخيص وقيّم
      if (accountAvgRoas !== null && c.roas !== null && c.roas < accountAvgRoas * 0.8) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن العائد (ROAS ${c.roas}x) أضعف من متوسط حسابك (${Math.round(accountAvgRoas * 100) / 100}x) - عملاء رخاص لكن قيمتهم أقل، مش نجاح كامل.` };
      }
      // فحص نقطة التعادل - لو هامش الربح متحدد، الـScale محتاج ROAS
      // فوق نقطة التعادل بمسافة أمان حقيقية (30%)، مش بس فوق الصفر
      if (breakEvenRoas !== null && c.roas !== null && c.roas < breakEvenRoas * SCALE_ROAS_SAFETY_MULTIPLIER) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أرخص من المتوسط، لكن العائد (ROAS ${c.roas}x) قريب جداً من نقطة التعادل (${Math.round(breakEvenRoas * 100) / 100}x) - مش هامش أمان كافي عشان تزوّد ميزانية.` };
      }
      const roasNote = c.roas !== null ? ` والعائد ${c.roas}x` : "";
      return {
        ...base, divergencePct, decision: "SCALE",
        reason: `تكلفة العميل (${c.cpa}) أرخص من متوسط حسابك بـ${Math.abs(divergencePct)}%${roasNote} عبر ${daysActive} يوم وعينة ${conversionsForConfidence} تحويل - زوّد الميزانية ${SAFE_SCALE_INCREASE_PCT}% بس (مش أكتر، وانتظر 3-4 أيام قبل أي زيادة تانية - نفس ممارسة الميديا باير المحترفين).`,
      };
    }

    if (divergencePct >= DECISION_THRESHOLD_PCT) {
      if (daysActive < MIN_DAYS_ACTIVE_FOR_KILL) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أعلى من المتوسط، لكن على ${daysActive} يوم بس - محتاج فرصة أطول قبل الحكم.` };
      }
      if (rank !== undefined && rank < worstRankCutoff) {
        return { ...base, divergencePct, decision: "WATCH", reason: "التكلفة أعلى من المتوسط، لكن مش من ضمن أضعف الإعلانات فعلياً - يستاهل مراقبة بس مش إيقاف فوري." };
      }
      // ROAS كتأكيد إضافي هنا (مش نقض) - لو العائد كمان أضعف من المتوسط،
      // ده يقوّي قرار الإيقاف. لو العائد لسه كويس رغم التكلفة الأعلى،
      // العميل غالي بس قيّم - يستاهل مراجعة بشرية مش إيقاف تلقائي
      if (accountAvgRoas !== null && c.roas !== null && c.roas >= accountAvgRoas) {
        return { ...base, divergencePct, decision: "WATCH", reason: `التكلفة أعلى من المتوسط، لكن العائد (ROAS ${c.roas}x) لسه كويس - عميل غالي لكن قيّم، يستاهل مراجعة بشرية مش إيقاف تلقائي.` };
      }
      return {
        ...base, divergencePct, decision: "KILL",
        reason: `تكلفة العميل (${c.cpa}) أغلى من متوسط حسابك بـ${divergencePct}% عبر ${daysActive} يوم، ومن ضمن أضعف الإعلانات فعلياً - يستاهل إيقاف أو تقليل ميزانية كبير.`,
      };
    }

    return { ...base, divergencePct, decision: "WATCH", reason: "أداء قريب من متوسط حسابك - لا يستدعي قراراً حاسماً الآن." };
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

  const snapshots = await prisma.creativeSnapshot.findMany({
    where: { workspaceId, date: { gte: thirtyDaysAgo }, ...(platform ? { platform: platform as any } : {}) },
  });

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
