// app/components/ui/TrackingAccuracyGauge.tsx
//
// عداد دائري "نسبة تطابق التتبع" - نفس فكرة عداد الفجوة (رقمين جنب
// بعض)، لكن بعرض بصري تفاعلي. مبني على بيانات حقيقية فعلاً.

export function TrackingAccuracyGauge({
  verified,
  raw,
  size = 140,
}: {
  verified: number;
  raw: number;
  size?: number;
}) {
  const pct = raw > 0 ? Math.min(100, Math.round((verified / raw) * 100)) : 0;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = pct >= 80 ? "var(--verified)" : pct >= 50 ? "var(--gap)" : "var(--critical)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-visible)" strokeWidth="10" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold text-text-primary">{raw > 0 ? `${pct}%` : "—"}</span>
        </div>
      </div>
      <span className="text-xs text-text-muted">نسبة تطابق التتبع</span>
    </div>
  );
}
