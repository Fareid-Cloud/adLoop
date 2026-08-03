// lib/adDecisions.ts
//
// عمود القرار بجوار كل إعلان: Scale (أخضر ↑) / Hold (رمادي) / Pause (أحمر ↓).
//
// ثلاث طبقات، كلٌّ منها كانت ناقصة قبل هذا الملف:
//
// ١) القاعدة: تُبنى على classifyScaleKillWatch الموجود (تكلفة العميل مقابل
//    متوسط الحساب + ROAS مقابل نقطة التعادل الحقيقية + حجم العينة + عدد
//    الأيام + التعب الإحصائي)، ويُضاف إليها هنا **التكرار (Frequency)**:
//    جمهور رأى الإعلان أكثر من ٣ مرات في أسبوع مشبع، وزيادة ميزانيته
//    تشتري تكراراً لا وصولاً جديداً - أشهر خطأ Scale على ميتا.
//
// ٢) التنفيذ الحقيقي: زرّ يُجري نداءً فعلياً على المنصة. الميزانية لا
//    تُضبط على الإعلان في أي منصة، فـ Scale يزيد ميزانية الكيان الأب
//    (مجموعة ميتا/تيك توك، حملة جوجل) بنسبة آمنة ٢٠٪ - لا أكثر.
//
// ٣) البوابة الزمنية: بعد أي تنفيذ لا يُقترح شيء جديد على الإعلان نفسه
//    قبل ٤ أيام. السبب ليس تجميلاً: التغيير يُدخل الإعلان في إعادة تعلّم،
//    وقياسه قبل استقراره يقيس الاضطراب لا الأثر. ثم يُعاد التقييم من الصفر
//    بمقارنة ما قبل بما بعد - وهذا ما يجعلها "حلقة" لا سلسلة تغييرات عمياء.

import { prisma } from "@/lib/prisma";
import {
  classifyScaleKillWatch,
  getWorkspaceCreativePerformances,
  type CreativePerformance,
} from "@/lib/creativeAnalysis";
import { platformLabel, t } from "@/lib/i18n/dictionary";

/** نسبة الزيادة الآمنة - ٢٠٪ لا أكثر، باتفاق مصادر ميديا باير متعددة */
export const SAFE_SCALE_INCREASE_PCT = 20;

/** أيام التهدئة بعد أي تنفيذ، قبل إعادة التقييم من جديد */
export const DECISION_COOLDOWN_DAYS = 4;

/**
 * سقف التكرار الأسبوعي. فوقه يُمنع Scale ويتقوّى Pause: التكرار المرتفع
 * يعني أن الجمهور استُهلك، فالمزيد من الإنفاق يُعيد العرض على الناس أنفسهم.
 */
export const FREQUENCY_SATURATION_THRESHOLD = 3.0;

export type Decision = "SCALE" | "HOLD" | "PAUSE";

export interface AdDecisionSignals {
  cpa: number;
  accountAvgCpa: number;
  divergencePct: number;
  roas: number | null;
  frequency: number | null;
  revenue: number | null;
  conversions: number;
  cost: number;
  daysActive: number;
  fatigued: boolean;
}

export interface AdDecisionView {
  adId: string;
  adName: string | null;
  platform: string;
  campaignId: string | null;
  adSetId: string | null;
  adGroupId: string | null;

  decision: Decision;
  reason: string;
  /** السبب بالإنجليزية - يعبر من `creativeAnalysis` بلا إعادة صياغة */
  reasonEn: string;
  signals: AdDecisionSignals;

  /** هل يمكن تنفيذ هذا القرار فعلاً على المنصة الآن */
  executable: boolean;
  /** سبب تعطيل الزرّ - يُعرض للمستخدم بدل زرّ صامت لا يعمل */
  blockedReason: string | null;
  /** خلال فترة التهدئة: متى يُعاد التقييم */
  cooldownUntil: Date | null;
  cooldownDaysRemaining: number;
  /** آخر قرار نُفِّذ فعلاً على هذا الإعلان */
  lastAppliedDecision: Decision | null;
  scaleIncreasePct: number;
  /** تحذير الأثر الجانبي: الزيادة تمسّ كل إعلانات الكيان الأب */
  scaleAffectsSiblings: boolean;
}

// ==================== القاعدة ====================

interface BuildOptions {
  workspaceId: string;
  platform?: string;
  /** التكرار لكل منصة - من getFrequencyByPlatform. متاح لميتا وتيك توك فقط */
  frequencyByPlatform?: Record<string, number>;
}

