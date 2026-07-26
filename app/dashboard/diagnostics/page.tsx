// app/dashboard/diagnostics/page.tsx
//
// التشخيص: كل الفحوصات تُحسب في محرك واحد (lib/diagnosticsEngine.ts) بمصدر
// بيانات صريح لكل فحص، فلا توجد بطاقة بلا رقم حقيقي وراءها.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { runDiagnostics } from "@/lib/diagnosticsEngine";
import { DiagnosticsView, type CheckRow, type ActivityRow } from "./DiagnosticsView";

export const dynamic = "force-dynamic";

function safeHost(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export default async function DiagnosticsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
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
      titleAr: "اكتملت المزامنة اليومية",
      detailAr: `تمت معالجة ${r.totalWorkspaces} مساحة عمل (${r.succeeded} ناجحة)`,
      at: timeAgo(r.runAt),
    })),
    ...recentPages.map((p: any) => ({
      // new URL() ترمي استثناءً على رابط بلا بروتوكول (مثل "example.com")
      // وكان ذلك كافياً لإسقاط الصفحة بالكامل - نتعامل معه بأمان
      titleAr: `فحص صفحة ${p.label ?? safeHost(p.url)}`,
      detailAr: p.trackingDetected ? "التتبع مكتشف" : "لم يُكتشف تتبع",
      at: timeAgo(p.lastCheckedAt),
    })),
    ...recentActions.map((a: any) => ({
      titleAr: a.type === "SUGGESTION" ? "اقتراح جديد" : "تنبيه جديد",
      detailAr: a.title.slice(0, 70),
      at: timeAgo(a.createdAt),
    })),
  ].slice(0, 6);

  const checks: CheckRow[] = report.checks.map((c) => ({
    ...c,
    lastScanAt: timeAgo(c.lastScanAt),
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
      lastScanAt={report.lastScanAt ? timeAgo(report.lastScanAt) : null}
    />
  );
}
