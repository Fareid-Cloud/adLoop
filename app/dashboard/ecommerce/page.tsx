// app/dashboard/ecommerce/page.tsx
//
// النظرة التنفيذية للمتجر - ليست لوحة إعلانات ولا نسخة من تحليلات سلة.
// عشرة مؤشّرات تجارية فقط، ثم أكبر الفرص وأكبر تسريب، ثم إجراءات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { AiAsk } from "@/app/components/AiAsk";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/app/components/ui/MetricCard";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate, fmtNum,
  type RecommendedAction,
} from "./_components/EcomPrimitives";
import { getStoreOverview, getProfitJourney } from "@/lib/ecommerce/storeIntelligence";
import { getStoreFunnel } from "@/lib/storeFunnel";
import { StoreFunnel } from "@/app/components/StoreFunnel";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import {
  Wallet, TrendingUp, Percent, ShoppingCart, Receipt, Repeat, RotateCcw, PackageX,
  UserPlus,
} from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { resolveStoreScope } from "@/lib/ecommerce/storeScope";
import { StorePicker } from "@/app/components/ui/StorePicker";
import { missingReturnKey, revenueBasisKey, roiTone } from "@/lib/returnMetrics";
import { Sparkline } from "@/app/components/ui/Sparkline";

export const dynamic = "force-dynamic";

export default async function EcommerceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  // نفس نافذة الثلاثين يوماً التي تقيس بها بقيّة الصفحة - فالمسار يُقرأ
  // مع المؤشّرات فوقه لا بفترةٍ أخرى تجعل أرقامه غير قابلة للمقارنة بها.
  const funnelTo = new Date();
  const funnelFrom = new Date(funnelTo.getTime() - 30 * 24 * 60 * 60 * 1000);


  // القناة المختارة من الرابط، مُتحقَّقاً من انتمائها لهذه المساحة.
  const scope = await resolveStoreScope(workspace.id, (await searchParams).store);

  const [overview, journey, opps, funnel] = await Promise.all([
    getStoreOverview(workspace.id, 30, scope.selectedId),
    getProfitJourney(workspace.id, 30, scope.selectedId),
    buildOpportunities(workspace.id, 30),
    getStoreFunnel(workspace.id, funnelFrom, funnelTo, workspace.currency, scope.selectedId),
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
        action={<StorePicker options={scope.options} selectedId={scope.selectedId} locale={locale} />}
      />

      <SectionHeading hint={tr("storeStatusHint")}>{tr("storeStatus")}</SectionHeading>

      {/* عشرُ بطاقاتٍ في خمسة أعمدة = صفّان تامّان، وفي عمودين = خمسة صفوف
          تامّة. وهو التقسيم الوحيد الذي لا يترك بطاقةً وحيدةً في صفٍّ ناقص
          عند أيّ عرضٍ للشاشة - وأربعةُ أعمدةٍ كانت تترك اثنتين. */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          // الاتّجاه من الطلبات نفسها لا من تقدير: يومٌ بلا بيعٍ صفرٌ صادق.
          trend={<Sparkline values={overview.dailyRevenue} tone="accent" />}
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
          trend={<Sparkline values={overview.dailyOrders} tone="verified" />}
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
        {/* «عائد» و«جديد» سؤالان لا سؤال: الأوّل عن الولاء والثاني عن
            النموّ، ومتجرٌ عالي الولاء بلا مكتسَبٍ جديد متوقّف لا وفيّ. */}
        <MetricCard
          label={tr("newCustomers")}
          value={overview.newCustomers ?? "—"}
          icon={UserPlus}
          tone="accent"
          caption={
            overview.newCustomers === null
              ? { text: tr("needsCustomerData"), tone: "muted" }
              : undefined
          }
          explainKey="newCustomers"
          locale={locale}
        />
        <MetricCard
          label={tr("refundRate")}
          value={overview.refundRatePct ?? "—"}
          unit={overview.refundRatePct === null ? undefined : "%"}
          icon={RotateCcw}
          tone={
            overview.refundRatePct === null
              ? "default"
              : overview.refundRatePct >= 15
                ? "critical"
                : overview.refundRatePct >= 8
                  ? "gap"
                  : "verified"
          }
          caption={
            overview.refundRatePct === null
              ? { text: tc("needsOrders"), tone: "muted" }
              : overview.refundRatePct >= 15
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

        {/* 🔴 **العائدان كانا غائبين تماماً عن صفحة المتجر** - وهما أوّل ما
            يسأل عنه صاحب متجرٍ يُعلن: «بكم باع كلّ ريالٍ أنفقتُه، وهل ربحت».
            وكلاهما هنا من خطّافٍ حقيقيّ: البسط مبيعات متجره الفعلية (ويب هوك
            المتجر)، والمقام إنفاقه المسحوب من المنصّات - لا تقدير.

            ويُعرضان معاً لا أحدهما: العائد على الإنفاق يتجاهل ثمن البضاعة،
            فقد يقول «٤×» بينما العائد على الاستثمار يقول إنّك خسرت. */}
        <MetricCard
          label={tr("roas")}
          value={overview.returns.roas !== null ? `${overview.returns.roas}` : "—"}
          unit={overview.returns.roas !== null ? "x" : undefined}
          icon={TrendingUp}
          tone="accent"
          caption={
            overview.returns.roas !== null
              ? { text: t(locale, revenueBasisKey(overview.returns.revenueBasis)), tone: "muted" }
              : { text: t(locale, missingReturnKey(overview.returns.missing)!), tone: "muted" }
          }
          explainKey="storeRoas"
          locale={locale}
        />
        <MetricCard
          label={tr("roi")}
          value={overview.returns.roiPct !== null ? `${overview.returns.roiPct}` : "—"}
          unit={overview.returns.roiPct !== null ? "%" : undefined}
          icon={TrendingUp}
          tone={roiTone(overview.returns.roiPct)}
          caption={
            overview.returns.roiPct === null
              ? { text: t(locale, missingReturnKey(overview.returns.missing)!), tone: "muted" }
              : overview.returns.roiPct < 0
                ? { text: tr("roiNegative"), tone: "negative" }
                : { text: tr("roiRealCosts"), tone: "positive" }
          }
          explainKey="storeRoi"
          locale={locale}
        />
      </div>

      {!overview.hasOrderLevelData && (
        <div className="mb-8 rounded-2xl border border-gap/30 bg-gap/[0.06] p-4 text-[12.5px] leading-relaxed text-text-muted">
          {tr("aggregateOnly")}
        </div>
      )}

      <div className="mb-8">
        <StoreFunnel data={funnel} locale={locale} />
      </div>

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
      <AiAsk scope="store" locale={locale} currency={workspace.currency} demo={workspace.isDemo} />
    </div>
  );
}