export async function buildAdDecisions(opts: BuildOptions): Promise<AdDecisionView[]> {
  const { workspaceId, platform } = opts;

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const { performances, daysActiveByAdId, fatiguedAdIds, campaignIdByAdId } =
    await getWorkspaceCreativePerformances(workspaceId, platform);

  if (performances.length === 0) return [];

  const classified = classifyScaleKillWatch(
    performances,
    daysActiveByAdId,
    fatiguedAdIds,
    workspace?.profitMarginPct ?? null
  );
  const byAdId = new Map(classified.map((d) => [d.adId, d]));
  const perfById = new Map(performances.map((p) => [p.adId, p]));

  // معرّفات الكيان الأب - مطلوبة للتنفيذ، ومصدرها آخر لقطة لكل إعلان
  const parentRows = await prisma.creativeSnapshot.findMany({
    where: { workspaceId, adId: { in: performances.map((p) => p.adId) } },
    select: { adId: true, adSetId: true, adGroupId: true, campaignId: true, platform: true },
    distinct: ["adId"],
    orderBy: { date: "desc" },
  });
  const parentByAdId = new Map(parentRows.map((r) => [r.adId, r]));

  // سجلّات القرارات السابقة - بوابة الأيام الأربعة
  const records = await prisma.adDecisionRecord.findMany({
    where: { workspaceId, adId: { in: performances.map((p) => p.adId) } },
    orderBy: { appliedAt: "desc" },
  });
  const lastRecordByAdId = new Map<string, (typeof records)[number]>();
  for (const r of records) if (!lastRecordByAdId.has(r.adId)) lastRecordByAdId.set(r.adId, r);

  const now = new Date();
  const views: AdDecisionView[] = [];

  for (const perf of performances) {
    const classification = byAdId.get(perf.adId);
    if (!classification) continue;

    const parent = parentByAdId.get(perf.adId);
    const frequency = opts.frequencyByPlatform?.[perf.platform] ?? null;

    let decision: Decision =
      classification.decision === "KILL"
        ? "PAUSE"
        : classification.decision === "SCALE"
          ? "SCALE"
          : "HOLD";
    let reason = classification.reason;
    let reasonEn = classification.reasonEn;

    // طبقة التكرار - تُطبَّق فوق القاعدة الأساسية لا بدلاً منها
    if (decision === "SCALE" && frequency !== null && frequency >= FREQUENCY_SATURATION_THRESHOLD) {
      decision = "HOLD";
      reason =
        `الأداء يستحقّ الزيادة، لكن معدّل التكرار بلغ ${frequency.toFixed(1)} مرّة لكل شخص أسبوعياً ` +
        `(الحدّ ${FREQUENCY_SATURATION_THRESHOLD}) - الجمهور مُشبَع، وزيادة الميزانية الآن تشتري تكراراً لا وصولاً جديداً. ` +
        `جدّد المحتوى أو وسّع الاستهداف أولاً.`;
      reasonEn =
        `Performance justifies an increase, but frequency has reached ${frequency.toFixed(1)} times per person per week ` +
        `(threshold ${FREQUENCY_SATURATION_THRESHOLD}) - the audience is saturated, and more budget now buys repetition, not new reach. ` +
        `Refresh the creative or widen the targeting first.`;
    }

    // ==== البوابة الزمنية ====
    const lastRecord = lastRecordByAdId.get(perf.adId);
    const inCooldown = !!lastRecord && lastRecord.reEvaluateAt > now;
    const cooldownDaysRemaining = inCooldown
      ? Math.ceil((lastRecord!.reEvaluateAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    // ==== قابلية التنفيذ ====
    let executable = true;
    let blockedReason: string | null = null;

    if (inCooldown) {
      executable = false;
      blockedReason =
        `نُفِّذ قرار «${decisionLabelAr(lastRecord!.decision as Decision)}» على هذا الإعلان قبل ` +
        `${daysSince(lastRecord!.appliedAt, now)} يوم. لا قرار جديد قبل ${cooldownDaysRemaining} يوم - ` +
        `النتيجة لم تستقرّ بعد، وأي تغيير الآن يقيس الاضطراب لا الأثر.`;
    } else if (decision === "SCALE") {
      const missing = missingScaleTarget(perf.platform, parent);
      if (missing) {
        executable = false;
        blockedReason = missing;
      }
    } else if (decision === "PAUSE") {
      if (perf.platform === "GOOGLE_ADS" && (!parent?.adGroupId || !parent?.campaignId)) {
        executable = false;
        blockedReason =
          "ينقص معرّف المجموعة الإعلانية لهذا الإعلان - لا يمكن بناء اسم المصدر الصحيح لدى جوجل. سيتوفّر بعد المزامنة القادمة.";
      }
    }

    views.push({
      adId: perf.adId,
      adName: perf.adName,
      platform: perf.platform,
      campaignId: parent?.campaignId ?? campaignIdByAdId.get(perf.adId) ?? null,
      adSetId: parent?.adSetId ?? null,
      adGroupId: parent?.adGroupId ?? null,
      decision,
      reason,
      reasonEn,
      signals: {
        cpa: perf.cpa,
        accountAvgCpa: classification.accountAvgCpa,
        divergencePct: classification.divergencePct,
        roas: perf.roas,
        frequency,
        revenue: perf.conversionsValue,
        conversions: perf.usingVerifiedData ? (perf.verifiedConversions ?? 0) : perf.rawConversions,
        cost: Math.round(perf.cost),
        daysActive: daysActiveByAdId.get(perf.adId) ?? 0,
        fatigued: fatiguedAdIds.has(perf.adId),
      },
      executable,
      blockedReason,
      cooldownUntil: inCooldown ? lastRecord!.reEvaluateAt : null,
      cooldownDaysRemaining,
      lastAppliedDecision: (lastRecord?.decision as Decision) ?? null,
      scaleIncreasePct: SAFE_SCALE_INCREASE_PCT,
      scaleAffectsSiblings: perf.platform !== "GOOGLE_ADS",
    });
  }

  // الأهمّ أولاً: ما يستنزف المال، ثم ما يستحق التوسيع، ثم الباقي
  const order: Record<Decision, number> = { PAUSE: 0, SCALE: 1, HOLD: 2 };
  return views.sort((a, b) => order[a.decision] - order[b.decision] || b.signals.cost - a.signals.cost);
}

function missingScaleTarget(
  platform: string,
  parent: { adSetId: string | null; campaignId: string | null } | undefined
): string | null {
  if (platform === "GOOGLE_ADS") {
    return parent?.campaignId
      ? null
      : "ينقص معرّف الحملة - ميزانية جوجل تُضبط على مستوى الحملة، ولا هدف للزيادة بدونه.";
  }
  return parent?.adSetId
    ? null
    : "ينقص معرّف المجموعة الإعلانية - الميزانية تُضبط عليها لا على الإعلان. سيتوفّر بعد المزامنة القادمة.";
}

function daysSince(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

/** مفتاح القاموس لكلّ قرار - يُترجَم وقت العرض لا وقت التنفيذ. */
export const DECISION_KEY: Record<Decision, string> = {
  SCALE: "expDesc.decScale",
  PAUSE: "expDesc.decPause",
  HOLD: "expDesc.decHold",
};

export function decisionLabelAr(d: Decision): string {
  return t("ar", DECISION_KEY[d]);
}

// ==================== التنفيذ ====================

export interface ApplyResult {
  ok: boolean;
  message: string;
  previousValue?: number;
  newValue?: number;
  reEvaluateAt: Date;
}

/**
 * ينفّذ القرار فعلاً على المنصة ثم يسجّله. الترتيب مقصود: لا نسجّل شيئاً
 * قبل نجاح النداء، حتى لا نمنع المستخدم ٤ أيام بسبب تنفيذ لم يحدث أصلاً.
 */
export async function applyAdDecision(
  workspaceId: string,
  adId: string,
  decision: Decision
): Promise<ApplyResult> {
  const views = await buildAdDecisions({ workspaceId });
  const view = views.find((v) => v.adId === adId);
  if (!view) throw new Error("الإعلان غير موجود في بيانات آخر ٣٠ يوماً");

  if (view.cooldownUntil && view.cooldownUntil > new Date()) {
    throw new Error(
      `قرار سابق على هذا الإعلان لم تكتمل مدّة تقييمه بعد - متبقٍّ ${view.cooldownDaysRemaining} يوم.`
    );
  }

  const reEvaluateAt = new Date();
  reEvaluateAt.setDate(reEvaluateAt.getDate() + DECISION_COOLDOWN_DAYS);

  let previousValue: number | undefined;
  let newValue: number | undefined;
  let message: string;

  if (decision === "PAUSE") {
    await executePause(workspaceId, view);
    message = "يُوقَف الإعلان فعلياً على المنصّة.";
  } else if (decision === "SCALE") {
    const res = await executeScale(workspaceId, view);
    previousValue = res.previous;
    newValue = res.next;
    message =
      `زِيدت الميزانية ${SAFE_SCALE_INCREASE_PCT}% ` +
      `(من ${round2(res.previous)} إلى ${round2(res.next)}).` +
      (view.scaleAffectsSiblings
        ? " الزيادة على المجموعة الإعلانية، فتشمل باقي إعلاناتها."
        : " الزيادة على ميزانية الحملة، فتشمل باقي إعلاناتها.");
  } else {
    // Hold قرار حقيقي لا "لا شيء": يُثبّت الوضع ويؤجّل أي اقتراح على هذا
    // الإعلان ٤ أيام، فلا يظلّ يطالب المستخدم بقرار اتّخذه فعلاً
    message = `أُبقي الإعلان كما هو. لن يُقترح عليه قرار جديد قبل ${DECISION_COOLDOWN_DAYS} أيام.`;
  }

  await prisma.adDecisionRecord.create({
    data: {
      workspaceId,
      platform: view.platform as never,
      adId: view.adId,
      adName: view.adName,
      campaignId: view.campaignId,
      adSetId: view.adSetId,
      decision: decision as never,
      // السبب يُخزَّن بالعربية وحدها: هذا سجلّ تدقيق داخلي لا نصّ واجهة،
      // والإنجليزية تُبنى وقت العرض من المحرّك نفسه.
      reason: view.reason,
      reEvaluateAt,
      previousValue: previousValue ?? null,
      newValue: newValue ?? null,
      // لقطة ما قبل التنفيذ - أساس المقارنة بعد اكتمال النافذة
      metricsBefore: {
        cpa: view.signals.cpa,
        roas: view.signals.roas,
        cost: view.signals.cost,
        conversions: view.signals.conversions,
        revenue: view.signals.revenue,
        capturedAt: new Date().toISOString(),
      },
    },
  });

  // كل تنفيذ حقيقي يُسجَّل تجربة في المعمل - نفس نمط applyActionFeedItem
  try {
    const { recordExperiment } = await import("@/lib/experimentEngine");
    await recordExperiment({
      workspaceId,
      changeType: decision === "PAUSE" ? "PAUSE" : decision === "SCALE" ? "BUDGET" : "OTHER",
      description: t("ar", "expDesc.adDecision", {
        decision: decisionLabelAr(decision),
        ad: view.adName ?? view.adId,
      }),
      descKey: "expDesc.adDecision",
      // `decisionKey` يملأ `decision` وقت العرض بلغة القارئ
      descVars: { decisionKey: DECISION_KEY[decision], ad: view.adName ?? view.adId },
      campaignId: view.campaignId,
      platform: view.platform as never,
      source: "AUTO",
    });
  } catch (err) {
    // تسجيل التجربة مساعد - لا يجوز أن يُفشل تنفيذاً نجح على المنصة
    console.error("تعذّر تسجيل تجربة قرار الإعلان:", err);
  }

  return { ok: true, message, previousValue, newValue, reEvaluateAt };
}

async function executePause(workspaceId: string, view: AdDecisionView) {
  switch (view.platform) {
    case "GOOGLE_ADS": {
      if (!view.campaignId || !view.adGroupId) throw new Error("بيانات الإعلان ناقصة لدى جوجل");
      const { pauseGoogleAd } = await import("@/lib/syncGoogleAds");
      return pauseGoogleAd(workspaceId, view.campaignId, view.adGroupId, view.adId);
    }
    case "META_ADS": {
      const { pauseMetaAd } = await import("@/lib/syncMetaAds");
      return pauseMetaAd(workspaceId, view.adId);
    }
    case "TIKTOK_ADS": {
      const advertiserId = await resolveTikTokAdvertiserId(workspaceId, view.campaignId);
      const { pauseTikTokAd } = await import("@/lib/syncTikTokAds");
      return pauseTikTokAd(workspaceId, advertiserId, view.adId);
    }
    default:
      throw new Error(`الإيقاف غير مدعوم للمنصة ${platformLabel("ar", view.platform)}`);
  }
}

async function executeScale(
  workspaceId: string,
  view: AdDecisionView
): Promise<{ previous: number; next: number }> {
  switch (view.platform) {
    case "GOOGLE_ADS": {
      if (!view.campaignId) throw new Error("ينقص معرّف الحملة");
      const { changeGoogleCampaignBudget } = await import("@/lib/platformCampaignActions");
      return changeGoogleCampaignBudget(workspaceId, view.campaignId, SAFE_SCALE_INCREASE_PCT);
    }
    case "META_ADS": {
      if (!view.adSetId) throw new Error("ينقص معرّف المجموعة الإعلانية");
      const { changeMetaAdSetBudget } = await import("@/lib/platformCampaignActions");
      return changeMetaAdSetBudget(workspaceId, view.adSetId, SAFE_SCALE_INCREASE_PCT);
    }
    case "TIKTOK_ADS": {
      if (!view.adSetId) throw new Error("ينقص معرّف المجموعة الإعلانية");
      const advertiserId = await resolveTikTokAdvertiserId(workspaceId, view.campaignId);
      const { changeTikTokAdGroupBudget } = await import("@/lib/platformCampaignActions");
      return changeTikTokAdGroupBudget(workspaceId, advertiserId, view.adSetId, SAFE_SCALE_INCREASE_PCT);
    }
    default:
      throw new Error(`التوسيع غير مدعوم للمنصة ${platformLabel("ar", view.platform)}`);
  }
}

async function resolveTikTokAdvertiserId(workspaceId: string, campaignId: string | null): Promise<string> {
  const link = await prisma.campaignLink.findFirst({
    where: {
      workspaceId,
      platform: "TIKTOK_ADS",
      ...(campaignId ? { externalCampaignId: campaignId } : {}),
    },
  });
  if (!link) throw new Error("لا يوجد حساب تيك توك مرتبط بهذه الحملة");
  return link.externalAccountId;
}

// ==================== إعادة التقييم بعد اكتمال النافذة ====================

/**
 * "ولمّا نشوف النتيجة الجديدة نقيّم من الأول": بعد مرور الأيام الأربعة،
 * نقارن أداء الإعلان بما قبل القرار ونسجّل النتيجة. من دون هذه الخطوة
 * تبقى كل القرارات مجرّد تغييرات لم يتحقّق أحد من جدواها.
 */
export async function evaluateDueAdDecisions(workspaceId: string) {
  const now = new Date();
  const due = await prisma.adDecisionRecord.findMany({
    where: { workspaceId, outcome: "PENDING_EVALUATION", reEvaluateAt: { lte: now } },
  });
  if (due.length === 0) return { evaluated: 0 };

  let evaluated = 0;

  for (const record of due) {
    const rows = await prisma.creativeSnapshot.findMany({
      where: { workspaceId, adId: record.adId, date: { gte: record.appliedAt } },
    });

    const before = record.metricsBefore as { cpa?: number; roas?: number | null } | null;

    // إيقاف نجح = صفر إنفاق بعده. غياب الصفوف هنا ليس "بيانات ناقصة"،
    // هو الدليل نفسه على أن الإعلان توقّف فعلاً.
    if (record.decision === "PAUSE") {
      const spentAfter = rows.reduce((s, r) => s + r.cost, 0);
      await prisma.adDecisionRecord.update({
        where: { id: record.id },
        data: {
          outcome: spentAfter <= 0 ? "IMPROVED" : "UNCHANGED",
          metricsAfter: { cost: Math.round(spentAfter), rowsAfter: rows.length },
          evaluatedAt: now,
        },
      });
      evaluated++;
      continue;
    }

    if (rows.length === 0 || !before?.cpa) {
      await prisma.adDecisionRecord.update({
        where: { id: record.id },
        data: { outcome: "INSUFFICIENT_DATA", evaluatedAt: now },
      });
      evaluated++;
      continue;
    }

    const totals = rows.reduce(
      (a, r) => ({
        cost: a.cost + r.cost,
        conversions: a.conversions + (r.verifiedConversions ?? r.rawConversions),
        value: a.value + (r.conversionsValue ?? 0),
      }),
      { cost: 0, conversions: 0, value: 0 }
    );

    if (totals.conversions <= 0) {
      await prisma.adDecisionRecord.update({
        where: { id: record.id },
        data: {
          outcome: "INSUFFICIENT_DATA",
          metricsAfter: { cost: Math.round(totals.cost), conversions: 0 },
          evaluatedAt: now,
        },
      });
      evaluated++;
      continue;
    }

    const cpaAfter = totals.cost / totals.conversions;
    const roasAfter = totals.cost > 0 ? totals.value / totals.cost : null;
    const changePct = ((cpaAfter - before.cpa) / before.cpa) * 100;

    // ±١٠٪ نطاق ضجيج معقول على نافذة ٤ أيام - أقل منه ليس أثراً بل تذبذباً
    const outcome = changePct <= -10 ? "IMPROVED" : changePct >= 10 ? "WORSENED" : "UNCHANGED";

    await prisma.adDecisionRecord.update({
      where: { id: record.id },
      data: {
        outcome: outcome as never,
        metricsAfter: {
          cpa: Math.round(cpaAfter * 100) / 100,
          roas: roasAfter !== null ? Math.round(roasAfter * 100) / 100 : null,
          cost: Math.round(totals.cost),
          conversions: Math.round(totals.conversions * 10) / 10,
          changePct: Math.round(changePct * 10) / 10,
        },
        evaluatedAt: now,
      },
    });
    evaluated++;
  }

  return { evaluated };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
