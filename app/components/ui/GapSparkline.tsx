// app/components/ui/GapSparkline.tsx
//
// **خطّان في رسمٍ واحد: ما تقوله المنصّة، وما تحقّق فعلاً.**
//
// 🔴 هذه ليست بطاقةَ مؤشّرٍ أخرى - هي **المنتج نفسه مرسوماً**. كلّ ما
// في AdLoop يشرح فارقاً بين رقمين، ولم تكن هناك رسمةٌ واحدة تجيب
// السؤال الذي يليه مباشرةً: **هل الفارق يتّسع أم يضيق؟**
//
// رقمان في بطاقتين متجاورتين («٣٨» و«٩٦») يقولان أنّ الفجوة قائمة اليوم،
// ولا يقولان إن كانت تنفرج أو تُغلَق - وهو الفارق بين «حسابٌ يتحسّن
// تتبّعُه» و«حسابٌ يفلت منه». والمسافة بين الخطّين هي الجواب، تُقرأ
// بالعين بلا رقم.
//
// **ولا يُرسَم إلّا بما قِيس:** الخطّان من النافذة المنزلقة نفسها، فإن
// قصُرت البيانات عن نافذةٍ كاملة لم يُرسَم شيء. وخطٌّ من نقطتين يوحي
// باتّجاهٍ لم يُقَس.

const MIN_POINTS = 4;

export function GapSparkline({
  reported,
  verified,
  height = 34,
}: {
  /** ما تقوله المنصّة - يُرسَم باهتاً: هو المرجع لا البطل */
  reported: number[];
  /** ما تحقّق فعلاً - يُرسَم بلون التحقّق */
  verified: number[];
  height?: number;
}) {
  const n = Math.min(reported.length, verified.length);
  if (n < MIN_POINTS) return null;

  const a = reported.slice(-n);
  const b = verified.slice(-n);

  // مقياسٌ واحد للخطّين: مقياسان مستقلّان يجعلان الخطّين متلاصقين مهما
  // تباعدت قيمتاهما - أي يُخفيان الفجوة التي رُسمت الرسمة لإظهارها.
  const all = [...a, ...b];
  const max = Math.max(...all);
  const min = Math.min(...all);
  if (max === min) return null;

  const W = 100;
  const H = height;
  const pad = 3;
  const span = max - min;
  const step = W / (n - 1);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const pts = (s: number[]) => s.map((v, i) => `${i * step},${y(v)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H }}
      aria-hidden
    >
      {/* المساحة بين الخطّين هي الفجوة - تُملأ لتُقرأ مساحةً لا مسافةً
          بين خطّين، فيتّضح اتّساعها وضيقها بلا قراءة أرقام. */}
      <polygon
        points={`${pts(a)} ${pts(b).split(" ").reverse().join(" ")}`}
        fill="var(--gap)"
        opacity={0.16}
      />
      <polyline
        points={pts(a)}
        fill="none"
        stroke="var(--text-faint)"
        strokeWidth={1.25}
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts(b)}
        fill="none"
        stroke="var(--verified)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={W} cy={y(b[n - 1])} r={2.2} fill="var(--verified)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
