// app/components/ui/Skeleton.tsx
//
// شكل تحميل موحّد - بدل ما كل صفحة تخترع "جاري التحميل..." بشكل مختلف.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-card bg-surface-raised ${className}`}
      style={{ animationDuration: "1.4s" }}
    />
  );
}

// شكل جاهز لبطاقة مقياس وهي بتحمّل - يُستخدم بدل MetricCard وقت التحميل
export function MetricCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-7 w-16" />
    </div>
  );
}
