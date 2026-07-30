// app/components/MetricsExplorer.tsx
//
// نظير صفحة Overview في Google Ads: تختار فترة زمنية حرّة وحتى ستّة
// مؤشّرات معاً، فيظهر منحنى أداء يومي لكل منها. منفصل عن الرسم الثابت
// (آخر ١٤ يوماً) أعلى الصفحة الرئيسية - هذا استكشاف حرّ بالكامل.

"use client";

import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { t, type Locale } from "@/lib/i18n/dictionary";

const METRIC_OPTIONS = [
  { key: "impressions", labelKey: "impressions", color: "#4C8DFF" },
  { key: "clicks", labelKey: "clicks", color: "#A585FF" },
  // دلالية (مرتبطة بمعنى حقيقي في المنتج) - تشير إلى متغيّرات الثيم
  // نفسها بدل تكرار قيمة hex ثابتة، كي تبقى متزامنة إن تغيّر الثيم
  { key: "cost", labelKey: "cost", color: "var(--gap)" },
  { key: "raw_conversions", labelKey: "rawConversions", color: "var(--gap)" },
  { key: "verified_conversions", labelKey: "verifiedConversions", color: "var(--verified)" },
  { key: "ctr", labelKey: "ctr", color: "#4FCEF0" },
  { key: "cpc", labelKey: "cpc", color: "var(--critical)" },
  { key: "cpl_raw", labelKey: "cplRaw", color: "var(--gap)" },
  { key: "cpl_verified", labelKey: "cplVerified", color: "var(--verified)" },
  { key: "inflation_rate", labelKey: "inflationRate", color: "var(--critical)" },
] as const;

const RANGE_PRESETS = [
  { days: 7 },
  { days: 14 },
  { days: 30 },
  { days: 90 },
];

const MAX_METRICS = 6;

export function MetricsExplorer({ workspaceId, locale = "ar" }: { workspaceId: string; locale?: Locale }) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `explorer.${k}`, vars);
  const [rangeDays, setRangeDays] = useState(30);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["cpl_verified", "verified_conversions"]);
  const [series, setSeries] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (selectedMetrics.length === 0) {
      setSeries([]);
      return;
    }
    setLoading(true);

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - rangeDays);

    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      metrics: selectedMetrics.join(","),
    });

    const res = await fetch(`/api/workspaces/${workspaceId}/metrics-timeline?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSeries(data.series ?? []);
    }
    setLoading(false);
  }, [workspaceId, rangeDays, selectedMetrics]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleMetric(key: string) {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) return prev.filter((m) => m !== key);
      if (prev.length >= MAX_METRICS) return prev; // الحدّ الأقصى ستّة - لا نتجاهل الضغطة، لكن لا نزيد
      return [...prev, key];
    });
  }

  return (
    <div className="rounded-2xl bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-text-muted">{tr("title")}</span>
        <div className="flex gap-1">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => setRangeDays(preset.days)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                rangeDays === preset.days ? "bg-accent text-white" : "bg-surface-raised text-text-muted"
              }`}
            >
              {tr("rangeDays", { n: preset.days })}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRIC_OPTIONS.map((m) => {
          const isSelected = selectedMetrics.includes(m.key);
          const isDisabled = !isSelected && selectedMetrics.length >= MAX_METRICS;
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              disabled={isDisabled}
              className={`rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-30 ${
                isSelected ? "text-white" : "bg-surface-raised text-text-muted"
              }`}
              style={isSelected ? { backgroundColor: m.color } : undefined}
            >
              {tr(m.labelKey)}
            </button>
          );
        })}
      </div>
      <p className="mb-4 text-xs text-text-faint">
        {tr("selectedCount", { n: selectedMetrics.length, max: MAX_METRICS })}
      </p>

      {loading ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-text-faint">{tr("loading")}</div>
      ) : series.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-text-faint">
          {tr("noData")}
        </div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-raised)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selectedMetrics.map((key) => {
                const meta = METRIC_OPTIONS.find((m) => m.key === key)!;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={tr(meta.labelKey)}
                    stroke={meta.color}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={700}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
