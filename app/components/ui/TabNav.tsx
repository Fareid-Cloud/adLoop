"use client";

// app/components/ui/TabNav.tsx
//
// شريط التبويبات المشترك - **الشكل الواحد لكلّ تنقّل داخليّ في المنتج.**
//
// كان في المنتج ثلاثة أشكال لفكرة واحدة: تبويبات بخطّ سفليّ في الحملات،
// وكبسولات ممتلئة باللون في الإعدادات، وصفٌّ من الأزرار في التكاملات.
// الثلاثة تقول للمستخدم الشيء نفسه - «هذه أقسام، اختر واحداً» - بثلاث
// لغات بصرية، فيتعلّم الشكل في قسمٍ ولا يعرفه في الذي يليه.
//
// **الخطّ السفليّ لا الكبسولة الممتلئة:** الكبسولة الملوّنة وزنها البصريّ
// وزن زرّ الإجراء الأساسيّ في الصفحة - فيتنافس التنقّل مع «طبّق» و«احفظ»
// على العين. التبويب يشير إلى موضعك، لا يدعوك إلى فعل.
//
// **التمرير مع تلاشٍ عند الحافّة، لا التفاف:** الالتفاف يعطي صفّين غير
// متساويين يقفزان مع تغيّر اللغة. والتمرير وحده يخفي تبويبات بلا إشارة -
// فيظنّها المستخدم غير موجودة. الحلّ: تلاشٍ يظهر **فقط** حين يوجد ما هو
// مخفيّ خلفه، وتمريرٌ تلقائيّ يجلب التبويب النشط إلى العين عند الفتح.

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface TabItem {
  key: string;
  label: string;
  /** رابطٌ حقيقيّ - للتبويبات التي هي صفحات مستقلّة (تنقّل الحملات).
      حين يغيب، التبويب زرٌّ يبدّل الحالة في المكان (الإعدادات). */
  href?: string;
  icon?: LucideIcon;
  /** بديلٌ عن الأيقونة حين تكون العلامة صورةً - شعار منصّة مثلاً */
  iconNode?: React.ReactNode;
  /** عدد يُعرَض في رقاقة صغيرة - عدد الصفحات في القسم مثلاً */
  count?: number;
  /** نقطة تنبيه: القسم فيه ما يستدعي الانتباه (اتصال منتهٍ، قرار معلّق) */
  dot?: boolean;
}

export function TabNav({
  items,
  active,
  onChange,
  /** لون الخطّ السفليّ للتبويب النشط - لون المنصّة حين يكون التبويب منصّة */
  accent = "var(--accent)",
  className = "",
  ariaLabel,
}: {
  items: readonly TabItem[];
  active: string;
  /** يُمرَّر للتبويبات-الأزرار وحدها. تبويبات الروابط تنتقل بنفسها. */
  onChange?: (key: string) => void;
  accent?: string;
  className?: string;
  ariaLabel: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement>(null);
  // حافّتان مستقلّتان: التلاشي يظهر عند الجهة التي خلفها مخفيّ فقط. وهو
  // يعمل في الاتجاهين معاً - في RTL يكون «الأوّل» على اليمين.
  const [edges, setEdges] = useState({ start: false, end: false });
  // تدرّجات Tailwind فيزيائية (`to-r`/`to-l`) ولا مقابل منطقيّ لها، فالاتجاه
  // يُقرأ من الصفحة نفسها مرّةً بدل أن يُفترَض الإنجليزية.
  const [rtl, setRtl] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      // `scrollLeft` سالبٌ في RTL في المتصفّحات الحديثة - القيمة المطلقة
      // تجعل الحساب واحداً في الاتجاهين بلا فرعٍ لكلّ اتجاه.
      const x = Math.abs(el.scrollLeft);
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: x > 4, end: max > 4 && x < max - 4 });
    };

    setRtl(getComputedStyle(el).direction === "rtl");
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [items.length]);

  // التبويب النشط يُجلَب إلى العين - فمن يفتح صفحةً تبويبها العاشر يراه
  // مباشرةً بدل أن يفتح على أوّل تبويب ويظنّ نفسه في غير موضعه.
  // `block: "nearest"` كي لا تقفز الصفحة كلّها رأسياً.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label={ariaLabel}
        className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-border"
      >
        {items.map((item) => {
          const on = item.key === active;
          const Icon = item.icon;

          // المحتوى واحدٌ سواء كان التبويب رابطاً أو زرّاً - الفرق في العنصر
          // الحاوي وحده، فلا يفترق شكلُ الاثنين مع أوّل تعديل.
          const inner = (
            <>
              {item.iconNode ?? (Icon ? <Icon size={15} strokeWidth={2} /> : null)}
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-px font-mono text-[11px] leading-4 ${
                    on ? "bg-accent/12 text-accent" : "bg-surface-raised text-text-faint"
                  }`}
                  style={on ? { backgroundColor: `${accent}1f`, color: accent } : undefined}
                >
                  {item.count}
                </span>
              )}
              {item.dot && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gap" aria-hidden />
              )}
            </>
          );

          // `-mb-px` يضع الخطّ السفليّ للتبويب **فوق** خطّ الشريط لا تحته،
          // فيبدو امتداداً للتبويب لا سطراً ثانياً تحته.
          const cls = `-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
            on
              ? "text-text-primary"
              : "border-transparent text-text-muted hover:border-border-visible hover:text-text-primary"
          }`;
          const style = on ? { borderBottomColor: accent, color: accent } : undefined;

          return item.href ? (
            <a
              key={item.key}
              ref={on ? (activeRef as React.RefObject<HTMLAnchorElement>) : undefined}
              href={item.href}
              role="tab"
              aria-selected={on}
              aria-current={on ? "page" : undefined}
              className={cls}
              style={style}
            >
              {inner}
            </a>
          ) : (
            <button
              key={item.key}
              ref={on ? (activeRef as React.RefObject<HTMLButtonElement>) : undefined}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange?.(item.key)}
              className={cls}
              style={style}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {/* التلاشي `pointer-events-none` كي لا يبتلع ضغطةً على تبويبٍ تحته.
          ولونه لون **ما تحته فعلاً** (`--bg`) لا لون البطاقة: الشريط في
          موضعَيه يقف على خلفيّة الصفحة مباشرة، وتدرّجٌ من `--surface`
          (#161A21 فوق #0E1116) لا يتلاشى بل يضع لطخةً أفتح على الحافّة -
          فيُقرأ التبويبُ المقطوع تحت شريطٍ رماديّ، وهو أسوأ من قطعه. */}
      {edges.start && (
        <div
          className={`pointer-events-none absolute bottom-px top-0 start-0 w-10 from-bg to-transparent ${
            rtl ? "bg-gradient-to-l" : "bg-gradient-to-r"
          }`}
        />
      )}
      {edges.end && (
        <div
          className={`pointer-events-none absolute bottom-px top-0 end-0 w-10 from-bg to-transparent ${
            rtl ? "bg-gradient-to-r" : "bg-gradient-to-l"
          }`}
        />
      )}
    </div>
  );
}
