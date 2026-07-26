"use client";

// شريط مؤشرات الأداء: بطاقات قابلة للاختيار (4–10)، تحت كل واحدة رسم صغير
// لأدائها خلال الفترة المختارة، مع تمرير أفقي لأن العدد أكبر من عرض الشاشة.
// كل الأرقام تتبع فلتر المنصة المختار في أعلى الصفحة.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal, TrendingUp, TrendingDown, Check } from "lucide-react";
import { KPI_DEFS, type KpiKey, type KpiResult } from "@/lib/kpiEngine";

const MIN_KPIS = 4;
const MAX_KPIS = 10;

// لون مميز لكل مؤشر - ليس زخرفة: يجعل التعرّف على البطاقة فورياً عند
// التمرير الأفقي، ويربط المؤشر بمعناه (تكلفة/تحقّق/وصول/عائد).
const KPI_COLORS: Record<KpiKey, string> = {
  cost: "#F59E0B",
  conversions_reported: "#8B5CF6",
  conversions_verified: "#10B981",
  verification_rate: "#06B6D4",
  cpl_verified: "#EC4899",
  cpl_raw: "#F472B6",
  clicks: "#3B82F6",
  impressions: "#6366F1",
  ctr: "#0EA5E9",
  cpc: "#14B8A6",
  inflation_rate: "#EF4444",
  roas: "#22C55E",
};

function fmt(v: number, format: string, currency: string): string {
  if (format === "percent") return `${v.toFixed(1)}%`;
  if (format === "decimal") return `${v.toFixed(2)}x`;
  if (format === "currency") return `${Math.round(v).toLocaleString("en-US")} ${currency}`;
  return Math.round(v).toLocaleString("en-US");
}

// رسم صغير (SVG خالص - بدون مكتبة، خفيف وسريع)
function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-9" />;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24}`);
  const id = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-9 w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts.join(" ")} 100,30`} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiStrip({
  results,
  selected,
  currency,
  locale,
  onChangeSelection,
}: {
  results: KpiResult[];
  selected: KpiKey[];
  currency: string;
  locale: "ar" | "en";
  onChangeSelection: (keys: KpiKey[]) => void;
}) {
  const ar = locale === "ar";
  const scroller = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState(false);

  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  function toggle(k: KpiKey) {
    const has = selected.includes(k);
    if (has && selected.length <= MIN_KPIS) return;
    if (!has && selected.length >= MAX_KPIS) return;
    onChangeSelection(has ? selected.filter((x) => x !== k) : [...selected, k]);
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] text-text-muted">{ar ? "مؤشرات الأداء" : "Key metrics"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPicker((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <SlidersHorizontal size={13} /> {ar ? "اختيار المؤشرات" : "Customize"}
          </button>
          <button onClick={() => scroll(-1)} className="rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary" aria-label="prev"><ChevronLeft size={15} /></button>
          <button onClick={() => scroll(1)} className="rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary" aria-label="next"><ChevronRight size={15} /></button>
        </div>
      </div>

      {picker && (
        <div className="pop-shadow mb-3 rounded-xl border border-border bg-surface p-3">
          <div className="mb-2 text-[12px] text-text-faint">
            {ar ? `اختر من ${MIN_KPIS} إلى ${MAX_KPIS} مؤشرات (المحدد: ${selected.length})` : `Pick ${MIN_KPIS}–${MAX_KPIS} metrics (${selected.length} selected)`}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {KPI_DEFS.map((d) => {
              const on = selected.includes(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => toggle(d.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                    on ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted hover:text-text-primary"
                  }`}
                >
                  {on && <Check size={12} />}
                  {ar ? d.labelAr : d.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={scroller} className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {results.map((r) => {
          const def = KPI_DEFS.find((d) => d.key === r.key)!;
          const up = (r.changePct ?? 0) > 0;
          const good = r.changePct === null ? true : def.lowerIsBetter ? !up : up;
          const color = KPI_COLORS[r.key];
          return (
            <div
              key={r.key}
              className="kpi-card group relative min-w-[210px] flex-1 overflow-hidden rounded-2xl border p-4"
              style={{
                borderColor: `color-mix(in srgb, ${color} 26%, transparent)`,
                background: `linear-gradient(160deg, color-mix(in srgb, ${color} 9%, var(--surface)) 0%, var(--surface) 62%)`,
              }}
            >
              {/* شريط لوني علوي - تمييز بصري فوري عند التمرير الأفقي */}
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />

              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-[12.5px] text-text-muted">{ar ? def.labelAr : def.labelEn}</span>
              </div>
              <div className="font-mono text-[24px] font-semibold leading-none text-text-primary">
                {fmt(r.value, def.format, currency)}
              </div>
              {r.changePct !== null && (
                <div className={`mt-1.5 flex items-center gap-1 text-[11.5px] font-medium ${good ? "text-verified" : "text-critical"}`}>
                  {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(r.changePct)}%
                  <span className="text-text-faint">{ar ? "عن الفترة السابقة" : "vs prev."}</span>
                </div>
              )}
              <div className="mt-2"><Spark data={r.series} color={color} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
