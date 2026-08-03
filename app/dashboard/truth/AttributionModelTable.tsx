"use client";

// مقارنة نماذج الإسناد الثمانية جنباً إلى جنب.
//
// القيمة ليست في أي نموذج بمفرده - كلٌّ منها يمثّل افتراضاً مختلفاً عمّا
// "يصنع" التحويل، ولا يوجد نموذج صحيح مطلقاً. القيمة في **الفارق**: قناة
// يمنحها التوزيع متعدّد اللمسات أكثر ممّا تدّعيه لنفسها هي قناة مبخوسة
// تعمل في أول الرحلة، وخفض ميزانيتها بناءً على لوحتها وحدها خطأ شائع ومكلف.

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { ATTRIBUTION_MODELS, type AttributionModelKey, type ModelComparisonRow } from "@/lib/attributionModels";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { CHANNEL_KEYS } from "./TruthView";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { TABLE_WRAP, TH } from "@/app/components/ui/tableStyles";

const PLATFORM_NAMES: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  TIKTOK_ADS: "TikTok Ads",
  SNAPCHAT_ADS: "Snapchat Ads",
};

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const num1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");

export function AttributionModelTable({
  rows,
  channelRows,
  currency,
  pathCoveragePct,
  conversionsWithoutTouches,
  unbackedClaims,
  locale = "ar",
}: {
  rows: ModelComparisonRow[];
  channelRows: ModelComparisonRow[];
  currency: string;
  pathCoveragePct: number;
  conversionsWithoutTouches: number;
  unbackedClaims: number;
  locale?: Locale;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `campPages.${k}`, vars);
  const [dimension, setDimension] = useState<"platform" | "channel">("platform");
  const [metric, setMetric] = useState<"conversions" | "revenue">("conversions");

  const data = dimension === "platform" ? rows : channelRows;
  const label = (key: string) =>
    dimension === "platform" ? (PLATFORM_NAMES[key] ?? key) : ((CHANNEL_KEYS[key] ? t(locale, `campPages.${CHANNEL_KEYS[key]}`) : key));

  const underCredited = data.filter((r) => r.verdict === "UNDER_CREDITED");
  const overCredited = data.filter((r) => r.verdict === "OVER_CREDITED");

  return (
    <div>
      {/* أدوات التبديل */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Toggle
          options={[
            { key: "platform", label: tr("amtByPlatform") },
            { key: "channel", label: tr("amtByChannel") },
          ]}
          value={dimension}
          onChange={(v) => setDimension(v as "platform" | "channel")}
        />
        <Toggle
          options={[
            { key: "conversions", label: tr("amtConversions") },
            { key: "revenue", label: tr("amtRevenue") },
          ]}
          value={metric}
          onChange={(v) => setMetric(v as "conversions" | "revenue")}
        />
      </div>

      {/* الخلاصة قبل الجدول - الجدول يشرح، والخلاصة تُقرأ */}
      {(underCredited.length > 0 || overCredited.length > 0) && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {underCredited.length > 0 && (
            <Verdict
              tone="under"
              title={tr("amtUnderTitle")}
              body={
                <>
                  {tr("amtUnderBody", { names: underCredited.map((r) => label(r.key)).join(locale === "en" ? ", " : "، ") })}
                </>
              }
            />
          )}
          {overCredited.length > 0 && (
            <Verdict
              tone="over"
              title={tr("amtOverTitle")}
              body={
                <>
                  {tr("amtOverBody", { names: overCredited.map((r) => label(r.key)).join(locale === "en" ? ", " : "، ") })}
                </>
              }
            />
          )}
        </div>
      )}

      <div className={TABLE_WRAP}>
        <table className="w-full min-w-[900px] text-start text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="sticky start-0 bg-surface px-4 py-3 text-start font-medium">
                {dimension === "platform" ? tr("amtColPlatform") : tr("amtColChannel")}
              </th>
              {ATTRIBUTION_MODELS.map((m) => (
                <th key={m.key} className="px-3 py-3 font-medium" title={locale === "en" ? m.descriptionEn : m.descriptionAr}>
                  <span className="flex items-center justify-end gap-1">
                    {locale === "en" ? m.labelEn : m.labelAr}
                    <Info size={10} className="text-text-faint" />
                  </span>
                </th>
              ))}
              <th className={TH}>{tr("amtColVerdict")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.key} className="border-b border-border/50 last:border-0">
                <td className="sticky start-0 bg-surface px-4 py-3">
                  <span className="flex items-center gap-2 font-medium text-text-primary">
                    {dimension === "platform" && <PlatformLogo platform={row.key} size={14} />}
                    {label(row.key)}
                  </span>
                </td>
                {ATTRIBUTION_MODELS.map((m) => (
                  <td key={m.key} className="px-3 py-3 tabular-nums text-text-primary">
                    <Cell row={row} model={m.key} metric={metric} currency={currency} />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <VerdictBadge row={row} locale={locale} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* حدود القراءة - تُذكر مع الأرقام لا في حاشية بعيدة */}
      <div className="mt-2 flex flex-col gap-1 text-[11.5px] leading-relaxed text-text-faint">
        <p>
          {tr("amtCaveat")}
        </p>
        <p>
          {tr("amtCoverage", { pct: pathCoveragePct })}
          {conversionsWithoutTouches > 0 && (
            <>{tr("amtMissingTouches", { n: num(conversionsWithoutTouches) })}</>
          )}
          {unbackedClaims > 0 && (
            <>
              {" "}
              {tr("amtUnbacked", { n: num(unbackedClaims) })}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Cell({
  row, model, metric, currency,
}: {
  row: ModelComparisonRow;
  model: AttributionModelKey;
  metric: "conversions" | "revenue";
  currency: string;
}) {
  const credit = row.byModel[model];
  const value = metric === "conversions" ? credit.conversions : credit.revenue;

  if (value <= 0) return <span className="text-text-faint">—</span>;

  return (
    <span>
      {metric === "conversions" ? num1(value) : num(value)}
      {metric === "revenue" && <span className="ms-1 text-[10.5px] text-text-faint">{currency}</span>}
    </span>
  );
}

function VerdictBadge({ row, locale }: { row: ModelComparisonRow; locale: Locale }) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `campPages.${k}`, vars);
  if (row.verdict === "FAIR") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-[11.5px] text-text-muted">
        <Minus size={11} />
        {tr("amtFair")}
      </span>
    );
  }
  const under = row.verdict === "UNDER_CREDITED";
  const Arrow = under ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium ${
        under ? "bg-verified/10 text-verified" : "bg-critical/10 text-critical"
      }`}
      title={
        row.creditGapPct !== null
          ? tr("amtGapTitle", { pct: Math.abs(Math.round(row.creditGapPct)) })
          : tr("amtNoClaimTitle")
      }
    >
      <Arrow size={11} />
      {under ? tr("amtUnder") : tr("amtOver")}
      {row.creditGapPct !== null && (
        <span className="tabular-nums">{Math.abs(Math.round(row.creditGapPct))}%</span>
      )}
    </span>
  );
}

function Verdict({ tone, title, body }: { tone: "under" | "over"; title: string; body: React.ReactNode }) {
  const under = tone === "under";
  return (
    <div
      className={`rounded-xl border p-3 ${
        under ? "border-verified/30 bg-verified/[0.06]" : "border-critical/30 bg-critical/[0.06]"
      }`}
    >
      <div className={`mb-1 text-[12.5px] font-semibold ${under ? "text-verified" : "text-critical"}`}>
        {title}
      </div>
      <p className="text-[12px] leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}

function Toggle({
  options, value, onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            value === o.key ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
