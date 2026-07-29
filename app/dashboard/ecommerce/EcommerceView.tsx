"use client";

// قسم الإيكومرس: حصيلة الربح الفعلي، تتويج المنتج الرابح، وجدول أداء
// المنتجات — بنفس لغة تصميم صفحة التشخيص.
//
// المبدأ: الحكم على الربح المتحقق لا على الإيراد. المنتج الأكثر مبيعاً قد
// يكون الأكثر خسارة، ولا يظهر ذلك في أي تقرير مبيعات عادي.

import { useState, useMemo } from "react";
import {
  Trophy, TrendingDown, Package, Wallet, RotateCcw, Search,
  AlertOctagon, Store, Boxes, ChevronLeft,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { MetricCard, type MetricTone } from "@/app/components/ui/MetricCard";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  currentPrice: number;
  unitsSold: number;
  unitsReturned: number;
  revenue: number;
  returnRatePct: number;
  profitPerUnit: number;
  totalProfit: number;
  marginPct: number;
  velocity: number;
  stockDaysLeft: number | null;
  stockQuantity: number | null;
  confidence: "RELIABLE" | "PRELIMINARY" | "INSUFFICIENT";
  verdict: "WINNER" | "PROMISING" | "WATCH" | "LOSING" | "NO_DATA";
  verdictAr: string;
}

const VERDICT_META: Record<string, { key: string; tone: string }> = {
  WINNER: { key: "verdictWinner", tone: "var(--verified)" },
  PROMISING: { key: "verdictPromising", tone: "#22C55E" },
  WATCH: { key: "verdictWatch", tone: "var(--gap)" },
  LOSING: { key: "verdictLosing", tone: "var(--critical)" },
  NO_DATA: { key: "verdictNoData", tone: "var(--text-muted)" },
};

const CONFIDENCE_KEY: Record<string, string> = {
  RELIABLE: "confReliable",
  PRELIMINARY: "confPreliminary",
  INSUFFICIENT: "confInsufficient",
};

const STORE_LABEL: Record<string, string> = {
  SALLA: "سلة", SHOPIFY: "شوبيفاي", ZID: "زد",
  WOOCOMMERCE: "ووكومرس", EASY_ORDERS: "إيزي أوردرز",
};

const num = (n: number) => Math.round(n).toLocaleString("en-US");

