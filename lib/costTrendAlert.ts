// lib/costTrendAlert.ts
//
// بند 5 من الخطة - "اتجاه صاعد بشكل حاد لفترة متتالية". الخطة نفسها
// حذّرت إن ده محتاج عتبة دقيقة - قرارين مقصودين هنا:
// 1) مقارنة أسبوع بأسبوع (مش شهر بشهر) - أقل ضجيج، بيتحدّث يومياً
// 2) cooldown 7 أيام - من غير كده هيكرر نفس التنبيه يومياً لو الاتجاه
//    فضل مرتفع، وده إزعاج مش فايدة إضافية

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

const RISE_THRESHOLD_PCT = 25;
const COOLDOWN_DAYS = 7;
const MIN_CONVERSIONS_FOR_CONFIDENCE = 5;

export async function checkCostTrendAlertForWorkspace(workspaceId: string) {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);

  const [thisWeek, lastWeek] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: thisWeekStart, lte: now } },
      _sum: { cost: true, rawConversions: true },
    }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: lastWeekStart, lt: thisWeekStart } },
      _sum: { cost: true, rawConversions: true },
    }),
  ]);

  const thisConv = thisWeek._sum.rawConversions ?? 0;
  const lastConv = lastWeek._sum.rawConversions ?? 0;
  if (thisConv < MIN_CONVERSIONS_FOR_CONFIDENCE || lastConv < MIN_CONVERSIONS_FOR_CONFIDENCE) return;

  const thisCpa = (thisWeek._sum.cost ?? 0) / thisConv;
  const lastCpa = (lastWeek._sum.cost ?? 0) / lastConv;
  if (lastCpa <= 0) return;

  const risePct = Math.round(((thisCpa - lastCpa) / lastCpa) * 100);
  if (risePct < RISE_THRESHOLD_PCT) return;

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
  const recentSimilar = await prisma.actionFeedItem.findFirst({
    where: { workspaceId, title: { contains: "تكلفة العميل ارتفعت" }, createdAt: { gte: cooldownStart } },
  });
  if (recentSimilar) return;

  await pushToActionFeed({
    workspaceId,
    type: "ALERT",
    severity: "MEDIUM",
    title: "تكلفة العميل ارتفعت بشكل ملحوظ هذا الأسبوع",
    description: `تكلفة العميل هذا الأسبوع (${Math.round(thisCpa)}) أعلى بـ${risePct}% عن الأسبوع اللي فات (${Math.round(lastCpa)}).`,
    linkUrl: "/dashboard/campaigns/seasonal-trend",
  });
}
