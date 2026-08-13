
import { t } from "@/lib/i18n/dictionary";// lib/bidStrategyAudit.ts
//
// المنصة بتحسّن نحو الهدف اللي انت حاططه (Target CPA/ROAS)، مش نحو
// الحقيقة. لو الهدف نفسه بعيد عن الواقع (مبني على بيانات المنصة المتضخمة
// بدل الأرقام الحقيقية)، كل عملية التحسين بتاعة جوجل بتفضل بتلاحق رقم غلط.

export type BiddingStrategyType =
  | "TARGET_CPA" | "TARGET_ROAS" | "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CONVERSION_VALUE"
  | "MANUAL_CPC" | "ENHANCED_CPC" | "TARGET_IMPRESSION_SHARE" | "MANUAL_CPM" | "MANUAL_CPV" | string;

export interface BidStrategyInput {
  campaignId: string;
  campaignName: string;
  biddingStrategyType: BiddingStrategyType;
  targetCpa: number | null; // بالعملة، مش micros - محوّلة بالفعل
  targetRoas: number | null; // نسبة (2.5 يعني 250%)
  verifiedCpa: number | null; // الحقيقي الفعلي آخر 30 يوم
  /** 🔴 **اسمه `verifiedRoas` وكان يُمرَّر `null` دائماً، فلم يُفحص
   *  التزامٌ واحدٌ من نوع `TARGET_ROAS` منذ كُتب الملفّ.**
   *
   *  والسبب في الاسم: لم يكن عندنا إيراد منسوب أصلاً حتى نمرّره. ولمّا صار
   *  عندنا (`MetricSnapshot.revenue` = قيمة التحويل التي تنسبها المنصّة
   *  لإعلانها)، تبيّن أنّ هذا **هو** الرقم الصحيح لهذا الفحص بعينه لا رقمنا
   *  المتحقَّق: الفحص يسأل «الهدف الذي ضبطتَه في المنصّة، هل تحقّق؟» -
   *  والمنصّة تحسّن نحو قياسها هي، فمقارنة هدفها بقياسٍ آخر تقارن شيئين
   *  مختلفين وتنذر إنذاراً كاذباً. فسُمّي `actualRoas` بما هو. */
  actualRoas: number | null;
}

export interface BidStrategySanityResult {
  campaignId: string;
  campaignName: string;
  hasTarget: boolean; // بعض الاستراتيجيات (Manual CPC مثلاً) مفيهاش هدف أصلاً - مش كل حملة قابلة للفحص ده
  divergencePct: number | null;
  status: "ALIGNED" | "DIVERGENT" | "NOT_APPLICABLE";
  message: string;
  /** مفتاح الرسالة ومتغيّراتها - النصّ أعلاه احتياطيّ عربي فقط. */
  messageKey: string;
  messageVars?: Record<string, string | number>;
}

// هامش معقول - فرق أقل من 20% طبيعي جداً (تقلب يومي عادي)، أكتر من كده
// معناه الهدف نفسه بعيد عن الواقع بشكل يستاهل مراجعة
const DIVERGENCE_THRESHOLD_PCT = 20;
const MIN_VERIFIED_SAMPLE = 5; // أقل عدد تحويلات حقيقية قبل ما نثق في المقارنة

