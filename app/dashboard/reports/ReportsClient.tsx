"use client";

// app/dashboard/reports/ReportsClient.tsx
//
// التقارير الديناميكية. كل ما هنا يُحسب عند العرض من بيانات اليوم - لا
// تقرير مخزَّن كصورة، لأن قراراً جديداً على رقم قديم أسوأ من لا تقرير.
//
// البناء من أربع خطوات صريحة (المصدر ← المؤشّرات ← التفصيل ← التصفية)
// لا لأن الترتيب جميل، بل لأن كل خطوة تُضيّق ما بعدها فعلاً.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Target, ShieldCheck, Image as ImageIcon, ShoppingCart, CalendarRange,
  ArrowLeftRight, Layers, Users, Sparkles, Save, Mail, Download, Play,
  TrendingUp, TrendingDown, Minus, Trash2, Star,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { DateRangePicker } from "@/app/components/ui/DateRangePicker";
import { METRICS, type DataSource, type Dimension, type MetricKey, type ReportResult } from "@/lib/reports/reportEngine";
import type { DateRange, PresetKey, CompareMode } from "@/lib/dateRange";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { TH } from "@/app/components/ui/tableStyles";
import { renderReportDocument } from "@/lib/reports/reportDocument";

export interface SavedView {
  id: string;
  name: string;
  isFavorite: boolean;
  config: {
    source: DataSource;
    dimension: Dimension;
    metrics: MetricKey[];
    preset: PresetKey;
    range: DateRange;
    compareMode: CompareMode;
    platforms: string[];
    campaigns?: string[];
  };
}

interface Preset {
  id: string;
  icon: typeof BarChart3;
  titleKey: string;
  descKey: string;
  dimension: Dimension;
  metrics: MetricKey[];
  source: DataSource;
}

const QUICK: Preset[] = [
  { id: "performance", icon: BarChart3, titleKey: "qPerformance", descKey: "qPerformanceDesc", dimension: "platform", metrics: ["cost", "clicks", "conversions", "cpa", "ctr"], source: "VERIFIED" },
  { id: "campaign", icon: Target, titleKey: "qCampaign", descKey: "qCampaignDesc", dimension: "campaign", metrics: ["cost", "conversions", "cpa", "conversionRate"], source: "VERIFIED" },
  { id: "truth", icon: ShieldCheck, titleKey: "qTruth", descKey: "qTruthDesc", dimension: "platform", metrics: ["cost", "conversions", "verificationRate", "inflationRate", "wastedSpend"], source: "BOTH" },
  { id: "creative", icon: ImageIcon, titleKey: "qCreative", descKey: "qCreativeDesc", dimension: "campaign", metrics: ["cost", "impressions", "ctr", "cpa"], source: "VERIFIED" },
  { id: "ecommerce", icon: ShoppingCart, titleKey: "qEcommerce", descKey: "qEcommerceDesc", dimension: "platform", metrics: ["cost", "revenue", "roas", "orders", "rtoRate"], source: "REPORTED" },
  { id: "daily", icon: CalendarRange, titleKey: "qDaily", descKey: "qDailyDesc", dimension: "day", metrics: ["cost", "conversions", "cpa"], source: "VERIFIED" },
];

const COMPARE_PRESETS: Preset[] = [
  { id: "period", icon: ArrowLeftRight, titleKey: "cPeriod", descKey: "cPeriodDesc", dimension: "none", metrics: ["cost", "conversions", "cpa", "conversionRate"], source: "VERIFIED" },
  { id: "campaigns", icon: Target, titleKey: "cCampaign", descKey: "cCampaignDesc", dimension: "campaign", metrics: ["cost", "conversions", "cpa", "roas"], source: "VERIFIED" },
  { id: "platforms", icon: Layers, titleKey: "cPlatform", descKey: "cPlatformDesc", dimension: "platform", metrics: ["cost", "conversions", "cpa", "conversionRate"], source: "VERIFIED" },
  { id: "creatives", icon: Users, titleKey: "cCreative", descKey: "cCreativeDesc", dimension: "placement", metrics: ["cost", "impressions", "ctr", "cpa"], source: "VERIFIED" },
];

const DIMENSIONS: Dimension[] = ["none", "platform", "campaign", "day", "week", "month", "placement"];
const SOURCES: DataSource[] = ["REPORTED", "VERIFIED", "BOTH"];
const GROUPS = ["core", "efficiency", "truth", "ecommerce"] as const;

