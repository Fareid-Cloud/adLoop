// lib/admin/system.ts
//
// صحة النظام: المزامنات، الوظائف المعلّقة، والأخطاء.
//
// ✅ **تصحيح لافتراض كان في الخطة:** الخطة قالت إنّ "Running/Stuck" مش
// متاحين لأنّ مافيش طابور وظائف. ده غلط - جدول `SyncRun` موجود فعلاً
// وبيتكتب من `startSyncRun`/`finishSyncRun` في الكرون اليوميّ، وفيه حالة
// `RUNNING` صريحة بتتقفل لمّا التشغيل يخلص. يعني الصفّ اللي فاضل
// `RUNNING` بعد وقت معقول = **معلّق فعلاً**، مش تخمين. الأربع حالات
// (شغّال / معلّق / فشل / متأخّر) كلها من بيانات حقيقية.

import { prisma } from "@/lib/prisma";

/** تشغيل فاضل `RUNNING` أكتر من كده = معلّق. أطول تشغيل حقيقي مرصود
 *  بيتقاس بالدقايق، فالساعة هامش واسع مش عتبة ضيّقة. */
export const STUCK_AFTER_MINUTES = 60;

/** مساحة عمل مافيهاش مزامنة ناجحة من أكتر من كده = بياناتها بايتة */
export const STALE_AFTER_HOURS = 36;

export type WorkspaceSyncState = "OK" | "RUNNING" | "STUCK" | "FAILED" | "STALE" | "NEVER";

export interface WorkspaceSyncRow {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  state: WorkspaceSyncState;
  lastSuccessAt: Date | null;
  lastRunAt: Date | null;
  lastError: string | null;
  platform: string | null;
  runningSince: Date | null;
}

