// app/components/MetricsExplorer.tsx
//
// زي صفحة Overview في Google Ads بالظبط: تختار فترة زمنية حرة + لحد 6
// مقاييس مع بعض، وبيظهرلك منحنى أداء يومي لكل واحد فيهم. منفصل عن الرسم
// الثابت (آخر 14 يوم) اللي في أعلى صفحة "لمحة" - ده استكشاف حر بالكامل.

"use client";

import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const METRIC_OPTIONS = [
  { key: "impressions", label: "الظهور", color: "#4C8DFF" },
  { key: "clicks", label: "الكليكات", color: "#A585FF" },
  // دلالية (مرتبطة بمعنى حقيقي في المنتج) - بتشاور على متغيرات الثيم
  // نفسها بدل تكرار قيمة hex ثابتة، عشان تفضل متزامنة لو الثيم اتغيّر
  { key: "cost", label: "التكلفة", color: "var(--gap)" },
  { key: "raw_conversions", label: "التحويلات المعلنة", color: "var(--gap)" },
  { key: "verified_conversions", label: "التحويلات الحقيقية", color: "var(--verified)" },
  { key: "ctr", label: "نسبة النقر CTR", color: "#4FCEF0" },
  { key: "cpc", label: "تكلفة الكليك", color: "var(--critical)" },
  { key: "cpl_raw", label: "تكلفة العميل المعلنة", color: "var(--gap)" },
  { key: "cpl_verified", label: "تكلفة العميل الحقيقية", color: "var(--verified)" },
  { key: "inflation_rate", label: "نسبة التضخيم", color: "var(--critical)" },
] as const;

const RANGE_PRESETS = [
  { label: "7 أيام", days: 7 },
  { label: "14 يوم", days: 14 },
  { label: "30 يوم", days: 30 },
  { label: "90 يوم", days: 90 },
];

const MAX_METRICS = 6;

export function MetricsExplorer({ workspaceId }: { workspaceId: string }) {
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
      if (prev.length >= MAX_METRICS) return prev; // الحد الأقصى 6 - مبنتجاهلش الضغطة، بس منزودش
      return [...prev, key];
    });
  }

  return (
    <div className="rounded-2xl bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-text-muted">استكشاف الأداء عبر الزمن</span>
        <div className="flex gap-1">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => setRangeDays(preset.days)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                rangeDays === preset.days ? "bg-accent text-white" : "bg-surface-raised text-text-muted"
              }`}
            >
              {preset.label}
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
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="mb-4 text-xs text-text-faint">
        {selectedMetrics.length}/{MAX_METRICS} مقاييس مختارة
      </p>

      {loading ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-text-faint">جارٍ التحميل...</div>
      ) : series.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-text-faint">
          مفيش بيانات كافية للفترة والمقاييس المختارة
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
                    name={meta.label}
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
