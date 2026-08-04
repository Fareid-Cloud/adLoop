"use client";

// app/components/ui/MetricInfo.tsx
//
// شرح المؤشّر: ما هو، كيف يُحسب، ولماذا يهمّ.
//
// أيقونة المعلومات كانت `aria-label` صامتاً - يقرأه قارئ الشاشة ولا يراه
// أحد. المؤشّرات هنا ليست بديهية (تكلفة العميل الحقيقية، نسبة التضخيم،
// البُعد عن التعادل)، ورقم لا يفهم المستخدم من أين جاء لا يُبنى عليه قرار.

import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";

export interface MetricExplain {
  /** ما هو - جملة واحدة بلغة المستخدم لا تعريف تقني */
  what: string;
  /** كيف يُحسب - المعادلة أو المصدر، مكتوبة لا مرمّزة */
  how: string;
  /** لماذا يهمّ - القرار الذي يغيّره */
  why: string;
}

export function MetricInfo({
  explain, labels,
}: {
  explain: MetricExplain;
  labels: { what: string; how: string; why: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={boxRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          // البطاقة نفسها قد تكون رابطاً أو قابلة للضغط - الشرح لا يفتحها
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={labels.what}
        aria-expanded={open}
        className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
          open ? "bg-accent text-white" : "text-text-faint hover:bg-surface-raised hover:text-text-muted"
        }`}
      >
        <Info size={11} />
      </button>

      {open && (
        <span
          role="dialog"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="pop-shadow absolute top-6 z-50 w-[264px] cursor-default card pad-sm text-start"
          style={{ insetInlineStart: 0 }}
        >
          <span className="mb-2 flex items-start justify-between gap-2">
            <span className="text-[12.5px] font-semibold leading-snug text-text-primary">{explain.what}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
              aria-label={labels.close}
              className="shrink-0 text-text-faint hover:text-text-primary"
            >
              <X size={13} />
            </button>
          </span>

          <Row label={labels.how} body={explain.how} />
          <Row label={labels.why} body={explain.why} last />
        </span>
      )}
    </span>
  );
}

function Row({ label, body, last }: { label: string; body: string; last?: boolean }) {
  return (
    <span className={`block ${last ? "" : "mb-2"}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-faint">{label}</span>
      <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">{body}</span>
    </span>
  );
}