export interface CampaignOption {
  id: string;
  name: string;
  platform: string;
}

export function ReportsClient({
  locale,
  workspaceId,
  currency,
  platforms,
  campaigns,
  savedViews,
  initial,
  result,
}: {
  locale: Locale;
  workspaceId: string;
  currency: string;
  platforms: string[];
  campaigns: CampaignOption[];
  savedViews: SavedView[];
  initial: {
    source: DataSource;
    dimension: Dimension;
    metrics: MetricKey[];
    preset: PresetKey;
    range: DateRange;
    compare: DateRange | null;
    compareMode: CompareMode;
    selectedPlatforms: string[];
    selectedCampaigns: string[];
  };
  result: ReportResult | null;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `reports.${k}`, v);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState<DataSource>(initial.source);
  const [dimension, setDimension] = useState<Dimension>(initial.dimension);
  const [metrics, setMetrics] = useState<MetricKey[]>(initial.metrics);
  const [selPlatforms, setSelPlatforms] = useState<string[]>(initial.selectedPlatforms);
  const [selCampaigns, setSelCampaigns] = useState<string[]>(initial.selectedCampaigns);
  const [campaignQuery, setCampaignQuery] = useState("");
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  function run(next?: Partial<{ source: DataSource; dimension: Dimension; metrics: MetricKey[]; platforms: string[]; campaigns: string[] }>) {
    const q = new URLSearchParams(window.location.search);
    q.set("src", next?.source ?? source);
    q.set("dim", next?.dimension ?? dimension);
    q.set("m", (next?.metrics ?? metrics).join(","));
    const pf = next?.platforms ?? selPlatforms;
    if (pf.length) q.set("pf", pf.join(",")); else q.delete("pf");
    const cg = next?.campaigns ?? selCampaigns;
    if (cg.length) q.set("cg", cg.join(",")); else q.delete("cg");
    q.set("run", "1");
    startTransition(() => {
      router.push(`/dashboard/reports?${q.toString()}`);
      // النتيجة تحت البنّاء بكثير: بلا تمرير إليها يبدو الزرّ كأنه لم يفعل شيئاً
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }

  function applyPreset(p: Preset) {
    setSource(p.source);
    setDimension(p.dimension);
    setMetrics(p.metrics);
    run({ source: p.source, dimension: p.dimension, metrics: p.metrics });
  }

  const visibleMetrics = useMemo(
    () => (showAllMetrics ? METRICS : METRICS.filter((m) => m.common)),
    [showAllMetrics]
  );

  const visibleCampaigns = useMemo(() => {
    const q = campaignQuery.trim().toLowerCase();
    const list = selPlatforms.length ? campaigns.filter((c) => selPlatforms.includes(c.platform)) : campaigns;
    return (q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list).slice(0, 60);
  }, [campaigns, campaignQuery, selPlatforms]);

  // نتيجة فارغة بعد طلب صريح: يجب أن تُقال بوضوح لا أن تُترك للمستخدم
  // يستنتج أن الزرّ لم يعمل.
  const [emptyNotice, setEmptyNotice] = useState(false);
  useEffect(() => {
    if (result && result.rows.length === 0) setEmptyNotice(true);
  }, [result]);

  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      {/* ==================== الرأس ==================== */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{tr("title")}</h1>
          <p className="mt-1 text-[13px] text-text-muted">{tr("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            locale={locale}
            preset={initial.preset}
            range={initial.range}
            compare={initial.compare}
            compareMode={initial.compareMode}
          />
          {result && (
            <>
              <button onClick={() => setEmailOpen(true)} className="flex items-center gap-1.5 card px-3.5 py-2.5 text-[13px] text-text-primary">
                <Mail size={15} /> {tr("emailIt")}
              </button>
              {/* المستند المصمَّم أولاً - هو ما يخرج من المنتج إلى خارجه */}
              <button
                onClick={() =>
                  exportDocument(
                    result,
                    locale,
                    currency,
                    tr("docTitle"),
                    tr("docTitle"),
                    // الفترة من المدى المختار نفسه لا من حالة منفصلة قد تنحرف عنه
                    `${initial.range.from} — ${initial.range.to}`
                  )
                }
                className="btn btn-primary"
              >
                <Download size={15} /> {t(locale, "reportDoc.downloadHtml")}
              </button>
              <button
                onClick={() => exportCsv(result, locale, currency)}
                className="flex items-center gap-1.5 card px-3.5 py-2.5 text-[13px] text-text-primary"
              >
                <Download size={15} /> {t(locale, "reportDoc.downloadCsv")}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ==================== الجاهزة ==================== */}
      <Section title={tr("quickTitle")} subtitle={tr("quickSubtitle")}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {QUICK.map((p) => (
            <PresetCard key={p.id} preset={p} tr={tr} onClick={() => applyPreset(p)} />
          ))}
        </div>
      </Section>

      {/* ==================== المقارنة ==================== */}
      <Section title={tr("compareTitle")} subtitle={tr("compareSubtitle")}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {COMPARE_PRESETS.map((p) => (
            <PresetCard key={p.id} preset={p} tr={tr} onClick={() => applyPreset(p)} />
          ))}
        </div>
      </Section>

      {/* ==================== البنّاء + المحفوظة ==================== */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_300px]">
        <section className="card pad-md">
          <h2 className="section-title">{tr("builderTitle")}</h2>
          <p className="mb-4 mt-0.5 text-[12.5px] text-text-muted">{tr("builderSubtitle")}</p>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* ١ المصدر */}
            <Step n={1} label={tr("stepSource")}>
              <div className="flex flex-col gap-1.5">
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`rounded-xl border p-2.5 text-start ${
                      source === s ? "border-accent bg-accent/[0.07]" : "border-border bg-surface-raised"
                    }`}
                  >
                    <div className={`text-[12.5px] font-medium ${source === s ? "text-accent" : "text-text-primary"}`}>
                      {tr(s === "REPORTED" ? "srcReported" : s === "VERIFIED" ? "srcVerified" : "srcBoth")}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                      {tr(s === "REPORTED" ? "srcReportedHint" : s === "VERIFIED" ? "srcVerifiedHint" : "srcBothHint")}
                    </div>
                  </button>
                ))}
              </div>
            </Step>

            {/* ٢ المؤشّرات */}
            <Step n={2} label={tr("stepMetrics")}>
              <div className="mb-2 flex gap-1 rounded-lg bg-surface-raised p-0.5">
                <MiniTab active={!showAllMetrics} onClick={() => setShowAllMetrics(false)} label={tr("browseCommon")} />
                <MiniTab active={showAllMetrics} onClick={() => setShowAllMetrics(true)} label={tr("browseAll")} />
              </div>
              <div className="max-h-[210px] overflow-y-auto pe-1">
                {GROUPS.map((g) => {
                  const list = visibleMetrics.filter((m) => m.group === g);
                  if (list.length === 0) return null;
                  return (
                    <div key={g} className="mb-2">
                      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
                        {tr(`g${g[0].toUpperCase()}${g.slice(1)}`)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((m) => {
                          const on = metrics.includes(m.key);
                          return (
                            <button
                              key={m.key}
                              onClick={() => setMetrics((p) => (on ? p.filter((x) => x !== m.key) : [...p, m.key]))}
                              className={`rounded-full border px-2.5 py-1 text-[11.5px] ${
                                on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
                              }`}
                            >
                              {tr(metricLabelKey(m.key))}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 text-[11px] text-text-faint">
                {metrics.length > 0 ? tr("nSelected", { n: metrics.length }) : tr("noneSelected")}
              </div>
            </Step>

            {/* ٣ التفصيل + ٤ التصفية */}
            <div className="flex flex-col gap-4">
              <Step n={3} label={tr("stepBreakdown")}>
                <select
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value as Dimension)}
                  className="field w-full"
                >
                  {DIMENSIONS.map((d) => (
                    <option key={d} value={d}>{tr(`dim${d[0].toUpperCase()}${d.slice(1)}`)}</option>
                  ))}
                </select>
              </Step>

              <Step n={4} label={tr("stepFilters")}>
                <div className="mb-1 text-[11px] text-text-faint">{tr("pickPlatforms")}</div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {platforms.length === 0 && (
                    <span className="text-[11.5px] text-text-faint">{tr("noCampaignsYet")}</span>
                  )}
                  {platforms.map((p) => {
                    const on = selPlatforms.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => setSelPlatforms((s) => (on ? s.filter((x) => x !== p) : [...s, p]))}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${
                          on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
                        }`}
                      >
                        <PlatformLogo platform={p} size={13} />
                        {platformLabel(locale, p)}
                      </button>
                    );
                  })}
                </div>

                {/* اختيار الحملات صراحةً: بدونه لا توجد "حملة مقابل حملة"
                    أصلاً - فقط تفصيل يعرض الكلّ بلا حكم. */}
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-text-faint">{tr("pickCampaigns")}</span>
                  {selCampaigns.length > 0 && (
                    <button onClick={() => setSelCampaigns([])} className="text-[11px] text-accent">
                      {tr("clearSelection")}
                    </button>
                  )}
                </div>
                {campaigns.length === 0 ? (
                  <p className="text-[11.5px] text-text-faint">{tr("noCampaignsYet")}</p>
                ) : (
                  <>
                    <input
                      value={campaignQuery}
                      onChange={(e) => setCampaignQuery(e.target.value)}
                      placeholder={tr("searchCampaigns")}
                      className="field mb-1.5 w-full px-2.5 py-1.5 text-[12px]"
                    />
                    <div className="max-h-[132px] overflow-y-auto pe-1">
                      {visibleCampaigns.map((c) => {
                        const on = selCampaigns.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelCampaigns((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                            className={`mb-1 flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-start text-[11.5px] ${
                              on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
                            }`}
                          >
                            <PlatformLogo platform={c.platform} size={12} />
                            <span className="min-w-0 flex-1 truncate" title={c.name}>{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-text-faint">
                      {selCampaigns.length === 2 ? tr("compareReady") : tr("compareNeedTwo")}
                    </p>
                  </>
                )}
              </Step>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => run()}
              disabled={metrics.length === 0 || pending}
              className="btn btn-primary"
            >
              <Play size={14} /> {tr("generate")}
            </button>
            <button
              onClick={() => setSaveOpen(true)}
              className="flex items-center gap-1.5 card-inset px-4 py-2.5 text-[13px] text-text-primary"
            >
              <Save size={14} /> {tr("saveView")}
            </button>
          </div>
        </section>

        <SavedViews
          views={savedViews}
          tr={tr}
          workspaceId={workspaceId}
          onOpen={(v) => {
            setSource(v.config.source);
            setDimension(v.config.dimension);
            setMetrics(v.config.metrics);
            setSelPlatforms(v.config.platforms);
            setSelCampaigns(v.config.campaigns ?? []);
            run({
              source: v.config.source,
              dimension: v.config.dimension,
              metrics: v.config.metrics,
              platforms: v.config.platforms,
              campaigns: v.config.campaigns ?? [],
            });
          }}
        />
      </div>

      {/* ==================== النتيجة ==================== */}
      <div ref={resultRef} />
      {result && (
        <ResultBlock
          result={result}
          locale={locale}
          tr={tr}
          currency={currency}
          metrics={metrics}
          hasCompare={initial.compare !== null}
          source={source}
        />
      )}

      {emptyNotice && <EmptyDataModal tr={tr} onClose={() => setEmptyNotice(false)} />}
      {emailOpen && <EmailModal tr={tr} workspaceId={workspaceId} onClose={() => setEmailOpen(false)} />}
      {saveOpen && (
        <SaveViewModal
          tr={tr}
          workspaceId={workspaceId}
          config={{ source, dimension, metrics, preset: initial.preset, range: initial.range, compareMode: initial.compareMode, platforms: selPlatforms, campaigns: selCampaigns }}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </div>
  );
}

// ==================== النتيجة ====================

function ResultBlock({
  result, locale, tr, currency, metrics, hasCompare, source,
}: {
  result: ReportResult;
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  currency: string;
  metrics: MetricKey[];
  hasCompare: boolean;
  source: DataSource;
}) {
  if (result.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-[13.5px] text-text-primary">{tr("noRows")}</p>
        <p className="mt-1 text-[12.5px] text-text-muted">{tr("noRowsHint")}</p>
      </div>
    );
  }

  const cols = metrics.length > 0 ? metrics : (["cost", "conversions", "cpa"] as MetricKey[]);

  /**
   * اسم الطرف كما يُقرأ.
   *
   * 🔴 حين يكون البُعد منصّةً، كان المحرّك يُرجع الرمز الخام - فتظهر
   * `META_ADS` بشرطتها السفلية وحروفها الكبيرة في بطاقة نتيجة يقرؤها
   * عميل. الرمز يبقى في البيانات، والاسم يُترجَم هنا بلغة القارئ.
   */
  const nameOf = (label: string | null, platform: string | null) =>
    platform ? platformLabel(locale, platform) : label ?? "—";

  // الحكم الرئيسيّ: صاحب أكبر أثرٍ ماليّ لا أوّل ما في المصفوفة. المستخدم
  // ينظر إلى أكبر رقم أوّلاً، فالترتيب البصريّ يتبع الأهمّية لا الترتيب
  // الذي صدف أن يخرج به المحرّك.
  const ranked = [...result.verdicts].sort(
    (a, b) => (b.financialImpact ?? 0) - (a.financialImpact ?? 0)
  );
  const headline = ranked[0] ?? null;
  const rest = ranked.slice(1);

  /** تنزيل الجدول كما هو معروض - نفس الأعمدة والصفوف والترتيب */
  function downloadCsv() {
    const head = ["", ...cols.map((m) => tr(metricLabelKey(m)))];
    const lines = [head, ...result.rows.map((r) => [
      nameOf(r.label, r.platform),
      ...cols.map((m) => {
        const v = r.values[m];
        return v === null || v === undefined ? "" : String(v);
      }),
    ])];
    // BOM عمداً: بدونه يفتح Excel على ويندوز ملفّ UTF-8 بترميز خاطئ
    // فتظهر العربية رموزاً - وهو أوّل ما سيحدث لأغلب من يضغط هذا الزرّ.
    const csv = "﻿" + lines
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `adloop-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ══════════ الحكم ══════════
          🔴 كان صفّاً من مربّعات متطابقة، في كلّ واحد «الفائز» و«الفارق»
          بلا وزن يفرّق أهمّها عن أقلّها - ونتيجةٌ واحدةٌ فيها أثرٌ ماليّ
          بمئات الآلاف تُعرض بحجم نتيجةٍ فرقُها ثلاثة بالمئة.

          البنية الآن على درجتين: **حكمٌ رئيسيّ** لصاحب أكبر أثرٍ ماليّ
          يُقرأ من مسافة، ثمّ **لوحة نتائج** لبقيّة المؤشّرات. وهو ترتيبٌ
          يتبع ما يفعله المستخدم فعلاً: ينظر إلى أكبر رقم، ثمّ يتحقّق. */}
      {headline && (
        <section className="card-alert card-shadow overflow-hidden card">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-text-faint">
                <Sparkles size={13} className="text-accent" /> {tr("verdictTitle")}
              </div>
              <h2 className="text-[21px] font-semibold leading-snug text-text-primary">
                {tr("verdictLead", {
                  winner: nameOf(headline.winnerLabel, headline.winnerPlatform),
                  pct: Math.round(headline.differencePct ?? 0),
                  metric: tr(metricLabelKey(headline.metric)),
                })}
              </h2>
              <p className="mt-1 text-[13px] text-text-muted">
                {tr("verdictVs", { loser: nameOf(headline.loserLabel, headline.loserPlatform) })}
              </p>
            </div>

            {/* شعار الفائز بحجمٍ يُقرأ: هو الإجابة، فلا يُدفن في سطر نصّ */}
            {headline.winnerPlatform && (
              <span className="icon-badge h-14 w-14 shrink-0 bg-surface-raised">
                <PlatformLogo platform={headline.winnerPlatform} size={30} />
              </span>
            )}
          </div>

          {headline.financialImpact !== null && headline.financialImpact > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border bg-verified/[0.07] px-5 py-3.5">
              <span className="text-[12px] text-text-muted">
                {headline.impactKind === "saving" ? tr("impactSaving") : tr("impactGain")}
                {" · "}
                {tr("verdictImpactMonthly")}
              </span>
              <span className="num text-[24px] font-semibold leading-none text-verified">
                {fmtNumber(headline.financialImpact)}{" "}
                <span className="text-[14px] font-medium">{currency}</span>
              </span>
            </div>
          )}
        </section>
      )}

      {/* 🔴 الحكم يُبنى في المحرّك حين يكون في النتيجة **صفّان بالضبط** -
          وهو قرار سليم (إعلان «فائز» على عشرين صفّاً بلا سياق أسوأ من
          الصمت). لكنّ الصمت نفسه كان هو العطل: مَن يضغط «أنشئ التقرير»
          على ثلاث منصّات لا يرى الحكم ولا يعرف لماذا، فيظنّ الميزة معطّلة.
          القاعدة الحاكمة: نقطةٌ تمنع المستخدم تحمل معها الحلّ. */}
      {!headline && result.rows.length > 2 && (
        <div className="note border-border bg-surface-raised text-text-muted">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">{tr("verdictNeedsTwo", { n: result.rows.length })}</span>
        </div>
      )}

      {rest.length > 0 && (
        <section className="card pad-md">
          <h2 className="mb-3 section-title">{tr("scoreboard")}</h2>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            {rest.map((v) => (
              <div key={v.metric} className="card-inset flex flex-col gap-2 p-3.5">
                <div className="text-[11.5px] font-medium uppercase tracking-wide text-text-faint">
                  {tr(metricLabelKey(v.metric))}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  {v.winnerPlatform && <PlatformLogo platform={v.winnerPlatform} size={16} />}
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text-primary">
                    {nameOf(v.winnerLabel, v.winnerPlatform)}
                  </span>
                  {v.differencePct !== null && (
                    <span className="chip bg-verified/12 text-verified">
                      +{Math.round(v.differencePct)}%
                    </span>
                  )}
                </div>
                {v.financialImpact !== null && v.financialImpact > 0 && (
                  <div className="num text-[12.5px] text-text-muted">
                    {v.impactKind === "saving" ? tr("impactSaving") : tr("impactGain")}:{" "}
                    <span className="font-semibold text-verified">
                      {fmtNumber(v.financialImpact)} {currency}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* الجدول */}
      <section className="card-shadow overflow-hidden card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="section-title">{tr("resultTitle")}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11.5px] text-text-faint">
              {tr(source === "REPORTED" ? "srcReported" : source === "VERIFIED" ? "srcVerified" : "srcBoth")}
              {hasCompare && ` · ${tr("vsCompare")}`}
            </span>
            {/* التنزيل بجانب الجدول لا في شريط الصفحة: هو فعلٌ على **هذا**
                الجدول بأعمدته وصفوفه كما هي الآن، لا على «التقارير» عموماً. */}
            {result.rows.length > 0 && (
              <button onClick={downloadCsv} className="btn btn-secondary btn-sm">
                <Download size={13} /> {tr("downloadCsv")}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11.5px] text-text-muted">
                <th className={TH}>—</th>
                {cols.map((m) => (
                  <th key={m} className="px-4 py-3 text-start font-medium">{tr(metricLabelKey(m))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-text-primary">
                      {row.platform && <PlatformLogo platform={row.platform} size={14} />}
                      <span className="max-w-[220px] truncate" title={row.label}>
                        {row.platform && row.label === row.key ? platformLabel(locale, row.platform) : row.label}
                      </span>
                    </span>
                  </td>
                  {cols.map((m) => (
                    <td key={m} className="px-4 py-3">
                      <Cell value={row.values[m] ?? null} delta={row.deltaPct?.[m] ?? null} metric={m} currency={currency} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-raised/50">
                <td className="px-4 py-3 text-[12.5px] font-semibold text-text-primary">{tr("total")}</td>
                {cols.map((m) => (
                  <td key={m} className="px-4 py-3">
                    <Cell value={result.totals.values[m] ?? null} delta={result.totals.deltaPct?.[m] ?? null} metric={m} currency={currency} bold />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* الخلاصة */}
      <section className="card pad-md">
        <h2 className="section-title">{tr("summaryTitle")}</h2>
        <p className="mb-3 mt-0.5 text-[11.5px] text-text-faint">{tr("summaryNote")}</p>
        <ul className="flex flex-col gap-2">
          {result.summary.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    line.tone === "positive" ? "var(--verified)" : line.tone === "negative" ? "var(--critical)" : "var(--text-faint)",
                }}
              />
              <span className="text-text-primary">{t(locale, `reports.${line.key}`, line.vars)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Cell({
  value, delta, metric, currency, bold,
}: {
  value: number | null;
  delta: number | null;
  metric: MetricKey;
  currency: string;
  bold?: boolean;
}) {
  const def = METRICS.find((m) => m.key === metric);
  if (value === null) return <span className="text-text-faint">—</span>;

  const text =
    def?.format === "percent" ? `${fmtNumber(value)}%`
    : def?.format === "ratio" ? `${fmtNumber(value)}x`
    : def?.format === "currency" ? `${fmtNumber(value)} ${currency}`
    : fmtNumber(value);

  // الاتجاه ليس الإشارة: ارتفاع التكلفة سيّئ وارتفاع التحويلات جيّد.
  const good = delta === null ? null : def?.lowerIsBetter ? delta < 0 : delta > 0;
  const Icon = delta === null || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <span className="flex flex-col gap-0.5">
      <span className={`tabular-nums ${bold ? "font-semibold" : ""} text-text-primary`}>{text}</span>
      {delta !== null && (
        <span
          className="flex items-center gap-0.5 text-[11px] tabular-nums"
          style={{ color: good === null ? "var(--text-faint)" : good ? "var(--verified)" : "var(--critical)" }}
        >
          <Icon size={10} />
          {Math.abs(Math.round(delta))}%
        </span>
      )}
    </span>
  );
}

// ==================== العروض المحفوظة ====================

function SavedViews({
  views, tr, workspaceId, onOpen,
}: {
  views: SavedView[];
  tr: (k: string, v?: Record<string, string | number>) => string;
  workspaceId: string;
  onOpen: (v: SavedView) => void;
}) {
  const router = useRouter();
  async function remove(id: string) {
    await fetch(`/api/workspaces/${workspaceId}/report-views/${id}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  }
  return (
    <section className="card-shadow h-fit card pad-md">
      <h2 className="section-title">{tr("savedTitle")}</h2>
      <p className="mb-3 mt-0.5 text-[12px] text-text-muted">{tr("savedSubtitle")}</p>

      {views.length === 0 ? (
        <p className="card-ghost pad-md text-center text-[12.5px] text-text-muted">
          {tr("savedEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {views.map((v) => (
            <li key={v.id} className="card flex items-center gap-2 bg-surface-raised/60 px-3 py-2">
              {v.isFavorite && <Star size={12} className="shrink-0 text-gap" />}
              <button onClick={() => onOpen(v)} className="min-w-0 flex-1 truncate text-start text-[12.5px] text-text-primary">
                {v.name}
              </button>
              <button onClick={() => remove(v.id)} aria-label={tr("deleteView")} className="shrink-0 text-text-faint hover:text-critical">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-text-faint">{tr("savedNote")}</p>
    </section>
  );
}

// ==================== نوافذ ====================

function SaveViewModal({
  tr, workspaceId, config, onClose,
}: {
  tr: (k: string, v?: Record<string, string | number>) => string;
  workspaceId: string;
  config: SavedView["config"];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch(`/api/workspaces/${workspaceId}/report-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), config }),
    }).catch(() => {});
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 section-title">{tr("saveView")}</h2>
      <p className="mb-3 text-[12px] text-text-muted">{tr("savedNote")}</p>
      <label className="mb-1.5 block text-[12.5px] text-text-muted">{tr("saveViewName")}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={tr("saveViewPlaceholder")}
        className="field mb-4 w-full text-[13px]"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-secondary btn-sm">{tr("cancel")}</button>
        <button onClick={save} disabled={busy || !name.trim()} className="btn btn-primary">
          {busy ? tr("saving") : tr("save")}
        </button>
      </div>
    </Modal>
  );
}

function EmailModal({
  tr, workspaceId, onClose,
}: {
  tr: (k: string, v?: Record<string, string | number>) => string;
  workspaceId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "invalid">("idle");

  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setState("invalid"); return; }
    setState("sending");
    const res = await fetch(`/api/workspaces/${workspaceId}/report-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, query: window.location.search }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 section-title">{tr("emailTitle")}</h2>
      <p className="mb-3 text-[12px] leading-relaxed text-text-muted">{tr("emailHint")}</p>
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
        placeholder={tr("emailPlaceholder")}
        className="field mb-2 w-full text-[13px]"
      />
      {state === "invalid" && <p className="mb-2 text-[12px] text-critical">{tr("emailInvalid")}</p>}
      {state === "error" && <p className="mb-2 text-[12px] text-critical">{tr("emailFailed")}</p>}
      {state === "sent" && <p className="mb-2 text-[12px] text-verified">{tr("emailSent")}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-secondary btn-sm">{tr("cancel")}</button>
        <button onClick={send} disabled={state === "sending"} className="btn btn-primary">
          {state === "sending" ? tr("emailSending") : tr("emailSend")}
        </button>
      </div>
    </Modal>
  );
}

/**
 * تُعرض حين يطلب المستخدم تقريراً فيعود بصفر صفوف. بدونها يبدو زرّ الإنشاء
 * معطّلاً - وهو أسوأ من رسالة تقول "لا بيانات" وتشرح السبب المحتمل.
 */
function EmptyDataModal({
  tr, onClose,
}: {
  tr: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 section-title">{tr("emptyTitle")}</h2>
      <p className="mb-3 text-[12.5px] leading-relaxed text-text-muted">{tr("emptyBody")}</p>
      <div className="card mb-4 bg-surface-raised/70 p-3">
        <div className="mb-1.5 text-[11.5px] font-medium text-text-primary">{tr("emptyWhy")}</div>
        <ul className="flex flex-col gap-1">
          {["emptyR1", "emptyR2", "emptyR3"].map((k) => (
            <li key={k} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-text-muted">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-faint" />
              {tr(k)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end gap-2">
        <a
          href="/dashboard/integrations"
          className="btn btn-secondary btn-sm"
        >
          {tr("goConnect")}
        </a>
        <button onClick={onClose} className="btn btn-primary">
          {tr("ok")}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow w-full max-w-sm card pad-md">
        {children}
      </div>
    </div>
  );
}

// ==================== أجزاء صغيرة ====================

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card-shadow mb-4 card pad-md">
      <h2 className="section-title">{title}</h2>
      <p className="mb-3 mt-0.5 text-[12.5px] text-text-muted">{subtitle}</p>
      {children}
    </section>
  );
}

function PresetCard({
  preset, tr, onClick,
}: {
  preset: Preset;
  tr: (k: string, v?: Record<string, string | number>) => string;
  onClick: () => void;
}) {
  const Icon = preset.icon;
  return (
    <button
      onClick={onClick}
      className="bg-surface-raised p-3 text-start transition-colors hover:border-accent"
    >
      <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon size={16} />
      </span>
      <div className="text-[12.5px] font-medium text-text-primary">{tr(preset.titleKey)}</div>
      <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{tr(preset.descKey)}</div>
    </button>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/12 text-[11px] font-semibold text-accent">{n}</span>
        <span className="text-[12.5px] font-medium text-text-primary">{label}</span>
      </div>
      {children}
    </div>
  );
}

function MiniTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1 text-[11.5px] font-medium ${active ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"}`}
    >
      {label}
    </button>
  );
}

// ==================== أدوات ====================

function metricLabelKey(k: MetricKey): string {
  return `m${k[0].toUpperCase()}${k.slice(1)}`;
}

function fmtNumber(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}


/**
 * تنزيل التقرير كمستند مصمَّم بهوية المنتج.
 *
 * الـCSV يبقى متاحاً بجانبه لا بدلاً منه: من يريد فتح الأرقام في جدول
 * ويعيد ترتيبها يحتاج CSV، ومن يريد إرساله لمدير أو عميل يحتاج مستنداً
 * يُقرأ كما هو. المسار الواحد لا يخدم الحاجتين.
 */
function exportDocument(
  result: ReportResult,
  locale: Locale,
  currency: string,
  workspaceName: string,
  title: string,
  periodLabel: string
) {
  const cols = Object.keys(result.totals.values) as MetricKey[];
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `reports.${k}`, vars);

  // العملة تُلحق بالمؤشّرات المالية وحدها - «نسبة التحقّق ٣٩ ريال» بلا معنى
  const isMoney = (k: MetricKey) => /cost|spend|revenue|cpa|cpc|cpm|profit/i.test(k);

  const doc = renderReportDocument({
    locale,
    workspaceName,
    title,
    periodLabel,
    generatedAt: new Date(),
    kpis: cols.slice(0, 5).map((c) => ({
      label: tr(metricLabelKey(c)),
      value: fmtNumber(result.totals.values[c] ?? 0),
      unit: isMoney(c) ? currency : undefined,
    })),
    // الخلاصة مفاتيح ترجمة لا نصوص جاهزة - تُترجم هنا بلغة المستند
    summary: result.summary.map((s) => tr(s.key, s.vars)),
    sections: [
      {
        title,
        columns: [tr("colLabel"), ...cols.map((c) => tr(metricLabelKey(c)))],
        numericColumns: cols.map((_, i) => i + 1),
        rows: result.rows.map((r) => [
          r.label,
          ...cols.map((c) => fmtNumber(r.values[c] ?? 0)),
        ]),
      },
    ],
  });

  const blob = new Blob([doc], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adloop-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/** تصدير من البيانات المعروضة نفسها - لا نداء ثانٍ قد يُرجع أرقاماً مختلفة */
function exportCsv(result: ReportResult, locale: Locale, currency: string) {
  const cols = Object.keys(result.totals.values) as MetricKey[];
  const head = ["label", ...cols].join(",");
  const lines = result.rows.map((r) =>
    [`"${r.label.replace(/"/g, '""')}"`, ...cols.map((c) => r.values[c] ?? "")].join(",")
  );
  const csv = [head, ...lines].join("\n");
  // BOM ضروري ليقرأ Excel العربية بشكل صحيح بدل رموز مشوّهة
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adloop-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  void locale;
  void currency;
}
