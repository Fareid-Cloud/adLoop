// app/components/StoreFunnel.tsx
//
// مسار الشراء - **على المرجع الذي أرسله المالك، عنصراً بعنصر.**
//
//   صفٌّ علويّ: عمودٌ لكلّ مرحلة، بينها فواصل رأسية. في العمود: نقطةٌ
//   ملوّنة واسمُ المرحلة، ثمّ الرقم كبيراً ومعه سهمُ التغيّر ونسبتُه، ثمّ
//   سطرٌ صغير بالفارق عن الفترة السابقة.
//
//   تحته: مخروطٌ من خمس قطعٍ متدرّجة، لكلٍّ لونُ مرحلتها، ومنقوطةٌ من
//   الداخل - والنقاط تخفّ كلّما ضاق المخروط، فالكثافة نفسها تقول كم بقي.
//
// **والفرق عن القالب أنّ كلّ رقمٍ هنا موصولٌ بمصدره:** الظهور والنقرة من
// `MetricSnapshot`، والسلّة والدفع من إبلاغ المنصّة نفسها، والطلب الباقي
// بعد طرح المرتجعات. لا مرحلةَ مرسومةً لتكتمل الصورة.

import { t, type Locale } from "@/lib/i18n/dictionary";
import type { StoreFunnel as FunnelData } from "@/lib/storeFunnel";

/** لونُ كلّ مرحلة - نفسه في نقطة العمود وفي قطعة المخروط تحتها، فالعين
 *  تربط الرقم برسمه بلا مفتاحٍ منفصل. */
const TINT = ["#2563EB", "#DB2777", "#E11D48", "#F97316", "#16A34A"];

/** نقاطٌ داخل قطعة المخروط. عددُها يتبع ارتفاع القطعة، فتخفّ الكثافة مع
 *  الضيق - وهي الإشارة البصرية التي تجعل الفقد محسوساً قبل قراءة نسبة. */
function dots(x1: number, x2: number, h1: number, h2: number, seed: number, mid: number) {
  const out: Array<{ cx: number; cy: number }> = [];
  const cols = 7;
  const rows = 5;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // موضعٌ شبه عشوائيّ لكنّه **ثابت**: مشتقٌّ من الفهرس لا من `Math.random`،
      // وإلّا تحرّكت النقاط مع كلّ تصيير وبدا الرسم مضطرباً.
      const jx = ((Math.sin(seed * 12.9 + c * 4.1 + r * 7.3) + 1) / 2) * 0.6 + 0.2;
      const jy = ((Math.sin(seed * 7.7 + c * 9.4 + r * 3.2) + 1) / 2) * 0.8 + 0.1;
      const tx = (c + jx) / cols;
      const cx = x1 + (x2 - x1) * tx;
      const h = h1 + (h2 - h1) * tx;
      const cy = mid - h / 2 + h * ((r + jy) / rows);
      out.push({ cx, cy });
    }
  }
  return out;
}

