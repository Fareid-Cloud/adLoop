// app/components/ui/TrustNumber.tsx
//
// العنصر البصري المحوري لاتجاه "الشاهد" - جوهر المنتج كله هو "نتحقق
// بدل ما نصدّق الأرقام"، فالفكرة إن أي رقم في الواجهة يوريك بصرياً
// مستوى الثقة فيه من أول نظرة، مش تفصيلة مدفونة في صفحات معيّنة.
//
// متحقق: وزن أثقل شوية + علامة ✓ خضراء صغيرة.
// خام/غير مؤكد: وزن أخف + خط تحت متقطع + شفافية أقل شوية.

export function TrustNumber({
  value,
  verified,
  className = "",
}: {
  value: string | number;
  verified: boolean;
  className?: string;
}) {
  if (verified) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono font-semibold text-text-primary ${className}`}>
        {value}
        <span className="text-[0.7em] text-verified" title="رقم متحقق منه فعلياً">✓</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 border-b border-dashed border-text-faint font-mono text-text-muted opacity-80 ${className}`}
      title="رقم مُبلَّغ من المنصة — لم يُتحقق منه بعد"
    >
      {value}
    </span>
  );
}
