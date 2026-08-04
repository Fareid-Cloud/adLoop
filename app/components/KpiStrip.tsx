"use client";

// شريط مؤشرات الأداء: بطاقات قابلة للاختيار (4–10)، تحت كل واحدة رسم صغير
// لأدائها خلال الفترة المختارة. كل الأرقام تتبع فلتر المنصة المختار أعلى
// الصفحة.
//
// شبكة تلتفّ لا شريط يُمرَّر أفقياً: خمس بطاقات بحدّ أدنى ٢١٤ بكسل تتجاوز
// عرض الشاشة، فيختفي آخر مؤشّر خلف حافة لا يلاحظها المستخدم - وسهما التمرير
// اللذان كانا يعوّضان ذلك صارا بلا وظيفة بعد الالتفاف فحُذفا.

import { useId, useState } from "react";
import {
  SlidersHorizontal, ArrowUpRight, ArrowDownRight, Check,
  Wallet, Target, ShieldCheck, Percent, UserCheck, Users, MousePointerClick, Eye,
  Activity, Coins, AlertTriangle, TrendingUp,
} from "lucide-react";
import { KPI_DEFS, type KpiKey, type KpiResult } from "@/lib/kpiEngine";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

const MIN_KPIS = 4;
const MAX_KPIS = 10;

// لون مميز لكل مؤشر - ليس زخرفة: يجعل التعرّف على البطاقة فورياً عند
// التمرير الأفقي، ويربط المؤشر بمعناه (تكلفة/تحقّق/وصول/عائد).
// اللون محصور الآن في مربّع الأيقونة ورسم الاتجاه فقط - لا شريط علوي ولا
// تدرّج على البطاقة، فتبقى الصفحة هادئة عند اصطفاف ست بطاقات أو أكثر.
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

// أيقونة لكل مؤشر - نفس بنية بطاقة MetricCard الموحّدة، فيبقى شكل البطاقة
// واحداً في كل أقسام المنتج بدل شكلين متجاورين
const KPI_ICONS: Record<KpiKey, typeof Wallet> = {
  cost: Wallet,
  conversions_reported: Target,
  conversions_verified: ShieldCheck,
  verification_rate: Percent,
  cpl_verified: UserCheck,
  cpl_raw: Users,
  clicks: MousePointerClick,
  impressions: Eye,
  ctr: Activity,
  cpc: Coins,
  inflation_rate: AlertTriangle,
  roas: TrendingUp,
};

// الوحدة تُفصل عن الرقم ليأخذ الرقم الوزن البصري وتبقى الوحدة ثانوية -
// نفس تسلسل بطاقة المؤشر الموحّدة
function fmtValue(v: number, format: string): string {
  if (format === "percent") return v.toFixed(1);
  if (format === "decimal") return v.toFixed(2);
  return Math.round(v).toLocaleString("en-US");
}

function fmtUnit(format: string, currency: string): string {
  if (format === "percent") return "%";
  if (format === "decimal") return "x";
  if (format === "currency") return currency;
  return "";
}

// رسم صغير (SVG خالص - بدون مكتبة، خفيف وسريع)
function Spark({ data, color }: { data: number[]; color: string }) {
  // `useId` لا `Math.random`: المعرّف العشوائي يختلف بين عرض الخادم وترطيب
  // العميل، فيرفض React الشجرة ("This won't be patched up") ويسقط ما بعدها
  // من الصفحة. `useId` مستقرّ عبر الاثنين بحكم تصميمه.
  //
  // ويُستدعى قبل أي خروج مبكّر: الخطّاف بعد `return` مشروط، وهو كسر لقواعد
  // الخطّافات يُربك ترتيبها بين عرض وآخر.
  const id = `sg-${useId().replace(/:/g, "")}`;
  if (data.length < 2) return <div className="h-9" />;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24}`);
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
  const [picker, setPicker] = useState(false);


  function toggle(k: KpiKey) {
    const has = selected.includes(k);
    if (has && selected.length <= MIN_KPIS) return;
    if (!has && selected.length >= MAX_KPIS) return;
    onChangeSelection(has ? selected.filter((x) => x !== k) : [...selected, k]);
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] text-text-muted">{t(locale, "kpiStrip.title")}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPicker((v) => !v)} className="flex items-center gap-1.5 card px-2.5 py-1.5 text-[12px] text-text-muted transition-colors hover:text-text-primary">
            <SlidersHorizontal size={13} /> {t(locale, "kpiStrip.customize")}
          </button>
        </div>
      </div>

      {picker && (
        <div className="pop-shadow mb-3 card pad-sm">
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

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(214px,1fr))]">
        {results.map((r) => {
          const def = KPI_DEFS.find((d) => d.key === r.key)!;
          const up = (r.changePct ?? 0) > 0;
          const good = r.changePct === null ? true : def.lowerIsBetter ? !up : up;
          const color = KPI_COLORS[r.key];
          const Icon = KPI_ICONS[r.key];
          const unit = fmtUnit(def.format, currency);
          return (
            <div
              key={r.key}
              className="card-shadow group card pad-md transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-border"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-muted">
                  {ar ? def.labelAr : def.labelEn}
                </span>
                {/* مصدر البيانات: شعارات صغيرة متداخلة قليلاً - تعريف فوري
                    بمصدر الرقم دون أن تسرق مساحة من الرقم نفسه */}
                {r.sources.length > 0 && (
                  <span
                    className="flex shrink-0 items-center rounded-full border border-border bg-surface px-1 py-0.5"
                    title={ar ? t(locale, "kpiStrip.dataSource") : "Data source"}
                  >
                    {r.sources.map((p, i) => (
                      <span key={p} className="flex items-center justify-center rounded-full bg-surface" style={{ marginInlineStart: i === 0 ? 0 : -4, zIndex: r.sources.length - i }}>
                        <PlatformLogo platform={p} size={12} />
                      </span>
                    ))}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-text-primary">
                  {fmtValue(r.value, def.format)}
                </span>
                {unit && <span className="text-[13px] font-medium text-text-muted">{unit}</span>}
              </div>

              {r.changePct !== null && (
                <div className="mt-2 flex items-center gap-1 text-[12px]">
                  <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${good ? "text-verified" : "text-critical"}`}>
                    {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {Math.abs(r.changePct)}%
                  </span>
                  <span className="text-text-faint">{ar ? t(locale, "kpiStrip.vsPrev") : "vs prev. period"}</span>
                </div>
              )}

              <div className="mt-3"><Spark data={r.series} color={color} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