export function StoreFunnel({ data, locale }: { data: FunnelData; locale: Locale }) {
  const tr = (k: string, v?: Record<string, string | number>) =>
    t(locale, `shopFunnel.${k}`, v);
  const loc = locale === "ar" ? "ar-EG" : "en-US";

  const compact = new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat(loc, { maximumFractionDigits: 1 });

  const stages = data.stages;
  const top = stages[0]?.value ?? 0;

  const W = 1000;
  const H = 210;
  const MID = H / 2;
  const seg = W / stages.length;
  // مقياسٌ لوغاريتميّ للرسم وحده - **الأرقام المكتوبة تبقى حقيقية.** الخطّيّ
  // ينهار إلى خيطٍ بعد المرحلة الثانية (الطلبات جزءٌ من ألفٍ من الظهور)،
  // فلا يبقى في الشكل ما يُقرأ.
  const height = (v: number) => {
    if (top <= 0) return H * 0.08;
    const r = Math.log10(1 + v) / Math.log10(1 + top);
    return Math.max(0.08, r) * (H - 12);
  };

  return (
    <div className="card pad-lg">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold text-text-primary">{tr("title")}</span>
        <span className="text-[11.5px] text-text-muted">{tr("subtitle")}</span>
      </div>

      {/* الصفّ العلويّ - أعمدةٌ متساوية تقف كلٌّ منها فوق قطعتها */}
      <div className="no-scrollbar mb-5 flex overflow-x-auto">
        {stages.map((s, i) => {
          const up = (s.changePct ?? 0) >= 0;
          const diff = s.value - s.prevValue;
          return (
            <div
              key={s.key}
              className="min-w-[8.5rem] flex-1 border-e border-border px-4 first:ps-0 last:border-0"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: TINT[i] }}
                />
                <span className="truncate text-[12.5px] font-medium text-text-primary">
                  {tr(s.key)}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold leading-none text-text-primary">
                  {compact.format(s.value)}
                </span>
                {s.changePct !== null && (
                  <span
                    className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                      up ? "bg-verified/12 text-verified" : "bg-critical/12 text-critical"
                    }`}
                  >
                    {up ? "↑" : "↓"} {Math.abs(s.changePct).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="mt-1.5 text-[11px] text-text-faint">
                {diff >= 0 ? "+" : "−"}
                {compact.format(Math.abs(diff))} {tr("vsPrev")}
              </div>

              {/* 🔴 تكلفة الوصول إلى المرحلة - وهي ما تسمّيه المنصّات
                  «تكلفة الإضافة للسلّة» وأخواتِها. رقمُ قرارٍ لا زينة:
                  به يُعرَف أين يغلو المسار قبل أن يصل إلى بيع. */}
              {s.costPer !== null && (
                <div className="mt-1 font-mono text-[11px] text-text-muted">
                  {money.format(s.costPer)} {data.currency} · {tr("each")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* المخروط */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[210px] w-full"
        role="img"
        aria-label={tr("title")}
      >
        {stages.map((s, i) => {
          const next = stages[i + 1];
          const h1 = height(s.value);
          const h2 = height(next ? next.value : s.value * 0.9);
          const x1 = i * seg;
          const x2 = (i + 1) * seg;
          const weak = s.key === data.weakestStepKey;
          return (
            <g key={s.key}>
              <polygon
                points={`${x1},${MID - h1 / 2} ${x2},${MID - h2 / 2} ${x2},${MID + h2 / 2} ${x1},${MID + h1 / 2}`}
                fill={TINT[i]}
                opacity={0.13}
              />
              {dots(x1, x2, h1, h2, i + 1, MID).map((d, n) => (
                <circle key={n} cx={d.cx} cy={d.cy} r={3.2} fill={TINT[i]} opacity={0.85} />
              ))}
              {/* المرحلة الأضعف وحدها معلَّمة - موضعُ الفعل لا موضعُ زينة */}
              {weak && (
                <line
                  x1={x1}
                  y1={MID - h1 / 2 - 8}
                  x2={x1}
                  y2={MID + h1 / 2 + 8}
                  stroke="var(--gap)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* نسب البقاء - الرسم يُري الانحدار، وهذه تقيسه */}
      <div className="mt-1 flex">
        {stages.map((s, i) => {
          const weak = s.key === data.weakestStepKey;
          return (
            <div key={s.key} className="min-w-[8.5rem] flex-1 px-4 text-center">
              {i > 0 && (
                <span className={`text-[11px] ${weak ? "font-medium text-gap" : "text-text-faint"}`}>
                  {tr("stepKept", {
                    pct: s.keptFromPrevPct === null ? "—" : s.keptFromPrevPct.toFixed(1),
                  })}
                  {weak && ` · ${tr("weakest")}`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!data.storeConnected && (
        <p className="mt-5 border-t border-border pt-3.5 text-[11.5px] leading-relaxed text-text-faint">
          {tr("noStoreNote")}
        </p>
      )}
    </div>
  );
}
