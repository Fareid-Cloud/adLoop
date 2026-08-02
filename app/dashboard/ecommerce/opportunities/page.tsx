// app/dashboard/ecommerce/opportunities/page.tsx
//
// كل ما يمكن فعله الآن لزيادة الربح، مرتَّباً بالأثر المالي.
//
// هذه الصفحة هي الفرق بين لوحة تحليل ومستشار: لا تعرض أن الهامش انخفض،
// بل تقول ما يُفعل، وكم يُتوقَّع أن يعيد، وما درجة الثقة في ذلك التقدير.
// كل فرصة تحمل ثلاثة أشياء: أثر بالمال، ثقة مبرَّرة، وصعوبة صريحة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  EcomHeader, SectionHeading, DataGate, LimitsNote, fmtNum,
} from "../_components/EcomPrimitives";
import { buildOpportunities, type Opportunity } from "@/lib/ecommerce/opportunities";
import { MetricCard } from "@/app/components/ui/MetricCard";
import {
  TrendingUp, Target, Layers, ArrowLeft, ArrowUpCircle, ArrowDownCircle,
  PauseCircle, PackagePlus, Boxes, Users, RotateCcw, Wallet,
} from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

const TYPE_META: Record<
  Opportunity["type"],
  { icon: typeof TrendingUp; labelKey: string; tone: string }
> = {
  RAISE_PRICE: { icon: ArrowUpCircle, labelKey: "typeRaisePrice", tone: "text-gap bg-gap/10" },
  LOWER_PRICE: { icon: ArrowDownCircle, labelKey: "typeLowerPrice", tone: "text-accent bg-accent/10" },
  PAUSE_ADS: { icon: PauseCircle, labelKey: "typePauseAds", tone: "text-critical bg-critical/10" },
  INCREASE_BUDGET: { icon: TrendingUp, labelKey: "typeIncreaseBudget", tone: "text-verified bg-verified/10" },
  RESTOCK: { icon: PackagePlus, labelKey: "typeRestock", tone: "text-critical bg-critical/10" },
  BUNDLE: { icon: Boxes, labelKey: "typeBundle", tone: "text-accent bg-accent/10" },
  CROSS_SELL: { icon: Layers, labelKey: "typeCrossSell", tone: "text-accent bg-accent/10" },
  WIN_BACK: { icon: Users, labelKey: "typeWinBack", tone: "text-gap bg-gap/10" },
  REDUCE_RETURNS: { icon: RotateCcw, labelKey: "typeReduceReturns", tone: "text-critical bg-critical/10" },
};

const CONFIDENCE_KEY = { HIGH: "confHigh", MEDIUM: "confMedium", LOW: "confLow" } as const;
const CONFIDENCE_TONE = {
  HIGH: "bg-verified/10 text-verified",
  MEDIUM: "bg-gap/10 text-gap",
  LOW: "bg-surface-raised text-text-muted",
} as const;
const DIFFICULTY_KEY = { EASY: "diffEasy", MEDIUM: "diffMedium", HARD: "diffHard" } as const;

export default async function OpportunitiesPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `opportunities.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);
  const tx = (item: { key: string; vars?: Record<string, string | number> }) => tText(locale, "oppText", item);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <DataGate titleAr={tc("noWorkspace")} reasonAr={tc("noWorkspaceHint")} href="/dashboard" hrefLabelAr={tc("toHome")} />;
  }

  const result = await buildOpportunities(workspace.id, 30);
  const c = result.currency;

  const easyWins = result.opportunities.filter((o) => o.difficulty === "EASY");
  const highConfidence = result.opportunities.filter((o) => o.confidence === "HIGH");

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title={tr("title")}
        subtitle={tr("subtitle")}
        storeName={workspace.name}
      />

      {result.opportunities.length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label={tr("totalFound")}
            value={fmtNum(result.totalPotentialProfit)}
            unit={`${c} · ${t(locale, "store.perMonth")}`}
            icon={Wallet}
            tone="verified"
          />
          <MetricCard
            label={tr("quickWins")}
            value={easyWins.length}
            icon={Target}
            tone="accent"
            caption={
              easyWins.length > 0
                ? { text: tr("withImpact", { value: `${fmtNum(easyWins.reduce((s, o) => s + o.estimatedMonthlyProfit, 0))} ${c}` }), tone: "positive" }
                : undefined
            }
          />
          <MetricCard
            label={tr("highConfidence")}
            value={highConfidence.length}
            icon={TrendingUp}
            tone="verified"
            caption={{ text: tr("highConfidenceHint"), tone: "muted" }}
          />
        </div>
      )}

      <LimitsNote items={result.blindSpots.map(tx)} />

      {result.opportunities.length === 0 ? (
        <DataGate
          titleAr={tr("noneTitle")}
          reasonAr={tr("noneReason")}
          href="/dashboard/ecommerce/products"
          hrefLabelAr={tr("noneCta")}
        />
      ) : (
        <>
          <SectionHeading hint={tr("listHint")}>{tr("countLabel", { count: result.opportunities.length })}</SectionHeading>

          <div className="flex flex-col gap-3">
            {result.opportunities.map((o) => {
              const meta = TYPE_META[o.type];
              const Icon = meta.icon;
              return (
                <article
                  key={o.id}
                  className="card-shadow rounded-2xl border border-border bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-text-primary">{tx(o.title)}</h3>
                          <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] text-text-muted">
                            {tr(meta.labelKey)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">{tx(o.reason)}</p>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <div className="text-[22px] font-semibold leading-none tabular-nums text-verified">
                        +{fmtNum(o.estimatedMonthlyProfit)}
                      </div>
                      <div className="mt-1 text-[11.5px] text-text-muted">{c} · {t(locale, "store.perMonth")}</div>
                    </div>
                  </div>

                  {/* الإجراء المحدَّد - لا نصيحة عامة */}
                  <div className="mt-3 rounded-xl border border-border bg-surface-2/50 p-3">
                    <div className="mb-1 text-[11.5px] font-medium text-text-faint">{tr("whatToDo")}</div>
                    <p className="text-[12.5px] leading-relaxed text-text-primary">{tx(o.action)}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${CONFIDENCE_TONE[o.confidence]}`}
                        title={tx(o.confidenceReason)}
                      >
                        {tr(CONFIDENCE_KEY[o.confidence])}
                      </span>
                      <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[11.5px] text-text-muted">
                        {tr(DIFFICULTY_KEY[o.difficulty])}
                      </span>
                      {o.oneClick && (
                        <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent">
                          {tr("oneClick")}
                        </span>
                      )}
                    </div>

                    {o.actionHref && (
                      <Link
                        href={o.actionHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
                      >
                        {tc("apply")}
                        <ArrowLeft size={13} />
                      </Link>
                    )}
                  </div>

                  {/* سبب درجة الثقة معروض دائماً - درجة بلا تفسير لا قيمة لها */}
                  <p className="mt-2 text-[11.5px] leading-relaxed text-text-faint">
                    {tx(o.confidenceReason)}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
