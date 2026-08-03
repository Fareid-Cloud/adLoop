// lib/monthlyForecastAlert.ts
//
// من خطة action-layer-retrofit-plan.md - بند 1 (أعلى ثقة). صفحة
// التوقّع الشهري كانت عرض بس، من غير تنبيه استباقي. نفس المنطق المستخدم
// في الصفحة بالظبط، هنا بس بيتحول لتنبيه فعلي لو الانحراف كبير.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t, type Locale } from "@/lib/i18n/dictionary";

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

  const overVars = {
    pct: projectedPct,
    projected: Math.round(projectedTotal).toLocaleString("en-US"),
    target: target.toLocaleString("en-US"),
  };

  if (projectedPct > 110) {
    await pushToActionFeed({
      workspaceId,
      source: "FORECAST",
      type: "ALERT",
      severity: "HIGH",
      title: t("ar", "alerts.forecastOverTitle"),
      titleKey: "alerts.forecastOverTitle",
      description: t("ar", "alerts.forecastOverBody", overVars),
      descKey: "alerts.forecastOverBody",
      descVars: overVars,
      linkUrl: "/dashboard/campaigns/monthly-forecast",
    });
  } else if (projectedPct < 80) {
    await pushToActionFeed({
      workspaceId,
      source: "FORECAST",
      type: "ALERT",
      severity: "MEDIUM",
      title: t("ar", "alerts.forecastUnderTitle"),
      titleKey: "alerts.forecastUnderTitle",
      description: t("ar", "alerts.forecastUnderBody", { pct: projectedPct }),
      descKey: "alerts.forecastUnderBody",
      descVars: { pct: projectedPct },
      linkUrl: "/dashboard/campaigns/monthly-forecast",
    });
  }
}
