// lib/contentFormatSuggestion.ts
//
// بند 4 من خطة action-layer-retrofit-plan.md - "اقتراح تحويل ميزانية
// للشكل الأفضل أداءً لو الفرق كبير ومستقر". نفس بيانات صفحة شكل المحتوى
// الموجودة، بس هنا بيتحول لاقتراح فعلي (SUGGESTION له Apply/Dismiss)
// بدل عرض بس - شبيه بمقارنة Spark/عادي في تيك توك.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t, type Locale } from "@/lib/i18n/dictionary";

// مفاتيح لا نصوص: الشكل يُسمّى بلغة القارئ وقت العرض.
const FORMAT_KEYS: Record<string, string> = {
  REELS: "alerts.fmtReels",
  STORY: "alerts.fmtStory",
  FEED: "alerts.fmtFeed",
};
const fmt = (loc: Locale, format: string) => t(loc, FORMAT_KEYS[format] ?? format);

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
      placementDetail: { in: Object.keys(FORMAT_KEYS) },
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

  // اسما الشكلين يُترجمان وقت العرض من مفتاحيهما - تخزينهما كنصّ عربي
  // كان يجعل القارئ الإنجليزي يرى «ريلز» داخل جملة إنجليزية.
  const titleVars = {
    cheap: fmt("ar", cheapest.format),
    cheapKey: FORMAT_KEYS[cheapest.format],
    expensive: fmt("ar", mostExpensive.format),
    expensiveKey: FORMAT_KEYS[mostExpensive.format],
    diffPct,
  };
  const descVars = {
    ...titleVars,
    cheapCpa: Math.round(cheapest.cpa!),
    expensiveCpa: Math.round(mostExpensive.cpa!),
  };

  await pushToActionFeed({
    workspaceId,
    source: "CREATIVE",
    type: "SUGGESTION",
    severity: "MEDIUM",
    title: t("ar", "alerts.formatTitle", titleVars),
    titleKey: "alerts.formatTitle",
    titleVars,
    description: t("ar", "alerts.formatBody", descVars),
    descKey: "alerts.formatBody",
    descVars,
    linkUrl: "/dashboard/campaigns/content-formats",
  });
}