export function EcommerceView({
  workspaceName, products, winner, runnerUp, losing, totals,
  windowDays, hasStoreConnection, storePlatform, currency, locale = "ar",
}: {
  workspaceName: string;
  products: ProductRow[];
  winner: ProductRow | null;
  runnerUp: ProductRow | null;
  losing: ProductRow[];
  totals: { revenue: number; profit: number; units: number; returnRatePct: number };
  windowDays: number;
  hasStoreConnection: boolean;
  storePlatform: string | null;
  currency: string;
  locale?: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `productsPage.${k}`, v);
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<"all" | string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) => (verdict === "all" || p.verdict === verdict) &&
             (!q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
    );
  }, [products, query, verdict]);

  // بطاقات المؤشّر الموحّدة - نفس الشكل الهادئ في كل أقسام المنتج
  const cards: Array<{
    key: string;
    label: string;
    value: string;
    unit?: string;
    Icon: typeof Wallet;
    tone: MetricTone;
    caption?: { text: string; tone: "muted" | "positive" | "warning" | "negative" };
  }> = [
    { key: "revenue", label: t(locale, "common.revenue"), value: num(totals.revenue), unit: currency, Icon: Wallet, tone: "accent" },
    {
      key: "profit",
      label: tr("realProfit"),
      value: num(totals.profit),
      unit: currency,
      Icon: Trophy,
      tone: totals.profit >= 0 ? "verified" : "critical",
      caption:
        totals.profit < 0
          ? { text: tr("profitLossNote"), tone: "negative" }
          : undefined,
    },
    { key: "units", label: tr("unitsSold"), value: num(totals.units), Icon: Package, tone: "default" },
    {
      key: "returns",
      label: tr("returnRate"),
      value: String(totals.returnRatePct),
      unit: "%",
      Icon: RotateCcw,
      tone: totals.returnRatePct > 25 ? "critical" : totals.returnRatePct > 12 ? "gap" : "verified",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="reveal mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] text-text-muted">{workspaceName}</div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{tr("title")}</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-muted">
            {tr("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <Store size={14} className={hasStoreConnection ? "text-verified" : "text-text-faint"} />
          {hasStoreConnection && storePlatform ? (
            <span className="text-[12.5px] text-text-primary">{tr("storeLinked", { store: STORE_LABEL[storePlatform] ?? storePlatform })}</span>
          ) : (
            <a href="/dashboard/integrations" className="text-[12.5px] text-accent no-underline">
              {tr("connectStore")}
            </a>
          )}
        </div>
      </div>

      {/* تنبيه صريح عند غياب مصدر البيانات الحقيقي */}
      {!hasStoreConnection && (
        <div className="reveal card-shadow mb-5 flex items-start gap-2.5 rounded-2xl border border-gap/35 bg-gap/[0.06] p-4">
          <AlertOctagon size={16} className="mt-0.5 shrink-0 text-gap" />
          <p className="text-[12.5px] leading-relaxed text-text-primary">
            {tr("noStoreWarn")}
          </p>
        </div>
      )}

      {/* الحصيلة */}
      <div className="reveal mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        {cards.map((c) => (
          <MetricCard
            key={c.key}
            label={c.label}
            value={c.value}
            unit={c.unit}
            icon={c.Icon}
            tone={c.tone}
            caption={c.caption}
          />
        ))}
      </div>

      {/* المنتج الرابح */}
      <section className="reveal card-shadow mb-6 overflow-hidden rounded-2xl border border-border bg-surface"
               style={{ animationDelay: "150ms" }}>
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Trophy size={16} className="text-verified" />
          <h2 className="text-[14px] font-semibold text-text-primary">{tr("winner")}</h2>
        </div>

        {winner ? (
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-semibold text-text-primary">{winner.name}</span>
                  <span className="rounded-full bg-verified/12 px-2 py-0.5 text-[11px] font-medium text-verified">
                    {tr(CONFIDENCE_KEY[winner.confidence])}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-text-muted">{winner.verdictAr}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Stat label={tr("unitProfit")} value={`${winner.profitPerUnit} ${currency}`} tone="var(--verified)" />
                  <Stat label={t(locale, "common.margin")} value={`${winner.marginPct}%`} />
                  <Stat label={tr("velocity")} value={tr("perDay", { n: winner.velocity })} />
                  <Stat label={tr("returns")} value={`${winner.returnRatePct}%`}
                        tone={winner.returnRatePct > 25 ? "var(--gap)" : undefined} />
                  {winner.stockDaysLeft !== null && (
                    <Stat label={tr("stockCovers")} value={tr("daysN", { n: winner.stockDaysLeft ?? 0 })}
                          tone={winner.stockDaysLeft <= 7 ? "var(--critical)" : undefined} />
                  )}
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-verified/30 bg-verified/[0.06] px-5 py-4 text-center">
                <div className="text-[11.5px] text-text-muted">{tr("achievedProfit")}</div>
                <div className="mt-1 font-mono text-[26px] font-bold leading-none text-verified">
                  {num(winner.totalProfit)}
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">{tr("perWindow", { currency, days: windowDays })}</div>
              </div>
            </div>

            {runnerUp && (
              <p className="mt-4 border-t border-border pt-3 text-[12.5px] text-text-muted">
                الثاني: <span className="text-text-primary">{runnerUp.name}</span> بربح{" "}
                <span className="font-mono text-text-primary">{num(runnerUp.totalProfit)} {currency}</span>
                {" "}— الفارق {num(winner.totalProfit - runnerUp.totalProfit)} {currency}.
              </p>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Trophy size={26} className="mx-auto mb-2 text-text-faint" />
            <p className="text-[13.5px] text-text-primary">{tr("noWinner")}</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-text-muted">
              الترشيح يتطلب ربحاً موجباً وعينة كافية (25 وحدة على الأقل) ونسبة مرتجعات معقولة.
              ترشيح منتج بناءً على عينة صغيرة أسوأ من عدم الترشيح.
            </p>
          </div>
        )}
      </section>

      {/* المنتجات الخاسرة */}
      {losing.length > 0 && (
        <section className="reveal card-shadow mb-6 overflow-hidden rounded-2xl border border-critical/35 bg-surface"
                 style={{ animationDelay: "220ms" }}>
          <div className="flex items-center gap-2 border-b border-border p-4">
            <TrendingDown size={16} className="text-critical" />
            <h2 className="text-[14px] font-semibold text-text-primary">{tr("losingProducts")}</h2>
            <span className="rounded-full bg-critical/12 px-2 py-0.5 font-mono text-[11px] font-medium text-critical">
              {losing.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {losing.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-text-primary">{p.name}</div>
                  <p className="text-[12.5px] text-text-muted">{p.verdictAr}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[14px] font-bold text-critical">
                    {num(p.totalProfit)} {currency}
                  </span>
                  <a href="/dashboard/pricing"
                     className="flex items-center gap-1 rounded-xl border border-border bg-surface-raised px-3 py-1.5 text-[12px] text-text-primary no-underline">
                    {tr("fixPricing")}
                    <ChevronLeft size={12} className="rtl:rotate-0 ltr:rotate-180" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* جدول المنتجات */}
      <section className="reveal card-shadow overflow-hidden rounded-2xl border border-border bg-surface"
               style={{ animationDelay: "300ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2">
            <Boxes size={15} className="text-text-muted" />
            <h2 className="text-[15px] font-semibold text-text-primary">{tr("allProducts")}</h2>
            <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[11.5px] text-text-muted">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)}
                    className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-text-primary outline-none">
              <option value="all">{tr("allStates")}</option>
              {Object.entries(VERDICT_META).map(([k, v]) => (
                <option key={k} value={k}>{tr(v.key)}</option>
              ))}
            </select>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 10 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("searchPlaceholder")}
                     className="w-44 rounded-xl border border-border bg-surface-raised py-2 text-[12.5px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent"
                     style={{ paddingInlineStart: 30, paddingInlineEnd: 10 }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["المنتج", "الحالة", "مباع", "المرتجعات", "ربح الوحدة", "الربح المتحقق", "المخزون"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-[11.5px] font-medium text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-[13px] text-text-muted">لا توجد منتجات مطابقة.</td></tr>
              ) : filtered.map((p) => {
                const v = VERDICT_META[p.verdict];
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-raised/45">
                    <td className="px-4 py-3.5">
                      <div className="text-[13px] font-medium text-text-primary">{p.name}</div>
                      {p.sku && <div className="font-mono text-[11px] text-text-faint">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{ background: `color-mix(in srgb, ${v.tone} 13%, transparent)`, color: v.tone }}>
                        {p.verdict === "WINNER" && <Trophy size={10} />}
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.tone }} />
                        {tr(v.key)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[12.5px] text-text-primary">
                      {num(p.unitsSold)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className="font-mono text-[12.5px] font-medium"
                            style={{ color: p.returnRatePct > 30 ? "var(--critical)" : p.returnRatePct > 15 ? "var(--gap)" : "var(--text-muted)" }}>
                        {p.returnRatePct}%
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className="font-mono text-[12.5px] font-medium"
                            style={{ color: p.profitPerUnit < 0 ? "var(--critical)" : "var(--verified)" }}>
                        {p.profitPerUnit > 0 ? "+" : ""}{p.profitPerUnit}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className="font-mono text-[13px] font-semibold"
                            style={{ color: p.totalProfit < 0 ? "var(--critical)" : "var(--text-primary)" }}>
                        {num(p.totalProfit)} {currency}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {p.stockQuantity === null ? (
                        <span className="text-[11.5px] text-text-faint">{tr("untracked")}</span>
                      ) : (
                        <span className="font-mono text-[12.5px]"
                              style={{ color: (p.stockDaysLeft ?? 99) <= 7 ? "var(--critical)" : "var(--text-primary)" }}>
                          {num(p.stockQuantity)}
                          {p.stockDaysLeft !== null && (
                            <span className="ms-1 text-[11px] text-text-muted">({tr("daysShort", { n: p.stockDaysLeft ?? 0 })})</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="rounded-xl border border-border bg-surface-raised px-3 py-2">
      <span className="block text-[10.5px] text-text-muted">{label}</span>
      <span className="mt-0.5 block font-mono text-[13px] font-medium"
            style={{ color: tone ?? "var(--text-primary)" }}>{value}</span>
    </span>
  );
}
