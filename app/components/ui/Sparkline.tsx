// app/components/ui/Sparkline.tsx
//
// رسمُ اتجاهٍ صغيرٌ داخل بطاقة المؤشّر - **من بياناتٍ حقيقية أو لا يُرسَم.**
//
// 🔴 الرقم وحده يقول «أين أنت»، ولا يقول «إلى أين تسير». وبطاقةٌ تعرض
// «تكلفة العميل ٦٨» لا تُفرّق بين حسابٍ استقرّ عندها وآخر تضاعف فيها هذا
// الأسبوع - وهما حالتان مختلفتان تماماً في القرار.
//
// **ولا يُرسَم شيءٌ عند نقصان البيانات:** خطٌّ من نقطتين أو من قيمٍ متساوية
// شكلٌ بلا معنى، وحضورُه يوحي باتجاهٍ لم يُقَس. الغياب هنا أصدق من رسمٍ
// مطمئنٍ لا يستند إلى شيء.

/** أقلُّ عددِ نقاطٍ يُقرأ منه اتجاه. ما دونها لقطاتٌ لا خطّ. */
const MIN_POINTS = 4;

export function Sparkline({
  values,
  tone = "accent",
  height = 28,
}: {
  values: number[];
  /** لونٌ دلاليّ يتبع معنى المؤشّر لا ذوقاً: المتحقَّق أخضر، والفجوة برتقالية */
  tone?: "accent" | "verified" | "gap" | "critical";
  height?: number;
}) {
  if (values.length < MIN_POINTS) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  // كلُّ القيم متساوية: لا اتجاه يُرسَم، والخطُّ المستقيم في المنتصف يوحي
  // باستقرارٍ قد يكون في الحقيقة غيابَ بيانات.
  if (max === min) return null;

  const W = 100;
  const H = height;
  const pad = 2;
  const span = max - min;
  const step = W / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = i * step;
    // مقلوب: الأعلى قيمةً هو الأعلى موضعاً، و`y` تنمو لأسفل في SVG.
    const y = pad + (1 - (v - min) / span) * (H - pad * 2);
    return `${x},${y}`;
  });

  const stroke = `var(--${tone})`;
  const last = values[values.length - 1];
  const lastX = W;
  const lastY = pad + (1 - (last - min) / span) * (H - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H }}
      aria-hidden
    >
      {/* مساحةٌ باهتة تحت الخطّ: تعطي الخطَّ وزناً في مساحةٍ بهذا الصغر
          دون أن يصير رسماً بيانياً يزاحم الرقم فوقه. */}
      <polygon
        points={`0,${H} ${pts.join(" ")} ${W},${H}`}
        fill={stroke}
        opacity={0.1}
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // بدونه يُشوّه `preserveAspectRatio="none"` سُمكَ الخطّ مع تمدّد العرض
        vectorEffect="non-scaling-stroke"
      />
      {/* النقطة الأخيرة معلَّمة: هي «الآن»، وبها يُقرأ الخطّ اتجاهاً منتهياً
          إلى الرقم المعروض فوقه لا شكلاً عائماً. */}
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
