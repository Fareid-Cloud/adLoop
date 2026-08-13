// app/components/ui/HealthGauge.tsx
//
// **عدّاد الصحة - عنصر هوية، لا زينة صفحة واحدة.**
//
// كان محبوساً داخل `DiagnosticsView` بينما بقيّة المنتج يعرض الدرجة نفسها
// كنصّ رمادي ("درجة الصحة — التتبّع وحده مُقاساً حتى الآن")، فيقرأ المستخدم
// رقماً بلا وزن بصري ولا يربطه بالعدّاد الذي رآه في مكان آخر. أي درجة من
// مئة في المنتج تُعرض بهذا الشكل من الآن.
//
// الحجوم الثلاثة تخدم موضعاً مختلفاً: `lg` لبطل صفحة صحة الحساب، `md`
// لبطاقة داخل شبكة، `sm` لصفّ الرأس حيث المساحة سطر واحد. اللون واحد في
// الثلاثة لأن دلالته أهمّ من مقاسه: أخضر مطمئن، كهرماني منتبه، أحمر عاجل.

const SIZES = {
  sm: { box: 36, r: 14, sw: 4, num: 12, sub: 0 },
  md: { box: 88, r: 35, sw: 8, num: 24, sub: 9 },
  lg: { box: 132, r: 52, sw: 11, num: 34, sub: 11 },
} as const;

export type HealthGaugeSize = keyof typeof SIZES;

/** نفس العتبات في كل موضع - درجة تعني الشيء ذاته أينما ظهرت */
export function healthTone(score: number): string {
  return score >= 80 ? "var(--verified)" : score >= 55 ? "var(--gap)" : "var(--critical)";
}

export function HealthGauge({
  score,
  size = "lg",
  showDenominator = true,
}: {
  score: number;
  size?: HealthGaugeSize;
  /** يُخفى في الحجم الصغير حيث لا يتّسع السطر لـ«/ ١٠٠» */
  showDenominator?: boolean;
}) {
  const s = SIZES[size];
  const c = 2 * Math.PI * s.r;
  const tone = healthTone(score);
  const half = s.box / 2;
  const withSub = showDenominator && s.sub > 0;

  return (
    <div className="relative shrink-0" style={{ height: s.box, width: s.box }}>
      <svg viewBox={`0 0 ${s.box} ${s.box}`} className="h-full w-full -rotate-90">
        <circle cx={half} cy={half} r={s.r} fill="none" stroke="var(--surface-raised)" strokeWidth={s.sw} />
        <circle
          cx={half}
          cy={half}
          r={s.r}
          fill="none"
          stroke={tone}
          strokeWidth={s.sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.max(0, Math.min(100, score)) / 100) * c}
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold leading-none"
          style={{ fontSize: s.num, color: tone }}
        >
          {score}
        </span>
        {withSub && (
          <span className="mt-0.5 text-text-muted" style={{ fontSize: s.sub }}>
            / 100
          </span>
        )}
      </div>
    </div>
  );
}