export function auditBidStrategySanity(
  input: BidStrategyInput,
  verifiedSampleSize: number,
  /** عيّنة المنصّة نفسها - تحويلاتها هي كما تعدّها.
   *
   *  فرع `TARGET_CPA` يقارن هدفك بتكلفتنا **المتحقَّقة**، فعيّنتُه عيّنتنا.
   *  وفرع `TARGET_ROAS` يقارن هدف المنصّة بما حقّقته المنصّة، فعيّنتُه
   *  عيّنتها - ولو حكمناه بعدّنا نحن، لسكت الفحص في كلّ حسابٍ لم يُركَّب
   *  فيه تحقّقٌ بعد، وهو الحساب الذي يحتاجه أكثر. */
  platformSampleSize: number = verifiedSampleSize,
): BidStrategySanityResult {
  const base = { campaignId: input.campaignId, campaignName: input.campaignName };

  if (input.biddingStrategyType === "TARGET_CPA" || input.biddingStrategyType === "MAXIMIZE_CONVERSIONS") {
    if (input.targetCpa === null || input.verifiedCpa === null || verifiedSampleSize < MIN_VERIFIED_SAMPLE) {
      return { ...base, hasTarget: input.targetCpa !== null, divergencePct: null, status: "NOT_APPLICABLE",
        message: t("ar", "alerts.bidNoSample"), messageKey: "alerts.bidNoSample" };
    }

    const divergencePct = Math.round(((input.verifiedCpa - input.targetCpa) / input.targetCpa) * 100);
    const isDivergent = Math.abs(divergencePct) > DIVERGENCE_THRESHOLD_PCT;

    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      messageKey: isDivergent ? "alerts.bidCpaDivergent" : "alerts.bidCpaAligned",
      messageVars: { target: input.targetCpa, actual: input.verifiedCpa, pct: Math.abs(divergencePct) },
      message: t("ar", isDivergent ? "alerts.bidCpaDivergent" : "alerts.bidCpaAligned", {
        target: input.targetCpa,
        actual: input.verifiedCpa,
        pct: Math.abs(divergencePct),
      }),
    };
  }

  if (input.biddingStrategyType === "TARGET_ROAS" || input.biddingStrategyType === "MAXIMIZE_CONVERSION_VALUE") {
    if (input.targetRoas === null || input.actualRoas === null || platformSampleSize < MIN_VERIFIED_SAMPLE) {
      return { ...base, hasTarget: input.targetRoas !== null, divergencePct: null, status: "NOT_APPLICABLE",
        message: t("ar", "alerts.bidNoSample"), messageKey: "alerts.bidNoSample" };
    }

    const divergencePct = Math.round(((input.actualRoas - input.targetRoas) / input.targetRoas) * 100);
    const isDivergent = Math.abs(divergencePct) > DIVERGENCE_THRESHOLD_PCT;

    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      messageKey: isDivergent ? "alerts.bidRoasDivergent" : "alerts.bidRoasAligned",
      messageVars: { target: input.targetRoas, actual: input.actualRoas, pct: Math.abs(divergencePct) },
      message: t("ar", isDivergent ? "alerts.bidRoasDivergent" : "alerts.bidRoasAligned", {
        target: input.targetRoas,
        actual: input.actualRoas,
        pct: Math.abs(divergencePct),
      }),
    };
  }

  // Manual CPC وأنواع تانية مفيهاش "هدف" تلقائي - الفحص ده مش منطبق عليها أصلاً
  return { ...base, hasTarget: false, divergencePct: null, status: "NOT_APPLICABLE",
    message: t("ar", "alerts.bidManual"), messageKey: "alerts.bidManual" };
}

// ==================== إغلاق نفس الفجوة اللي اكتشفناها في ميتا ====================
// الفحص كان موجود من زمان، لكن بيظهر في صفحة Diagnostics بس - محدش
// كان بيدفعه كتنبيه استباقي. نفس الاكتشاف بالظبط اللي عملناه لميتا،
// جوجل كانت عندها نفس الفجوة من غير ما ننتبه ليها قبل كده.
export async function checkBidStrategyAlertsForWorkspace(workspaceId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { pushToActionFeed } = await import("@/lib/actionFeed");

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS", biddingStrategyType: { not: null } },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const link of links) {
    const agg = await prisma.metricSnapshot.aggregate({
      where: { workspaceId, campaignId: link.externalCampaignId, date: { gte: thirtyDaysAgo } },
      _sum: { cost: true, verifiedConversions: true, rawConversions: true, revenue: true },
    });
    const verified = agg._sum.verifiedConversions ?? 0;
    const cost = agg._sum.cost ?? 0;
    // قيمة التحويل التي تنسبها المنصّة لهذه الحملة - البسط الوحيد الذي
    // يجوز أن يُقارَن بهدفٍ ضُبط في المنصّة نفسها.
    const revenue = agg._sum.revenue ?? 0;
    const platformConversions = agg._sum.rawConversions ?? 0;

    const result = auditBidStrategySanity(
      {
        campaignId: link.externalCampaignId,
        campaignName: link.campaignName,
        biddingStrategyType: link.biddingStrategyType!,
        targetCpa: link.targetCpa,
        targetRoas: link.targetRoas,
        verifiedCpa: verified > 0 ? cost / verified : null,
        actualRoas: cost > 0 && revenue > 0 ? revenue / cost : null,
      },
      verified,
      platformConversions,
    );

    if (result.status === "DIVERGENT") {
      await pushToActionFeed({
        workspaceId,
        source: "BID_STRATEGY",
        type: "ALERT",
        severity: "MEDIUM",
        title: t("ar", "alerts.bidAlertTitle", { campaign: result.campaignName }),
        titleKey: "alerts.bidAlertTitle",
        titleVars: { campaign: result.campaignName },
        description: result.message,
        descKey: result.messageKey,
        descVars: result.messageVars,
      });
    }
  }
}

