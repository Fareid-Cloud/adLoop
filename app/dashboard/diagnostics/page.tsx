// app/dashboard/diagnostics/page.tsx
//
// التشخيص: كل الفحوصات تُحسب في محرك واحد (lib/diagnosticsEngine.ts) بمصدر
// بيانات صريح لكل فحص، فلا توجد بطاقة بلا رقم حقيقي وراءها.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { runDiagnostics } from "@/lib/diagnosticsEngine";
import { DiagnosticsView, type CheckRow, type ActivityRow } from "./DiagnosticsView";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

function safeHost(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

function timeAgo(locale: Locale, d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t(locale, "campPages.tNow");
  if (mins < 60) return t(locale, "campPages.tMinsAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t(locale, "campPages.tHoursAgo", { n: hrs });
  return t(locale, "campPages.tDaysAgo", { n: Math.floor(hrs / 24) });
}

export default async function DiagnosticsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const report = await runDiagnostics(workspace.id);

  // سجل النشاط من أحداث حقيقية: آخر مزامنات وفحوصات وقرارات
  const [recentActions, recentPages, cronRuns] = await Promise.all([
    prisma.actionFeedItem.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" }, take: 4,
      select: { title: true, createdAt: true, type: true },
    }),
    prisma.monitoredPage.findMany({
      where: { workspaceId: workspace.id, lastCheckedAt: { not: null } },
      orderBy: { lastCheckedAt: "desc" }, take: 2,
      select: { url: true, label: true, lastCheckedAt: true, trackingDetected: true },
    }),
    prisma.cronRunLog.findMany({ orderBy: { runAt: "desc" }, take: 1 }),
  ]);

  const activity: ActivityRow[] = [
    ...cronRuns.map((r: any) => ({
      title: t(locale, "campPages.actSyncDone"),
      detail: t(locale, "campPages.actSyncDetail", { n: r.totalWorkspaces, ok: r.succeeded }),
      at: timeAgo(locale, r.runAt),
    })),
    ...recentPages.map((p: any) => ({
      // new URL() ترمي استثناءً على رابط بلا بروتوكول (مثل "example.com")
      // وكان ذلك كافياً لإسقاط الصفحة بالكامل - نتعامل معه بأمان
      title: t(locale, "campPages.actPageCheck", { page: p.label ?? safeHost(p.url) }),
      detail: t(locale, p.trackingDetected ? "campPages.actTrackingFound" : "campPages.actTrackingMissing"),
      at: timeAgo(locale, p.lastCheckedAt),
    })),
    ...recentActions.map((a: any) => ({
      title: t(locale, a.type === "SUGGESTION" ? "campPages.actNewSuggestion" : "campPages.actNewAlert"),
      detail: a.title.slice(0, 70),
      at: timeAgo(locale, a.createdAt),
    })),
  ].slice(0, 6);

  const checks: CheckRow[] = report.checks.map((c) => ({
    ...c,
    lastScanAt: timeAgo(locale, c.lastScanAt),
  }));

  return (
    <DiagnosticsView
      workspaceName={workspace.name}
      healthScore={report.healthScore}
      scoreTrend={report.scoreTrend}
      counts={report.counts}
      checks={checks}
      activity={activity}
      totalMonthlyImpact={report.totalMonthlyImpact}
      currency={report.currency}
      lastScanAt={report.lastScanAt ? timeAgo(locale, report.lastScanAt) : null}
      locale={(user.preferredLocale as "ar" | "en") ?? "ar"}
    />
  );
}
