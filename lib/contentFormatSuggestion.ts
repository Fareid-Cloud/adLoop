// lib/contentFormatSuggestion.ts
//
// بند 4 من خطة action-layer-retrofit-plan.md - "اقتراح تحويل ميزانية
// للشكل الأفضل أداءً لو الفرق كبير ومستقر". نفس بيانات صفحة شكل المحتوى
// الموجودة، بس هنا بيتحول لاقتراح فعلي (SUGGESTION له Apply/Dismiss)
// بدل عرض بس - شبيه بمقارنة Spark/عادي في تيك توك.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

const FORMAT_LABELS: Record<string, string> = {
  REELS: "ريلز",
  STORY: "ستوري",
  FEED: "الفيد (منشور عادي)",
};

// إصلاح عدم اتساق: باقي المنتج كله (جوجل/ميتا/تيك توك) بيستخدم 20%
// كعتبة "فرق حقيقي مش صدفة" و5 كحد أدنى للعينة - كانت هنا 25% من غير
// سبب حقيقي، غير متسقة مع باقي المعايير في نفس المنتج
const MIN_CONVERSIONS_FOR_CONFIDENCE = 5;
const MEANINGFUL_DIFFERENCE_PCT = 20;

export async function checkContentFormatSuggestionForWorkspace(workspaceId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await prisma.metricSnapshot.groupBy({
    by: ["placementDetail"],
    where: {
      workspaceId,
      platform: "META_ADS",
      placementDetail: { in: Object.keys(FORMAT_LABELS) },
      date: { gte: thirtyDaysAgo },
    },
    _sum: { cost: true, rawConversions: true },
  });

  const withCpa = rows
    .map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const conv = r._sum.rawConversions ?? 0;
      return { format: r.placementDetail, cost, conversions: conv, cpa: conv > 0 ? cost / conv : null };
    })
    .filter((r: any) => r.cpa !== null && r.conversions >= MIN_CONVERSIONS_FOR_CONFIDENCE);

  if (withCpa.length < 2) return;

  const sorted = withCpa.sort((a: any, b: any) => a.cpa - b.cpa);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];

  const diffPct = Math.round(((mostExpensive.cpa! - cheapest.cpa!) / cheapest.cpa!) * 100);
  if (diffPct < MEANINGFUL_DIFFERENCE_PCT) return;

  await pushToActionFeed({
    workspaceId,
    type: "SUGGESTION",
    severity: "MEDIUM",
    title: `${FORMAT_LABELS[cheapest.format]} بيجيب عميل أرخص بـ${diffPct}% من ${FORMAT_LABELS[mostExpensive.format]}`,
    description: `تكلفة العميل عبر ${FORMAT_LABELS[cheapest.format]} (${Math.round(cheapest.cpa!)}) أرخص بوضوح من ${FORMAT_LABELS[mostExpensive.format]} (${Math.round(mostExpensive.cpa!)}) - يستاهل تحويل ميزانية أكتر للشكل الأرخص.`,
    linkUrl: "/dashboard/campaigns/content-formats",
  });
}
