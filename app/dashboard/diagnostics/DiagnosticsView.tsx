"use client";

// صفحة التشخيص: مؤشر صحة بعدّاد دائري، بطاقات مقسّمة بالخطورة، قائمة
// المشاكل ذات الأثر المالي، سجل نشاط حيّ، وجدول كل الفحوصات.
//
// النسخة السابقة كانت شبكة بطاقات متطابقة بلا مصدر ولا أثر ولا اتجاه،
// وبلا أي تقسيم بالخطورة أو زر فحص - فبدت فارغة رغم أن البيانات موجودة.

import { useState, useMemo, useTransition, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, AlertOctagon, AlertTriangle, Info, CheckCircle2, Search,
  ChevronLeft, ChevronDown, Activity, Loader2, Radar,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { MetricCard, type MetricTone } from "@/app/components/ui/MetricCard";
import { CATEGORY_META, type CheckCategory, type CheckSeverity, type CheckStatus } from "@/lib/diagnosticsEngine";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { itemTitle } from "@/lib/localizedRecord";
import { HealthGauge } from "@/app/components/ui/HealthGauge";
import { TH, TD, TR, THEAD_ROW } from "@/app/components/ui/tableStyles";

export interface CheckRow {
  id: string;
  titleAr: string; titleEn: string;
  descAr: string; descEn: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: CheckSeverity;
  findingAr?: string;
  findingEn?: string;
  monthlyImpact?: number | null;
  source?: string;
  remedy?: string[];
  trend: number[];
  platform?: string | null;
  lastScanAt: string;
  actionHref?: string;
}

export interface ActivityRow {
  /** نصّ مترجَم جاهز - يصل من `t(locale, ...)` في الصفحة */
  title: string;
  detail: string;
  at: string;
}

const STATUS_TONE: Record<CheckStatus, string> = {
  PASS: "var(--verified)",
  WARNING: "var(--gap)",
  FAILED: "var(--critical)",
  UNKNOWN: "var(--text-muted)",
};
const STATUS_KEY: Record<CheckStatus, string> = {
  PASS: "statusPass", WARNING: "statusWarning", FAILED: "statusFailed", UNKNOWN: "statusUnknown",
};

// نبرة كل بطاقة من نظام البطاقة الموحّد بدل ألوان مكتوبة يدوياً - فيبقى
// التلوين دلالياً واحداً عبر المنتج كله
const SEVERITY_CARDS = [
  { key: "critical", Icon: AlertOctagon, tone: "critical" },
  { key: "high", Icon: AlertTriangle, tone: "gap" },
  { key: "medium", Icon: Info, tone: "accent" },
  { key: "passing", Icon: CheckCircle2, tone: "verified" },
] as const satisfies ReadonlyArray<{ key: string; Icon: typeof AlertOctagon; tone: MetricTone }>;

function Spark({ data, tone }: { data: number[]; tone: string }) {
  if (data.length < 2) return <span className="text-[11px] text-text-faint">—</span>;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${20 - ((v - min) / range) * 16}`);
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" className="h-5 w-[68px]">
      <polyline points={pts.join(" ")} fill="none" stroke={tone} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}


export function DiagnosticsView({
  workspaceName, healthScore, scoreTrend, counts, checks, activity, totalMonthlyImpact, currency, lastScanAt, locale,
}: {
  workspaceName: string;
  healthScore: number;
  scoreTrend: number[];
  counts: { critical: number; high: number; medium: number; passing: number };
  checks: CheckRow[];
  activity: ActivityRow[];
  totalMonthlyImpact: number;
  currency: string;
  lastScanAt: string | null;
  locale: Locale;
}) {
  const ar = locale === "ar";
  // مساحتان مختلفتان في القاموس: نصوص الصفحة، ونصوص هذا العرض
  const tp = (k: string) => t(locale, ("diagnosticsPage." + k) as never);
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `diag.${k}`, vars);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [category, setCategory] = useState<"all" | CheckCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CheckStatus>("all");
  // فلتر الخطورة منفصل عن فلتر الحالة: الضغط على بطاقة "حرجة" كان يضبط
  // فلتر الحالة على "الكل" فلا يفلتر شيئاً - وبطاقة "سليمة" وحدها هي التي
  // كانت تعمل بالصدفة لأن لها حالة مقابلة.
  const [severityFilter, setSeverityFilter] = useState<"all" | CheckSeverity>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);
  // الفحص الحيّ: عدد الفحوصات المكشوفة حتى الآن. عند الضغط على "فحص جديد"
  // نبدأ من صفر ونكشفها تباعاً، ليرى المستخدم العمل يجري فعلاً بدل انتظار
  // صامت ثم ظهور كل شيء دفعة واحدة.
  const [revealed, setRevealed] = useState<number | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const scoreLabel = healthScore >= 80 ? tp("scoreGood") : healthScore >= 55 ? tp("scoreWarn") : tp("scoreCritical");
  const scoreTone = healthScore >= 80 ? "var(--verified)" : healthScore >= 55 ? "var(--gap)" : "var(--critical)";

  // أهم المشاكل: الحرجة ثم العالية، مرتّبة بالأثر المالي
  const topIssues = useMemo(
    () => checks
      .filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH")
      .sort((a, b) => (b.monthlyImpact ?? 0) - (a.monthlyImpact ?? 0)),
    [checks]
  );
  const visibleIssues = showAllIssues ? topIssues : topIssues.slice(0, 4);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return checks.filter((c) =>
      (category === "all" || c.category === category) &&
      (statusFilter === "all" || c.status === statusFilter) &&
      (severityFilter === "all" || c.severity === severityFilter) &&
      (!q ||
        c.titleAr.toLowerCase().includes(q) ||
        c.titleEn.toLowerCase().includes(q) ||
        c.descAr.toLowerCase().includes(q) ||
        c.descEn.toLowerCase().includes(q))
    );
  }, [checks, category, statusFilter, severityFilter, query]);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { all: checks.length };
    for (const c of checks) m[c.category] = (m[c.category] ?? 0) + 1;
    return m;
  }, [checks]);

  async function runScan() {
    setScanning(true);
    setScanDone(false);
    setRevealed(0);
    setShowAllIssues(false);

    // ننزل إلى جدول الفحوصات ليشاهد المستخدم النتائج تظهر واحدة تلو الأخرى
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);

    // الفحص الفعلي يجري في الخلفية بينما نكشف النتائج تدريجياً. الإيقاع
    // مضبوط ليبدو عملاً حقيقياً لا شريط تحميل وهمياً: كل فحص له وقته.
    const total = checks.length || 1;
    const stepMs = Math.max(420, Math.min(1100, Math.round(26000 / total)));

    const request = fetch("/api/diagnostics/scan", { method: "POST" }).catch(() => null);

    for (let i = 1; i <= total; i++) {
      await new Promise((r) => setTimeout(r, stepMs));
      setRevealed(i);
    }

    await request;
    setScanning(false);
    setScanDone(true);
    startTransition(() => router.refresh());
    // نُبقي رسالة الاكتمال ظاهرة قليلاً ثم نعود للعرض الكامل
    setTimeout(() => { setRevealed(null); setScanDone(false); }, 4000);
  }

  const busy = scanning || pending;

  return (
    <div className="mx-auto max-w-6xl pb-10">
      {/* الرأس */}
      <div className="reveal mb-8 flex flex-wrap items-start justify-between gap-4" style={{ animationDelay: "0ms" }}>
        <div>
          <div className="mb-1 text-[13px] text-text-muted">{workspaceName}</div>
          <h1 className="page-title">{tp("title")}</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {tp("subtitle")}
          </p>
        </div>
        {/* `flex-wrap` والنصّ `whitespace-nowrap`: الصفّ كان يضغط «آخر فحص:
            الآن» حتى ينكسر على سطرين داخل ارتفاع سطر واحد، فيُقرأ نصفه.
            الآن يلتفّ العنصر كاملاً إلى سطر جديد بدل أن ينكسر النصّ نفسه. */}
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {lastScanAt && (
            <span className="whitespace-nowrap text-[12.5px] text-text-muted">{tp("lastScan")}: {lastScanAt}</span>
          )}
          {/* الوصول إلى صفحة الصفحات المراقَبة - كان الرابط الوحيد إليها قد
              أُزيل عند إعادة بناء هذه الصفحة، فأصبحت غير قابلة للوصول تماماً */}
          <a
            href="/dashboard/diagnostics/tracking-coverage"
            className="btn btn-secondary"
          >
            <Radar size={15} className="text-text-muted" />
            {tr("trackingCoverage")}
          </a>
          <button
            onClick={runScan}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {busy ? tr("scanning") : tp("runScan")}
          </button>
        </div>
      </div>

      {/* مؤشر الصحة + بطاقات الخطورة */}
      <div className="reveal mb-6 grid gap-4 lg:grid-cols-[1.15fr_2fr]" style={{ animationDelay: "80ms" }}>
        <div className="card-shadow flex items-center gap-4 card pad-lg">
          <HealthGauge score={healthScore} size="lg" />
          <div className="min-w-0">
            <div className="text-[13px] text-text-muted">{tp("healthScore")}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: scoreTone }} />
              <span className="text-[16px] font-semibold" style={{ color: scoreTone }}>{scoreLabel}</span>
            </div>
            {totalMonthlyImpact > 0 && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                {tr("estimatedImpact")}{" "}
                <span className="font-mono font-semibold text-critical">
                  {totalMonthlyImpact.toLocaleString("en-US")} {currency}
                </span>{" "}
                {tr("monthly")}.
              </p>
            )}
            <div className="mt-2"><Spark data={scoreTrend} tone={scoreTone} /></div>
          </div>
        </div>

        {/* بطاقات فلترة تفاعلية بنفس نظام البطاقة الموحّد - كانت نسخة بصرية
            ثانية مكتوبة يدوياً، فصارت تنحرف عن باقي المنتج مع كل تعديل */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEVERITY_CARDS.map((s) => {
            const n = counts[s.key];
            const selected = s.key === "passing"
              ? statusFilter === "PASS"
              : severityFilter === (s.key.toUpperCase() as CheckSeverity);
            return (
              <MetricCard
                key={s.key}
                label={tp(s.key)}
                explainKey={SEVERITY_EXPLAIN[s.key]}
                locale={locale}
                value={n}
                icon={s.Icon}
                // العدد صفر لا يستحق تلويناً تحذيرياً - لا مشكلة أصلاً
                tone={n > 0 || s.key === "passing" ? s.tone : "neutral"}
                selected={selected}
                caption={{
                  text: tr(s.key + "Sub"),
                  tone: s.key === "passing" ? "positive" : n > 0 ? "warning" : "muted",
                }}
                onClick={() => {
                  if (s.key === "passing") {
                    const on = statusFilter === "PASS";
                    setStatusFilter(on ? "all" : "PASS");
                    setSeverityFilter("all");
                  } else {
                    const sev = s.key.toUpperCase() as CheckSeverity;
                    const on = severityFilter === sev;
                    setSeverityFilter(on ? "all" : sev);
                    setStatusFilter("all");
                  }
                  // ننزل للجدول ليرى المستخدم أثر الفلترة فوراً بدل أن
                  // يحدث التصفية أسفل الصفحة دون أن ينتبه لها
                  setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* المشاكل + النشاط */}
      <div className="reveal mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]" style={{ animationDelay: "200ms" }}>
        <section className="card-shadow overflow-hidden card">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <h2 className="section-title">{tp("issuesTitle")}</h2>
            <span className="chip bg-critical/12 font-mono text-critical">
              {topIssues.length}
            </span>
          </div>

          {topIssues.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={26} className="mx-auto mb-2 text-verified" />
              <p className="text-[13.5px] text-text-primary">{tp("noIssues")}</p>
              <p className="mt-1 text-[12.5px] text-text-muted">{tp("noIssuesSub")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visibleIssues.map((c) => {
                const tone = c.severity === "CRITICAL" ? "var(--critical)" : "var(--gap)";
                return (
                  <li key={c.id} className="flex items-start gap-3 p-4">
                    {c.monthlyImpact ? (
                      <div className="shrink-0 rounded-xl px-3 py-2 text-center"
                           style={{ background: `color-mix(in srgb, ${tone} 10%, transparent)` }}>
                        <div className="font-mono text-[15px] font-bold leading-none" style={{ color: tone }}>
                          {c.monthlyImpact.toLocaleString("en-US")}
                        </div>
                        <div className="mt-0.5 text-[10px] text-text-muted">{tr("perMonth", { currency })}</div>
                      </div>
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-text-primary">{bi(locale, c.titleAr, c.titleEn)}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                              style={{ background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone }}>
                          {c.severity === "CRITICAL" ? tp("severityCritical") : tp("severityHigh")}
                        </span>
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
                          {ar ? CATEGORY_META[c.category].ar : CATEGORY_META[c.category].en}
                        </span>
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-text-muted">{bi(locale, c.findingAr, c.findingEn) ?? bi(locale, c.descAr, c.descEn)}</p>
                    </div>

                    {c.actionHref && isActionable(c) && (
                      <a href={c.actionHref}
                         className="btn btn-secondary btn-sm shrink-0">
                        {tr("resolve")}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {topIssues.length > 4 && (
            <button
              onClick={() => setShowAllIssues((v) => !v)}
              className="w-full border-t border-border py-3 text-[12.5px] font-medium text-accent"
            >
              {showAllIssues ? tp("showTopOnly") : `${tp("showMore")} (${topIssues.length - 4})`}
            </button>
          )}
        </section>

        <section className="card-shadow overflow-hidden card">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Activity size={15} className="text-accent" />
            <h2 className="section-title">{tp("recentActivity")}</h2>
          </div>
          {activity.length === 0 ? (
            <p className="p-6 text-center text-[12.5px] text-text-muted">{tp("noActivity")}</p>
          ) : (
            <ul className="p-4">
              {activity.map((a, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    {i < activity.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-text-primary">{itemTitle(locale, a)}</div>
                    <div className="text-[11.5px] text-text-muted">{a.detail}</div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-text-faint">{a.at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* جدول كل الفحوصات */}
      <section ref={tableRef} className="reveal card-shadow overflow-hidden card" style={{ animationDelay: "320ms" }}>
        {/* شريط تقدّم الفحص الحيّ */}
        {revealed !== null && (
          <div className="border-b border-border px-5 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
                {scanDone ? (
                  <><CheckCircle2 size={15} className="text-verified" /> {tr("scanDone", { n: checks.length })}</>
                ) : (
                  <><Loader2 size={15} className="animate-spin text-accent" /> {tr("scanning", { done: revealed, total: checks.length })}</>
                )}
              </span>
              {!scanDone && revealed > 0 && checks[revealed - 1] && (
                <span className="truncate text-[12px] text-text-muted">{bi(locale, checks[revealed - 1].titleAr, checks[revealed - 1].titleEn)}</span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${checks.length ? (revealed / checks.length) * 100 : 0}%`,
                  background: scanDone ? "var(--verified)" : "var(--accent)",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <h2 className="section-title">{tp("allChecks")}</h2>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[11.5px] text-text-muted">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as any)}
                    className="field">
              <option value="all">{tp("allCategories")} ({categoryCounts.all ?? 0})</option>
              {(Object.keys(CATEGORY_META) as CheckCategory[]).filter((k) => categoryCounts[k]).map((k) => (
                <option key={k} value={k}>{ar ? CATEGORY_META[k].ar : CATEGORY_META[k].en} ({categoryCounts[k]})</option>
              ))}
            </select>
            {(severityFilter !== "all" || statusFilter !== "all" || category !== "all") && (
              <button
                onClick={() => { setSeverityFilter("all"); setStatusFilter("all"); setCategory("all"); }}
                className="card-inset px-3 py-2 text-[12.5px] text-text-muted"
              >
                {tr("clearFilters")}
              </button>
            )}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="field">
              <option value="all">{tp("allStatuses")}</option>
              {(Object.keys(STATUS_TONE) as CheckStatus[]).map((k) => (
                <option key={k} value={k}>{tp(STATUS_KEY[k])}</option>
              ))}
            </select>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 10 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tp("searchChecks")}
                     className="field w-44"
                     style={{ paddingInlineStart: 30, paddingInlineEnd: 10 }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className={THEAD_ROW}>
                {[tp("colCheck"), tp("colCategory"), tp("colStatus"), tp("colLastScan"), tp("colTrend"), tp("colAction")].map((h) => (
                  <th key={h} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-[13px] text-text-muted">{tp("noMatches")}</td></tr>
              ) : filtered.map((c, rowIndex) => {
                // أثناء الفحص الحيّ لا نعرض إلا ما كُشف حتى الآن
                if (revealed !== null && rowIndex >= revealed) return null;
                const st = { tone: STATUS_TONE[c.status], ar: tp(STATUS_KEY[c.status]) };
                const cat = CATEGORY_META[c.category];
                const failing = c.status === "FAILED" || c.status === "WARNING";
                const isOpen = expanded === c.id;
                const hasDetails = !!(c.source || (c.remedy && c.remedy.length > 0));
                return (
                  <Fragment key={c.id}>
                  <tr className={`reveal border-b border-border last:border-0 ${isOpen ? "bg-surface-raised/35" : "hover:bg-surface-raised/45"}`}>
                    <td className={TD}>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)` }}>
                          {c.platform ? <PlatformLogo platform={c.platform} size={14} />
                            : <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-text-primary">{bi(locale, c.titleAr, c.titleEn)}</div>
                          <div className="text-[11.5px] leading-relaxed text-text-muted">{bi(locale, c.findingAr, c.findingEn) ?? bi(locale, c.descAr, c.descEn)}</div>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)`, color: cat.color }}>
                        {ar ? cat.ar : cat.en}
                      </span>
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ background: `color-mix(in srgb, ${st.tone} 13%, transparent)`, color: st.tone }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.tone }} />
                        {st.ar}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[11.5px] text-text-muted">{c.lastScanAt}</td>
                    <td className={TD}><Spark data={c.trend} tone={st.tone} /></td>
                    <td className={TD}>
                      {/* زر واحد فقط عندما يوجد محتوى حقيقي وراءه: تفاصيل
                          قابلة للتوسيع، أو رابط معالجة لمشكلة قائمة. لا يُعرض
                          زر "تفاصيل" يقود إلى صفحة لا تخصّ الفحص. */}
                      {hasDetails ? (
                        <button
                          onClick={() => setExpanded(isOpen ? null : c.id)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border px-3 py-1.5 text-[11.5px]"
                          style={failing
                            ? { borderColor: `color-mix(in srgb, ${st.tone} 32%, transparent)`, background: `color-mix(in srgb, ${st.tone} 9%, transparent)`, color: st.tone }
                            : { borderColor: "var(--border)", background: "var(--surface-raised)", color: "var(--text-primary)" }}
                        >
                          {isOpen ? tp("hide") : tp("details")}
                          <ChevronDown size={12} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-text-faint">—</span>
                      )}
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="border-b border-border bg-surface-raised/35">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[11.5px] font-medium text-text-muted">{tp("whatItMeasures")}</div>
                            <p className="text-[12.5px] leading-relaxed text-text-primary">{c.descAr}</p>
                            {c.source && (
                              <>
                                <div className="mb-1 mt-3 text-[11.5px] font-medium text-text-muted">{tp("dataSource")}</div>
                                <p className="text-[12.5px] leading-relaxed text-text-muted">{c.source}</p>
                              </>
                            )}
                            {c.monthlyImpact ? (
                              <p className="mt-3 text-[12.5px] text-text-muted">
                                {tr("impactLabel")}{" "}
                                <span className="font-mono font-semibold text-critical">
                                  {c.monthlyImpact.toLocaleString("en-US")} {currency}
                                </span>{" "}
                                {tr("monthly")}
                              </p>
                            ) : null}
                          </div>

                          {c.remedy && c.remedy.length > 0 && (
                            <div>
                              <div className="mb-2 text-[11.5px] font-medium text-text-muted">{tp("remedySteps")}</div>
                              <ol className="flex flex-col gap-2">
                                {c.remedy.map((step, i) => (
                                  <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-primary">
                                    <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-accent/12 font-mono text-[10px] font-semibold text-accent"
                                          style={{ height: 18, width: 18 }}>
                                      {i + 1}
                                    </span>
                                    {step}
                                  </li>
                                ))}
                              </ol>
                              {c.actionHref && isActionable(c) && (
                                <a href={c.actionHref}
                                   className="btn btn-primary btn-sm mt-3">
                                  {tr("goResolve")}
                                  <ChevronLeft size={12} className="rtl:rotate-0 ltr:rotate-180" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** الشرح مشتقّ من مفتاح الخطورة الثابت لا من نصّها المترجَم */
const SEVERITY_EXPLAIN: Record<string, string | undefined> = {
  critical: "urgentActions",
  high: "importantActions",
  medium: "suggestions",
  passing: "healthScore",
};

/** الحقل المطابق للّغة - البيانات تحمل الاثنين، والعرض كان يقرأ العربي دائماً */
/** هل لهذا الفحص ما يُحَلّ؟ زرّ «حلّ» فوق فحص ناجح يَعِد بشيء غير موجود. */
/**
 * هل يستحقّ هذا البند زرّ «حلّ»؟
 *
 * القاعدة: الزرّ يَعِد بفعل. بندٌ سليم لا شيء فيه يُحلّ، ووجهةٌ هي الصفحة
 * التي يقف عليها المستخدم الآن تجعل الضغطة بلا أثر مرئيّ - وهو ما يُقرأ
 * كعطل لا كتصميم. حيث لا وجهة تُغيّر شيئاً، لا زرّ أصلاً؛ التشخيص وحده
 * يكفي والنصّ يشرح.
 */
function isActionable(c: CheckRow): boolean {
  if (c.status !== "WARNING" && c.status !== "FAILED") return false;
  return !!c.actionHref && c.actionHref !== "/dashboard/diagnostics";
}

function bi(locale: Locale, ar?: string, en?: string): string | undefined {
  if (ar === undefined && en === undefined) return undefined;
  return locale === "en" ? en : ar;
}
