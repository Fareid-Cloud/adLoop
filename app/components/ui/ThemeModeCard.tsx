"use client";

// app/components/ui/ThemeModeCard.tsx
//
// بطاقة اختيار الوضع - **عيّنةٌ حقيقية لا أيقونة تصفه.**
//
// كان الاختيار كبسولتين مكتوباً عليهما «فاتح» و«داكن». والكلمة تسمّي ولا
// تُري: مَن لم يجرّب الوضع الداكن لا يعرف من الكلمة أهو رماديّ فحميّ أم
// أزرقُ ليليّ، ولا كيف يقع لونُ التمييز عليه. فيضغط ليرى، ثمّ يرجع.
//
// **وما يجعل العيّنة صادقة أنّها ليست رسماً:** المعاينة عناصر حقيقية
// ملفوفة في `data-mode`، وهو الوصف نفسه الذي يبدّل ثيم التطبيق كلّه في
// `theme.css`. فهي تقرأ `--surface` و`--border` و`--accent` من مصدرها -
// أي أنّ أيّ تعديلٍ على الثيم يظهر هنا تلقائياً، ولا يمكن أن تنحرف
// المعاينة عن الحقيقة لأنّها ليست نسخةً منها.

import { Check } from "lucide-react";

/** واجهةٌ مصغَّرة: شريطٌ جانبيّ، ورأسٌ، وبطاقةٌ فيها سطران ومؤشّر.
 *  ليست صورةً للمنتج بل بنيتُه - وهو ما يكفي للحكم على الوضع. */
function MiniUi({ mode }: { mode: "light" | "dark" }) {
  return (
    <div
      data-mode={mode}
      dir="ltr"
      aria-hidden
      className="pointer-events-none flex h-[74px] w-full overflow-hidden rounded-lg border border-border bg-bg"
    >
      <div className="flex w-1/4 flex-col gap-1 border-e border-border bg-surface p-1.5">
        <div className="h-1.5 w-4/5 rounded-full bg-accent" />
        <div className="h-1.5 w-3/5 rounded-full bg-text-faint/35" />
        <div className="h-1.5 w-4/5 rounded-full bg-text-faint/35" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-1.5">
        <div className="h-2 w-1/2 rounded-full bg-text-primary/70" />
        <div className="flex-1 rounded-md border border-border bg-surface p-1.5">
          <div className="mb-1 h-1.5 w-2/3 rounded-full bg-text-faint/40" />
          <div className="h-1.5 w-1/3 rounded-full bg-accent/70" />
        </div>
      </div>
    </div>
  );
}

export function ThemeModeCard({
  mode,
  label,
  selected,
  onSelect,
}: {
  mode: "light" | "dark";
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex flex-col gap-2 rounded-xl border p-2 text-start transition-colors ${
        selected
          ? "border-accent bg-accent/[0.06]"
          : "border-border hover:border-border-visible"
      }`}
    >
      <MiniUi mode={mode} />
      <span
        className={`px-1 pb-0.5 text-[12.5px] font-medium ${
          selected ? "text-accent" : "text-text-muted"
        }`}
      >
        {label}
      </span>

      {selected && (
        // العلامة على الحافّة لا فوق المعاينة: علامةٌ في المنتصف تحجب
        // جزءاً ممّا جاءت البطاقة كي تُريه.
        <span className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow-sm">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
