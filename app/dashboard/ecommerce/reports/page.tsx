// app/dashboard/ecommerce/reports/page.tsx
//
// تقرير تنفيذي واحد قابل للطباعة والمشاركة - لا مولّد تقارير بعشرين خياراً.
//
// السبب: التقرير الذي يحتاج ضبطاً قبل إخراجه لا يُخرَج. هذا التقرير يجيب
// ما يسأل عنه الشريك أو المحاسب فعلاً: كم بعنا، كم بقي، وأين ذهب الباقي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, DataGate, DataTable, Td, Tr, fmtNum,
} from "../_components/EcomPrimitives";
import { getProfitJourney, getStoreOverview, getCustomerAnalytics } from "@/lib/ecommerce/storeIntelligence";
import { getEcommerceOverview } from "@/lib/ecommerce/productPerformance";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import { PrintButton } from "./PrintButton";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { resolveStoreScope } from "@/lib/ecommerce/storeScope";
import { StorePicker } from "@/app/components/ui/StorePicker";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; store?: string }>;
}) {
  const sp = await searchParams;
  const windowDays = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tx = (item: { key: string; vars?: Record<string, string | number> }) => tText(locale, "oppText", item);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `storeReports.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <DataGate locale={locale} title={tc("noWorkspace")} reason={tc("noWorkspaceHint")} href="/dashboard" hrefLabel={tc("toHome")} />;
  }

  // المتجر المختار من الرابط، مُتحقَّقاً من انتمائه لهذه المساحة.
  const scope = await resolveStoreScope(workspace.id, sp.store);

  const [journey, overview, products, customers, opps] = await Promise.all([
    getProfitJourney(workspace.id, windowDays, scope.selectedId),
    getStoreOverview(workspace.id, windowDays, scope.selectedId),
    getEcommerceOverview(workspace.id, windowDays, scope.selectedId),
    getCustomerAnalytics(workspace.id, scope.selectedId),
    buildOpportunities(workspace.id, windowDays, scope.selectedId),
  ]);

  const c = journey.currency;

  if (journey.revenue <= 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <EcomHeader title={tr("title")} subtitle={tr("subtitle")} storeName={workspace.name} />
        <DataGate locale={locale}
          title={tr("noneTitle")}
          reason={tr("noneReason")}
        />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const topProducts = [...products.products].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="print:hidden">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitleWindow", { days: windowDays })}
          storeName={workspace.name}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StorePicker options={scope.options} selectedId={scope.selectedId} locale={locale} />
              <PrintButton locale={locale} label={tr("print")} />
            </div>
          }
        />
      </div>

      {/* الورقة نفسها - تُطبع وحدها */}
      <article className="card pad-lg print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-border pb-4">
          <h2 className="text-[20px] font-semibold text-text-primary">{workspace.name}</h2>
          <p className="mt-1 text-[12.5px] text-text-muted">
            {tr("header", { days: windowDays, date: today })}
          </p>
        </header>

        {/* الخلاصة أولاً - من يقرأ سطراً واحداً يقرأ هذا */}
        <section className="mb-6">
          <h3 className="mb-2 section-title">{tr("summary")}</h3>
          <p className="text-[13px] leading-relaxed text-text-muted">
            {tr("summaryLine", {
              revenue: `${fmtNum(journey.revenue)} ${c}`,
              profit: `${fmtNum(journey.netProfit)} ${c}`,
              margin: journey.netMarginPct ?? 0,
            })}
            {journey.biggestLeak &&
              tr("summaryLeak", {
                label: tText(locale, "stageText", journey.biggestLeak.label),
                pct: journey.biggestLeak.pctOfRevenue,
              })}
            .
            {opps.opportunities.length > 0 &&
              tr("summaryOpps", {
                count: opps.opportunities.length,
                amount: `${fmtNum(opps.totalPotentialProfit)} ${c}`,
              })}
          </p>
        </section>

        {/* المؤشّرات */}
        <section className="mb-6">
          <h3 className="mb-2 section-title">{tr("metrics")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Fact label={tc("revenue")} value={`${fmtNum(journey.revenue)} ${c}`} />
            <Fact label={t(locale, "store.netProfit")} value={`${fmtNum(journey.netProfit)} ${c}`} />
            <Fact label={t(locale, "profit.netMargin")} value={`${journey.netMarginPct ?? 0}%`} />
            <Fact label={t(locale, "store.orders")} value={fmtNum(overview.orders)} />
            <Fact
              label={t(locale, "store.aov")}
              value={overview.avgOrderValue !== null ? `${fmtNum(overview.avgOrderValue)} ${c}` : "—"}
            />
            <Fact label={t(locale, "store.refundRate")} value={`${overview.refundRatePct}%`} />
            <Fact
              label={t(locale, "store.returningCustomers")}
              value={overview.returningCustomersPct !== null ? `${overview.returningCustomersPct}%` : "—"}
            />
            <Fact
              label={t(locale, "customers.avgLtv")}
              value={customers.avgLtv !== null ? `${fmtNum(customers.avgLtv)} ${c}` : "—"}
            />
            <Fact label={t(locale, "store.inventoryRisk")} value={String(overview.inventoryRiskCount)} />
            {/* العائدان في التقرير كما هما في الصفحة - رقمٌ يظهر على الشاشة
                ويغيب عن التقرير المطبوع يجعل الاثنين موضع شكّ. */}
            <Fact
              label={t(locale, "store.adSpend")}
              value={overview.returns.adSpend !== null ? `${fmtNum(overview.returns.adSpend)} ${c}` : "—"}
            />
            <Fact
              label={t(locale, "store.roas")}
              value={overview.returns.roas !== null ? `${overview.returns.roas}x` : "—"}
            />
            <Fact
              label={t(locale, "store.roi")}
              value={overview.returns.roiPct !== null ? `${overview.returns.roiPct}%` : "—"}
            />
          </div>
        </section>

        {/* رحلة الربح */}
        <section className="mb-6">
          <h3 className="mb-2 section-title">{tr("whereMoney")}</h3>
          <DataTable headers={[tr("colItem"), tr("colAmount"), tr("colPctRevenue"), tr("colRemaining")]} minWidth={420}>
            {journey.stages.map((s) => (
              <Tr key={s.key}>
                <Td className="font-medium text-text-primary">{tText(locale, "stageText", s.label)}</Td>
                <Td className={`tabular-nums ${s.amount < 0 ? "text-critical" : "text-text-primary"}`}>
                  {s.amount < 0 ? "−" : ""}
                  {fmtNum(Math.abs(s.amount))}
                </Td>
                <Td className="tabular-nums text-text-muted">{s.pctOfRevenue}%</Td>
                <Td className="tabular-nums text-text-muted">{fmtNum(s.runningTotal)}</Td>
              </Tr>
            ))}
          </DataTable>
        </section>

        {/* أفضل المنتجات */}
        {topProducts.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 section-title">{tr("topProducts")}</h3>
            <DataTable headers={[tc("product"), tc("units"), tc("revenue"), tc("profit"), tc("margin")]} minWidth={480}>
              {topProducts.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium text-text-primary">{p.name}</Td>
                  <Td className="tabular-nums text-text-muted">{p.unitsSold}</Td>
                  <Td className="tabular-nums text-text-primary">{fmtNum(p.revenue)}</Td>
                  <Td className={`tabular-nums ${p.totalProfit >= 0 ? "text-verified" : "text-critical"}`}>
                    {fmtNum(p.totalProfit)}
                  </Td>
                  <Td className="tabular-nums text-text-muted">{p.marginPct}%</Td>
                </Tr>
              ))}
            </DataTable>
          </section>
        )}

        {/* التوصيات */}
        {opps.opportunities.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 section-title">{tr("topRecs")}</h3>
            <ol className="flex list-inside list-decimal flex-col gap-2">
              {opps.opportunities.slice(0, 5).map((o) => (
                <li key={o.id} className="text-[12.5px] leading-relaxed text-text-muted">
                  <span className="font-medium text-text-primary">{tx(o.title)}</span> — {tx(o.action)}{" "}
                  <span className="font-semibold text-verified">
                    (+{fmtNum(o.estimatedMonthlyProfit)} {c} {tr("perMonth")})
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* حدود التقرير - تُطبع مع التقرير عمداً */}
        {journey.missingCosts.length > 0 && (
          <section className="border-t border-border pt-4">
            <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-muted">{tr("limits")}</h3>
            <ul className="flex flex-col gap-1">
              {journey.missingCosts.map((m, i) => (
                <li key={i} className="text-[11.5px] leading-relaxed text-text-faint">
                  • {t(locale, m.key, m.vars)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/50 py-1.5">
      <div className="text-[11.5px] text-text-faint">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium tabular-nums text-text-primary">{value}</div>
    </div>
  );
}
