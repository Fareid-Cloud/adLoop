// lib/bidStrategyAudit.ts
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
  verifiedRoas: number | null;
}

export interface BidStrategySanityResult {
  campaignId: string;
  campaignName: string;
  hasTarget: boolean; // بعض الاستراتيجيات (Manual CPC مثلاً) مفيهاش هدف أصلاً - مش كل حملة قابلة للفحص ده
  divergencePct: number | null;
  status: "ALIGNED" | "DIVERGENT" | "NOT_APPLICABLE";
  message: string;
}

// هامش معقول - فرق أقل من 20% طبيعي جداً (تقلب يومي عادي)، أكتر من كده
// معناه الهدف نفسه بعيد عن الواقع بشكل يستاهل مراجعة
const DIVERGENCE_THRESHOLD_PCT = 20;
const MIN_VERIFIED_SAMPLE = 5; // أقل عدد تحويلات حقيقية قبل ما نثق في المقارنة

export function auditBidStrategySanity(
  input: BidStrategyInput,
  verifiedSampleSize: number
): BidStrategySanityResult {
  const base = { campaignId: input.campaignId, campaignName: input.campaignName };

  if (input.biddingStrategyType === "TARGET_CPA" || input.biddingStrategyType === "MAXIMIZE_CONVERSIONS") {
    if (input.targetCpa === null || input.verifiedCpa === null || verifiedSampleSize < MIN_VERIFIED_SAMPLE) {
      return { ...base, hasTarget: input.targetCpa !== null, divergencePct: null, status: "NOT_APPLICABLE",
        message: "لا توجد عينة تحويلات حقيقية كافية للمقارنة بعد." };
    }

    const divergencePct = Math.round(((input.verifiedCpa - input.targetCpa) / input.targetCpa) * 100);
    const isDivergent = Math.abs(divergencePct) > DIVERGENCE_THRESHOLD_PCT;

    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      message: isDivergent
        ? `الهدف المضبوط في جوجل (${input.targetCpa}) بعيد عن تكلفة العميل الحقيقية الفعلية (${input.verifiedCpa}) بنسبة ${Math.abs(divergencePct)}% - جوجل بتحسّن نحو رقم مش واقعي.`
        : `الهدف المضبوط قريب من الواقع الفعلي (فرق ${Math.abs(divergencePct)}% بس) - الاستراتيجية منطقية.`,
    };
  }

  if (input.biddingStrategyType === "TARGET_ROAS" || input.biddingStrategyType === "MAXIMIZE_CONVERSION_VALUE") {
    if (input.targetRoas === null || input.verifiedRoas === null || verifiedSampleSize < MIN_VERIFIED_SAMPLE) {
      return { ...base, hasTarget: input.targetRoas !== null, divergencePct: null, status: "NOT_APPLICABLE",
        message: "لا توجد عينة تحويلات حقيقية كافية للمقارنة بعد." };
    }

    const divergencePct = Math.round(((input.verifiedRoas - input.targetRoas) / input.targetRoas) * 100);
    const isDivergent = Math.abs(divergencePct) > DIVERGENCE_THRESHOLD_PCT;

    return {
      ...base, hasTarget: true, divergencePct,
      status: isDivergent ? "DIVERGENT" : "ALIGNED",
      message: isDivergent
        ? `الهدف المضبوط (${input.targetRoas}x) بعيد عن العائد الحقيقي الفعلي (${input.verifiedRoas}x) بنسبة ${Math.abs(divergencePct)}%.`
        : `الهدف المضبوط قريب من الواقع الفعلي - الاستراتيجية منطقية.`,
    };
  }

  // Manual CPC وأنواع تانية مفيهاش "هدف" تلقائي - الفحص ده مش منطبق عليها أصلاً
  return { ...base, hasTarget: false, divergencePct: null, status: "NOT_APPLICABLE",
    message: "استراتيجية المزايدة دي (يدوية) معندهاش هدف تلقائي يتفحص." };
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
      _sum: { cost: true, verifiedConversions: true },
    });
    const verified = agg._sum.verifiedConversions ?? 0;
    const cost = agg._sum.cost ?? 0;

    const result = auditBidStrategySanity(
      {
        campaignId: link.externalCampaignId,
        campaignName: link.campaignName,
        biddingStrategyType: link.biddingStrategyType!,
        targetCpa: link.targetCpa,
        targetRoas: link.targetRoas,
        verifiedCpa: verified > 0 ? cost / verified : null,
        verifiedRoas: null,
      },
      verified
    );

    if (result.status === "DIVERGENT") {
      await pushToActionFeed({
        workspaceId,
        type: "ALERT",
        severity: "MEDIUM",
        title: `${result.campaignName}: هدف المزايدة بعيد عن الواقع`,
        description: result.message,
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
      message: "استراتيجية المزايدة دي يدوية - مفيش فترة تعلّم تلقائية تتفحص." };
  }

  if (conversionsLast30Days >= threshold) {
    return { ...base, threshold, status: "LIKELY_STABLE",
      message: `${conversionsLast30Days} تحويل خلال آخر 30 يوم - فوق حد ${biddingStrategyType} (${threshold}) - على الأرجح خارج فترة التعلّم.` };
  }

  const gapNeeded = threshold - conversionsLast30Days;
  return {
    ...base, threshold,
    status: conversionsLast30Days < threshold / 2 ? "LEARNING_LIMITED" : "LEARNING",
    message: `${conversionsLast30Days} تحويل خلال آخر 30 يوم - محتاجة ${gapNeeded} تحويل إضافي عشان توصل لحد ${biddingStrategyType} (${threshold}).`,
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
        type: "ALERT",
        severity: "MEDIUM",
        title: `${result.campaignName}: بعيدة عن الخروج من فترة التعلّم`,
        description: result.message,
      });
    }
  }
}
