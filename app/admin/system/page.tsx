// app/admin/system/page.tsx
//
// صحة النظام + صندوق أدوات الإصلاح.
//
// الأربع حالات (شغّال / معلّق / فشل / متأخّر) كلها من `SyncRun` الحقيقي،
// مش تقدير: الجدول بيتكتب مع كل تشغيل من `startSyncRun`/`finishSyncRun`،
// والصفّ اللي فاضل `RUNNING` بعد ساعة معناه إنّ التشغيل مات في نصّه.

import Link from "next/link";
import { Activity, RefreshCw, XCircle, Plug, Rocket, ShieldAlert } from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { getSystemHealth, STALE_AFTER_HOURS, STUCK_AFTER_MINUTES } from "@/lib/admin/system";
import { checkReadiness, type ReadinessSeverity } from "@/lib/launchReadiness";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_MUTED, TD_NUM } from "@/app/components/ui/tableStyles";
import { prisma } from "@/lib/prisma";
import { AdminAction } from "../components/AdminAction";
import { AdminPageHeader, Badge, Card, SectionTitle, ago, dateTime, pct } from "../components/AdminUI";

export const dynamic = "force-dynamic";

const STATE_TONE = {
  OK: "ok", RUNNING: "info", STUCK: "bad", FAILED: "bad", STALE: "warn", NEVER: "muted",
} as const;

const SEVERITY_TONE: Record<ReadinessSeverity, "bad" | "warn" | "muted"> = {
  BLOCKER: "bad", REVENUE: "bad", FEATURE: "warn", OPTIONAL: "muted",
};
const SEVERITY_LABEL: Record<ReadinessSeverity, string> = {
  BLOCKER: "product down",
  REVENUE: "no revenue",
  FEATURE: "feature down",
  OPTIONAL: "minor",
};

