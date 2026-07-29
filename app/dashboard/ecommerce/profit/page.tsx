// app/dashboard/ecommerce/profit/page.tsx
//
// رحلة الربح: من الإيراد إلى ما يبقى في جيبك فعلاً.
//
// هذه أهم صفحة في القسم لأنها تجيب السؤال الذي لا تجيبه أي لوحة أخرى:
// المتجر يقول "بعت بمئة ألف"، ومنصّة الإعلان تقول "عائدك ٣ أضعاف"، ولا
// أحد منهما يطرح تكلفة البضاعة والشحن والرسوم والمرتجعات معاً. هنا تُطرح
// كلّها بالترتيب، فيظهر أين يذهب المال فعلياً.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate, LimitsNote, fmtNum,
  type RecommendedAction,
} from "../_components/EcomPrimitives";
import { getProfitJourney } from "@/lib/ecommerce/storeIntelligence";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Wallet, TrendingUp, Percent, AlertTriangle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const windowDays = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `profit.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return <DataGate titleAr={tc("noWorkspace")} reasonAr={tc("noWorkspaceHint")} href="/dashboard" hrefLabelAr={tc("toHome")} />;
  }

  const journey = await getProfitJourney(workspace.id, windowDays);
  const c = journey.currency;

  if (journey.revenue <= 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitle")}
          storeName={workspace.name}
        />
        <DataGate
          titleAr={tr("noRevenue")}
          reasonAr={tr("noRevenueReason")}
        />
      </div>
    );
  }

  const costStages = journey.stages.filter((s) => s.key !== "revenue");
  const maxCost = Math.max(...costStages.map((s) => Math.abs(s.amount)), 1);

  const actions: RecommendedAction[] = [];

  if (journey.biggestLeak) {
    actions.push({
      titleAr: tr("focusFirst", { label: journey.biggestLeak.labelAr }),
      reasonAr: tr("focusReason", {
        amount: `${fmtNum(journey.biggestLeak.amount)} ${c}`,
        pct: journey.biggestLeak.pctOfRevenue,
        gain: `${fmtNum(journey.biggestLeak.amount * 0.1)} ${c}`,
      }),
      tone: "warning",
      href: "/dashboard/ecommerce/opportunities",
      hrefLabelAr: tr("seeOpportunities"),
    });
  }

  if (journey.netMarginPct !== null && journey.netMarginPct < 0) {
    actions.push({
      titleAr: tr("losingTitle"),
      reasonAr: tr("losingReason", { pct: journey.netMarginPct ?? 0 }),
      tone: "critical",
      href: "/dashboard/ecommerce/products",
      hrefLabelAr: tr("losingCta"),
    });
  } else if (journey.netMarginPct !== null && journey.netMarginPct < 10) {
    actions.push({
      titleAr: tr("thinTitle"),
      reasonAr: tr("thinReason", { pct: journey.netMarginPct ?? 0 }),
      tone: "warning",
      href: "/dashboard/ecommerce/pricing-intelligence",
      hrefLabelAr: tr("thinCta"),
    });
  }

  const adStage = journey.stages.find((s) => s.key === "advertising");
  if (adStage && adStage.pctOfRevenue >= 30) {
    actions.push({
      titleAr: tr("adHeavyTitle"),
      reasonAr: tr("adHeavyReason", { pct: adStage.pctOfRevenue }),
      tone: "critical",
      href: "/dashboard/campaigns/creatives",
      hrefLabelAr: tr("adHeavyCta"),
    });
  }

  const returnsStage = journey.stages.find((s) => s.key === "returns");
  if (returnsStage && returnsStage.pctOfRevenue >= 8) {
    actions.push({
      titleAr: tr("returnsTitle"),
      reasonAr: tr("returnsReason", { pct: returnsStage.pctOfRevenue }),
      tone: "critical",
      href: "/dashboard/ecommerce/orders",
      hrefLabelAr: tr("returnsCta"),
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title={tr("title")}
        subtitle={`${tr("subtitle")} ${tc("lastNDays", { days: windowDays })}.`}
        storeName={workspace.name}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <MetricCard label={tc("revenue")} value={fmtNum(journey.revenue)} unit={c} icon={Wallet} tone="accent" />
        <MetricCard
          label={t(locale, "store.netProfit")}
          value={fmtNum(journey.netProfit)}
          unit={c}
          icon={TrendingUp}
          tone={journey.netProfit >= 0 ? "verified" : "critical"}
        />
        <MetricCard
          label={tr("netMargin")}
          value={journey.netMarginPct ?? "—"}
          unit={journey.netMarginPct !== null ? "%" : undefined}
          icon={Percent}
          tone={
            journey.netMarginPct === null ? "neutral"
              : journey.netMarginPct >= 20 ? "verified"
                : journey.netMarginPct >= 10 ? "gap" : "critical"
          }
          bar={journey.netMarginPct !== null ? { pct: Math.max(0, journey.netMarginPct) } : undefined}
        />
      </div>

      <LimitsNote items={journey.missingCostsAr} />

      <SectionHeading hint={tr("whereMoneyGoesHint")}>{tr("whereMoneyGoes")}</SectionHeading>

      <div className="card-shadow mb-2 overflow-hidden rounded-2xl border border-border bg-surface">
        {/* الإيراد كنقطة بداية */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/[0.05] p-4">
          <div>
            <div className="text-[13.5px] font-semibold text-text-primary">{tc("revenue")}</div>
            <div className="mt-0.5 text-[11.5px] text-text-faint">{journey.stages[0].sourceAr}</div>
          </div>
          <div className="text-[20px] font-semibold tabular-nums text-text-primary">
            {fmtNum(journey.revenue)} <span className="text-[12px] font-normal text-text-muted">{c}</span>
          </div>
        </div>

        {costStages.map((stage) => (
          <div key={stage.key} className="border-b border-border/60 p-4 last:border-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium text-text-primary">{stage.labelAr}</span>
                {stage.isEstimate && (
                  <span className="rounded-md bg-gap/10 px-1.5 py-0.5 text-[10.5px] font-medium text-gap">
                    {tr("estimated")}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] tabular-nums text-text-faint">{stage.pctOfRevenue}%</span>
                <span className="text-[16px] font-semibold tabular-nums text-critical">
                  −{fmtNum(Math.abs(stage.amount))}
                </span>
              </div>
            </div>

            {/* الشريط نسبي لأكبر بند تكلفة - يجعل الترتيب مرئياً فوراً */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-critical/70"
                style={{ width: `${(Math.abs(stage.amount) / maxCost) * 100}%` }}
              />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
              <span className="text-text-faint">{stage.sourceAr}</span>
              <span className="tabular-nums text-text-muted">
                {tr("remaining")}: {fmtNum(stage.runningTotal)} {c}
              </span>
            </div>
          </div>
        ))}

        {/* صافي الربح كنقطة نهاية */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-t-2 p-4 ${
            journey.netProfit >= 0
              ? "border-verified/40 bg-verified/[0.06]"
              : "border-critical/40 bg-critical/[0.06]"
          }`}
        >
          <div>
            <div className="text-[13.5px] font-semibold text-text-primary">{t(locale, "store.netProfit")}</div>
            <div className="mt-0.5 text-[11.5px] text-text-faint">
              {tr("netProfitCaption")}
            </div>
          </div>
          <div
            className={`text-[24px] font-semibold tabular-nums ${
              journey.netProfit >= 0 ? "text-verified" : "text-critical"
            }`}
          >
            {fmtNum(journey.netProfit)} <span className="text-[12px] font-normal text-text-muted">{c}</span>
          </div>
        </div>
      </div>

      {journey.biggestLeak && (
        <div className="mb-2 flex items-start gap-2 rounded-2xl border border-border bg-surface p-4">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-gap" />
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            أكبر بند يستهلك إيرادك هو <span className="font-semibold text-text-primary">{journey.biggestLeak.labelAr}</span>{" "}
            بـ{journey.biggestLeak.pctOfRevenue}% من كل ريال تبيعه. خفضه ١٠% يضيف{" "}
            <span className="font-semibold text-verified">
              {fmtNum(journey.biggestLeak.amount * 0.1)} {c}
            </span>{" "}
            إلى صافي ربحك دون بيع وحدة إضافية واحدة.
          </p>
        </div>
      )}

      <RecommendedActions actions={actions} emptyAr={tr("healthy")} />
    </div>
  );
}
