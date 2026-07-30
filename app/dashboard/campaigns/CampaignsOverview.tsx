"use client";

// نظرة الحملات بلغة تصميم صفحة التشخيص نفسها: حصيلة أعلى الصفحة، تقسيم
// بالحالة، ظهور تدريجي، وجدول بمقارنة مباشرة بين الرقم المُعلن والمتحقق
// منه لكل حملة - بدل جدول مسطّح لا يميّز الجيد من السيئ.

import { useState, useMemo } from "react";
import { Search, TrendingDown, AlertOctagon, CheckCircle2, Wallet, ChevronLeft } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

export interface CampaignRow {
  campaignId: string;
  campaignName: string;
  platform: string;
  clicks: number;
  cost: number;
  rawConversions: number;
  verifiedConversions: number;
  cplRaw: number;
  cplVerified: number;
  inflationRatePct: number;
}

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE_ADS: "Google Ads", META_ADS: "Meta Ads",
  TIKTOK_ADS: "TikTok Ads", SNAPCHAT_ADS: "Snapchat Ads",
};

const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** تصنيف الحملة بنفس منطق الخطورة المستخدم في الفحوصات - مفتاح لا نصّ */
function classify(r: CampaignRow): { key: "critical" | "watch" | "healthy"; tone: string; labelKey: string } {
  if (r.cost > 0 && r.verifiedConversions === 0) {
    return { key: "critical", tone: "var(--critical)", labelKey: "ovStCritical" };
  }
  if (r.inflationRatePct >= 50) {
    return { key: "watch", tone: "var(--gap)", labelKey: "ovStWatch" };
  }
  return { key: "healthy", tone: "var(--verified)", labelKey: "ovStHealthy" };
}

