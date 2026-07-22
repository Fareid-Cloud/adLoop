// lib/scaleKillAlerts.ts
//
// بيشغّل classifyScaleKillWatch() يومياً على كل حساب، ويدفع اقتراح
// فعلي (SUGGESTION له Apply/Dismiss) لأي إعلان محتاج قرار Scale أو Kill.
// cooldown 7 أيام لكل إعلان - عشان منكررش نفس الاقتراح يومياً لو محدش
// اتخذ قرار فيه لسه.
//
// بيستخدم getWorkspaceCreativePerformances المشتركة (نفس الدالة اللي
// creatives/page.tsx وصفحات المنصة الفردية بتستخدمها) - نقطة حقيقة
// وحيدة، مش منطق مكرر.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { classifyScaleKillWatch, getWorkspaceCreativePerformances } from "@/lib/creativeAnalysis";

const COOLDOWN_DAYS = 7;
const SCALE_SPECIFIC_COOLDOWN_DAYS = 4; // نفس "3-4 أيام" اللي مصادر ميديا باير محترفين متفقة عليها بين كل زيادة والتانية

export async function checkScaleKillDecisionsForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  const { performances, daysActiveByAdId, fatiguedAdIds, campaignIdByAdId } =
    await getWorkspaceCreativePerformances(workspaceId);
  if (performances.length === 0) return;

  const links = await prisma.campaignLink.findMany({ where: { workspaceId } });
  const accountIdByCampaignId = new Map(links.map((l: any) => [l.externalCampaignId, l.externalAccountId]));

  const decisions = classifyScaleKillWatch(performances, daysActiveByAdId, fatiguedAdIds, workspace?.profitMarginPct ?? null);
  const actionable = decisions.filter((d) => d.decision === "SCALE" || d.decision === "KILL");

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);

  // فترة راحة خاصة بـScale - أدق من الـcooldown العام (7 أيام لأي تنبيه
  // مشابه)، هنا بنفحص تحديداً هل الإعلان ده اتزوّدت ميزانيته فعلياً (حالة
  // APPLIED مش أي اقتراح اتبعت) خلال آخر 4 أيام - نفس "انتظر 3-4 أيام
  // قبل أي زيادة تانية" اللي مصادر متعددة متفقة عليها
  const scaleCooldownStart = new Date();
  scaleCooldownStart.setDate(scaleCooldownStart.getDate() - SCALE_SPECIFIC_COOLDOWN_DAYS);

  for (const decision of actionable) {
    if (decision.decision === "SCALE") {
      const recentlyApplied = await prisma.actionFeedItem.findFirst({
        where: {
          workspaceId,
          title: { contains: decision.adName ?? decision.adId },
          status: "APPLIED",
          resolvedAt: { gte: scaleCooldownStart },
        },
      });
      if (recentlyApplied) continue; // اتزوّدت ميزانيته فعلاً مؤخراً - سيبه يستقر الأول
    }

    const recentSimilar = await prisma.actionFeedItem.findFirst({
      where: {
        workspaceId,
        title: { contains: decision.adName ?? decision.adId },
        createdAt: { gte: cooldownStart },
      },
    });
    if (recentSimilar) continue;

    // بند Kill بس له actionType حقيقي (إيقاف إعلان آمن التنفيذ على
    // مستوى الإعلان الفردي) - Scale لسه معلوماتي (الميزانية عادةً على
    // مستوى المجموعة/الحملة، مش الإعلان نفسه - تنفيذه غلط ممكن يأثر
    // على إعلانات تانية شريكة في نفس الميزانية)
    let actionType: string | undefined;
    let actionPayload: Record<string, unknown> | undefined;

    if (decision.decision === "KILL") {
      const campaignId = campaignIdByAdId.get(decision.adId);
      const accountId = campaignId ? accountIdByCampaignId.get(campaignId) : undefined;

      if (decision.platform === "GOOGLE_ADS" && campaignId && decision.adGroupId) {
        actionType = "PAUSE_AD_GOOGLE";
        actionPayload = { campaignId, adGroupId: decision.adGroupId, adId: decision.adId };
      } else if (decision.platform === "META_ADS") {
        actionType = "PAUSE_AD_META";
        actionPayload = { adId: decision.adId };
      } else if (decision.platform === "TIKTOK_ADS" && accountId) {
        actionType = "PAUSE_AD_TIKTOK";
        actionPayload = { advertiserId: accountId, adId: decision.adId };
      }
      // لو البيانات المطلوبة ناقصة (مثلاً adGroupId لسه معاش يتزامن)،
      // actionType بيفضل undefined - يبقى اقتراح معلوماتي بس، أأمن من
      // تنفيذ ناقص البيانات
    }

    await pushToActionFeed({
      workspaceId,
      type: "SUGGESTION",
      severity: decision.decision === "KILL" ? "HIGH" : "MEDIUM",
      title: `${decision.decision === "SCALE" ? "Scale" : "Kill"}: ${decision.adName ?? decision.adId}`,
      description: decision.reason,
      linkUrl: "/dashboard/campaigns/creatives",
      actionType,
      actionPayload,
    });
  }
}
