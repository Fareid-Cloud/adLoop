// lib/monthlyForecastAlert.ts
//
// من خطة action-layer-retrofit-plan.md - بند 1 (أعلى ثقة). صفحة
// التوقّع الشهري كانت عرض بس، من غير تنبيه استباقي. نفس المنطق المستخدم
// في الصفحة بالظبط، هنا بس بيتحول لتنبيه فعلي لو الانحراف كبير.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

export async function checkMonthlyForecastAlertForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace?.monthlyBudgetTarget) return;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dayOfMonth = now.getDate();
  const daysRemaining = endOfMonth.getDate() - dayOfMonth;

  const agg = await prisma.metricSnapshot.aggregate({
    where: { workspaceId, date: { gte: startOfMonth, lte: now } },
    _sum: { cost: true },
  });

  const spentSoFar = agg._sum.cost ?? 0;
  const dailyAverage = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;
  const projectedTotal = spentSoFar + dailyAverage * daysRemaining;
  const target = workspace.monthlyBudgetTarget;
  const projectedPct = target > 0 ? Math.round((projectedTotal / target) * 100) : 0;

  if (dayOfMonth < 5) return;

  if (projectedPct > 110) {
    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: "HIGH",
      title: "متوقّع تتجاوز الميزانية الشهرية",
      description: `بمعدل صرفك الحالي، متوقّع توصل لـ${projectedPct}% من هدفك الشهري (${Math.round(projectedTotal).toLocaleString()} من ${target.toLocaleString()}).`,
      linkUrl: "/dashboard/campaigns/monthly-forecast",
    });
  } else if (projectedPct < 80) {
    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: "MEDIUM",
      title: "متوقّع تصرف أقل من الميزانية الشهرية",
      description: `بمعدل صرفك الحالي، متوقّع توصل لـ${projectedPct}% بس من هدفك الشهري - يستاهل مراجعة ليه.`,
      linkUrl: "/dashboard/campaigns/monthly-forecast",
    });
  }
}