export interface SystemHealth {
  lastCronRun: {
    runAt: Date; totalWorkspaces: number; succeeded: number; failed: number;
    durationMs: number | null; errors: string | null;
  } | null;
  cronSuccessRatePct: number | null;
  cronRuns: Array<{ runAt: Date; succeeded: number; failed: number; durationMs: number | null }>;
  workspaces: WorkspaceSyncRow[];
  counts: Record<WorkspaceSyncState, number>;
  openIssues: number;
  urgentIssues: number;
  expiringConnections: number;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const now = new Date();
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000);
  const staleBefore = new Date(now.getTime() - STALE_AFTER_HOURS * 3_600_000);

  const [cronRuns, workspaces, latestRuns, lastSuccesses, openIssues, urgentIssues, expiring] =
    await Promise.all([
      prisma.cronRunLog.findMany({ orderBy: { runAt: "desc" }, take: 30 }),
      prisma.workspace.findMany({
        select: { id: true, name: true, user: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // آخر تشغيل لكل مساحة أياً كانت نتيجته - `distinct` بعد الترتيب
      // بيدّي الأحدث لكل مفتاح، فاستعلام واحد بدل واحد لكل مساحة.
      prisma.syncRun.findMany({
        orderBy: { startedAt: "desc" },
        distinct: ["workspaceId"],
        select: {
          workspaceId: true, status: true, startedAt: true, finishedAt: true,
          errorMessage: true, platform: true,
        },
      }),
      prisma.syncRun.findMany({
        where: { status: "SUCCESS" },
        orderBy: { startedAt: "desc" },
        distinct: ["workspaceId"],
        select: { workspaceId: true, startedAt: true },
      }),
      prisma.actionFeedItem.count({ where: { status: "PENDING" } }),
      prisma.actionFeedItem.count({ where: { status: "PENDING", severity: { in: ["URGENT", "HIGH"] } } }),
      prisma.connectedPlatform.count({
        where: { expiresAt: { lte: new Date(now.getTime() + 7 * 86_400_000) } },
      }),
    ]);

  const lastRunBy = new Map(latestRuns.map((r) => [r.workspaceId, r]));
  const lastSuccessBy = new Map(lastSuccesses.map((r) => [r.workspaceId, r.startedAt]));

  const counts: Record<WorkspaceSyncState, number> = {
    OK: 0, RUNNING: 0, STUCK: 0, FAILED: 0, STALE: 0, NEVER: 0,
  };

  const rows: WorkspaceSyncRow[] = workspaces.map((w) => {
    const run = lastRunBy.get(w.id);
    const lastSuccessAt = lastSuccessBy.get(w.id) ?? null;

    let state: WorkspaceSyncState;
    if (!run) state = "NEVER";
    else if (run.status === "RUNNING") state = run.startedAt < stuckBefore ? "STUCK" : "RUNNING";
    else if (run.status === "FAILED") state = "FAILED";
    else if (!lastSuccessAt || lastSuccessAt < staleBefore) state = "STALE";
    else state = "OK";

    counts[state] += 1;
    return {
      workspaceId: w.id,
      workspaceName: w.name,
      ownerEmail: w.user.email,
      state,
      lastSuccessAt,
      lastRunAt: run?.startedAt ?? null,
      lastError: run?.errorMessage ?? null,
      platform: run?.platform ?? null,
      runningSince: run?.status === "RUNNING" ? run.startedAt : null,
    };
  });

  // الترتيب بالخطورة مش بالتاريخ: اللوحة دي بتتفتح عشان يتشاف اللي
  // باظ، والصفّ السليم مالوش أولوية في أول الجدول.
  const priority: Record<WorkspaceSyncState, number> = {
    STUCK: 0, FAILED: 1, STALE: 2, NEVER: 3, RUNNING: 4, OK: 5,
  };
  rows.sort((a, z) => priority[a.state] - priority[z.state]);

  const totalRuns = cronRuns.reduce((s, r) => s + r.totalWorkspaces, 0);
  const totalOk = cronRuns.reduce((s, r) => s + r.succeeded, 0);

  return {
    lastCronRun: cronRuns[0]
      ? {
          runAt: cronRuns[0].runAt,
          totalWorkspaces: cronRuns[0].totalWorkspaces,
          succeeded: cronRuns[0].succeeded,
          failed: cronRuns[0].failed,
          durationMs: cronRuns[0].durationMs,
          errors: cronRuns[0].errors,
        }
      : null,
    cronSuccessRatePct: totalRuns > 0 ? (totalOk / totalRuns) * 100 : null,
    cronRuns: cronRuns.map((r) => ({
      runAt: r.runAt, succeeded: r.succeeded, failed: r.failed, durationMs: r.durationMs,
    })),
    workspaces: rows,
    counts,
    openIssues,
    urgentIssues,
    expiringConnections: expiring,
  };
}

/** آخر تشغيلات مساحة واحدة بالتفصيل - صندوق أدوات الإصلاح */
export async function getWorkspaceSyncHistory(workspaceId: string, take = 25) {
  return prisma.syncRun.findMany({
    where: { workspaceId },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true, platform: true, status: true, trigger: true,
      startedAt: true, finishedAt: true, durationMs: true,
      recordsWritten: true, errorMessage: true,
    },
  });
}

/**
 * إغلاق تشغيل معلّق.
 *
 * **مش إلغاء للعمل نفسه** - الدالة اللي بتشتغل جوّه لامبدا انتهت أو ماتت
 * من زمان، والصفّ ده هو الأثر الوحيد الباقي. الإغلاق بيحرّر المساحة من
 * حالة "شغّال" الكاذبة اللي بتمنع أي تشخيص صحيح، وبيسجّل السبب صراحة
 * عشان مايتقريش كأنّه فشل حقيقي من المنصّة.
 */
export async function closeStuckRun(runId: string, adminEmail: string): Promise<boolean> {
  const run = await prisma.syncRun.findUnique({
    where: { id: runId },
    select: { status: true, startedAt: true },
  });
  if (!run || run.status !== "RUNNING") return false;

  const finishedAt = new Date();
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      finishedAt,
      durationMs: finishedAt.getTime() - run.startedAt.getTime(),
      errorMessage: `Marked as failed by ${adminEmail} — the run never reported back (owner panel).`,
    },
  });
  return true;
}
