"use client";

// app/dashboard/reports/VerdictBoard.tsx
//
// لوحة الحكم - مبنيّة على مرجعٍ بصريّ أرسله المالك.
//
// **البنية تتبع ترتيب القراءة لا ترتيب البيانات:** الإجابة أوّلاً بحجمٍ
// يُقرأ من بعيد، ثمّ الأرقام التي أنتجتها، ثمّ ما يُفعَل بها. وإلى جانبها
// عمودٌ يجيب عن السؤال التالي مباشرةً: «وهل أثق في هذا؟» - توصيةٌ، ثمّ
// درجة ثقةٍ وحجم عيّنة، ثمّ أبرز ما يُقرأ في الأرقام.
//
// **ولا زرّ ينفّذ شيئاً من هنا.** المرجع فيه «انقل الميزانية» كإجراءٍ
// مباشر، والمالك سبق أن رفضه صراحةً - ونقلُ ميزانيةٍ بضغطةٍ من صفحة تقرير
// قرارٌ لا رجعة فيه يُتّخذ بلا مراجعة. الزرّ هنا يفتح **محاكاة الميزانية**:
// المستخدم يرى الأثر قبل أن يقرّر، والقرار يبقى قراره.

import Link from "next/link";
import {
  Sparkles, TrendingUp, Target, ShieldCheck, Lightbulb, ArrowUpRight, ArrowDownRight, FileText,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import {
  METRIC_BY_KEY, metricLabelKey,
  type ComparisonVerdict, type MetricKey, type ReportResult, type ReportRow,
} from "@/lib/reports/reportEngine";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmt2 = (n: number) => (Math.abs(n) < 10 ? Math.round(n * 100) / 100 : Math.round(n)).toLocaleString("en-US");

export function VerdictBoard({
  result, locale, currency,
}: {
  result: ReportResult;
  locale: Locale;
  currency: string;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `reports.${k}`, v);
  const ctx = result.verdictContext;

  const ranked = [...result.verdicts].sort(
    (a, b) => (b.financialImpact ?? 0) - (a.financialImpact ?? 0),
  );
  const headline = ranked[0] ?? null;
  if (!headline || result.rows.length !== 2 || !ctx) return null;

  const nameOf = (label: string | null, platform: string | null) =>
    platform ? platformLabel(locale, platform) : label ?? "—";

  const winnerName = nameOf(headline.winnerLabel, headline.winnerPlatform);
  const loserName = nameOf(headline.loserLabel, headline.loserPlatform);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      {/* ══════════ العمود الأيسر: الإجابة وأرقامها ══════════ */}
      <div className="flex min-w-0 flex-col gap-4">
        <HeroVerdict
          v={headline}
          winnerName={winnerName}
          loserName={loserName}
          currency={currency}
          tr={tr}
          metricLabel={tr(metricLabelKey(headline.metric))}
        />

        <Scoreboard rows={result.rows} verdicts={ranked} locale={locale} currency={currency} tr={tr} nameOf={nameOf} />

        <Comparison rows={result.rows} verdicts={ranked} currency={currency} tr={tr} nameOf={nameOf} />

        {ctx.trend.length > 1 && (
          <TrendCard
            trend={ctx.trend}
            metric={headline.metric}
            aName={nameOf(result.rows[0].label, result.rows[0].platform)}
            bName={nameOf(result.rows[1].label, result.rows[1].platform)}
            tr={tr}
          />
        )}
      </div>

      {/* ══════════ العمود الأيمن: أثق في هذا؟ وماذا أفعل؟ ══════════ */}
      <div className="flex min-w-0 flex-col gap-4">
        {ctx.shiftPct && (
          <section className="card pad-md">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-primary">
              <Sparkles size={14} className="text-accent" /> {tr("vRecommendation")}
            </h3>
            <p className="text-[15px] font-semibold leading-snug text-text-primary">
              {tr("vShiftLead", { min: ctx.shiftPct.min, max: ctx.shiftPct.max, loser: loserName, winner: winnerName })}
            </p>

            <div className="mt-3 space-y-2.5 border-t border-border pt-3">
              {headline.financialImpact !== null && headline.financialImpact > 0 && (
                <Stat
                  icon={<TrendingUp size={14} />}
                  tone="verified"
                  label={tr("vEstProfit")}
                  value={`+${fmt(headline.financialImpact)} ${currency}`}
                />
              )}
              {headline.differencePct !== null && (
                <Stat
                  icon={<Target size={14} />}
                  tone="accent"
                  label={tr("vEstImprovement", { metric: tr(metricLabelKey(headline.metric)) })}
                  value={`+${Math.round(headline.differencePct)}%`}
                />
              )}
            </div>
          </section>
        )}

        <ConfidenceCard ctx={ctx} tr={tr} />

        <section className="card pad-md">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-primary">
            <Lightbulb size={14} className="text-accent" /> {tr("vInsights")}
          </h3>
          <ul className="space-y-2.5">
            {ranked.slice(0, 4).map((v) => (
              <li key={v.metric} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {v.winnerPlatform
                    ? <PlatformLogo platform={v.winnerPlatform} size={15} />
                    : <span className="block h-[15px] w-[15px] rounded-full bg-accent/25" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium leading-snug text-text-primary">
                    {nameOf(v.winnerLabel, v.winnerPlatform)} · {tr(metricLabelKey(v.metric))}
                  </span>
                  {v.differencePct !== null && (
                    <span className="mt-0.5 block text-[11.5px] text-text-muted">
                      {tr("vHigher", { pct: Math.round(v.differencePct), metric: tr(metricLabelKey(v.metric)) })}
                      {" · "}
                      {tr("vThan", { loser: nameOf(v.loserLabel, v.loserPlatform) })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <ChangesCard ctx={ctx} locale={locale} tr={tr} />
      </div>
    </div>
  );
}

// ==================== البطل ====================

function HeroVerdict({
  v, winnerName, loserName, currency, tr, metricLabel,
}: {
  v: ComparisonVerdict;
  winnerName: string;
  loserName: string;
  currency: string;
  tr: (k: string, x?: Record<string, string | number>) => string;
  metricLabel: string;
}) {
  return (
    <section className="card card-shadow overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-5 p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-faint">
            <Sparkles size={13} className="text-accent" /> {tr("verdictTitle")}
          </div>
          {/* الاسم فسطر الفارق فسطر المقابل: ثلاثة أسطر بأوزان مختلفة، فيُقرأ
              الحكم في نظرة واحدة بدل جملةٍ واحدة متساوية الثقل. */}
          <p className="text-[19px] leading-snug text-text-primary">{winnerName}</p>
          <p className="text-[30px] font-bold leading-tight text-accent">
            {tr("vHigher", { pct: Math.round(v.differencePct ?? 0), metric: metricLabel })}
          </p>
          <p className="text-[15px] text-text-muted">{tr("vThan", { loser: loserName })}</p>
        </div>

        {/* شعار الفائز بحجمٍ يُقرأ: هو الإجابة، فلا يُدفن في سطر نصّ */}
        {v.winnerPlatform && (
          <span className="icon-badge h-16 w-16 shrink-0 bg-surface-raised">
            <PlatformLogo platform={v.winnerPlatform} size={34} />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border bg-verified/[0.07] px-5 py-4">
        <div className="min-w-0">
          <div className="text-[12px] text-text-muted">
            {v.impactKind === "saving" ? tr("impactSaving") : tr("impactGain")} · {tr("vPotentialProfit")}
          </div>
          <div className="num mt-0.5 text-[26px] font-bold leading-none text-verified">
            {fmt(v.financialImpact ?? 0)} <span className="text-[15px] font-medium">{currency}</span>
          </div>
        </div>
        {/* لا تنفيذ من هنا - المحاكاة تُري الأثر قبل القرار */}
        <Link href="/dashboard/budget-simulator" className="btn btn-primary btn-sm shrink-0">
          {tr("vOpenSimulator")}
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}

// ==================== لوحة الأداء ====================

function Scoreboard({
  rows, verdicts, locale, currency, tr, nameOf,
}: {
  rows: ReportRow[];
  verdicts: ComparisonVerdict[];
  locale: Locale;
  currency: string;
  tr: (k: string, x?: Record<string, string | number>) => string;
  nameOf: (l: string | null, p: string | null) => string;
}) {
  const [a, b] = rows;
  return (
    <section className="card pad-md">
      <h3 className="mb-3 section-title">{tr("vScoreboard")}</h3>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="px-2 pb-2 text-start text-[11px] font-semibold text-text-faint">{tr("vMetric")}</th>
              {[a, b].map((r) => (
                <th key={r.key} className="px-2 pb-2 text-start text-[11.5px] font-semibold text-text-primary">
                  <span className="flex items-center gap-1.5">
                    {r.platform && <PlatformLogo platform={r.platform} size={14} />}
                    {nameOf(r.label, r.platform)}
                  </span>
                </th>
              ))}
              <th className="px-2 pb-2 text-end text-[11px] font-semibold text-text-faint">{tr("vWinner")}</th>
            </tr>
          </thead>
          <tbody>
            {verdicts.map((v) => {
              const def = METRIC_BY_KEY.get(v.metric)!;
              const av = a.values[v.metric] ?? 0;
              const bv = b.values[v.metric] ?? 0;
              // الشريط نسبةٌ من الأكبر لا من مجموعهما: المقارنة بينهما هي
              // المقصودة، وقسمتُهما على المجموع تُصغّر الفارق بصرياً.
              const max = Math.max(Math.abs(av), Math.abs(bv)) || 1;
              return (
                <tr key={v.metric} className="border-t border-border/50">
                  <td className="px-2 py-2.5 text-text-muted">{tr(metricLabelKey(v.metric))}</td>
                  {[{ r: a, val: av }, { r: b, val: bv }].map(({ r, val }) => (
                    <td key={r.key} className="px-2 py-2.5">
                      <span className="block whitespace-nowrap tabular-nums text-text-primary">
                        {def.format === "currency" ? `${fmt2(val)} ${currency}` : def.format === "percent" ? `${fmt2(val)}%` : fmt2(val)}
                      </span>
                      <span className="mt-1 block h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-surface-raised">
                        <span
                          className={`block h-full rounded-full ${v.winnerKey === r.key ? "bg-accent" : "bg-text-faint/45"}`}
                          style={{ width: `${Math.min(100, (Math.abs(val) / max) * 100)}%` }}
                        />
                      </span>
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-end">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-text-primary">
                      {v.winnerPlatform && <PlatformLogo platform={v.winnerPlatform} size={13} />}
                      {nameOf(v.winnerLabel, v.winnerPlatform)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-text-faint">{tr("vMoreDetailsBody")}</p>
      {void locale}
    </section>
  );
}

// ==================== المقارنة ====================

function Comparison({
  rows, verdicts, currency, tr, nameOf,
}: {
  rows: ReportRow[];
  verdicts: ComparisonVerdict[];
  currency: string;
  tr: (k: string, x?: Record<string, string | number>) => string;
  nameOf: (l: string | null, p: string | null) => string;
}) {
  const [a, b] = rows;
  return (
    <section className="card pad-md">
      <h3 className="mb-3 section-title">{tr("vComparison")}</h3>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
        {verdicts.slice(0, 6).map((v) => {
          const def = METRIC_BY_KEY.get(v.metric)!;
          const av = a.values[v.metric] ?? 0;
          const bv = b.values[v.metric] ?? 0;
          const max = Math.max(Math.abs(av), Math.abs(bv)) || 1;
          return (
            <div key={v.metric} className="card-inset min-w-0 p-3">
              <div className="truncate text-[11.5px] font-medium text-text-muted">
                {tr(metricLabelKey(v.metric))}
              </div>
              <div className="mt-2 flex h-[64px] items-end gap-2">
                {[{ r: a, val: av }, { r: b, val: bv }].map(({ r, val }) => (
                  <span key={r.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[10.5px] tabular-nums text-text-muted">
                      {def.format === "currency" ? fmt2(val) : def.format === "percent" ? `${fmt2(val)}%` : fmt2(val)}
                    </span>
                    <span
                      className={`w-full rounded-t ${v.winnerKey === r.key ? "bg-accent" : "bg-text-faint/35"}`}
                      style={{ height: `${Math.max(4, (Math.abs(val) / max) * 42)}px` }}
                    />
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">
                {[a, b].map((r) => (
                  <span key={r.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-text-faint">
                    {nameOf(r.label, r.platform)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {void currency}
    </section>
  );
}

// ==================== الأداء عبر الزمن ====================

function TrendCard({
  trend, metric, aName, bName, tr,
}: {
  trend: Array<{ date: string; a: number | null; b: number | null }>;
  metric: MetricKey;
  aName: string;
  bName: string;
  tr: (k: string, x?: Record<string, string | number>) => string;
}) {
  const vals = trend.flatMap((p) => [p.a, p.b]).filter((n): n is number => n !== null);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, trend.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - min) / span) * 100;

  const path = (pick: "a" | "b") =>
    trend
      .map((p, i) => (p[pick] === null ? null : `${x(i)},${y(p[pick]!)}`))
      .filter((s): s is string => s !== null)
      .map((s, i) => `${i === 0 ? "M" : "L"}${s}`)
      .join(" ");

  return (
    <section className="card pad-md">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title">{tr("vOverTime")}</h3>
        <span className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-accent">
            <span className="h-2 w-2 rounded-full bg-accent" /> {aName}
          </span>
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="h-2 w-2 rounded-full bg-text-faint" /> {bName}
          </span>
        </span>
      </div>
      {/* `preserveAspectRatio="none"` مقصود: المحور الأفقيّ زمنٌ والرأسيّ
          قيمة، ولا معنى لحفظ نسبةٍ بينهما - المطلوب أن يملأ الرسم عرضه. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[120px] w-full" role="img" aria-label={tr("vOverTime")}>
        <path d={path("b")} fill="none" stroke="var(--text-faint)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <path d={path("a")} fill="none" stroke="var(--accent)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 text-[11px] text-text-faint">{tr(metricLabelKey(metric))}</p>
    </section>
  );
}

// ==================== الثقة وما تغيّر ====================

function ConfidenceCard({
  ctx, tr,
}: {
  ctx: NonNullable<ReportResult["verdictContext"]>;
  tr: (k: string, x?: Record<string, string | number>) => string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <section className="card pad-md">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        <ShieldCheck size={14} className="text-verified" /> {tr("vConfidence")}
      </h3>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
            <circle cx="34" cy="34" r={r} fill="none" stroke="var(--surface-raised)" strokeWidth="6" />
            <circle
              cx="34" cy="34" r={r} fill="none" stroke="var(--verified)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(ctx.confidencePct / 100) * c} ${c}`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-text-primary">
            {ctx.confidencePct}%
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="text-[11px] text-text-faint">{tr("vConfidenceLevel")}</div>
            <div className="text-[12.5px] font-medium text-text-primary">{ctx.confidencePct}%</div>
          </div>
          <div>
            <div className="text-[11px] text-text-faint">{tr("vSampleSize")}</div>
            <div className="text-[12.5px] font-medium tabular-nums text-text-primary">
              {fmt(ctx.sampleSize)} <span className="font-normal text-text-muted">{tr("vConversions")}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-text-faint">{tr("vDataPeriod")}</div>
            <div className="text-[12.5px] font-medium text-text-primary">{tr("vDays", { n: ctx.periodDays })}</div>
          </div>
        </div>
      </div>
      {/* الرقم يُقال ومعه ما هو: «٩٤٪» بلا تعريف تُقرأ احتمالاً إحصائياً */}
      <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-text-faint">
        {tr("vConfidenceNote")}
      </p>
    </section>
  );
}

function ChangesCard({
  ctx, locale, tr,
}: {
  ctx: NonNullable<ReportResult["verdictContext"]>;
  locale: Locale;
  tr: (k: string, x?: Record<string, string | number>) => string;
}) {
  return (
    <section className="card pad-md">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        <FileText size={14} className="text-accent" /> {tr("vRecentChanges")}
      </h3>
      {ctx.changes.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-text-muted">{tr("vNoCompare")}</p>
      ) : (
        <ul className="space-y-2.5">
          {ctx.changes.map((c, i) => {
            const up = c.deltaPct > 0;
            return (
              <li key={`${c.rowKey}-${c.metric}-${i}`} className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`icon-badge mt-0.5 h-6 w-6 shrink-0 ${
                    up ? "bg-verified/12 text-verified" : "bg-critical/12 text-critical"
                  }`}
                >
                  {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-text-primary">
                    {c.platform ? platformLabel(locale, c.platform) : c.label} · {tr(metricLabelKey(c.metric))}
                  </span>
                  <span className={`text-[11.5px] tabular-nums ${up ? "text-verified" : "text-critical"}`}>
                    {up ? "+" : ""}{Math.round(c.deltaPct)}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({
  icon, tone, label, value,
}: {
  icon: React.ReactNode;
  tone: "verified" | "accent";
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className={`icon-badge h-7 w-7 shrink-0 ${tone === "verified" ? "bg-verified/12 text-verified" : "bg-accent/12 text-accent"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-text-faint">{label}</span>
        <span className={`block text-[13px] font-semibold tabular-nums ${tone === "verified" ? "text-verified" : "text-accent"}`}>
          {value}
        </span>
      </span>
    </div>
  );
}
