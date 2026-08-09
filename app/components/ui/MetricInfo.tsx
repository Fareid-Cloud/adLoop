"use client";

// app/components/ui/MetricInfo.tsx
//
// شرح المؤشّر: ما هو، كيف يُحسب، ولماذا يهمّ.
//
// أيقونة المعلومات كانت `aria-label` صامتاً - يقرأه قارئ الشاشة ولا يراه
// أحد. المؤشّرات هنا ليست بديهية (تكلفة العميل الحقيقية، نسبة التضخيم،
// البُعد عن التعادل)، ورقم لا يفهم المستخدم من أين جاء لا يُبنى عليه قرار.
//
// 🔴 **ولماذا يُرسَل إلى `<body>` بدل أن يُرسَم في مكانه:**
//
// كان `absolute` داخل البطاقة بـ`z-50`، فبدا **شفّافاً** يمرّ عبره الرسم
// الذي تحته. وليس شفّافاً: `z-index` لا يُقارَن إلّا بين إخوةٍ في سياق
// التكديس نفسه. البطاقة تُنشئ سياقها الخاصّ، فيبقى الخمسون حبيس البطاقة
// مهما ارتفع، وأيّ بطاقةٍ تليها في المستند تُرسَم فوقه.
//
// وهذه ثالث مرّة يظهر فيها النمط نفسه (محادثة الدعم، شارة العرض
// التجريبيّ، وهذا). البوّابة إلى `<body>` تُخرج العنصر من كلّ سياقٍ فوقه -
// وهي الحلّ الكامل الوحيد، لا رفع الرقم.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { Portal } from "@/app/components/ui/Portal";

export interface MetricExplain {
  /** ما هو - جملة واحدة بلغة المستخدم لا تعريف تقني */
  what: string;
  /** كيف يُحسب - المعادلة أو المصدر، مكتوبة لا مرمّزة */
  how: string;
  /** لماذا يهمّ - القرار الذي يغيّره */
  why: string;
}

const PANEL_W = 264;
const GAP = 8;
/** هامش لا تلمسه اللوحة عند حافّة الشاشة */
const EDGE = 12;

export function MetricInfo({
  explain, labels,
}: {
  explain: MetricExplain;
  labels: { what: string; how: string; why: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // الموضع يُحسب من مستطيل الأيقونة لا من والدها: اللوحة خارج الشجرة الآن،
  // فلا والد تُنسَب إليه.
  const place = useCallback(() => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(
      Math.max(EDGE, r.left + r.width / 2 - PANEL_W / 2),
      window.innerWidth - PANEL_W - EDGE,
    );
    setPos({ top: r.bottom + GAP, left });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;

    // الإغلاق بالضغط خارجها: **اللوحة لم تعد داخل `boxRef`** بعد البوّابة،
    // فلولا فحصها المستقلّ لأغلقت نفسها عند أوّل ضغطة داخلها.
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // التمرير يحرّك الأيقونة ولا يحرّك لوحةً مثبّتة بالشاشة - تُعاد المحاذاة.
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

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

      {open && pos && (
        <Portal>
          {/* على الهاتف تُثبَّت في وسط الشاشة لا عند حافّة الزرّ: المحاذاة
              إلى الزرّ تدفعها خارج الشاشة في الاتّجاه من اليمين لليسار. */}
          <div
            ref={popRef}
            role="dialog"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="pop-shadow card pad-sm fixed inset-x-3 top-1/2 z-[70] -translate-y-1/2 cursor-default text-start sm:inset-x-auto sm:translate-y-0"
            style={{
              // الشاشات الصغيرة تتجاهل هذين لأنّ `inset-x-3` يغلبهما عرضاً،
              // و`top-1/2` يغلب `top` بالفئة نفسها.
              insetInlineStart: undefined,
              ...(typeof window !== "undefined" && window.innerWidth >= 640
                ? { top: pos.top, left: pos.left, width: PANEL_W }
                : {}),
            }}
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
          </div>
        </Portal>
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
