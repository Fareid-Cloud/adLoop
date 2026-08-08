// app/dashboard/ecommerce/page.tsx
//
// النظرة التنفيذية للمتجر - ليست لوحة إعلانات ولا نسخة من تحليلات سلة.
// ثمانية مؤشّرات تجارية فقط، ثم أكبر الفرص وأكبر تسريب، ثم إجراءات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { AiAsk } from "@/app/components/AiAsk";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/app/components/ui/MetricCard";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate, fmtNum,
  type RecommendedAction,
} from "./_components/EcomPrimitives";
import { getStoreOverview, getProfitJourney } from "@/lib/ecommerce/storeIntelligence";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import {
  Wallet, TrendingUp, Percent, ShoppingCart, Receipt, Repeat, RotateCcw, PackageX,
} from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

export default async function EcommerceOverviewPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `store.${k}`, vars);
  const tc = (k: string, vars?: Record<string, string | number>) => t(locale, `common.${k}`, vars);
  const tx = (item: { key: string; vars?: Record<string, string | number> }) => tText(locale, "oppText", item);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return (
      <DataGate locale={locale}
        title={tc("noWorkspace")}
        reason={tc("noWorkspaceHint")}
        href="/dashboard"
        hrefLabel={tc("toHome")}
      />
    );
  }

  const [overview, journey, opps] = await Promise.all([
    getStoreOverview(workspace.id, 30),
    getProfitJourney(workspace.id, 30),
    buildOpportunities(workspace.id, 30),
  ]);

  const c = overview.currency;

  if (!overview.hasStoreConnection && overview.revenue === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitle")}
          storeName={workspace.name}
        />
        <DataGate locale={locale}
          title={tr("connectStoreTitle")}
          reason={tr("connectStoreReason")}
          hrefLabel={tr("connectStore")}
        />
      </div>
    );
  }

  const topOpps = opps.opportunities.slice(0, 3);
  const actions: RecommendedAction[] = topOpps.map((o) => ({
    title: tx(o.title),
    reason: tx(o.reason),
    impact: tc("estimatedImpact", { value: `${fmtNum(o.estimatedMonthlyProfit)} ${c}` }),
    href: o.actionHref,
    hrefLabel: tc("apply"),
    tone: o.type === "PAUSE_ADS" || o.type === "RAISE_PRICE" ? "critical" : "positive",
  }));

  if (journey.biggestLeak) {
    actions.push({
      title: tr("biggestLeak", { label: tText(locale, "stageText", journey.biggestLeak.label) }),
      reason: tr("biggestLeakReason", {
        pct: journey.biggestLeak.pctOfRevenue,
        amount: `${fmtNum(journey.biggestLeak.amount)} ${c}`,
      }),
      href: "/dashboard/ecommerce/profit",
      hrefLabel: tr("openProfit"),
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <EcomHeader
        title={tr("title")}
        subtitle={`${tr("subtitle")} ${tc("lastNDays", { days: 30 })}.`}
        storeName={workspace.name}
      />

      <SectionHeading hint={tr("storeStatusHint")}>{tr("storeStatus")}</SectionHeading>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={tc("revenue")}
          value={fmtNum(overview.revenue)}
          unit={c}
          icon={Wallet}
          tone="accent"
          delta={
            overview.revenueChangePct !== null
              ? {
                  value: `${Math.abs(overview.revenueChangePct)}%`,
                  direction: overview.revenueChangePct >= 0 ? "up" : "down",
                  positive: overview.revenueChangePct >= 0,
                  caption: tc("lastNDays", { days: 30 }),
                }
              : undefined
          }
          explainKey="revenue"
          locale={locale}
        />
        <MetricCard
          label={tr("netProfit")}
          value={fmtNum(overview.netProfit)}
          unit={c}
          icon={TrendingUp}
          tone={overview.netProfit >= 0 ? "verified" : "critical"}
          delta={
            overview.profitChangePct !== null
              ? {
                  value: `${Math.abs(overview.profitChangePct)}%`,
                  direction: overview.profitChangePct >= 0 ? "up" : "down",
                  positive: overview.profitChangePct >= 0,
                  caption: tc("lastNDays", { days: 30 }),
                }
              : undefined
          }
          caption={
            overview.netProfit < 0
              ? { text: tr("losingMoney"), tone: "negative" }
              : undefined
          }
          explainKey="netProfit"
          locale={locale}
        />
        <MetricCard
          label={tr("grossMargin")}
          value={overview.grossMarginPct ?? "—"}
          unit={overview.grossMarginPct !== null ? "%" : undefined}
          icon={Percent}
          tone={
            overview.grossMarginPct === null
              ? "neutral"
              : overview.grossMarginPct >= 20
                ? "verified"
                : overview.grossMarginPct >= 10
                  ? "gap"
                  : "critical"
          }
          bar={overview.grossMarginPct !== null ? { pct: Math.max(0, overview.grossMarginPct) } : undefined}
          explainKey="grossMargin"
          locale={locale}
        />
        <MetricCard label={tr("orders")} value={fmtNum(overview.orders)} icon={ShoppingCart} tone="default"
          explainKey="orders"
          locale={locale}
        />

        <MetricCard
          label={tr("aov")}
          value={overview.avgOrderValue !== null ? fmtNum(overview.avgOrderValue) : "—"}
          unit={overview.avgOrderValue !== null ? c : undefined}
          icon={Receipt}
          tone="default"
          explainKey="aov"
          locale={locale}
        />
        <MetricCard
          label={tr("returningCustomers")}
          value={overview.returningCustomersPct ?? "—"}
          unit={overview.returningCustomersPct !== null ? "%" : undefined}
          icon={Repeat}
          tone="verified"
          caption={
            overview.returningCustomersPct === null
              ? { text: tr("needsCustomerData"), tone: "muted" }
              : undefined
          }
          explainKey="repeatRate"
          locale={locale}
        />
        <MetricCard
          label={tr("refundRate")}
          value={overview.refundRatePct}
          unit="%"
          icon={RotateCcw}
          tone={overview.refundRatePct >= 15 ? "critical" : overview.refundRatePct >= 8 ? "gap" : "verified"}
          caption={
            overview.refundRatePct >= 15
              ? { text: tr("refundHigh"), tone: "negative" }
              : undefined
          }
          explainKey="refundRate"
          locale={locale}
        />
        <MetricCard
          label={tr("inventoryRisk")}
          value={overview.inventoryRiskCount}
          icon={PackageX}
          tone={overview.inventoryRiskCount > 0 ? "critical" : "neutral"}
          caption={
            overview.inventoryRiskCount > 0
              ? { text: tr("stockRiskHint"), tone: "negative" }
              : { text: tr("stockSafe"), tone: "positive" }
          }
          explainKey="capitalTied"
          locale={locale}
        />
      </div>

      {!overview.hasOrderLevelData && (
        <div className="mb-8 rounded-2xl border border-gap/30 bg-gap/[0.06] p-4 text-[12.5px] leading-relaxed text-text-muted">
          {tr("aggregateOnly")}
        </div>
      )}

      {topOpps.length > 0 && (
        <>
          <SectionHeading hint={tr("totalOpportunities", { value: `${fmtNum(opps.totalPotentialProfit)} ${c}` })}>
            {tr("topOpportunities")}
          </SectionHeading>
          <div className="mb-2 grid gap-3 lg:grid-cols-3">
            {topOpps.map((o) => (
              <div key={o.id} className="card pad-md">
                <div className="text-[13px] font-medium text-text-primary">{tx(o.title)}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-semibold tabular-nums text-verified">
                    +{fmtNum(o.estimatedMonthlyProfit)}
                  </span>
                  <span className="text-[12px] text-text-muted">{c} · {tr("perMonth")}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{tx(o.reason)}</p>
              </div>
            ))}
          </div>
          <a
            href="/dashboard/ecommerce/opportunities"
            className="text-[12.5px] text-accent no-underline hover:underline"
          >
            {tc("viewAll")} ({opps.opportunities.length})
          </a>
        </>
      )}

      <RecommendedActions locale={locale} actions={actions} />

      {/* مربّع السؤال في آخر المحتوى: هو `sticky` فيطفو فوق الصفحة في كلّ
          موضع تمرير، وموضعه هنا هو حيث يرسو - فوق التذييل مباشرةً حين
          يبلغ المستخدم الآخر. */}
      <AiAsk scope="store" locale={locale} />
    </div>
  );
}