// ==================== فترة التعلّم (Learning Phase) - جوجل ====================
// مختلفة عن ميتا (50 ثابت) وتيك توك (25 ثابت) - جوجل العتبة بتتغيّر حسب
// نوع استراتيجية المزايدة نفسها (مؤكدة من مصادر متعددة متسقة):
// Target CPA: 30 تحويل/30 يوم، Target ROAS/Maximize Conversion Value: 50+،
// Maximize Conversions: 15-20 (شغالة) لكن 30+ (مثالية).
const GOOGLE_LEARNING_THRESHOLDS: Record<string, number> = {
  TARGET_CPA: 30,
  TARGET_ROAS: 50,
  MAXIMIZE_CONVERSION_VALUE: 50,
  MAXIMIZE_CONVERSIONS: 20,
};

export interface GoogleLearningPhaseResult {
  campaignId: string;
  campaignName: string;
  conversionsLast30Days: number;
  threshold: number | null;
  status: "LIKELY_STABLE" | "LEARNING" | "LEARNING_LIMITED" | "NOT_APPLICABLE";
  message: string;
  /** مفتاح الرسالة ومتغيّراتها - النصّ أعلاه احتياطيّ عربي فقط. */
  messageKey: string;
  messageVars?: Record<string, string | number>;
}

export function estimateGoogleLearningPhase(
  campaignId: string,
  campaignName: string,
  biddingStrategyType: string,
  conversionsLast30Days: number
): GoogleLearningPhaseResult {
  const base = { campaignId, campaignName, conversionsLast30Days };
  const threshold = GOOGLE_LEARNING_THRESHOLDS[biddingStrategyType] ?? null;

  if (threshold === null) {
    return { ...base, threshold: null, status: "NOT_APPLICABLE",
      message: t("ar", "alerts.learnManual"), messageKey: "alerts.learnManual" };
  }

  if (conversionsLast30Days >= threshold) {
    return { ...base, threshold, status: "LIKELY_STABLE",
      messageKey: "alerts.learnStable",
      messageVars: { conversions: conversionsLast30Days, strategy: biddingStrategyType, threshold },
      message: t("ar", "alerts.learnStable", { conversions: conversionsLast30Days, strategy: biddingStrategyType, threshold }) };
  }

  const gapNeeded = threshold - conversionsLast30Days;
  return {
    ...base, threshold,
    status: conversionsLast30Days < threshold / 2 ? "LEARNING_LIMITED" : "LEARNING",
    messageKey: "alerts.learnNeeds",
    messageVars: { conversions: conversionsLast30Days, gap: gapNeeded, strategy: biddingStrategyType, threshold },
    message: t("ar", "alerts.learnNeeds", { conversions: conversionsLast30Days, gap: gapNeeded, strategy: biddingStrategyType, threshold }),
  };
}

export async function checkGoogleLearningPhaseAlertsForWorkspace(workspaceId: string) {
  const { prisma } = await import("@/lib/prisma");
  const { pushToActionFeed } = await import("@/lib/actionFeed");

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS", biddingStrategyType: { not: null } },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const link of links) {
    const agg = await prisma.metricSnapshot.aggregate({
      where: { workspaceId, campaignId: link.externalCampaignId, date: { gte: thirtyDaysAgo } },
      _sum: { verifiedConversions: true },
    });
    const conversions = agg._sum.verifiedConversions ?? 0;

    const result = estimateGoogleLearningPhase(
      link.externalCampaignId, link.campaignName, link.biddingStrategyType!, conversions
    );

    if (result.status === "LEARNING_LIMITED") {
      await pushToActionFeed({
        workspaceId,
        source: "BID_STRATEGY",
        type: "ALERT",
        severity: "MEDIUM",
        title: `${result.campaignName}: بعيدة عن الخروج من فترة التعلّم`,
        description: result.message,
      });
    }
  }
}
