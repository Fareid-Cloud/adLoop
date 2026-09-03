"use client";

// عارضُ الصور - **بوب أب جوّه الصفحة لا تبويبٌ جديد.**
//
// 🔴 الصورةُ كانت رابطاً بـ`target="_blank"`، فالدوسة عليها بتطلّع
// المستخدم برّه المنتج تماماً: بيسيب المحادثة، وبيرجع بزرّ الرجوع
// فتتحمّل الصفحة من أوّلها ويضيع مكانُه في القائمة. الصورةُ جزءٌ من
// الرسالة، وقراءتُها مايصحّش تكلّف مغادرة.
//
// والخلفيةُ **معتمةٌ قليلاً لا سوداء**: التعتيمُ الكامل بيقطع السياق،
// والمقصود إنّه يفضل شايف إنّه في نفس المكان وإنّ الصورة طبقةٌ فوقه.

import { useEffect } from "react";
import { X } from "lucide-react";
import { Portal } from "@/app/components/ui/Portal";

export function ImageLightbox({ src, alt = "", onClose }: { src: string; alt?: string; onClose: () => void }) {
  // Escape بيقفل، وتمريرُ الصفحة تحت بيتقفل: التمريرُ خلف طبقةٍ مفتوحة
  // بيحرّك المحتوى اللي هيرجع له، فيرجع لمكانٍ غير اللي ساب فيه.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <Portal>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]"
      >
        {/* الزرُّ على طرف الشاشة لا على طرف الصورة: الصورةُ بتتغيّر
            أبعادها، فزرٌّ ملزوقٌ بيها بيتنطّ من مكانٍ لمكان. */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="fixed end-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/70"
        >
          <X size={20} />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90dvh] max-w-[92vw] rounded-2xl bg-surface object-contain shadow-2xl"
        />
      </div>
    </Portal>
  );
}
