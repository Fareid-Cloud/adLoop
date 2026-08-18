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

import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { StoreFunnel as FunnelData } from "@/lib/storeFunnel";

/** لونُ كلّ مرحلة - نفسه في نقطة العمود وفي قطعة المخروط تحتها، فالعين
 *  تربط الرقم برسمه بلا مفتاحٍ منفصل. */
// 🔴 الثانية والثالثة كانتا `#DB2777` و`#E11D48` - ورديّتان متجاورتان في
// عجلة اللون، فتتداخلان حيث تلتقيان ويصعب فصلُ المرحلتين بالنظر. الثانية
// دُفعت نحو الأرجوانيّ والثالثة نحو الأحمر، فبينهما الآن مسافةٌ تُقرأ.
const TINT = ["#2563EB", "#C026D3", "#F43F5E", "#F97316", "#16A34A"];

/** نقاطٌ داخل قطعة المخروط. عددُها يتبع ارتفاع القطعة، فتخفّ الكثافة مع
 *  الضيق - وهي الإشارة البصرية التي تجعل الفقد محسوساً قبل قراءة نسبة. */
// `cols` على محور الطول و`rows` على محور الاتّساع - يُمرَّران لأنّ النسخة
// الرأسية تبدّل نسبة المحورين: قطعةٌ قصيرةٌ عريضة تحتاج صفوفاً أكثر وأعمدةً
// أقلّ لتبقى الكثافة كما هي. القيم الافتراضية هي أرقام النسخة الأفقية.
function dots(
  x1: number,
  x2: number,
  h1: number,
  h2: number,
  seed: number,
  mid: number,
  cols = 7,
  rows = 5
) {
  const out: Array<{ cx: number; cy: number }> = [];
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

/** 🔴 **الرسم بعرض الصفحة كان يُفقده شكلَه:** مخروطٌ ممتدٌّ على ١٤٠٠ بكسل
 *  يصير شريطاً مسطّحاً، والانحدارُ الذي هو كلّ معناه لا يُقرأ. الثلثان
 *  يعيدان له نسبتَه، والثلث الباقي يحمل ما يُفعَل بما يقوله. */
export function StoreFunnel({ data, locale }: { data: FunnelData; locale: Locale }) {
  const tr = (k: string, v?: Record<string, string | number>) =>
    t(locale, `shopFunnel.${k}`, v);
  const loc = locale === "ar" ? "ar-EG" : "en-US";

  const compact = new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 });

  const stages = data.stages;
  const top = stages[0]?.value ?? 0;

  // 🔴 **بلا بيانات كان الشكل يُرسَم على أيّ حال.** المقياس اللوغاريتميّ
  // يعطي كلّ مرحلةٍ أدنى ارتفاعٍ حين يكون المجموع صفراً، فيخرج شريطٌ
  // مسطّحٌ معلَّقةٌ عليه أصفار - يُقرأ **معطّلاً** لا فارغاً، ويجعل
  // المشترك يظنّ أنّ الصفحة مكسورة لا أنّ متجره لم يستقبل طلباً بعد.
  //
  // والفراغ يُقال بالكلام، ومعه خطوته التالية: هذا المسار يحتاج وسم
  // التتبّع على الموقع، لا مجرّد ربط متجر.
  if (!stages.some((s) => s.value > 0)) {
    return (
      <EmptyState
        title={tr("emptyTitle")}
        description={tr("emptyReason")}
        action={
          <a href="/dashboard/settings" className="btn btn-ghost">
            {tr("emptyAction")}
          </a>
        }
      />
    );
  }

  const W = 1000;
  const H = 210;
  const MID = H / 2;
  // 🔴 **الفوهة بيضاويٌّ كامل، والجسم يبدأ من مركزه.**
  //
  // رسمتُها مرّتين خطأً: مرّةً نصفَ بيضاويٍّ بحافّةٍ مستقيمة (فبدت قرصاً
  // ملصوقاً لا فوهةَ أنبوب)، ومرّةً بيضاوياً كاملاً فوق الجسم (فظهرت نقاطُه
  // من خلاله وبقي حرفُ المضلّع خلفه).
  //
  // والمرجع يفعل شيئاً واحداً: بيضاويٌّ كامل، **ونصفُه الأيمن يختفي تحت
  // الجسم** لأنّ الجسم يبدأ من مركزه لا من طرفه. فيُقرأ الشكل أنبوباً
  // منظوراً من فوهته - وهو ما يعطي الإيحاء المجسَّم.
  const CAP = (W / stages.length) * 0.16;
  const seg = (W - CAP) / stages.length;
  // مقياسٌ لوغاريتميّ للرسم وحده - **الأرقام المكتوبة تبقى حقيقية.** الخطّيّ
  // ينهار إلى خيطٍ بعد المرحلة الثانية (الطلبات جزءٌ من ألفٍ من الظهور)،
  // فلا يبقى في الشكل ما يُقرأ.
  //
  // 🔴 **مصدرٌ واحد للمقياس، يخدم الاتّجاهين.** الرسم يُدار على الشاشات
  // الضيّقة ولا يُعاد تصميمه، فلو بقي لكلّ اتّجاهٍ حسابُه انحرف أحدهما عن
  // الآخر عند أوّل تعديل - ونسبةُ الاتّساع هي كلّ ما يختلف بينهما.
  const spanRatio = (v: number) => {
    if (top <= 0) return 0.08;
    return Math.max(0.08, Math.log10(1 + v) / Math.log10(1 + top));
  };
  const height = (v: number) => spanRatio(v) * (H - 12);

  // ═══ مقاس الهاتف (تحت sm) ═══
  //
  // 🔴 **المحاولتان السابقتان فشلتا للسبب نفسه: الإصرار على إلصاق رقم
  // المرحلة بقطعتها.** هذا الشرط وحده لا يترك إلّا خيارين رديئين: شريطٌ
  // بعرض سبعين بكسلاً فيضيع الانحدار الذي هو معنى الرسمة، أو نصٌّ فوق
  // الرسم بلوحاتٍ معتمة فتصير صناديق مركونةً على خلفية.
  //
  // **فالحلّ فكُّ الشرط لا الالتفاف عليه.** المخروط يبقى أفقيّاً كما هو،
  // بعرض البطاقة، **بنصف الارتفاع** - فتبقى نسبته نسبة الديسكتوب نفسها
  // (٧٠٥×٢١٠ ≈ ٣٫٤:١ مقابل ٣٣٠×١٠٥) ويُقرأ **المخروط نفسه مصغَّراً**، لا
  // شكلاً آخر. والأرقام تنزل تحته قائمةً بصفوفٍ كاملة العرض.
  //
  // والربط بين الرقم ورسمه تحمله **نقطة اللون** - وهو جهاز التصميم
  // الأصليّ نفسه، لا حيلةً استُحدثت هنا.
  //
  // 🔴 **ومحور الطول أقصر، وإلّا صارت النقاط شُرَطاً.** الرسم يُمدَّد
  // بـ`preserveAspectRatio="none"`، فإن باعدت نسبةُ الـviewBox نسبةَ
  // الصندوق المرسوم فيه انسحقت الدائرة إلى بيضاويّ. الديسكتوب ٧٠٥×٢١٠
  // (٣٫٤:١) قريبٌ من viewBox ١٠٠٠×٢١٠ (٤٫٨:١) فالفرق لا يكاد يُرى؛ أمّا
  // ٢٨٥×١٠٦ على الهاتف (٢٫٧:١) فيسحق النقطة إلى ضعف طولها. وبطولٍ ٥٢٠
  // تصير النسبة ٢٫٥:١ - أي مطابقةً تقريباً، فتبقى النقطة نقطة.
  const WM = 520;
  const CAPM = (WM / stages.length) * 0.16;
  const SEGM = (WM - CAPM) / stages.length;

  const money = (v: number) =>
    new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(Math.round(v));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
    <div className="card pad-lg lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold text-text-primary">{tr("title")}</span>
        <span className="text-[11.5px] text-text-muted">{tr("subtitle")}</span>
      </div>

      {/* ═══ الأفقيّ - من sm فما فوق ═══
          🔴 خمس مراحل على ٣٦٠ بكسل تعني **عموداً بستّةٍ وثلاثين بكسلاً
          للنصّ**: الأسماء تُقصّ إلى حرفين، والرقم بحجم ٢٤ أوسع من عموده
          فيركب جاره، وشارة التغيّر تنطّ تحته وتغطّيه. لا يُعالَج بتصغير
          مقاسات - يُعالَج بتبديل المحور. */}
      <div className="hidden sm:block">
      {/* الصفّ العلويّ - أعمدةٌ متساوية تقف كلٌّ منها فوق قطعتها */}
      <div className="no-scrollbar mb-5 grid grid-cols-5" style={{ paddingInlineStart: `${(CAP / W) * 100}%` }}>
        {stages.map((s, i) => {
          const up = (s.changePct ?? 0) >= 0;
          const diff = s.value - s.prevValue;
          // 🔴 مرحلةٌ لا يبلّغ عنها الحساب تُعرَض غياباً لا صفراً. الصفر
          // بجانب طلباتٍ قائمة تناقضٌ صريح - لا يبلغ أحدٌ طلباً دون سلّة -
          // فيقرؤه المالك عطلاً في المنتج، وهو في الحقيقة فئةُ تحويلٍ غير
          // معرَّفةٍ في الحساب الإعلانيّ.
          if (!s.measured) {
            return (
              <div
                key={s.key}
                className="min-w-0 border-e border-border px-3 last:border-0"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full opacity-35"
                    style={{ background: TINT[i] }}
                  />
                  <span className="truncate text-[12.5px] font-medium text-text-muted">
                    {tr(s.key)}
                  </span>
                </div>
                <div className="text-[15px] font-medium text-text-faint">{tr("notMeasured")}</div>
                {/* السببان مختلفان، وكذلك العلاج. الرسالة تقول أيَّهما هو
                    وتُنهي بالخطوة التالية بدل أن تصف عطلاً وتسكت. */}
                <div className="mt-1.5 text-[11px] leading-relaxed text-text-faint">
                  {data.trackingLive ? tr("notMeasuredEvent") : tr("notMeasuredNoTracking")}
                </div>
              </div>
            );
          }
          return (
            <div
              key={s.key}
              className="min-w-0 border-e border-border px-3 last:border-0"
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
                  {money(s.costPer)} {data.currency} · {tr("each")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* المخروط - `chart-flip-rtl` يقلبه مع اتّجاه القراءة ليقف تحت
          عناوينه لا معكوساً عنها. الشرح في `theme.css` عند القاعدة. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="chart-flip-rtl h-[210px] w-full"
        role="img"
        aria-label={tr("title")}
      >
        {/* 🔴 **فوهةُ المخروط - وهي ما يجعله مخروطاً لا شبه منحرف.**
            قُصٌّ بيضويّ عند الطرف الأوّل، نصفُه ظاهرٌ خارج القطعة الأولى:
            يقرأه النظر عمقاً، فيبدو الشكل أنبوباً يضيق لا مضلّعاً مسطّحاً.
            وهو أوّل ما يُرى، فغيابه كان يُفقد الرسم صفته كلَّها. */}
        {stages.map((s, i) => {
          const next = stages[i + 1];
          const h1 = height(s.value);
          const h2 = height(next ? next.value : s.value * 0.9);
          const x1 = CAP + i * seg;
          const x2 = CAP + (i + 1) * seg;
          const weak = s.key === data.weakestStepKey;
          return (
            <g key={s.key}>
              <polygon
                points={`${x1},${MID - h1 / 2} ${x2},${MID - h2 / 2} ${x2},${MID + h2 / 2} ${x1},${MID + h1 / 2}`}
                fill={TINT[i]}
                opacity={s.measured ? 0.13 : 0.05}
              />
              {s.measured &&
                dots(i === 0 ? CAP : x1, x2, h1, h2, i + 1, MID).map((d, n) => (
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
        <ellipse
          cx={CAP}
          cy={MID}
          rx={CAP}
          ry={height(stages[0]?.value ?? 0) / 2}
          fill={TINT[0]}
        />
      </svg>

      {/* نسب البقاء - الرسم يُري الانحدار، وهذه تقيسه */}
      <div className="mt-1 grid grid-cols-5" style={{ paddingInlineStart: `${(CAP / W) * 100}%` }}>
        {stages.map((s, i) => {
          const weak = s.key === data.weakestStepKey;
          return (
            <div key={s.key} className="min-w-0 px-3 text-center">
              {i > 0 && s.keptFromPrevPct !== null && (
                <span className={`text-[11px] ${weak ? "font-medium text-gap" : "text-text-faint"}`}>
                  {tr("stepKept", { pct: s.keptFromPrevPct.toFixed(1) })}
                  {weak && ` · ${tr("weakest")}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* ═══ الهاتف - تحت sm ═══ */}
      <div className="sm:hidden">
        {/* المخروط نفسه بحذافيره: المقياس نفسه، والنقاط بالبذور نفسها،
            والفوهة ونصفها خلف الجسم، والخطّ المتقطّع للأضعف. الارتفاع وحده
            نصفُ ارتفاعه، فتبقى النسبة نسبة الديسكتوب. */}
        <svg
          viewBox={`0 0 ${WM} ${H}`}
          preserveAspectRatio="none"
          className="chart-flip-rtl mb-4 h-[106px] w-full"
          role="img"
          aria-label={tr("title")}
        >
          {stages.map((s, i) => {
            const next = stages[i + 1];
            const h1 = height(s.value);
            const h2 = height(next ? next.value : s.value * 0.9);
            const x1 = CAPM + i * SEGM;
            const x2 = CAPM + (i + 1) * SEGM;
            const weak = s.key === data.weakestStepKey;
            return (
              <g key={s.key}>
                <polygon
                  points={`${x1},${MID - h1 / 2} ${x2},${MID - h2 / 2} ${x2},${MID + h2 / 2} ${x1},${MID + h1 / 2}`}
                  fill={TINT[i]}
                  opacity={s.measured ? 0.16 : 0.05}
                />
                {s.measured &&
                  dots(i === 0 ? CAPM : x1, x2, h1, h2, i + 1, MID, 4, 4).map((d, n) => (
                    <circle key={n} cx={d.cx} cy={d.cy} r={5} fill={TINT[i]} opacity={0.85} />
                  ))}
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
          <ellipse
            cx={CAPM}
            cy={MID}
            rx={CAPM}
            ry={height(stages[0]?.value ?? 0) / 2}
            fill={TINT[0]}
          />
        </svg>

        {/* القائمة: صفٌّ كامل العرض لكلّ مرحلة، بلا قصٍّ ولا تراكب */}
        <div className="divide-y divide-border">
          {stages.map((s, i) => {
            const up = (s.changePct ?? 0) >= 0;
            const diff = s.value - s.prevValue;
            const weak = s.key === data.weakestStepKey;
            return (
              <div key={s.key} className="py-2.5">
                {i > 0 && s.keptFromPrevPct !== null && (
                  <div className={`mb-1 text-[11px] ${weak ? "font-medium text-gap" : "text-text-faint"}`}>
                    {tr("stepKept", { pct: s.keptFromPrevPct.toFixed(1) })}
                    {weak && ` · ${tr("weakest")}`}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.measured ? "" : "opacity-35"}`}
                      style={{ background: TINT[i] }}
                    />
                    <span
                      className={`text-[13px] font-medium ${s.measured ? "text-text-primary" : "text-text-muted"}`}
                    >
                      {tr(s.key)}
                    </span>
                  </div>

                  {s.measured ? (
                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className="font-mono text-[20px] font-bold leading-none text-text-primary">
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
                  ) : (
                    <span className="shrink-0 text-[13px] font-medium text-text-faint">
                      {tr("notMeasured")}
                    </span>
                  )}
                </div>

                {s.measured ? (
                  <div className="mt-1 text-[11px] text-text-faint">
                    {diff >= 0 ? "+" : "−"}
                    {compact.format(Math.abs(diff))} {tr("vsPrev")}
                    {s.costPer !== null && (
                      <span className="font-mono text-text-muted">
                        {" · "}
                        {money(s.costPer)} {data.currency} {tr("each")}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] leading-relaxed text-text-faint">
                    {data.trackingLive ? tr("notMeasuredEvent") : tr("notMeasuredNoTracking")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!data.storeConnected && (
        <p className="mt-5 border-t border-border pt-3.5 text-[11.5px] leading-relaxed text-text-faint">
          {tr("noStoreNote")}
        </p>
      )}
    </div>

    {/* ═══ الثلث: أكبر تسرّب ═══
        الرسم يقول «أين يضيق»، وهذا يقول «كم يكلّفك ذلك» - وهو ما يُفعَل به
        شيء. وأكبرُ تسرّبٍ **بالعدد** لا بالنسبة: انتقالٌ يُبقي ٣٪ من مليون
        يخسر أكثر ممّن يُبقي ١٥٪ من ألف، والقرار يتبع الأثر لا النسبة. */}
    <div className="card pad-lg flex flex-col">
      <div className="mb-1 text-[13px] font-medium text-text-primary">{tr("leakTitle")}</div>

      {data.biggestLeak === null ? (
        <p className="text-[12px] leading-relaxed text-text-muted">{tr("leakNone")}</p>
      ) : (
        <>
          <p className="mb-4 text-[11.5px] leading-5 text-text-muted">{tr("leakSub")}</p>

          <div className="mb-1 text-[12.5px] text-text-muted">
            {tr(`before_${data.biggestLeak.stageKey}`)}
          </div>
          <div className="font-mono text-[30px] font-bold leading-none text-gap">
            {compact.format(data.biggestLeak.lost)}
          </div>
          <div className="mt-1.5 text-[12px] text-text-muted">{tr("leakLost")}</div>

          {data.biggestLeak.wastedSpend !== null && (
            <div className="mt-4 rounded-xl border border-gap/30 bg-gap/[0.07] p-3">
              <div className="text-[11.5px] text-text-muted">{tr("leakCostLabel")}</div>
              <div className="mt-0.5 font-mono text-[17px] font-semibold text-text-primary">
                {money(data.biggestLeak.wastedSpend)} {data.currency}
              </div>
            </div>
          )}

          <p className="mt-auto pt-4 text-[11.5px] leading-relaxed text-text-faint">
            {tr(`leakHint_${data.biggestLeak.stageKey}`)}
          </p>
        </>
      )}
    </div>
    </div>
  );
}
