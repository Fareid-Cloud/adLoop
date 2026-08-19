"use client";

// app/components/GuidedTour.tsx
//
// جولة تعريفية تفاعلية لأول مستخدم يفتح الداشبورد.
// كل خطوة بتميّز عنصر في الواجهة بـ spotlight (منطقة مضاءة حول العنصر
// وباقي الصفحة معتمة) + tooltip بجانبه فيه شرح.
//
// مبنيّ بحركات CSS لا بـ`framer-motion`.
//
// وكان التعليق هنا يقول إنّها «غير موجودة في المشروع»، ثمّ أُضيفت إلى
// `package.json` ولم تُستورَد في سطرٍ واحد - فصار الوصف يكذب على قارئه.
// هي اليوم تبعيّةٌ قائمةٌ بلا مستعمِل (٥٫٤ ميجابايت).

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, X, LayoutDashboard,
  Link2, BarChart3, ShieldCheck, Megaphone, Sparkles,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { tourNavId } from "@/lib/navConfig";

/** المحدّد من المعرّف نفسه الذي يولّده الشريط - لا نصّاً موازياً يُكتب بيد. */
function tourTarget(href: string): string {
  return `#${CSS.escape(tourNavId(href))}`;
}

interface TourStep {
  id: string;
  icon: typeof LayoutDashboard;
  titleKey: string;
  descKey: string;
  targetSelector: string;
  position: "right" | "bottom" | "left";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "sidebar",
    icon: LayoutDashboard,
    titleKey: "tour.sidebarTitle",
    descKey: "tour.sidebarDesc",
    targetSelector: tourTarget("/dashboard"),
    position: "right",
  },
  {
    id: "integrations",
    icon: Link2,
    titleKey: "tour.integrationsTitle",
    descKey: "tour.integrationsDesc",
    targetSelector: tourTarget("/dashboard/integrations"),
    position: "right",
  },
  {
    id: "truth",
    icon: ShieldCheck,
    titleKey: "tour.truthTitle",
    descKey: "tour.truthDesc",
    targetSelector: tourTarget("/dashboard/truth"),
    position: "right",
  },
  {
    id: "campaigns",
    icon: Megaphone,
    titleKey: "tour.campaignsTitle",
    descKey: "tour.campaignsDesc",
    targetSelector: tourTarget("/dashboard/campaigns"),
    position: "right",
  },
  {
    id: "diagnostics",
    icon: BarChart3,
    titleKey: "tour.diagnosticsTitle",
    descKey: "tour.diagnosticsDesc",
    targetSelector: tourTarget("/dashboard/diagnostics"),
    position: "right",
  },
  {
    id: "ai",
    icon: Sparkles,
    titleKey: "tour.aiTitle",
    descKey: "tour.aiDesc",
    targetSelector: "#tour-notification-bell",
    position: "bottom",
  },
];

interface GuidedTourProps {
  locale: Locale;
  onDismiss: () => void;
}

