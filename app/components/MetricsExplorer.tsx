// app/components/MetricsExplorer.tsx
//
// نظير صفحة Overview في Google Ads: تختار فترة زمنية حرّة وحتى ستّة
// مؤشّرات معاً، فيظهر منحنى أداء يومي لكل منها. منفصل عن الرسم الثابت
// (آخر ١٤ يوماً) أعلى الصفحة الرئيسية - هذا استكشاف حرّ بالكامل.

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { t, type Locale } from "@/lib/i18n/dictionary";

const METRIC_OPTIONS = [
  { key: "impressions", labelKey: "impressions" },
  { key: "clicks", labelKey: "clicks" },
  { key: "cost", labelKey: "cost" },
  { key: "raw_conversions", labelKey: "rawConversions" },
  { key: "verified_conversions", labelKey: "verifiedConversions" },
  { key: "ctr", labelKey: "ctr" },
  { key: "cpc", labelKey: "cpc" },
  { key: "cpl_raw", labelKey: "cplRaw" },
  { key: "cpl_verified", labelKey: "cplVerified" },
  { key: "inflation_rate", labelKey: "inflationRate" },
] as const;

/**
 * **اللون بالأسبقية لا بالمؤشّر.**
 *
 * كان لكل مؤشّر لون ثابت، وكانت الألوان تتكرّر: `--gap` لثلاثة مؤشّرات
 * و`--verified` لاثنين و`--critical` لاثنين. اختيار «التكلفة» و«التحويلات
 * المُعلنة» معاً كان يرسم منحنيين بلون واحد - فلا يُعرف أيّهما أيّ.
 *
 * الحلّ نفسه الذي تستخدمه أدوات القياس: أوّل ما تختاره يأخذ اللون الأوّل،
 * والثاني الثاني، وهكذا. خمسة ألوان هادئة متباعدة بوضوح، وخمسة مؤشّرات
 * كحدّ أقصى - سادسٌ يعني لوناً يقارب لوناً آخر.
 */
const SERIES_COLORS = [
  "#4C8DFF", // أزرق
  "#E5484D", // أحمر
  "#F2A93B", // كهرماني
  "#3EA76B", // أخضر
  "#8E6FE8", // بنفسجي
] as const;

// اختصارات سريعة مألوفة + مدى مخصّص. كانت أربعة أرقام ثابتة لا تشمل
// «الشهر الماضي» ولا «هذا الربع» ولا أي مدى يختاره المستخدم بنفسه.
const RANGE_PRESETS = [
  { days: 7 },
  { days: 14 },
  { days: 30 },
  { days: 90 },
  { days: 180 },
  { days: 365 },
];

const MAX_METRICS = SERIES_COLORS.length;

export function MetricsExplorer({ workspaceId, locale = "ar" }: { workspaceId: string; locale?: Locale }) {
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `explorer.${k}`, vars);
  const [rangeDays, setRangeDays] = useState(30);
  // هل الرقم الحالي مدى مخصّص؟ يميّزه بصرياً عن الاختصارات
  const [custom, setCustom] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["cpl_verified", "verified_conversions"]);
  const [series, setSeries] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * كل مؤشّر يُقاس على ذروته هو: القيمة ÷ أعلى قيمة له في الفترة × ١٠٠.
   * بهذا يُقارَن **شكل** المنحنيات - وهو السؤال الحقيقي هنا: هل يصعد هذا
   * بينما يهبط ذاك؟ - بدل أن يبتلع المؤشّر الأكبر رقماً بقيّةَ الرسم.
   * القيم الأصلية تبقى في الصفوف نفسها ليعرضها التلميح.
   */
  const normalized = useMemo(() => {
    if (series.length === 0) return [];
    const peaks = new Map<string, number>();
    for (const key of selectedMetrics) {
      const max = Math.max(...series.map((row) => Number(row[key] ?? 0)), 0);
      peaks.set(key, max > 0 ? max : 1);
    }
    return series.map((row) => {
      const out: Record<string, string | number> = { ...row };
      for (const key of selectedMetrics) {
        out[`n_${key}`] = (Number(row[key] ?? 0) / peaks.get(key)!) * 100;
      }
      return out;
    });
  }, [series, selectedMetrics]);

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
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="section-title">{tr("title")}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex gap-1 card p-1">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => { setCustom(false); setRangeDays(preset.days); }}
                className={`rounded-lg px-2.5 py-1 text-[12px] transition-colors ${
                  !custom && rangeDays === preset.days
                    ? "bg-accent font-medium text-white"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {tr("rangeDays", { n: preset.days })}
              </button>
            ))}
          </div>
          {/* مدى مخصّص: الاختصارات لا تغطّي كل سؤال - «آخر ٤٥ يوماً» سؤال
              مشروع لا يجيب عنه زرّ ثابت. */}
          <label className="flex items-center gap-1.5 card px-2.5 py-1.5 text-[12px] text-text-muted">
            {tr("customDays")}
            <input
              type="number"
              min={1}
              max={730}
              value={custom ? rangeDays : ""}
              placeholder="—"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 1) { setCustom(false); return; }
                setCustom(true);
                setRangeDays(Math.min(730, Math.round(n)));
              }}
              className="w-14 rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-center text-[12px] text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRIC_OPTIONS.map((m) => {
          const order = selectedMetrics.indexOf(m.key);
          const isSelected = order >= 0;
          const isDisabled = !isSelected && selectedMetrics.length >= MAX_METRICS;
          // الشارة تأخذ لون منحناها نفسه: هذا هو الرابط الوحيد بين ما
          // اختاره المستخدم وما يراه في الرسم.
          const color = isSelected ? SERIES_COLORS[order % SERIES_COLORS.length] : null;
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              disabled={isDisabled}
              className={`rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-30 ${
                isSelected ? "text-white" : "bg-surface-raised text-text-muted hover:text-text-primary"
              }`}
              style={color ? { backgroundColor: color } : undefined}
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
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={normalized} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
              {/* المحور نسبة مئوية من ذروة كل مؤشّر لا قيمة مطلقة: الظهور
                  بمئات الآلاف والنقر بنسبة ٢٫٩٪ لا يشتركان في محور واحد -
                  الثاني ينسحق على الصفر فيبدو خطّاً ميّتاً. */}
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(x) => `${x}%`}
                stroke="var(--text-faint)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: "0 10px 30px rgb(0 0 0 / 0.16)",
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                // التلميح يعرض القيمة الحقيقية لا النسبة: التطبيع للرسم
                // وحده، والقرار يُتّخذ على الرقم الفعلي.
                formatter={(_value, name, item) => {
                  const key = String(item?.dataKey ?? "").replace(/^n_/, "");
                  const raw = (item?.payload as Record<string, number>)?.[key];
                  return [raw != null ? fmtValue(raw) : "—", name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selectedMetrics.map((key, i) => {
                const meta = METRIC_OPTIONS.find((m) => m.key === key)!;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={`n_${key}`}
                    name={tr(meta.labelKey)}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={700}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11.5px] text-text-faint">{tr("scaleNote")}</p>
        </div>
      )}
    </div>
  );
}

/** رقم مقروء في التلميح: منزلتان للصغير، بلا كسور للكبير */
function fmtValue(n: number): string {
  const abs = Math.abs(n);
  return n.toLocaleString("en-US", { maximumFractionDigits: abs >= 100 ? 0 : abs >= 10 ? 1 : 2 });
}
