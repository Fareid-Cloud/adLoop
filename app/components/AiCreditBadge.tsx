// app/components/AiCreditBadge.tsx
//
// رصيد التحليلات الذكية في الهيدر: يعرض المتبقي من حصة الشهر، ويوفّر
// طريقاً مباشراً للترقية عند اقترابه من النفاد - بدل أن يفاجئ المستخدمَ
// رفضٌ عند الضغط على زر التحليل دون أن يعرف السبب مسبقاً.

import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";

export function AiCreditBadge({
  remaining,
  total,
  locale = "ar",
}: {
  remaining: number;
  total: number;
  locale?: "ar" | "en";
}) {
  const ar = locale === "ar";
  const pct = total > 0 ? (remaining / total) * 100 : 0;

  // لون دلالي: أخضر مريح، برتقالي عند الربع الأخير، أحمر عند النفاد
  const tone = remaining === 0 ? "var(--critical)" : pct <= 25 ? "var(--gap)" : "var(--verified)";

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/dashboard/billing"
        title={ar ? "رصيد التحليلات الذكية لهذا الشهر" : "This month's AI analysis credit"}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 no-underline"
      >
        <Sparkles size={14} style={{ color: tone }} />
        <span className="font-mono text-[12.5px] font-medium" style={{ color: tone }}>
          {remaining}
        </span>
        <span className="text-[11px] text-text-faint">/ {total}</span>
      </Link>

      <Link
        href="/dashboard/billing?credits=1"
        title={ar ? "شراء رصيد أو ترقية الباقة" : "Buy credit or upgrade plan"}
        aria-label={ar ? "شراء رصيد" : "Buy credit"}
        className="flex items-center justify-center rounded-xl border border-border bg-surface p-1.5 text-text-muted no-underline hover:text-accent"
      >
        <Plus size={14} />
      </Link>
    </div>
  );
}
