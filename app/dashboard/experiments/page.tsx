// app/dashboard/experiments/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ExperimentsClient } from "./ExperimentsClient";
import { computeExperimentImpact } from "@/lib/experimentsLab";
import { estimateLearningPhaseDuration, findStabilizationDay } from "@/lib/periodComparison";
import { getMetricLabel, MetricKey } from "@/lib/dashboardDefaults";

// المقاييس اللي التحسّن فيها معناه "الرقم ينزل" (عكس بعض المقاييس التانية)
const LOWER_IS_BETTER = new Set(["cpl_verified", "cpl_raw"]);

export default async function ExperimentsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لسه معملتش مساحة عمل" description="ارجع لـ لمحة عشان تنشئ أول مساحة عمل." />;
  }

  const logs = await prisma.experimentLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { changedAt: "desc" },
  });

  const experiments = await Promise.all(
    logs.map(async (log: any) => {
      const daysSinceChange = Math.floor((Date.now() - log.changedAt.getTime()) / 86400000);

      if (!log.measuredMetric || log.beforeMetricValue === null) {
        return {
          id: log.id,
          changeType: log.changeType,
          description: log.description,
          changedAt: log.changedAt.toISOString(),
          confidenceLevel: "INSUFFICIENT_DATA" as const,
          headline: "مفيش مقياس محدد لقياس الأثر - سجّل تعديل جديد واختار مقياس.",
        };
      }

      const where: any = { workspaceId: workspace.id, date: { gte: log.changedAt } };
      if (log.relatedCampaignId) where.campaignId = log.relatedCampaignId;

      const [agg, verifiedCount] = await Promise.all([
        prisma.metricSnapshot.aggregate({
          where,
          _sum: { cost: true, verifiedConversions: true, rawConversions: true },
        }),
        prisma.metricSnapshot.aggregate({
          where,
          _sum: { verifiedConversions: true },
        }),
      ]);

      const afterValue = computeMetricFromAgg(log.measuredMetric, agg._sum);

      const impact = computeExperimentImpact(
        log.beforeMetricValue,
        afterValue,
        LOWER_IS_BETTER.has(log.measuredMetric),
        {
          daysSinceChange,
          verifiedConversionsSinceChange: verifiedCount._sum.verifiedConversions ?? 0,
        },
        getMetricLabel(log.measuredMetric as MetricKey, "ar"),
        "ar"
      );

      return {
        id: log.id,
        changeType: log.changeType,
        description: log.description,
        changedAt: log.changedAt.toISOString(),
        confidenceLevel: impact.confidence,
        headline: impact.headline,
      };
    })
  );

  // درجة استقرار الأداء بعد تغييرات الميزانية - مبنية على تاريخ الحساب
  // ده نفسه (لو متاح)، مش رقم عام واحد لكل الحسابات
  const budgetLogs = logs.filter((l: any) => l.changeType === "BUDGET" && l.measuredMetric);
  const stabilizationSamples: Array<{ daysToStabilize: number }> = [];

  for (const log of budgetLogs) {
    const dailySnapshots = await prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id, date: { gte: log.changedAt } },
      orderBy: { date: "asc" },
    });
    if (dailySnapshots.length < 5) continue; // مش كفاية بيانات نحكم بيها على التجربة دي

    const byDate = new Map<string, number>();
    for (const s of dailySnapshots) {
      const key = s.date.toISOString().slice(0, 10);
      const existing = byDate.get(key) ?? 0;
      const value = computeMetricFromAgg(log.measuredMetric, {
        cost: s.cost, verifiedConversions: s.verifiedConversions, rawConversions: s.rawConversions,
      });
      byDate.set(key, existing + value);
    }

    const dailyValues = Array.from(byDate.values());
    const stabilizedAt = findStabilizationDay(dailyValues);
    if (stabilizedAt !== null) stabilizationSamples.push({ daysToStabilize: stabilizedAt });
  }

  const learningPhase = estimateLearningPhaseDuration(stabilizationSamples);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">التجارب</h1>

      <div className="mb-6 rounded-2xl bg-surface p-4">
        <div className="mb-1 text-sm text-text-primary">
          الأداء عادةً بيستقر بعد تعديل الميزانية خلال {learningPhase.estimatedDays} يوم تقريباً
        </div>
        <p className="text-xs text-text-faint">
          {learningPhase.basis === "account_history"
            ? `مبني على تاريخ حسابك تحديداً (${learningPhase.sampleSize} تعديل سابق)`
            : "معيار صناعي عام - لا يتوفر بعد تاريخ كافٍ من حسابك تحديداً (يلزم 3 تعديلات ميزانية على الأقل مسجّلة)"}
        </p>
      </div>

      <ExperimentsClient workspaceId={workspace.id} experiments={experiments} />
    </div>
  );
}

function computeMetricFromAgg(
  metric: string,
  sums: { cost: number | null; verifiedConversions: number | null; rawConversions: number | null }
): number {
  const cost = sums.cost ?? 0;
  const verified = sums.verifiedConversions ?? 0;
  const raw = sums.rawConversions ?? 0;

  switch (metric) {
    case "cpl_verified": return verified > 0 ? Math.round((cost / verified) * 100) / 100 : 0;
    case "cpl_raw": return raw > 0 ? Math.round((cost / raw) * 100) / 100 : 0;
    case "verified_conversions": return verified;
    default: return 0;
  }
}
