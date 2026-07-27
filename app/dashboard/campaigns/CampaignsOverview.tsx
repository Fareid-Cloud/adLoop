"use client";

// نظرة الحملات بلغة تصميم صفحة التشخيص نفسها: حصيلة أعلى الصفحة، تقسيم
// بالحالة، ظهور تدريجي، وجدول بمقارنة مباشرة بين الرقم المُعلن والمتحقق
// منه لكل حملة - بدل جدول مسطّح لا يميّز الجيد من السيئ.

import { useState, useMemo } from "react";
import { Search, TrendingDown, AlertOctagon, CheckCircle2, Wallet, ChevronLeft } from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";

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

/** تصنيف الحملة بنفس منطق الخطورة المستخدم في التشخيص */
function classify(r: CampaignRow): { key: "critical" | "watch" | "healthy"; tone: string; labelAr: string } {
  if (r.cost > 0 && r.verifiedConversions === 0) {
    return { key: "critical", tone: "var(--critical)", labelAr: "بلا نتيجة مؤكدة" };
  }
  if (r.inflationRatePct >= 50) {
    return { key: "watch", tone: "var(--gap)", labelAr: "تضخيم مرتفع" };
  }
  return { key: "healthy", tone: "var(--verified)", labelAr: "سليمة" };
}

export function CampaignsOverview({
  rows, currency,
}: {
  rows: CampaignRow[];
  currency: string;
}) {
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

  const summaryCards = [
    { key: "spend", labelAr: "إجمالي الإنفاق", value: `${num(totals.cost)} ${currency}`, Icon: Wallet, tone: "var(--accent)" },
    { key: "verified", labelAr: "تحويلات محقّقة", value: `${num(totals.verified)} / ${num(totals.reported)}`, Icon: CheckCircle2, tone: "var(--verified)" },
    { key: "wasted", labelAr: "إنفاق بلا نتيجة مؤكدة", value: `${num(totals.wasted)} ${currency}`, Icon: TrendingDown, tone: "var(--critical)" },
    { key: "critical", labelAr: "حملات تحتاج تدخّلاً", value: String(counts.critical + counts.watch), Icon: AlertOctagon, tone: "var(--gap)" },
  ];

  return (
    <div>
      {/* الحصيلة */}
      <div className="reveal mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        {summaryCards.map((c) => (
          <div key={c.key} className="card-shadow overflow-hidden rounded-2xl border p-4"
               style={{
                 borderColor: `color-mix(in srgb, ${c.tone} 26%, transparent)`,
                 background: `linear-gradient(160deg, color-mix(in srgb, ${c.tone} 7%, var(--surface)) 0%, var(--surface) 62%)`,
               }}>
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c.tone }} />
            <c.Icon size={16} style={{ color: c.tone }} />
            <div className="mt-2 font-mono text-[20px] font-bold leading-none text-text-primary">{c.value}</div>
            <div className="mt-1 text-[11.5px] text-text-muted">{c.labelAr}</div>
          </div>
        ))}
      </div>

      {/* الجدول */}
      <section className="reveal card-shadow overflow-hidden rounded-2xl border border-border bg-surface"
               style={{ animationDelay: "180ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-text-primary">الحملات</h2>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[11.5px] text-text-muted">
              {filtered.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">كل المنصات</option>
              {platforms.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p] ?? p}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value as any)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">كل الحالات</option>
              <option value="critical">بلا نتيجة مؤكدة ({counts.critical})</option>
              <option value="watch">تضخيم مرتفع ({counts.watch})</option>
              <option value="healthy">سليمة ({counts.healthy})</option>
            </select>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 10 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم الحملة"
                     className="w-44 rounded-xl border border-border bg-surface-raised py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
                     style={{ paddingInlineStart: 30, paddingInlineEnd: 10 }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["الحملة", "الحالة", "الإنفاق", "مُعلن ← محقّق", "تكلفة العميل", "التضخيم"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-[11.5px] font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-[13px] text-text-muted">لا توجد حملات مطابقة.</td></tr>
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
                      {r.cls.labelAr}
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