export function CampaignsOverview({
  rows, currency, locale = "ar",
}: {
  rows: CampaignRow[];
  currency: string;
  locale?: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `campPages.${k}`, vars);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<"all" | string>("all");
  const [state, setState] = useState<"all" | "critical" | "watch" | "healthy">("all");

  const enriched = useMemo(() => rows.map((r) => ({ ...r, cls: classify(r) })), [rows]);

  const totals = useMemo(
    () => enriched.reduce(
      (a, r) => ({
        cost: a.cost + r.cost,
        reported: a.reported + r.rawConversions,
        verified: a.verified + r.verifiedConversions,
        wasted: a.wasted + (r.rawConversions > 0
          ? r.cost * (1 - r.verifiedConversions / r.rawConversions)
          : r.cost),
      }),
      { cost: 0, reported: 0, verified: 0, wasted: 0 }
    ),
    [enriched]
  );

  const counts = useMemo(() => ({
    critical: enriched.filter((r) => r.cls.key === "critical").length,
    watch: enriched.filter((r) => r.cls.key === "watch").length,
    healthy: enriched.filter((r) => r.cls.key === "healthy").length,
  }), [enriched]);

  const platforms = useMemo(() => [...new Set(rows.map((r) => r.platform))], [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((r) =>
      (platform === "all" || r.platform === platform) &&
      (state === "all" || r.cls.key === state) &&
      (!q || r.campaignName.toLowerCase().includes(q))
    );
  }, [enriched, query, platform, state]);

  // بطاقات المؤشّر الموحّدة - نفس نظام البطاقة في كل أقسام المنتج
  const verificationPct = totals.reported > 0 ? Math.round((totals.verified / totals.reported) * 100) : 0;
  const wastedPct = totals.cost > 0 ? Math.round((totals.wasted / totals.cost) * 100) : 0;

  return (
    <div>
      {/* الحصيلة */}
      <div className="reveal mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <MetricCard
          label={tr("ovTotalSpend")}
          value={num(totals.cost)}
          unit={currency}
          icon={Wallet}
          tone="accent"
        />
        <MetricCard
          label={tr("ovVerifiedConv")}
          value={num(totals.verified)}
          icon={CheckCircle2}
          tone="verified"
          verified
          caption={{ text: tr("ovOfReported", { n: num(totals.reported), pct: verificationPct }), tone: "muted" }}
          bar={{ pct: verificationPct }}
        />
        <MetricCard
          label={tr("ovWasted")}
          value={num(totals.wasted)}
          unit={currency}
          icon={TrendingDown}
          tone="critical"
          caption={{ text: tr("ovWastedPct", { pct: wastedPct }), tone: "negative" }}
        />
        <MetricCard
          label={tr("ovNeedAction")}
          value={counts.critical + counts.watch}
          icon={AlertOctagon}
          tone={counts.critical > 0 ? "critical" : counts.watch > 0 ? "gap" : "neutral"}
          caption={
            counts.critical > 0
              ? { text: tr("ovNeedActionCaption", { critical: counts.critical, watch: counts.watch }), tone: "negative" }
              : { text: tr("ovNoneCritical"), tone: "positive" }
          }
        />
      </div>

      {/* الجدول */}
      <section className="reveal card-shadow overflow-hidden rounded-2xl border border-border bg-surface"
               style={{ animationDelay: "180ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-text-primary">{t(locale, "campPages.title")}</h2>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[11.5px] text-text-muted">
              {filtered.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">{tr("ovAllPlatforms")}</option>
              {platforms.map((p) => <option key={p} value={p}>{platformLabel(locale, p)}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value as any)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">{tr("ovAllStates")}</option>
              <option value="critical">{tr("ovStCritical")} ({counts.critical})</option>
              <option value="watch">{tr("ovStWatch")} ({counts.watch})</option>
              <option value="healthy">{tr("ovStHealthy")} ({counts.healthy})</option>
            </select>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 10 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("ovSearch")}
                     className="w-44 rounded-xl border border-border bg-surface-raised py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
                     style={{ paddingInlineStart: 30, paddingInlineEnd: 10 }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["ovColCampaign", "ovColState", "ovColSpend", "ovColReportedVerified", "ovColCpa", "ovColInflation"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-[11.5px] font-medium text-text-muted">{tr(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-[13px] text-text-muted">{tr("ovNoMatch")}</td></tr>
              ) : filtered.map((r) => (
                <tr key={`${r.platform}-${r.campaignId}`} className="border-b border-border last:border-0 hover:bg-surface-raised/45">
                  <td className="px-4 py-3.5">
                    <div className="flex items-start gap-2.5">
                      <PlatformLogo platform={r.platform} size={16} />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-text-primary">{r.campaignName}</div>
                        <div className="text-[11px] text-text-muted">{PLATFORM_LABEL[r.platform] ?? r.platform}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: `color-mix(in srgb, ${r.cls.tone} 13%, transparent)`, color: r.cls.tone }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.cls.tone }} />
                      {tr(r.cls.labelKey)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[12.5px] text-text-primary">
                    {num(r.cost)} {currency}
                  </td>
                  {/* المقارنة المباشرة - جوهر المنتج في عمود واحد */}
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className="font-mono text-[12.5px] text-text-muted line-through decoration-text-faint/50">
                      {num(r.rawConversions)}
                    </span>
                    <ChevronLeft size={11} className="mx-1 inline text-text-faint rtl:rotate-0 ltr:rotate-180" />
                    <span className="font-mono text-[13px] font-semibold text-verified">{num(r.verifiedConversions)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className="font-mono text-[12px] text-text-muted line-through decoration-text-faint/50">
                      {r.cplRaw || "—"}
                    </span>
                    <span className="mx-1 text-text-faint">·</span>
                    <span className="font-mono text-[13px] font-semibold text-text-primary">
                      {r.cplVerified || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className="font-mono text-[12.5px] font-medium"
                          style={{ color: r.inflationRatePct >= 50 ? "var(--critical)" : r.inflationRatePct >= 25 ? "var(--gap)" : "var(--text-muted)" }}>
                      {r.inflationRatePct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
