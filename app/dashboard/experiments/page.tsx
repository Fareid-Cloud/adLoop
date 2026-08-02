// app/dashboard/experiments/page.tsx
//
// الاختبارات: تُنشأ تلقائياً عند تنفيذ أي قرار، وتُقاس نتيجتها بعد
// اكتمال النافذة (lib/experimentEngine.ts). الصفحة عرض فقط - لا تحسب
// النتائج بنفسها، حتى لا يختلف رقمان لنفس الاختبار بين مكانين.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ExperimentsView, type ExperimentRow } from "./ExperimentsView";
import { estimateLearningPhaseDuration, findStabilizationDay } from "@/lib/periodComparison";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export default async function ExperimentsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const [logs, campaignLinks] = await Promise.all([
    prisma.experimentLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { changedAt: "desc" },
      take: 100,
    }),
    prisma.campaignLink.findMany({
      where: { workspaceId: workspace.id },
      select: { externalCampaignId: true, campaignName: true, platform: true },
    }),
  ]);

  const nameByCampaign = new Map(
    campaignLinks.map((c: any) => [c.externalCampaignId, c.campaignName])
  );

  const experiments: ExperimentRow[] = logs.map((log: any) => ({
    id: log.id,
    changeType: log.changeType,
    description: log.description,
    changedAt: log.changedAt.toISOString(),
    platform: log.platform ?? null,
    campaignName: log.relatedCampaignId ? nameByCampaign.get(log.relatedCampaignId) ?? null : null,
    source: log.source,
    status: log.status,
    confidenceLevel: log.confidenceLevel,
    windowDays: log.windowDays ?? 7,
    note: log.note ?? null,
    trackedMetrics: log.trackedMetrics ?? [],
    metricResults: (log.metricResults as any) ?? null,
  }));

  // مدة استقرار الأداء بعد تعديلات الميزانية - من تاريخ هذا الحساب تحديداً
  const budgetLogs = logs.filter((l: any) => l.changeType === "BUDGET");
  const stabilizationSamples: Array<{ daysToStabilize: number }> = [];

  for (const log of budgetLogs) {
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id, date: { gte: log.changedAt } },
      orderBy: { date: "asc" },
      select: { date: true, cost: true, verifiedConversions: true },
    });
    if (snapshots.length < 5) continue;

    const byDate = new Map<string, number>();
    for (const s of snapshots) {
      const key = s.date.toISOString().slice(0, 10);
      const cpl = (s.verifiedConversions ?? 0) > 0 ? s.cost / s.verifiedConversions : 0;
      byDate.set(key, (byDate.get(key) ?? 0) + cpl);
    }

    const stabilizedAt = findStabilizationDay(Array.from(byDate.values()));
    if (stabilizedAt !== null) stabilizationSamples.push({ daysToStabilize: stabilizedAt });
  }

  const learningPhase = estimateLearningPhaseDuration(stabilizationSamples);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-5 text-[26px] font-semibold text-text-primary">{t(locale, "lab.pageTitle")}</h1>

      <div className="card-shadow mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-1 text-[13.5px] text-text-primary">
          {t(locale, "lab.stabilizeLine", { n: learningPhase.estimatedDays })}
        </div>
        <p className="text-[12px] text-text-faint">
          {learningPhase.basis === "account_history"
            ? t(locale, "lab.stabilizeFromHistory", { n: learningPhase.sampleSize })
            : t(locale, "lab.stabilizeGeneric")}
        </p>
      </div>

      <ExperimentsView
        workspaceId={workspace.id}
        experiments={experiments}
        locale={locale}
        campaigns={campaignLinks.map((c: any) => ({
          id: c.externalCampaignId,
          name: c.campaignName,
          platform: c.platform,
        }))}
      />
    </div>
  );
}
