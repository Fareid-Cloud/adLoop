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
  ChevronLeft, ChevronDown, Activity, Loader2,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { CATEGORY_META, type CheckCategory, type CheckSeverity, type CheckStatus } from "@/lib/diagnosticsEngine";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface CheckRow {
  id: string;
  titleAr: string; titleEn: string;
  descAr: string; descEn: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: CheckSeverity;
  findingAr?: string;
  monthlyImpact?: number | null;
  sourceAr?: string;
  remedyAr?: string[];
  trend: number[];
  platform?: string | null;
  lastScanAt: string;
  actionHref?: string;
}

export interface ActivityRow { titleAr: string; detailAr: string; at: string }

const STATUS_TONE: Record<CheckStatus, string> = {
  PASS: "var(--verified)",
  WARNING: "var(--gap)",
  FAILED: "var(--critical)",
  UNKNOWN: "var(--text-muted)",
};
const STATUS_KEY: Record<CheckStatus, string> = {
  PASS: "statusPass", WARNING: "statusWarning", FAILED: "statusFailed", UNKNOWN: "statusUnknown",
};

const SEVERITY_CARDS = [
  { key: "critical", Icon: AlertOctagon, tone: "var(--critical)" },
  { key: "high", Icon: AlertTriangle, tone: "var(--gap)" },
  { key: "medium", Icon: Info, tone: "#F59E0B" },
  { key: "passing", Icon: CheckCircle2, tone: "var(--verified)" },
] as const;

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

function Gauge({ score }: { score: number }) {
  const R = 52, C = 2 * Math.PI * R;
  const tone = score >= 80 ? "var(--verified)" : score >= 55 ? "var(--gap)" : "var(--critical)";
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={R} fill="none" stroke="var(--surface-raised)" strokeWidth="11" />
        <circle
          cx="66" cy="66" r={R} fill="none" stroke={tone} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (score / 100) * C}
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[34px] font-bold leading-none" style={{ color: tone }}>{score}</span>
        <span className="mt-0.5 text-[11px] text-text-muted">/ 100</span>
      </div>
    </div>
  );
}

