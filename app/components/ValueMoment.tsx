"use client";

// app/components/ValueMoment.tsx
//
// اللحظة الأولى التي يرى فيها المستخدم الفجوة بين ما تقوله المنصة والحقيقة.
// بيظهر بعد أول مزامنة ناجحة - الأرقام بتتحرك substages:
//   1) الرقم المعلَن من المنصة (FADE IN)
//   2) الرقم الحقيقي المتحقق (SLIDE UP)
//   3) الفجوة بينهم (PULSE)
//
// الهدف: المستخدم يفهم قيمة AdLoop في 3 ثواني من غير شرح.
// مبنيّ بحركات CSS لا بـ`framer-motion`.
//
// وكان التعليق هنا يقول إنّها «غير موجودة في المشروع»، ثمّ أُضيفت إلى
// `package.json` ولم تُستورَد في سطرٍ واحد - فصار الوصف يكذب على قارئه.
// هي اليوم تبعيّةٌ قائمةٌ بلا مستعمِل (٥٫٤ ميجابايت).

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, TrendingDown, ArrowUp, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface ValueMomentProps {
  reportedConversions: number;
  verifiedConversions: number;
  currency?: string;
  locale: Locale;
  onDismiss: () => void;
}

export function ValueMoment({
  reportedConversions,
  verifiedConversions,
  locale,
  onDismiss,
}: ValueMomentProps) {
  const ar = locale === "ar";
  const [stage, setStage] = useState(0);
  const [visible, setVisible] = useState(true);

  const gap = reportedConversions - verifiedConversions;
  const gapPct = reportedConversions > 0
    ? Math.round((gap / reportedConversions) * 100)
    : 0;

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 800),
      setTimeout(() => setStage(2), 2200),
      setTimeout(() => setStage(3), 3400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  }, [onDismiss]);

  if (!visible) return null;

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="vm-overlay fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="vm-card pop-shadow w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-text-faint hover:bg-surface-raised hover:text-text-primary"
        >
          <X size={16} />
        </button>

        {/* Stage 1: Reported number */}
        {stage >= 1 && (
          <div className="vm-reveal mb-4">
            <p className="mb-2 text-[13px] text-text-muted">
              {t(locale, "valueMoment.thePlatformSaysYou")}
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[42px] font-bold tabular-nums text-gap">
                {fmt(reportedConversions)}
              </span>
              <span className="text-[14px] text-text-muted">
                {t(locale, "valueMoment.conversions")}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-text-faint">
              {t(locale, "valueMoment.reportedByPlatform")}
            </p>
          </div>
        )}

        {/* Stage 2: Verified number */}
        {stage >= 2 && (
          <div className="vm-slide-up mb-4">
            <div className="mx-auto mb-2 h-px w-16 bg-border" />
            <p className="mb-2 text-[13px] text-text-muted">
              {t(locale, "valueMoment.butTheTruthIs")}
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[42px] font-bold tabular-nums text-verified">
                {fmt(verifiedConversions)}
              </span>
              <span className="text-[14px] text-text-muted">
                {t(locale, "valueMoment.verifiedConversions")}
              </span>
              <ShieldCheck size={20} className="text-verified" />
            </div>
            <p className="mt-1 text-[12px] text-text-faint">
              {t(locale, "valueMoment.fromRealWhatsappMessages")}
            </p>
          </div>
        )}

        {/* Stage 3: The gap */}
        {stage >= 3 && (
          <div className="vm-pop">
            <div className="mx-auto mb-3 h-px w-16 bg-border" />

            {/* Gap meter */}
            <div className="mx-auto mb-3 max-w-xs">
              <div className="relative h-3 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="vm-bar absolute inset-y-0 start-0 rounded-full bg-verified"
                  style={{ "--bar-width": `${Math.max(5, 100 - gapPct)}%` } as React.CSSProperties}
                />
                <div
                  className="vm-bar absolute inset-y-0 end-0 rounded-full bg-gap/30"
                  style={{
                    "--bar-width": `${gapPct}%`,
                    borderInlineEnd: "2px solid var(--gap)",
                  } as React.CSSProperties}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] tabular-nums">
                <span className="text-verified">{fmt(verifiedConversions)} ✓</span>
                <span className="text-gap">{fmt(gap)} {t(locale, "valueMoment.reportedOnly")}</span>
              </div>
            </div>

            <div className="vm-pop rounded-2xl border border-gap/30 bg-gap/[0.06] p-4">
              <div className="mb-1 flex items-center justify-center gap-2">
                <TrendingDown size={18} className="text-gap" />
                <span className="text-[15px] font-bold text-gap">
                  {gapPct}% {t(locale, "valueMoment.gap")}
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-text-muted">
                {ar
                  ? `المنصة ادّعت ${fmt(reportedConversions)} تحويل، لكن فعلياً وصل ${fmt(verifiedConversions)} بس. الفجوة دي ${fmt(gap)} تحويل المنصة حسبتهم وهميّين.`
                  : `The platform claimed ${fmt(reportedConversions)} conversions, but only ${fmt(verifiedConversions)} were real. That's ${fmt(gap)} conversions the platform counted that never happened.`}
              </p>
            </div>

            <button
              onClick={dismiss}
              className="btn btn-primary mt-5 w-full vm-pop-delayed"
            >
              {t(locale, "valueMoment.letSGoSee")}
              <ArrowUp size={15} className="rtl:rotate-0 ltr:rotate-180" />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .vm-overlay { animation: vmFadeIn .3s ease-out; }
        .vm-card { animation: vmScaleIn .4s cubic-bezier(.16,1,.3,1); }
        .vm-reveal { animation: vmFadeUp .5s ease-out both; }
        .vm-slide-up { animation: vmSlideUp .6s cubic-bezier(.16,1,.3,1) both; }
        .vm-pop { animation: vmPop .5s cubic-bezier(.16,1,.3,1) both; }
        .vm-pop-delayed { animation: vmPop .5s cubic-bezier(.16,1,.3,1) 1.2s both; }
        .vm-bar { animation: vmBarGrow 1s cubic-bezier(.16,1,.3,1) .2s both; width: var(--bar-width); }

        @keyframes vmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vmScaleIn { from { opacity: 0; transform: scale(.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes vmFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vmSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vmPop { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes vmBarGrow { from { width: 0; } to { width: var(--bar-width); } }

        @media (prefers-reduced-motion: reduce) {
          .vm-overlay, .vm-card, .vm-reveal, .vm-slide-up,
          .vm-pop, .vm-pop-delayed, .vm-bar { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
