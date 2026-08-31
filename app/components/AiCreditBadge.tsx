// app/components/AiCreditBadge.tsx
//
// رصيد التحليلات الذكية في الهيدر: يعرض المتبقي من حصة الشهر، ويوفّر
// طريقاً مباشراً للترقية عند اقترابه من النفاد - بدل أن يفاجئ المستخدمَ
// رفضٌ عند الضغط على زر التحليل دون أن يعرف السبب مسبقاً.

import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function AiCreditBadge({
  remaining,
  total,
  locale,
}: {
  remaining: number;
  total: number;
  locale: "ar" | "en";
}) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;

  // لون دلالي: أخضر مريح، برتقالي عند الربع الأخير، أحمر عند النفاد
  const tone = remaining === 0 ? "var(--critical)" : pct <= 25 ? "var(--gap)" : "var(--verified)";

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/dashboard/billing"
        title={t(locale, "aiCredit.label")}
        className="btn btn-secondary btn-sm"
      >
        <Sparkles size={14} style={{ color: tone }} />
        {/* 🔴 **النسبة تنقلب في العربية.** الرقمان صندوقان سطريّان منفصلان،
            فيصفّهما `dir="rtl"` من اليمين: يقرأ صاحبُ الحساب «٢٠٠٠ / ١٩٩١»
            أي أنّه استهلك ألفين من ألفٍ وتسعمئة وواحدٍ وتسعين - رقمٌ مقلوب
            عن حصّةٍ يدفع ثمنها. النسبة وحدة واحدة تُقرأ من اليسار دائماً،
            كالمعادلة والتاريخ - فتُلَفّ في `bdi` باتّجاهٍ صريح. */}
        <bdi dir="ltr" className="flex items-center gap-1">
          <span className="font-mono text-[12.5px] font-medium" style={{ color: tone }}>
            {remaining}
          </span>
          <span className="text-[11px] text-text-faint">/ {total}</span>
        </bdi>
      </Link>

      <Link
        href="/dashboard/billing?credits=1"
        title={t(locale, "aiCredit.buyOrUpgrade")}
        aria-label={t(locale, "aiCredit.buy")}
        className="flex items-center justify-center card p-1.5 text-text-muted no-underline hover:text-accent"
      >
        <Plus size={14} />
      </Link>
    </div>
  );
}