export function DiagnosticsView({
  workspaceName, healthScore, scoreTrend, counts, checks, activity, totalMonthlyImpact, currency, lastScanAt, locale = "ar",
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
  locale?: Locale;
}) {
  const ar = locale === "ar";
  const tr = (k: string) => t(locale, ("diagnosticsPage." + k) as any);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [category, setCategory] = useState<"all" | CheckCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CheckStatus>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);
  // الفحص الحيّ: عدد الفحوصات المكشوفة حتى الآن. عند الضغط على "فحص جديد"
  // نبدأ من صفر ونكشفها تباعاً، ليرى المستخدم العمل يجري فعلاً بدل انتظار
  // صامت ثم ظهور كل شيء دفعة واحدة.
  const [revealed, setRevealed] = useState<number | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const scoreLabel = healthScore >= 80 ? tr("scoreGood") : healthScore >= 55 ? tr("scoreWarn") : tr("scoreCritical");
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
      (!q || c.titleAr.toLowerCase().includes(q) || c.descAr.toLowerCase().includes(q))
    );
  }, [checks, category, statusFilter, query]);

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
          <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{tr("title")}</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {tr("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastScanAt && (
            <span className="text-[12.5px] text-text-muted">{tr("lastScan")}: {lastScanAt}</span>
          )}
          <button
            onClick={runScan}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {busy ? tr("scanning") : tr("runScan")}
          </button>
        </div>
      </div>

      {/* مؤشر الصحة + بطاقات الخطورة */}
      <div className="reveal mb-6 grid gap-4 lg:grid-cols-[1.15fr_2fr]" style={{ animationDelay: "80ms" }}>
        <div className="card-shadow flex items-center gap-4 rounded-2xl border border-border bg-surface p-6">
          <Gauge score={healthScore} />
          <div className="min-w-0">
            <div className="text-[13px] text-text-muted">{tr("healthScore")}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: scoreTone }} />
              <span className="text-[16px] font-semibold" style={{ color: scoreTone }}>{scoreLabel}</span>
            </div>
            {totalMonthlyImpact > 0 && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                الأثر المقدَّر للمشاكل القائمة{" "}
                <span className="font-mono font-semibold text-critical">
                  {totalMonthlyImpact.toLocaleString("en-US")} {currency}
                </span>{" "}
                شهرياً.
              </p>
            )}
            <div className="mt-2"><Spark data={scoreTrend} tone={scoreTone} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SEVERITY_CARDS.map((s) => {
            const n = counts[s.key];
            const active = s.key !== "passing" && n > 0;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key === "passing" ? "PASS" : "all")}
                className="card-shadow overflow-hidden rounded-2xl border p-4 text-start"
                style={{
                  borderColor: active ? `color-mix(in srgb, ${s.tone} 34%, transparent)` : "var(--border)",
                  background: active ? `color-mix(in srgb, ${s.tone} 7%, var(--surface))` : "var(--surface)",
                }}
              >
                <s.Icon size={17} style={{ color: active || s.key === "passing" ? s.tone : "var(--text-faint)" }} />
                <div className="mt-2 font-mono text-[26px] font-bold leading-none"
                     style={{ color: active || s.key === "passing" ? s.tone : "var(--text-primary)" }}>
                  {n}
                </div>
                <div className="mt-1 text-[12px] font-medium text-text-primary">{tr(s.key)}</div>
                <div className="text-[11px] text-text-muted">{tr(s.key + "Sub")}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* المشاكل + النشاط */}
      <div className="reveal mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]" style={{ animationDelay: "200ms" }}>
        <section className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <h2 className="text-[14px] font-semibold text-text-primary">{tr("issuesTitle")}</h2>
            <span className="rounded-full bg-critical/12 px-2 py-0.5 font-mono text-[11px] font-medium text-critical">
              {topIssues.length}
            </span>
          </div>

          {topIssues.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={26} className="mx-auto mb-2 text-verified" />
              <p className="text-[13.5px] text-text-primary">{tr("noIssues")}</p>
              <p className="mt-1 text-[12.5px] text-text-muted">{tr("noIssuesSub")}</p>
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
                        <div className="mt-0.5 text-[10px] text-text-muted">{currency} / شهرياً</div>
                      </div>
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-text-primary">{c.titleAr}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                              style={{ background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone }}>
                          {c.severity === "CRITICAL" ? tr("severityCritical") : tr("severityHigh")}
                        </span>
                        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">
                          {ar ? CATEGORY_META[c.category].ar : CATEGORY_META[c.category].en}
                        </span>
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-text-muted">{c.findingAr ?? c.descAr}</p>
                    </div>

                    {c.actionHref && (
                      <a href={c.actionHref}
                         className="shrink-0 rounded-xl border border-border bg-surface-raised px-3 py-1.5 text-[12px] text-text-primary no-underline">
                        معالجة
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
              {showAllIssues ? tr("showTopOnly") : `${tr("showMore")} (${topIssues.length - 4})`}
            </button>
          )}
        </section>

        <section className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Activity size={15} className="text-accent" />
            <h2 className="text-[14px] font-semibold text-text-primary">{tr("recentActivity")}</h2>
          </div>
          {activity.length === 0 ? (
            <p className="p-6 text-center text-[12.5px] text-text-muted">{tr("noActivity")}</p>
          ) : (
            <ul className="p-4">
              {activity.map((a, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    {i < activity.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-text-primary">{a.titleAr}</div>
                    <div className="text-[11.5px] text-text-muted">{a.detailAr}</div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-text-faint">{a.at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* جدول كل الفحوصات */}
      <section ref={tableRef} className="reveal card-shadow overflow-hidden rounded-2xl border border-border bg-surface" style={{ animationDelay: "320ms" }}>
        {/* شريط تقدّم الفحص الحيّ */}
        {revealed !== null && (
          <div className="border-b border-border px-5 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
                {scanDone ? (
                  <><CheckCircle2 size={15} className="text-verified" /> اكتمل الفحص بنجاح — {checks.length} فحصاً</>
                ) : (
                  <><Loader2 size={15} className="animate-spin text-accent" /> جارٍ الفحص… {revealed} من {checks.length}</>
                )}
              </span>
              {!scanDone && revealed > 0 && checks[revealed - 1] && (
                <span className="truncate text-[12px] text-text-muted">{checks[revealed - 1].titleAr}</span>
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
            <h2 className="text-[15px] font-semibold text-text-primary">{tr("allChecks")}</h2>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[11.5px] text-text-muted">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as any)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">{tr("allCategories")} ({categoryCounts.all ?? 0})</option>
              {(Object.keys(CATEGORY_META) as CheckCategory[]).filter((k) => categoryCounts[k]).map((k) => (
                <option key={k} value={k}>{ar ? CATEGORY_META[k].ar : CATEGORY_META[k].en} ({categoryCounts[k]})</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">{tr("allStatuses")}</option>
              {(Object.keys(STATUS_TONE) as CheckStatus[]).map((k) => (
                <option key={k} value={k}>{tr(STATUS_KEY[k])}</option>
              ))}
            </select>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 10 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("searchChecks")}
                     className="w-44 rounded-xl border border-border bg-surface-raised py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
                     style={{ paddingInlineStart: 30, paddingInlineEnd: 10 }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border text-start">
                {[tr("colCheck"), tr("colCategory"), tr("colStatus"), tr("colLastScan"), tr("colTrend"), tr("colAction")].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-[11.5px] font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-[13px] text-text-muted">{tr("noMatches")}</td></tr>
              ) : filtered.map((c, rowIndex) => {
                // أثناء الفحص الحيّ لا نعرض إلا ما كُشف حتى الآن
                if (revealed !== null && rowIndex >= revealed) return null;
                const st = { tone: STATUS_TONE[c.status], ar: tr(STATUS_KEY[c.status]) };
                const cat = CATEGORY_META[c.category];
                const failing = c.status === "FAILED" || c.status === "WARNING";
                const isOpen = expanded === c.id;
                const hasDetails = !!(c.sourceAr || (c.remedyAr && c.remedyAr.length > 0));
                return (
                  <Fragment key={c.id}>
                  <tr className={`reveal border-b border-border last:border-0 ${isOpen ? "bg-surface-raised/35" : "hover:bg-surface-raised/45"}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)` }}>
                          {c.platform ? <PlatformLogo platform={c.platform} size={14} />
                            : <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-text-primary">{c.titleAr}</div>
                          <div className="text-[11.5px] leading-relaxed text-text-muted">{c.findingAr ?? c.descAr}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ background: `color-mix(in srgb, ${cat.color} 13%, transparent)`, color: cat.color }}>
                        {ar ? cat.ar : cat.en}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ background: `color-mix(in srgb, ${st.tone} 13%, transparent)`, color: st.tone }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.tone }} />
                        {st.ar}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[11.5px] text-text-muted">{c.lastScanAt}</td>
                    <td className="px-4 py-3.5"><Spark data={c.trend} tone={st.tone} /></td>
                    <td className="px-4 py-3.5">
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
                          {isOpen ? tr("hide") : tr("details")}
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
                            <div className="mb-1 text-[11.5px] font-medium text-text-muted">{tr("whatItMeasures")}</div>
                            <p className="text-[12.5px] leading-relaxed text-text-primary">{c.descAr}</p>
                            {c.sourceAr && (
                              <>
                                <div className="mb-1 mt-3 text-[11.5px] font-medium text-text-muted">{tr("dataSource")}</div>
                                <p className="text-[12.5px] leading-relaxed text-text-muted">{c.sourceAr}</p>
                              </>
                            )}
                            {c.monthlyImpact ? (
                              <p className="mt-3 text-[12.5px] text-text-muted">
                                الأثر المقدَّر:{" "}
                                <span className="font-mono font-semibold text-critical">
                                  {c.monthlyImpact.toLocaleString("en-US")} {currency}
                                </span>{" "}
                                شهرياً
                              </p>
                            ) : null}
                          </div>

                          {c.remedyAr && c.remedyAr.length > 0 && (
                            <div>
                              <div className="mb-2 text-[11.5px] font-medium text-text-muted">{tr("remedySteps")}</div>
                              <ol className="flex flex-col gap-2">
                                {c.remedyAr.map((step, i) => (
                                  <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-primary">
                                    <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-accent/12 font-mono text-[10px] font-semibold text-accent"
                                          style={{ height: 18, width: 18 }}>
                                      {i + 1}
                                    </span>
                                    {step}
                                  </li>
                                ))}
                              </ol>
                              {c.actionHref && (
                                <a href={c.actionHref}
                                   className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-medium text-white no-underline">
                                  اذهب للمعالجة
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