export function GuidedTour({ locale, onDismiss }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipKey, setTooltipKey] = useState(0);

  const current = TOUR_STEPS[step];
  const tr = (k: string) => t(locale, `tour.${k}`);
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  const measureTarget = useCallback(() => {
    // 🔴 محاطٌ بـ`try`: `querySelector` يرمي `SyntaxError` على محدّدٍ فاسد -
    // لا يعود فارغاً. وقد كان يرمي فعلاً على `#tour-nav-/dashboard`، فتسقط
    // الصفحة كلُّها عند أوّل خطوة. والجولةُ زينةٌ فوق المنتج، فلا يجوز أن
    // تُسقطه مهما أخطأ محدّدُها.
    let el: Element | null = null;
    try {
      el = document.querySelector(current.targetSelector);
    } catch {
      el = null;
    }
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [current.targetSelector]);

  useEffect(() => {
    const timer = setTimeout(measureTarget, 300);
    return () => clearTimeout(timer);
  }, [measureTarget, step]);

  useEffect(() => {
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [measureTarget]);

  const next = () => {
    if (isLast) {
      onDismiss();
    } else {
      setStep((s) => s + 1);
      setTooltipKey((k) => k + 1);
    }
  };

  const prev = () => {
    if (!isFirst) {
      setStep((s) => s - 1);
      setTooltipKey((k) => k + 1);
    }
  };

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { display: "none" };
    const GAP = 12;
    const W = 280;
    switch (current.position) {
      case "right":
        return {
          position: "fixed",
          top: Math.max(16, Math.min(targetRect.top, window.innerHeight - 200)),
          left: Math.min(targetRect.right + GAP, window.innerWidth - W - 16),
          width: W,
        };
      case "bottom":
        return {
          position: "fixed",
          top: targetRect.bottom + GAP,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - W - 16)),
          width: W,
        };
      case "left":
        return {
          position: "fixed",
          top: Math.max(16, Math.min(targetRect.top, window.innerHeight - 200)),
          right: window.innerWidth - targetRect.left + GAP,
          width: W,
        };
    }
  };

  const spotlightPath = targetRect
    ? `M0,0 L${window.innerWidth},0 L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z M${targetRect.left - 8},${targetRect.top - 8} a8,8 0 0,1 8,-8 L${targetRect.right + 8 - 8},${targetRect.top - 8} a8,8 0 0,1 8,8 L${targetRect.right + 8},${targetRect.top - 8 + 8} a8,8 0 0,1 -8,8 L${targetRect.right + 8},${targetRect.bottom + 8 - 8} a8,8 0 0,1 -8,-8 L${targetRect.right + 8 - 8},${targetRect.bottom + 8} a8,8 0 0,1 -8,-8 L${targetRect.left - 8 + 8},${targetRect.bottom + 8} a8,8 0 0,1 8,-8 L${targetRect.left - 8},${targetRect.bottom + 8 - 8 + 8} a8,8 0 0,1 8,-8 L${targetRect.left - 8},${targetRect.top - 8 + 8} a8,8 0 0,1 -8,-8 Z`
    : "";

  const Icon = current.icon;

  return (
    <>
      {targetRect && (
        <svg
          className="fixed inset-0 z-[9990] pointer-events-none gt-overlay"
          width={window.innerWidth}
          height={window.innerHeight}
        >
          <path d={spotlightPath} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
        </svg>
      )}

      <div
        key={tooltipKey}
        className="z-[9991] gt-tooltip rounded-2xl border border-border bg-surface p-5"
        style={getTooltipStyle()}
        role="dialog"
        aria-label={tr(current.titleKey)}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Icon size={14} />
          </span>
          <span className="text-[11px] font-medium text-accent">
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <button
            onClick={onDismiss}
            className="ms-auto flex h-6 w-6 items-center justify-center rounded-full text-text-faint hover:bg-surface-raised hover:text-text-primary"
            aria-label={tr("skip")}
          >
            <X size={13} />
          </button>
        </div>

        <h3 className="mb-1.5 text-[14px] font-semibold text-text-primary">
          {tr(current.titleKey)}
        </h3>
        <p className="mb-4 text-[12.5px] leading-relaxed text-text-muted">
          {tr(current.descKey)}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onDismiss}
            className="text-[12px] text-text-faint hover:text-text-primary"
          >
            {tr("skipTour")}
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button onClick={prev} className="btn btn-ghost btn-sm">
                {true ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}
            <button onClick={next} className="btn btn-primary btn-sm">
              {isLast ? tr("finish") : tr("next")}
              {true ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .gt-overlay { animation: gtFadeIn .3s ease-out; }
        .gt-tooltip { animation: gtSlideIn .35s cubic-bezier(.16,1,.3,1) both; }
        @keyframes gtFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gtSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .gt-overlay, .gt-tooltip { animation: none !important; }
        }
      `}</style>
    </>
  );
}
