// app/admin/analytics/tabs/ProductTab.tsx

import { Activity, Users, Zap, Plug } from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import type { ProductAnalytics } from "@/lib/admin/product";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM } from "@/app/components/ui/tableStyles";
import { Card, SectionTitle, pct } from "../../components/AdminUI";
import { AreaTrend } from "./Charts";

export function ProductTab({ data }: { data: ProductAnalytics }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard locale="en" label="DAU" value={data.dau.toLocaleString("en-US")} icon={Activity} tone="accent" />
        <MetricCard locale="en" label="WAU" value={data.wau.toLocaleString("en-US")} icon={Users} tone="accent" />
        <MetricCard locale="en" label="MAU" value={data.mau.toLocaleString("en-US")} icon={Users} tone="accent" />
        <MetricCard
          locale="en" label="Stickiness" value={pct(data.stickinessPct)} icon={Zap}
          tone={data.stickinessPct !== null && data.stickinessPct >= 20 ? "verified" : "neutral"}
          caption={{ text: "DAU ÷ MAU", tone: "muted" }}
        />
      </div>

      <Card>
        <SectionTitle hint="distinct accounts active per day">Daily active accounts</SectionTitle>
        <AreaTrend data={data.activityTrend} xKey="date" yKey="users" tone="accent" label="accounts" />
        <p className="mt-2 text-[11.5px] text-text-faint">
          Recorded from the day this panel shipped — before that the product only kept a single &ldquo;last active&rdquo;
          timestamp per account, which cannot answer this question retroactively.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="real per-call counters, live for a long time">AI features</SectionTitle>
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Feature</th>
                  <th className={TH_NUM}>Accounts</th>
                  <th className={TH_NUM}>Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.aiFeatureUsage.map((f) => (
                  <tr key={f.label} className={TR}>
                    <td className={TD}>{f.label}</td>
                    <td className={TD_NUM}>{f.users}</td>
                    <td className={TD_NUM}>{f.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle>Reach</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Workspaces" value={data.workspacesTotal} />
            <Stat
              label="With fresh data (48h)"
              value={data.workspacesWithFreshData}
              tone={data.workspacesWithFreshData < data.workspacesTotal ? "warn" : "ok"}
            />
            <Stat label="Automation rules" value={data.automationRules} />
            <Stat label="Decisions applied" value={data.appliedDecisions} />
          </div>
          {/* صفر منصّات مربوطة حالةٌ حقيقيّة ومهمّة - مش تفصيلة تُحذف
              بصمت. من غير سطر بيقولها، الصفّ بيختفي وكإنّ المكان ده
              مالوش وجود أصلاً. */}
          {data.platforms.length === 0 && (
            <p className="m-0 mt-3 text-[11.5px] text-text-faint">
              No ad platform is connected on any account yet.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.platforms.map((p) => (
              <span key={p.platform} className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] text-text-muted">
                <Plug size={9} /> {p.platform} · {p.accounts}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle hint="instrumented features only">Feature usage & adoption</SectionTitle>
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Feature</th>
                <th className={TH_NUM}>Events</th>
                <th className={TH_NUM}>Accounts used</th>
                <th className={TH_NUM}>Accounts entitled</th>
                <th className={TH_NUM}>Adoption</th>
              </tr>
            </thead>
            <tbody>
              {data.features.map((f) => (
                <tr key={f.key} className={TR}>
                  <td className={TD}>{f.label}</td>
                  <td className={TD_NUM}>{f.events}</td>
                  <td className={TD_NUM}>{f.users}</td>
                  <td className={TD_NUM}>{f.entitled ?? "—"}</td>
                  <td className={TD_NUM}>
                    <span className={f.adoptionPct !== null && f.adoptionPct < 20 ? "text-gap" : undefined}>
                      {pct(f.adoptionPct)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-text-faint">{data.instrumentationNote}</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-gap" : "text-text-primary"}`}>
        {value.toLocaleString("en-US")}
      </div>
    </div>
  );
}
