// app/components/ui/ReportedVsActualBars.tsx
//
// مقارنة بصرية عمودية بين المُبلَّغ والمؤكد - نفس منطق عداد الفجوة،
// بس بعرض أعمدة بدل رقمين. مبني على بيانات حقيقية.

export function ReportedVsActualBars({ reported, actual }: { reported: number; actual: number }) {
  const max = Math.max(reported, actual, 1);
  const reportedHeightPct = (reported / max) * 100;
  const actualHeightPct = (actual / max) * 100;

  return (
    <div className="flex items-end justify-center gap-6 px-4" style={{ height: 120 }}>
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-24 w-14 items-end rounded-lg bg-surface-raised">
          <div
            className="w-full rounded-lg bg-gap transition-[height] duration-700 ease-out"
            style={{ height: `${reportedHeightPct}%` }}
          />
        </div>
        <span className="font-mono text-sm text-text-primary">{reported}</span>
        <span className="text-[11px] text-text-faint">مُبلَّغ</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-24 w-14 items-end rounded-lg bg-surface-raised">
          <div
            className="w-full rounded-lg bg-verified transition-[height] duration-700 ease-out"
            style={{ height: `${actualHeightPct}%` }}
          />
        </div>
        <span className="font-mono text-sm text-text-primary">{actual}</span>
        <span className="text-[11px] text-text-faint">مؤكد فعلياً</span>
      </div>
    </div>
  );
}
