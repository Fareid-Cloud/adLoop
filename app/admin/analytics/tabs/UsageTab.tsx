// app/admin/analytics/tabs/UsageTab.tsx
//
// الاستهلاك والتكلفة - أهمّ تبويب من ناحية المخاطرة المالية: كل نداء
// ذكاء اصطناعي فلوس حقيقية، والحساب الشاذّ الواحد بيقدر ياكل هامش شهر.

import Link from "next/link";
import { Sparkles, AlertTriangle, TrendingUp, Gauge } from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import type { UsageOverview } from "@/lib/admin/usage";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM, TD_MUTED } from "@/app/components/ui/tableStyles";
import { Card, SectionTitle, Badge, shortDate } from "../../components/AdminUI";
import { AreaTrend } from "./Charts";

export function UsageTab({ data }: { data: UsageOverview }) {
  const trend = data.trend.map((t) => ({
    date: t.date.slice(5),
    calls: t.aiRefresh + t.imageQuality + t.siteScan,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          locale="en" label="AI calls this period" value={data.totalAiCalls.toLocaleString("en-US")}
          icon={Sparkles} tone="accent"
        />
        <MetricCard
          locale="en" label="Estimated tokens"
          value={`${(data.totalEstimatedTokens / 1_000_000).toFixed(2)}M`}
          icon={TrendingUp} tone="neutral"
          caption={{ text: "upper bound from each call's max_tokens", tone: "muted" }}
        />
        <MetricCard
          locale="en" label="Estimated cost"
          value={data.totalEstimatedCostUsd !== null ? `$${data.totalEstimatedCostUsd.toFixed(2)}` : "not configured"}
          icon={Gauge} tone={data.costConfigured ? "gap" : "neutral"}
          caption={{
            text: data.costConfigured ? "at CLAUDE_COST_PER_MTOK_USD" : "set CLAUDE_COST_PER_MTOK_USD to price this",
            tone: "muted",
          }}
        />
        <MetricCard
          locale="en" label="Abnormal consumers" value={data.anomalies.length.toLocaleString("en-US")}
          icon={AlertTriangle} tone={data.anomalies.length > 0 ? "critical" : "verified"}
          caption={{ text: "3× their own trailing average", tone: "muted" }}
        />
      </div>

      <Card>
        <SectionTitle hint="written daily by the cron before counters reset">Consumption trend</SectionTitle>
        <AreaTrend data={trend} xKey="date" yKey="calls" tone="gap" label="AI calls" />
        <p className="mt-2 text-[11.5px] leading-relaxed text-text-faint">{data.perWorkspaceNote}</p>
      </Card>

      {data.anomalies.length > 0 && (
        <Card>
          <SectionTitle hint="each account compared against itself, not against everyone">Abnormal consumption</SectionTitle>
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Account</th>
                  <th className={TH_NUM}>Today</th>
                  <th className={TH_NUM}>Their average</th>
                  <th className={TH_NUM}>Multiple</th>
                </tr>
              </thead>
              <tbody>
                {data.anomalies.map((a) => (
                  <tr key={a.userId} className={TR}>
                    <td className={TD}>
                      <Link href={`/admin/customers/${a.userId}`} className="text-text-primary no-underline hover:underline">
                        {a.email}
                      </Link>
                    </td>
                    <td className={TD_NUM}>{a.todayCalls}</td>
                    <td className={TD_NUM}>{a.averageCalls}</td>
                    <td className={TD_NUM}><span className="text-critical">{a.multiple}×</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle hint={`hard ceiling is ${data.monthlyLimitPerUser} AI refreshes per account per month`}>
            Top consumers
          </SectionTitle>
          {data.topConsumers.length === 0 ? (
            <p className="text-[12.5px] text-text-faint">No AI usage recorded this period.</p>
          ) : (
            <div className={TABLE_WRAP}>
              <table className={TABLE}>
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Account</th>
                    <th className={TH}>Plan</th>
                    <th className={TH_NUM}>Calls</th>
                    <th className={TH_NUM}>Tokens</th>
                    <th className={TH_NUM}>Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topConsumers.map((c) => (
                    <tr key={c.userId} className={TR}>
                      <td className={TD}>
                        <Link href={`/admin/customers/${c.userId}`} className="text-text-primary no-underline hover:underline">
                          {c.email}
                        </Link>
                      </td>
                      <td className={TD}>{c.plan}</td>
                      <td className={TD_NUM}>{c.calls}</td>
                      <td className={TD_NUM}>{(c.tokens / 1000).toFixed(0)}k</td>
                      <td className={TD_NUM}>{c.costUsd !== null ? `$${c.costUsd.toFixed(2)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle hint="already-recorded warning and block moments">At or over cap</SectionTitle>
          {data.nearOrOverCap.length === 0 ? (
            <p className="text-[12.5px] text-verified">Nobody hit a usage limit in this window.</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {data.nearOrOverCap.map((u) => (
                <li key={u.userId} className="text-[12.5px]">
                  <Link href={`/admin/customers/${u.userId}`} className="text-text-primary no-underline hover:underline">
                    {u.email}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {u.blockedAt && <Badge tone="bad">blocked {shortDate(u.blockedAt)}</Badge>}
                    {u.warnedAt && <Badge tone="warn">warned {shortDate(u.warnedAt)}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
