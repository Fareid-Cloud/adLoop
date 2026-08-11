// app/components/StoreFunnel.tsx
//
// مسار الشراء - **مخروطٌ متدرّج بصفّ إحصاءاتٍ فوقه**، على المرجع الذي
// أرسله المالك للمتجر تحديداً. وهو شكلٌ مقصودٌ أن يختلف عن قمع الحملات:
// ذاك أشرطةٌ أفقية لأنّه يقارن منصّاتٍ ببعضها، وهذا مخروطٌ لأنّه يقرأ
// **مساراً واحداً يضيق**.
//
// **الضيق نفسه هو المعلومة:** الشكل يُري بالنظر أين تنغلق الطريق فجأة،
// قبل أن يُقرأ رقم. وذلك ما لا يفعله الجدول ولا صفٌّ من الأشرطة.
//
// 🔴 **ورسمُه من الأرقام لا من قالب:** ارتفاع كلّ حافّةٍ نسبةٌ حقيقية من
// المرحلة الأولى. القوالب الجاهزة ترسم مخروطاً متساوي التدرّج مهما كانت
// البيانات - فيبدو الحساب المتهالك كالحساب الممتاز.

import { t, type Locale } from "@/lib/i18n/dictionary";
import type { StoreFunnel as FunnelData } from "@/lib/storeFunnel";

/** ألوان المراحل - تدرّجٌ واحد من لون الثيم إلى لون التحقّق، لا سبعة
 *  ألوانٍ مستقلّة. التدرّج يقول «هذه مراحلُ شيءٍ واحد»؛ والألوان المستقلّة
 *  (كما في القوالب) تجعل العين تبحث عن معنىً في اللون فلا تجده. */
const STAGE_TINT = [
  "var(--accent)",
  "color-mix(in oklab, var(--accent) 78%, var(--verified))",
  "color-mix(in oklab, var(--accent) 52%, var(--verified))",
  "color-mix(in oklab, var(--accent) 26%, var(--verified))",
  "var(--verified)",
];

export function StoreFunnel({ data, locale }: { data: FunnelData; locale: Locale }) {
  const tr = (k: string, v?: Record<string, string | number>) =>
    t(locale, `shopFunnel.${k}`, v);

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const stages = data.stages;
  const top = stages[0]?.value ?? 0;

  // إحداثيات المخروط: ارتفاع كلّ حافّة نسبةٌ من المرحلة الأولى، بحدٍّ أدنى
  // يبقي القطعة مرئيّةً حين تقترب النسبة من الصفر - وإلّا اختفت المراحل
  // الأخيرة تماماً في كلّ حسابٍ حقيقيّ (الطلبات جزءٌ من ألفٍ من الظهور).
  const H = 132;
  const MIN = 0.06;
  const edge = (v: number) => (top > 0 ? Math.max(MIN, v / top) * H : MIN * H);

  // مقياسٌ لوغاريتميّ للرسم وحده - **الأرقام المكتوبة تبقى حقيقية.**
  // الخطّيّ يجعل المخروط ينهار إلى خيطٍ بعد المرحلة الثانية، فلا يُقرأ منه
  // شيء. اللوغاريتميّ يُبقي الترتيب والانحدار مرئيّين معاً.
  const logEdge = (v: number) => {
    if (top <= 0) return MIN * H;
    const r = Math.log10(1 + v) / Math.log10(1 + top);
    return Math.max(MIN, r) * H;
  };

  const W = 100;
  const seg = W / (stages.length - 1 || 1);

  return (
    <div className="card pad-lg">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-text-primary">{tr("title")}</span>
      </div>
      <p className="mb-5 text-[12px] leading-5 text-text-muted">{tr("subtitle")}</p>

      {/* صفّ الإحصاءات: كلّ مرحلة عمودٌ باسمها ورقمها وتغيّرها. الأعمدة
          متساوية العرض فتقف كلّ قيمةٍ فوق موضعها في المخروط تحتها. */}
      <div className="no-scrollbar mb-4 flex gap-0 overflow-x-auto">
        {stages.map((s, i) => {
          const unknown = !data.storeConnected && (s.key === "orders" || s.key === "kept");
          const up = (s.changePct ?? 0) >= 0;
          return (
            <div
              key={s.key}
              className="min-w-[7.5rem] flex-1 border-e border-border px-3 last:border-0 first:ps-0"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STAGE_TINT[i] }}
                />
                <span className="truncate text-[12px] text-text-muted">{tr(s.key)}</span>
              </div>

              {unknown ? (
                <div className="text-[13px] text-text-faint">{tr("noStore")}</div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[19px] font-semibold leading-tight text-text-primary">
                      {nf.format(s.value)}
                    </span>
                    {s.changePct !== null && (
                      <span
                        className={`font-mono text-[11px] ${up ? "text-verified" : "text-critical"}`}
                      >
                        {up ? "↑" : "↓"} {Math.abs(s.changePct).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-faint">
                    {tr("vsPrev", { value: nf.format(s.prevValue) })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* المخروط. `preserveAspectRatio="none"` كي يمتدّ بعرض البطاقة أياً
          كان، فتبقى كلّ قطعةٍ تحت عمود إحصاءاتها بالضبط. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[132px] w-full"
        role="img"
        aria-label={tr("title")}
      >
        {stages.slice(0, -1).map((s, i) => {
          const next = stages[i + 1];
          const h1 = logEdge(s.value);
          const h2 = logEdge(next.value);
          const x1 = i * seg;
          const x2 = (i + 1) * seg;
          const weak = next.key === data.weakestStepKey;
          return (
            <g key={s.key}>
              <polygon
                points={`${x1},${(H - h1) / 2} ${x2},${(H - h2) / 2} ${x2},${(H + h2) / 2} ${x1},${(H + h1) / 2}`}
                fill={STAGE_TINT[i]}
                opacity={0.85}
              />
              {/* الانتقال الأضعف وحده معلَّم - وهو الموضع الذي يستحقّ الفعل */}
              {weak && (
                <line
                  x1={x2}
                  y1={(H - h2) / 2 - 6}
                  x2={x2}
                  y2={(H + h2) / 2 + 6}
                  stroke="var(--gap)"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* نسب البقاء تحت كلّ انتقال - الرسم يُري الانحدار، وهذه تقيسه */}
      <div className="mt-2 flex gap-0">
        {stages.slice(1).map((s) => {
          const weak = s.key === data.weakestStepKey;
          const unknown = !data.storeConnected && (s.key === "orders" || s.key === "kept");
          return (
            <div key={s.key} className="min-w-[7.5rem] flex-1 px-3 text-center">
              <span
                className={`text-[11px] ${weak ? "font-medium text-gap" : "text-text-faint"}`}
              >
                {unknown
                  ? "—"
                  : tr("stepKept", {
                      pct: s.keptFromPrevPct === null ? "—" : s.keptFromPrevPct.toFixed(1),
                    })}
                {weak && ` · ${tr("weakest")}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* 🔴 يُقال صراحةً ما ليس في المسار. المرجع يعرض «إضافة للسلّة»
          و«بدء الدفع»، ونحن لا نجمعهما - وسكوتُنا عن ذلك يجعل المستخدم
          يظنّ أنّ مساره كاملٌ وأنّ ما بين النقرة والطلب بلا تفصيل. */}
      <p className="mt-5 border-t border-border pt-3.5 text-[11.5px] leading-relaxed text-text-faint">
        {tr("missingStages")}
      </p>
    </div>
  );
}
