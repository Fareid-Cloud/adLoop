// app/admin/analytics/tabs/CustomersTab.tsx

import Link from "next/link";
import { Users, UserPlus, Activity, AlertTriangle, Star } from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import type { CustomerAnalytics } from "@/lib/admin/customers";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM } from "@/app/components/ui/tableStyles";
import { Card, SectionTitle, Badge, money, pct } from "../../components/AdminUI";
import { Donut, BarSeries } from "./Charts";

export function CustomersTab({ data }: { data: CustomerAnalytics }) {
  const planDonut = Object.entries(data.byPlan).map(([name, value]) => ({ name, value }));
  const cohortBars = data.cohorts.map((c) => ({
    month: c.month.slice(2),
    signups: c.signups,
    paying: c.stillPaying,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard locale="en" label="Total" value={data.total.toLocaleString("en-US")} icon={Users} tone="accent" />
        <MetricCard
          locale="en" label="New in period" value={data.newInRange.toLocaleString("en-US")} icon={UserPlus} tone="verified"
          delta={data.newDeltaPct !== null ? {
            value: `${Math.abs(data.newDeltaPct).toFixed(0)}%`,
            direction: data.newDeltaPct >= 0 ? "up" : "down",
            positive: data.newDeltaPct >= 0,
            caption: "vs previous period",
          } : undefined}
        />
        <MetricCard
          locale="en" label="Active 7d / 30d" value={`${data.activeLast7} / ${data.activeLast30}`} icon={Activity} tone="accent"
        />
        <MetricCard
          locale="en" label="At risk" value={data.atRisk.toLocaleString("en-US")} icon={AlertTriangle}
          tone={data.atRisk > 0 ? "gap" : "verified"} href="/admin/customers?atRisk=1"
        />
        <MetricCard
          locale="en" label="VIP" value={data.vip.toLocaleString("en-US")} icon={Star} tone="neutral"
          href="/admin/customers?vip=1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle>Plan mix</SectionTitle>
          <Donut data={planDonut} emptyMessage="No accounts on any plan yet." />
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle hint="signup month → how many of that cohort still pay today">Cohorts</SectionTitle>
          <BarSeries
            data={cohortBars}
            xKey="month"
            bars={[
              { key: "signups", tone: "faint", label: "Signed up" },
              { key: "paying", tone: "verified", label: "Still paying" },
            ]}
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-text-faint">
            This is a point-in-time view: it compares each cohort against today, not month by month. Month-over-month
            retention curves need periodic snapshots, which start accumulating from now.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle>By country</SectionTitle>
          <SimpleList
            rows={data.byCountry.map((c) => ({ label: c.country, value: c.count }))}
            total={data.total}
            empty="No account has a country on it yet — it is captured at signup and on the billing form."
          />
        </Card>
        <Card>
          <SectionTitle hint="self-reported at signup">By business scale</SectionTitle>
          <SimpleList
            rows={data.byScale.map((s) => ({ label: s.scale, value: s.count }))}
            total={data.total}
            empty="Nobody has answered the spend-scale question during onboarding yet."
          />
        </Card>
        <Card>
          <SectionTitle>Status</SectionTitle>
          <SimpleList
            rows={[
              { label: "Paying", value: data.paying },
              { label: "Trialing", value: data.trialing },
              { label: "Free / lapsed", value: data.free },
              { label: "Suspended", value: data.suspended },
            ]}
            total={data.total}
          />
        </Card>
      </div>

      <Card>
        <SectionTitle hint="a suggestion for the VIP flag, not a replacement for it">Highest monthly value</SectionTitle>
        {data.topByMrr.length === 0 ? (
          <p className="text-[12.5px] text-text-faint">No paying accounts yet.</p>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Account</th>
                  <th className={TH_NUM}>Monthly (USD)</th>
                  <th className={TH}>VIP</th>
                </tr>
              </thead>
              <tbody>
                {data.topByMrr.map((c) => (
                  <tr key={c.id} className={TR}>
                    <td className={TD}>
                      <Link href={`/admin/customers/${c.id}`} className="text-text-primary no-underline hover:underline">
                        {c.email}
                      </Link>
                    </td>
                    <td className={TD_NUM}>{money(c.usdCents)}</td>
                    <td className={TD}>
                      {c.isVip ? <Badge tone="warn"><Star size={9} /> VIP</Badge> : <span className="text-text-faint">—</span>}
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

/**
 * "No data." كانت الرسالة لكلّ استعمال - وهي أسوأ حالة فاضية ممكنة:
 * بتقول إنّ مافيش شيء وماتقولش ليه، فالقارئ مايعرفش هل الحقل مش
 * بيتسجّل، ولا اتسجّل وماحدّش ملاه، ولا الفلتر بيخفيه. والتلاتة علاجهم
 * مختلف تماماً.
 */
function SimpleList({
  rows,
  total,
  empty = "Nothing recorded yet.",
}: {
  rows: Array<{ label: string; value: number }>;
  total: number;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-[12.5px] text-text-faint">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="m-0 list-none space-y-1.5 p-0">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-[12.5px]">
            <span className="text-text-muted">{r.label}</span>
            <span className="tabular-nums text-text-primary">
              {r.value} <span className="text-text-faint">{pct(total > 0 ? (r.value / total) * 100 : null)}</span>
            </span>
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-surface-raised">
            <div className="h-full bg-accent/60" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
