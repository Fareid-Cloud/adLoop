// جدول "الأداء حسب المصدر" - مستوحى من Cometly، لكن بطبقة الحقيقة بتاعتنا:
// عمود "معلن" (رقم المنصة) جنب عمود "محقّق" (المتحقّق منه فعلاً) - ده الفرق
// الجوهري اللي بيميّزنا. صفوف بهوية كل منصة اللونية + مؤشرات اتجاه.
import { TrendingDown, TrendingUp } from "lucide-react";
import { platformMeta } from "@/lib/platformMeta";

export interface SourceRow {
  platform: string;
  clicks: number;
  rawConversions: number;
  verifiedConversions: number;
  cost: number;
  cplVerified: number | null;
  trend: { verified: number | null; cplVerified: number | null };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// مؤشر اتجاه: lowerIsBetter=true للتكلفة (النزول أخضر)، false للتحويلات
function TrendBadge({ pct, lowerIsBetter }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct === null || pct === 0) return null;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
        good ? "bg-verified/10 text-verified" : "bg-critical/10 text-critical"
      }`}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(pct)}%
    </span>
  );
}

export function SourcePerformanceTable({ rows }: { rows: SourceRow[] }) {
  const sorted = [...rows].sort((a, b) => b.cost - a.cost);

  return (
    <div className="overflow-hidden rounded-2xl card-shadow border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-semibold text-text-primary">الأداء حسب المصدر</h3>
        <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] text-text-muted">آخر 30 يوماً</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-[12px] text-text-faint">
              <th className="px-5 py-2.5 text-start font-medium">المصدر</th>
              <th className="px-3 py-2.5 text-start font-medium">تحويلات معلنة</th>
              <th className="px-3 py-2.5 text-start font-medium">محقّقة ✓</th>
              <th className="px-3 py-2.5 text-start font-medium">الإنفاق</th>
              <th className="px-5 py-2.5 text-start font-medium">تكلفة العميل الحقيقية</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const meta = platformMeta(r.platform);
              return (
                <tr key={r.platform} className="border-t border-border transition-colors hover:bg-surface-raised">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="font-medium text-text-primary">{meta.label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-text-muted">{fmt(r.rawConversions)}</td>
                  <td className="px-3 py-3.5">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-verified">{fmt(r.verifiedConversions)}</span>
                      <TrendBadge pct={r.trend.verified} />
                    </span>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-text-primary">{fmt(Math.round(r.cost))}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-text-primary">{r.cplVerified !== null ? fmt(r.cplVerified) : "—"}</span>
                      <TrendBadge pct={r.trend.cplVerified} lowerIsBetter />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