export default async function SystemPage() {
  const health = await getSystemHealth();
  const readiness = checkReadiness();

  // صفوف "معلّقة" بمعرّفاتها - محتاجينها عشان زرّ الإغلاق يعرف يقفل أنهي
  // تشغيل بالظبط، مش أحدث تشغيل للمساحة.
  const stuckRuns = health.counts.STUCK
    ? await prisma.syncRun.findMany({
        where: {
          status: "RUNNING",
          startedAt: { lt: new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000) },
        },
        select: { id: true, workspaceId: true, platform: true, startedAt: true },
      })
    : [];
  const stuckByWorkspace = new Map(stuckRuns.map((r) => [r.workspaceId, r]));

  const problems = health.workspaces.filter((w) => w.state !== "OK");

  return (
    <div>
      <AdminPageHeader
        title="System Health"
        subtitle={health.lastCronRun ? `Last daily run ${ago(health.lastCronRun.runAt)}` : "No daily run logged yet"}
        icon={Activity}
      />

      {readiness.missing.length > 0 && (
        <div className="mb-4">
          <div
            className={`mb-2 flex items-start gap-2 rounded-2xl border p-3 ${
              readiness.readyToLaunch
                ? "border-gap/30 bg-gap/8"
                : "border-critical/30 bg-critical/8"
            }`}
          >
            {readiness.readyToLaunch
              ? <Rocket size={14} className="mt-0.5 shrink-0 text-gap" />
              : <ShieldAlert size={14} className="mt-0.5 shrink-0 text-critical" />}
            <div className="text-[12.5px] leading-relaxed text-text-primary">
              {readiness.readyToLaunch ? (
                <>Nothing blocks a launch. {readiness.missing.length} setting{readiness.missing.length === 1 ? " is" : "s are"} missing, all of them features or minor extras.</>
              ) : (
                <>
                  <strong>Do not launch yet:</strong>{" "}
                  {readiness.countsBySeverity.BLOCKER > 0 && <>{readiness.countsBySeverity.BLOCKER} setting{readiness.countsBySeverity.BLOCKER === 1 ? "" : "s"} that take the product down</>}
                  {readiness.countsBySeverity.BLOCKER > 0 && readiness.countsBySeverity.REVENUE > 0 && ", and "}
                  {readiness.countsBySeverity.REVENUE > 0 && <>{readiness.countsBySeverity.REVENUE} that stop any money arriving</>}.
                </>
              )}
            </div>
          </div>

          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Missing setting</th>
                  <th className={TH}>Impact</th>
                  <th className={TH}>What stops working</th>
                </tr>
              </thead>
              <tbody>
                {readiness.missing.map(({ item }) => (
                  <tr key={item.key} className={TR}>
                    <td className={TD}>
                      <div className="font-mono text-[11.5px]">{item.key}</div>
                      <div className="text-[10.5px] text-text-faint">{item.group}</div>
                    </td>
                    <td className={TD}>
                      <Badge tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
                    </td>
                    <td className={TD}>
                      <span className="text-[12px] leading-relaxed text-text-muted">{item.breaks}</span>
                      {item.fallback && (
                        <div className="mt-0.5 text-[11px] text-text-faint">Built-in fallback: {item.fallback}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
            This checks only that a value is present — <strong>not that it is correct</strong>. A key set to the
            wrong value passes here and fails on first real use. No secret value is ever read or rendered.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          locale="en" label="Cron success rate" value={pct(health.cronSuccessRatePct, 1)} icon={Activity}
          tone={health.cronSuccessRatePct !== null && health.cronSuccessRatePct >= 95 ? "verified" : "gap"}
          subLabel="last 30 runs"
        />
        <MetricCard
          locale="en" label="Workspaces needing attention" value={problems.length.toLocaleString("en-US")}
          icon={XCircle} tone={problems.length > 0 ? "critical" : "verified"}
          subLabel={`of ${health.workspaces.length} total`}
        />
        <MetricCard
          locale="en" label="Urgent account alerts" value={health.urgentIssues.toLocaleString("en-US")}
          icon={Activity} tone={health.urgentIssues > 0 ? "gap" : "verified"}
          subLabel={`${health.openIssues} pending in total`}
        />
        <MetricCard
          locale="en" label="Connections expiring" value={health.expiringConnections.toLocaleString("en-US")}
          icon={Plug} tone={health.expiringConnections > 0 ? "gap" : "verified"}
          subLabel="within 7 days"
        />
      </div>

      <SectionTitle
        hint={`stuck = still running after ${STUCK_AFTER_MINUTES}m · stale = no success in ${STALE_AFTER_HOURS}h`}
      >
        Sync & jobs
      </SectionTitle>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(health.counts) as Array<keyof typeof health.counts>).map((k) =>
          health.counts[k] > 0 ? (
            <Badge key={k} tone={STATE_TONE[k]}>{health.counts[k]} {k.toLowerCase()}</Badge>
          ) : null
        )}
      </div>

      {health.workspaces.length === 0 ? (
        <Card><p className="text-[12.5px] text-text-faint">No workspaces exist yet.</p></Card>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Workspace</th>
                <th className={TH}>Owner</th>
                <th className={TH}>State</th>
                <th className={TH}>Last success</th>
                <th className={TH}>Last error</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {health.workspaces.map((w) => {
                const stuck = stuckByWorkspace.get(w.workspaceId);
                return (
                  <tr key={w.workspaceId} className={TR}>
                    <td className={TD}>{w.workspaceName}</td>
                    <td className={TD_MUTED}>
                      <Link
                        href={`/admin/customers?q=${encodeURIComponent(w.ownerEmail)}`}
                        className="text-text-muted no-underline hover:underline"
                      >
                        {w.ownerEmail}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Badge tone={STATE_TONE[w.state]}>{w.state.toLowerCase()}</Badge>
                      {w.runningSince && (
                        <div className="mt-0.5 text-[10.5px] text-text-faint">since {ago(w.runningSince)}</div>
                      )}
                    </td>
                    <td className={TD_MUTED}>{w.lastSuccessAt ? ago(w.lastSuccessAt) : "never"}</td>
                    <td className={TD_MUTED}>
                      {w.lastError ? (
                        <span className="line-clamp-2 font-mono text-[11px] text-critical">{w.lastError}</span>
                      ) : "—"}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1.5">
                        <AdminAction
                          url={`/api/admin/system/resync/${w.workspaceId}`}
                          label="Re-sync"
                          confirmLabel="Run now?"
                          icon="RefreshCw"
                          size="sm"
                        />
                        {stuck && (
                          <AdminAction
                            url={`/api/admin/system/close-run/${stuck.id}`}
                            label="Close stuck run"
                            confirmLabel="Mark failed?"
                            icon="XCircle"
                            tone="danger"
                            size="sm"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle hint="last 30 daily runs">Cron history</SectionTitle>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr className={THEAD_ROW}>
              <th className={TH}>Run</th>
              <th className={TH_NUM}>Succeeded</th>
              <th className={TH_NUM}>Failed</th>
              <th className={TH_NUM}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {health.cronRuns.length === 0 ? (
              <tr className={TR}>
                <td className={TD_MUTED} colSpan={4}>No runs logged yet.</td>
              </tr>
            ) : (
              health.cronRuns.map((r, i) => (
                <tr key={i} className={TR}>
                  <td className={TD_MUTED}>{dateTime(r.runAt)}</td>
                  <td className={TD_NUM}>{r.succeeded}</td>
                  <td className={TD_NUM}>
                    {r.failed > 0 ? <span className="text-critical">{r.failed}</span> : 0}
                  </td>
                  <td className={TD_NUM}>{r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SectionTitle>What this page does not cover</SectionTitle>
      <Card>
        <p className="m-0 text-[12.5px] leading-relaxed text-text-muted">
          Application error rates and stack traces live in Sentry, not here. Sentry is wired for capture only — there is
          no in-app query API — so duplicating a half-blind error view on this page would be a display, not a tool. Use
          the Sentry dashboard for that, and this page for the data pipeline.
        </p>
      </Card>
    </div>
  );
}
