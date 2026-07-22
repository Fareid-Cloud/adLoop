// lib/bidStrategyProgression.ts
//
// "الأول ننصح Max Clicks، وبعدين عند هدف معين ننصح Target CPA زي ما
// جوجل بتعمل - بس مش تكرار على الفاضي" - بحثنا في ممارسات ميديا باير
// محترفين حقيقيين (مش رأي شخصي)، ولقينا مسار مختلف عن اقتراح جوجل
// السطحي ("عندك تراكينج؟ روح Max Conversions" بدون عتبة حقيقية):
//
// 1) حملة جديدة/بدون بيانات كافية → Max Clicks (بناء بيانات أول)
// 2) بعد ~30 تحويل و3-4 أسابيع على Max Clicks → Max Conversions
//    (جوجل نفسها بتقول 15 كحد أدنى نظري، لكن ممارسة محترفين حقيقية
//    بتستنى ضعف الرقم - 15 مخاطرة حقيقية توقف الحملة "تختنق")
// 3) بعد 30 تحويل تانية (آخر 30 يوم) وأنت على Max Conversions → Target
//    CPA - **مهم جداً: الرقم المقترح لازم يكون فوق متوسطك الفعلي، مش
//    تحته** (بحث مؤكد: تحته = خنق الحملة فوراً)

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

const MIN_CONVERSIONS_FOR_MAX_CONVERSIONS = 30;
const MIN_CONVERSIONS_FOR_TARGET_CPA = 30;
const MIN_CAMPAIGN_AGE_DAYS = 21;
const TARGET_CPA_SAFETY_MARGIN_PCT = 12;

export async function checkBidStrategyProgressionForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const link of links) {
    const firstSnapshot = await prisma.metricSnapshot.findFirst({
      where: { workspaceId, platform: "GOOGLE_ADS", campaignId: link.externalCampaignId },
      orderBy: { date: "asc" },
    });
    if (!firstSnapshot) continue;

    const campaignAgeDays = Math.floor((Date.now() - firstSnapshot.date.getTime()) / 86400000);

    const agg = await prisma.metricSnapshot.aggregate({
      where: { workspaceId, platform: "GOOGLE_ADS", campaignId: link.externalCampaignId, date: { gte: thirtyDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    });
    const conversions = agg._sum.verifiedConversions ?? 0;
    const cost = agg._sum.cost ?? 0;

    let suggestion: { title: string; description: string; actionType: string; actionPayload: Record<string, unknown> } | null = null;

    if (link.biddingStrategyType === "MAXIMIZE_CLICKS") {
      if (conversions >= MIN_CONVERSIONS_FOR_MAX_CONVERSIONS && campaignAgeDays >= MIN_CAMPAIGN_AGE_DAYS) {
        suggestion = {
          title: `${link.campaignName}: جاهزة للانتقال لـ Max Conversions`,
          description: `${conversions} تحويل حقيقي آخر 30 يوم، والحملة شغالة ${campaignAgeDays} يوم - بيانات كافية للخوارزمية تبدأ تحسّن على التحويلات بدل الكليكات بس.`,
          actionType: "SET_BID_STRATEGY_GOOGLE",
          actionPayload: { campaignId: link.externalCampaignId, newStrategy: "MAXIMIZE_CONVERSIONS" },
        };
      }
    } else if (link.biddingStrategyType === "MAXIMIZE_CONVERSIONS") {
      if (conversions >= MIN_CONVERSIONS_FOR_TARGET_CPA) {
        const avgCpa = cost / conversions;
        const suggestedTargetCpa = Math.round(avgCpa * (1 + TARGET_CPA_SAFETY_MARGIN_PCT / 100));
        suggestion = {
          title: `${link.campaignName}: جاهزة لتحديد Target CPA`,
          description: `${conversions} تحويل آخر 30 يوم بمتوسط تكلفة ${Math.round(avgCpa)} - نقترح تحديد الهدف عند ${suggestedTargetCpa} (فوق متوسطك الفعلي بـ${TARGET_CPA_SAFETY_MARGIN_PCT}% كهامش أمان، مش تحته - تحديد رقم أقل من أدائك الحالي بيخنق الحملة فوراً).`,
          actionType: "SET_BID_STRATEGY_GOOGLE",
          actionPayload: { campaignId: link.externalCampaignId, newStrategy: "TARGET_CPA", targetCpaValue: suggestedTargetCpa, changePct: TARGET_CPA_SAFETY_MARGIN_PCT },
        };
      }
    }

    if (!suggestion) continue;

    const cooldownStart = new Date();
    cooldownStart.setDate(cooldownStart.getDate() - 14);
    const recentSimilar = await prisma.actionFeedItem.findFirst({
      where: { workspaceId, title: { contains: link.campaignName }, createdAt: { gte: cooldownStart } },
    });
    if (recentSimilar) continue;

    await pushToActionFeed({
      workspaceId,
      type: "SUGGESTION",
      severity: "MEDIUM",
      title: suggestion.title,
      description: suggestion.description,
      linkUrl: "/dashboard/diagnostics",
      actionType: suggestion.actionType,
      actionPayload: suggestion.actionPayload,
    });
  }
}
