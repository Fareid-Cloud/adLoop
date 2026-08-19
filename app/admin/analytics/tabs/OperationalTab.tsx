// app/admin/analytics/tabs/OperationalTab.tsx

import Link from "next/link";
import { LifeBuoy, Clock, AlertTriangle, Users } from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import type { OperationalAnalytics } from "@/lib/admin/operational";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM, TD_MUTED } from "@/app/components/ui/tableStyles";
import { Card, SectionTitle, dateTime } from "../../components/AdminUI";

export function OperationalTab({ data }: { data: OperationalAnalytics }) {
  const hours = (h: number | null) => (h === null ? "—" : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          locale="en" label="Open tickets" value={data.tickets.open.toLocaleString("en-US")} icon={LifeBuoy}
          tone={data.tickets.open > 0 ? "gap" : "verified"} href="/admin/support"
          subLabel={`${data.tickets.answered} answered · ${data.tickets.closed} closed`}
        />
        <MetricCard
          locale="en" label="Median resolution" value={hours(data.resolution.medianHours)} icon={Clock} tone="accent"
          subLabel={data.resolution.sample > 0 ? `from ${data.resolution.sample} closed threads` : "no closed threads yet"}
        />
        <MetricCard
          locale="en" label="Urgent account alerts" value={data.workspaceIssues.urgent.toLocaleString("en-US")}
          icon={AlertTriangle} tone={data.workspaceIssues.urgent > 0 ? "critical" : "verified"}
          subLabel={`${data.workspaceIssues.pending} pending in total`}
        />
        <MetricCard
          locale="en" label="At-risk accounts" value={data.atRiskAccounts.toLocaleString("en-US")} icon={Users}
          tone={data.atRiskAccounts > 0 ? "gap" : "verified"} href="/admin/customers?atRisk=1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="chosen by an admin when closing a thread">Most common problems</SectionTitle>
          {data.byCategory.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-text-faint">
              No thread has been categorised yet. Categories are picked when a thread is closed — until then this stays a
              guess, and it is better left blank than filled with one.
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {data.byCategory.map((c) => (
                <li key={c.key} className="flex justify-between text-[12.5px]">
                  <span className="text-text-muted">{c.label}</span>
                  <span className="tabular-nums text-text-primary">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
          {data.uncategorised > 0 && (
            <p className="mt-2 text-[11.5px] text-text-faint">{data.uncategorised} thread(s) have no category.</p>
          )}
        </Card>

        <Card>
          <SectionTitle hint="from the in-product feedback box">Feedback mix</SectionTitle>
          {data.feedbackByCategory.length === 0 ? (
            <p className="text-[12.5px] text-text-faint">No feedback submitted yet.</p>
          ) : (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {data.feedbackByCategory.map((f) => (
                <li key={f.category} className="flex justify-between text-[12.5px]">
                  <span className="text-text-muted">{f.category}</span>
                  <span className="tabular-nums text-text-primary">{f.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint="accounts the product itself flagged, whether or not they wrote in">
          Workspaces with the most urgent alerts
        </SectionTitle>
        {data.workspaceIssues.topWorkspaces.length === 0 ? (
          <p className="text-[12.5px] text-text-faint">No urgent alerts pending anywhere.</p>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Workspace</th>
                  <th className={TH}>Owner</th>
                  <th className={TH_NUM}>Urgent alerts</th>
                </tr>
              </thead>
              <tbody>
                {data.workspaceIssues.topWorkspaces.map((w) => (
                  <tr key={w.workspaceId} className={TR}>
                    <td className={TD}>{w.name}</td>
                    <td className={TD}>
                      <Link href={`/admin/customers?q=${encodeURIComponent(w.ownerEmail)}`} className="text-text-primary no-underline hover:underline">
                        {w.ownerEmail}
                      </Link>
                    </td>
                    <td className={TD_NUM}>{w.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint="daily runs where at least one workspace failed">Incidents</SectionTitle>
        {data.incidents.length === 0 ? (
          <p className="text-[12.5px] text-verified">No failed sync runs on record.</p>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>When</th>
                  <th className={TH_NUM}>Failed</th>
                  <th className={TH_NUM}>Of</th>
                  <th className={TH}>Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.incidents.map((i, idx) => (
                  <tr key={idx} className={TR}>
                    <td className={TD_MUTED}>{dateTime(i.runAt)}</td>
                    <td className={TD_NUM}><span className="text-critical">{i.failed}</span></td>
                    <td className={TD_NUM}>{i.total}</td>
                    <td className={TD_MUTED}>
                      <span className="line-clamp-2 font-mono text-[11px]">{i.errors ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
