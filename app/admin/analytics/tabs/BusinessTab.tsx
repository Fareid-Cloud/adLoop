// app/admin/analytics/tabs/BusinessTab.tsx

import { DollarSign, TrendingUp, Users, CreditCard, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import type { BusinessSummary, KNOWN_GAPS } from "@/lib/admin/business";
import { Card, SectionTitle, NotMeasured, money } from "../../components/AdminUI";
import { AreaTrend, BarSeries, Donut } from "./Charts";

export function BusinessTab({
  data,
  gaps,
}: {
  data: BusinessSummary;
  gaps: typeof KNOWN_GAPS;
}) {
  const revenueSeries = data.revenue.map((p) => ({ month: p.month.slice(2), revenue: Math.round(p.usdCents / 100) }));
  const planDonut = Object.entries(data.mrr.byPlan).map(([name, v]) => ({ name, value: Math.round(v.usdCents / 100) }));
  const movement = [
    {
      period: "This period",
      new: Math.round(data.movement.newUsdCents / 100),
      expansion: Math.round(data.movement.expansionUsdCents / 100),
      contraction: -Math.round(data.movement.contractionUsdCents / 100),
      churned: -Math.round(data.movement.churnedUsdCents / 100),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          locale="en" label="MRR" value={money(data.mrr.usd.usd)} icon={DollarSign} tone="verified"
          subLabel={`${data.mrr.payingCustomers} paying accounts`}
        />
        <MetricCard locale="en" label="ARR" value={money(data.arrUsdCents)} icon={TrendingUp} tone="accent" />
        <MetricCard locale="en" label="ARPU" value={money(data.arpuUsdCents)} icon={Users} tone="accent" />
        <MetricCard
          locale="en"
          label="LTV (estimate)"
          value={data.ltv ? money(data.ltv.usdCents) : "—"}
          icon={CreditCard}
          tone="neutral"
          caption={{ text: data.ltv ? "firms up as cancellation history builds" : "no cancellations recorded yet", tone: "muted" }}
        />
      </div>

      {Object.keys(data.mrr.usd.unconverted).length > 0 && (
        <div className="rounded-2xl border border-gap/30 bg-gap/8 p-3 text-[12.5px] text-text-primary">
          <AlertTriangle size={13} className="mb-0.5 me-1.5 inline text-gap" />
          Some revenue is excluded from the USD total because no exchange rate is recorded for it:{" "}
          {Object.entries(data.mrr.usd.unconverted).map(([c, v]) => `${(v / 100).toLocaleString("en-US")} ${c}`).join(", ")}.
          The daily cron records rates, so this clears itself once one has run.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle hint="collected, by month, converted to USD">Revenue</SectionTitle>
          <AreaTrend data={revenueSeries} xKey="month" yKey="revenue" tone="verified" label="USD" />
        </Card>
        <Card>
          <SectionTitle hint="monthly recurring">MRR by plan</SectionTitle>
          <Donut data={planDonut} />
          <ul className="m-0 mt-2 list-none space-y-1 p-0">
            {Object.entries(data.mrr.byPlan).map(([plan, v]) => (
              <li key={plan} className="flex justify-between text-[12px]">
                <span className="text-text-muted">{plan}</span>
                <span className="tabular-nums text-text-primary">{v.customers} · {money(v.usdCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="gifts excluded — they are not revenue">Revenue movement</SectionTitle>
          {data.movement.events === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-text-faint">
              No subscription events in this period. This table started recording with the owner panel, so it describes
              what happens from now on rather than reconstructing the past.
            </p>
          ) : (
            <BarSeries
              data={movement}
              xKey="period"
              bars={[
                { key: "new", tone: "verified", label: "New" },
                { key: "expansion", tone: "accent", label: "Expansion" },
                { key: "contraction", tone: "gap", label: "Contraction" },
                { key: "churned", tone: "critical", label: "Churned" },
              ]}
            />
          )}
        </Card>

        <Card>
          <SectionTitle>Payment health</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Failed this period" value={data.payments.failedThisPeriod} tone={data.payments.failedThisPeriod > 0 ? "bad" : "ok"} />
            <Stat label="Abandoned checkouts" value={data.payments.pendingOlderThanDay} tone={data.payments.pendingOlderThanDay > 0 ? "warn" : "ok"} />
            <Stat label="Past due accounts" value={data.payments.pastDueAccounts} tone={data.payments.pastDueAccounts > 0 ? "bad" : "ok"} />
          </div>
        </Card>
      </div>

      <SectionTitle>Not available</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {gaps.map((g) => (
          <NotMeasured key={g.metric} label={g.metric} reason={g.reason} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-critical" : tone === "warn" ? "text-gap" : "text-verified";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
