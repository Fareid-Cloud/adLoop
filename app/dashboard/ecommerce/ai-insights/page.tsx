// app/dashboard/ecommerce/ai-insights/page.tsx
//
// أسئلة محدَّدة بإجابات محسوبة، لا محادثة مفتوحة.
//
// السبب في رفض نمط الدردشة هنا: صاحب المتجر لا يعرف ما يسأل عنه غالباً،
// والسؤال المفتوح يُنتج تلخيصاً للبيانات لا قراراً. أربعة أسئلة ثابتة
// تغطّي ما يحتاجه فعلاً كل صباح، وكل إجابة مبنيّة على الأرقام نفسها التي
// تراها في بقية الصفحات - لا رأي منفصل يناقضها.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  EcomHeader, SectionHeading, DataGate, fmtNum,
} from "../_components/EcomPrimitives";
import { getProfitJourney, getStoreOverview } from "@/lib/ecommerce/storeIntelligence";
import { getEcommerceOverview } from "@/lib/ecommerce/productPerformance";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import { HelpCircle, ArrowLeft } from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

interface Answer {
  question: string;
  answer: string;
  evidence: string[];
  href?: string;
  hrefLabel?: string;
  tone: "critical" | "warning" | "positive" | "neutral";
}

export default async function AiInsightsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tx = (item: { key: string; vars?: Record<string, string | number> }) => tText(locale, "oppText", item);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `insightsPage.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <DataGate locale={locale} title={tc("noWorkspace")} reason={tc("noWorkspaceHint")} href="/dashboard" hrefLabel={tc("toHome")} />;
  }

  const [journey, prevJourney, overview, products, opps] = await Promise.all([
    getProfitJourney(workspace.id, 30),
    getProfitJourney(workspace.id, 60),
    getStoreOverview(workspace.id, 30),
    getEcommerceOverview(workspace.id, 30),
    buildOpportunities(workspace.id, 30),
  ]);

  const c = journey.currency;

  if (journey.revenue <= 0 && products.products.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitleShort")}
          storeName={workspace.name}
        />
        <DataGate locale={locale}
          title={tr("noneTitle")}
          reason={tr("noneReason")}
        />
      </div>
    );
  }

  const answers: Answer[] = [];

  // ==== ١) لماذا انخفض الربح؟ ====
  const prevPeriodProfit = prevJourney.netProfit - journey.netProfit;
  const profitDelta = journey.netProfit - prevPeriodProfit;

  if (prevPeriodProfit !== 0 && profitDelta < 0) {
    // نجد أي بند تكلفة نما أكثر من غيره - السبب لا العَرَض
    const changes = journey.stages
      .filter((s) => s.key !== "revenue")
      .map((s) => {
        const prev = prevJourney.stages.find((x) => x.key === s.key);
        const prevAmount = prev ? Math.abs(prev.amount) - Math.abs(s.amount) : 0;
        const growth = prevAmount > 0 ? ((Math.abs(s.amount) - prevAmount) / prevAmount) * 100 : 0;
        return { label: tText(locale, "stageText", s.label), growth, amount: Math.abs(s.amount) };
      })
      .filter((x) => x.growth > 0)
      .sort((a, b) => b.growth - a.growth);

    const culprit = changes[0];
    answers.push({
      question: tr("qProfitDrop"),
      answer: culprit
        ? tr("aProfitDrop", { amount: `${fmtNum(Math.abs(profitDelta))} ${c}`, label: culprit.label, pct: Math.round(culprit.growth) })
        : tr("aProfitDropNoCulprit", { amount: `${fmtNum(Math.abs(profitDelta))} ${c}` }),
      evidence: [
        tr("evNow", { value: `${fmtNum(journey.netProfit)} ${c}` }),
        tr("evPrev", { value: `${fmtNum(prevPeriodProfit)} ${c}` }),
        ...(culprit ? [tr("evConsumes", { label: culprit.label, value: `${fmtNum(culprit.amount)} ${c}` })] : []),
      ],
      href: "/dashboard/ecommerce/profit",
      hrefLabel: t(locale, "store.openProfit"),
      tone: "critical",
    });
  } else if (prevPeriodProfit !== 0) {
    answers.push({
      question: tr("qProfitMove"),
      answer: tr("aProfitUp", { amount: `${fmtNum(profitDelta)} ${c}` }),
      evidence: [
        tr("evNow", { value: `${fmtNum(journey.netProfit)} ${c}` }),
        tr("evPrev", { value: `${fmtNum(prevPeriodProfit)} ${c}` }),
        tr("evNetMargin", { pct: journey.netMarginPct ?? 0 }),
      ],
      tone: "positive",
    });
  }

  // ==== ٢) أي منتج يجب أن أوسّعه؟ ====
  const scalable = products.products
    .filter((p) => p.verdict === "WINNER" && p.confidence === "RELIABLE")
    .sort((a, b) => b.totalProfit - a.totalProfit);

  answers.push({
    question: tr("qScale"),
    answer: scalable.length
      ? tr("aScale", { name: scalable[0].name, profit: `${fmtNum(scalable[0].totalProfit)} ${c}`, margin: scalable[0].marginPct, returns: scalable[0].returnRatePct, units: scalable[0].unitsSold })
      : tr("aScaleNone"),
    evidence: scalable.slice(0, 3).map(
      (p) => `${p.name}: ${fmtNum(p.totalProfit)} ${c} • ${p.marginPct}% • ${p.unitsSold}`
    ),
    href: scalable.length ? "/dashboard/campaigns/creatives" : "/dashboard/ecommerce/products",
    hrefLabel: scalable.length ? tr("aScaleCta") : tr("aScaleCtaNone"),
    tone: scalable.length ? "positive" : "neutral",
  });

  // ==== ٣) أي منتج يخسر مالاً؟ ====
  const losers = products.products
    .filter((p) => p.profitPerUnit < 0 && p.unitsSold > 0)
    .sort((a, b) => a.profitPerUnit * a.unitsSold - b.profitPerUnit * b.unitsSold);

  answers.push({
    question: tr("qLosing"),
    answer: losers.length
      ? tr("aLosing", { count: losers.length, name: losers[0].name, perUnit: `${fmtNum(Math.abs(losers[0].profitPerUnit))} ${c}`, units: losers[0].unitsSold, total: `${fmtNum(Math.abs(losers[0].profitPerUnit) * losers[0].unitsSold)} ${c}` })
      : tr("aLosingNone"),
    evidence: losers
      .slice(0, 3)
      .map((p) => `${p.name}: −${fmtNum(Math.abs(p.profitPerUnit))} ${c} × ${p.unitsSold}`),
    href: losers.length ? "/dashboard/ecommerce/pricing-intelligence" : undefined,
    hrefLabel: tr("aLosingCta"),
    tone: losers.length ? "critical" : "positive",
  });

  // ==== ٤) ماذا أفعل اليوم؟ ====
  const top = opps.opportunities[0];
  answers.push({
    question: tr("qToday"),
    answer: top
      ? `${tx(top.title)}. ${tx(top.action)}`
      : tr("aTodayNone"),
    evidence: top
      ? [
          tr("evImpact", { value: `${fmtNum(top.estimatedMonthlyProfit)} ${c}` }),
          tx(top.confidenceReason),
          ...opps.opportunities.slice(1, 3).map((o) => `${tx(o.title)}: +${fmtNum(o.estimatedMonthlyProfit)} ${c}`),
        ]
      : [],
    href: "/dashboard/ecommerce/opportunities",
    hrefLabel: tr("allOpportunities"),
    tone: top ? "warning" : "positive",
  });

  const TONE = {
    critical: "border-critical/30 bg-critical/[0.05]",
    warning: "border-gap/30 bg-gap/[0.05]",
    positive: "border-verified/30 bg-verified/[0.05]",
    neutral: "border-border bg-surface",
  } as const;

  return (
    <div className="mx-auto max-w-4xl">
      <EcomHeader
        title={tr("title")}
        subtitle={tr("subtitle")}
        storeName={workspace.name}
      />

      <SectionHeading hint={tr("fourQuestionsHint")}>{tr("fourQuestions")}</SectionHeading>

      <div className="flex flex-col gap-3">
        {answers.map((a, i) => (
          <article key={i} className={`card-shadow rounded-2xl border p-5 ${TONE[a.tone]}`}>
            <div className="mb-2 flex items-start gap-2">
              <HelpCircle size={16} className="mt-0.5 shrink-0 text-text-muted" />
              <h3 className="text-[14px] font-semibold text-text-primary">{a.question}</h3>
            </div>

            <p className="text-[13px] leading-relaxed text-text-primary">{a.answer}</p>

            {a.evidence.length > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-surface/70 p-3">
                <div className="mb-1.5 text-[11.5px] font-medium text-text-faint">{tr("evidence")}</div>
                <ul className="flex flex-col gap-1">
                  {a.evidence.map((e, j) => (
                    <li key={j} className="text-[12px] tabular-nums text-text-muted">
                      • {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {a.href && (
              <Link
                href={a.href}
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent no-underline hover:underline"
              >
                {a.hrefLabel}
                <ArrowLeft size={13} />
              </Link>
            )}
          </article>
        ))}
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-text-faint">
        {tr("footnote")}
      </p>
    </div>
  );
}
