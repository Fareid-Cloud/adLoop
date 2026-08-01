"use client";

// app/components/CreditsButton.tsx
//
// زرّ رصيد الذكاء الاصطناعي في الشريط العلوي.
//
// **يعرض الرصيد لا الشراء.** زرّ "اشترِ" دائم في أعلى الشاشة يقرأ كإلحاح
// بيع؛ عدّاد رصيد يقرأ كمعلومة. الشراء يظهر داخله عند الحاجة فقط:
// اللون يهدأ فوق ٢٠٪، ويتحوّل تحذيراً تحتها، ويصير حمراء عند النفاد.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Plus } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function CreditsButton({
  left, total, locale = "ar",
}: {
  left: number;
  total: number;
  locale?: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `plans.${k}`, v);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const pct = total > 0 ? (left / total) * 100 : 0;
  const tone = left === 0 ? "critical" : pct <= 20 ? "gap" : "text-muted";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-[12px]"
        style={{ color: tone === "text-muted" ? "var(--text-muted)" : `var(--${tone})` }}
        title={tr("creditsLow", { left, total })}
      >
        <Zap size={13} />
        <span className="tabular-nums font-medium">{left}</span>
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="pop-shadow absolute top-10 z-50 w-56 rounded-xl border border-border bg-surface p-3"
            style={{ insetInlineEnd: 0 }}
          >
            <div className="mb-1 text-[12px] text-text-muted">{tr("creditsLow", { left, total })}</div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, Math.min(100, pct))}%`,
                  background: tone === "text-muted" ? "var(--verified)" : `var(--${tone})`,
                }}
              />
            </div>
            <button
              onClick={() => { setOpen(false); router.push("/dashboard/billing?credits=1"); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-[12.5px] font-medium text-white"
            >
              <Plus size={13} /> {tr("buyCredits")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
