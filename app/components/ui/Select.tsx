"use client";

// app/components/ui/Select.tsx
//
// **قائمة الاختيار في المنتج كلّه - واحدة لا خمس عشرة.**
//
// كانت كلّ شاشة تستعمل `<select>` الأصليّة، ولها في كلّ نظام تشغيل شكلٌ
// آخر: قائمة رماديّة بخطّ النظام على ويندوز، ولوحة مُدارة من نظام الهاتف
// على آيفون. فالشاشة الواحدة تحمل حقولاً بهويّتنا وقائمةً بهويّة ويندوز
// بجوارها. ولا تُصلَح بالتنسيق: الأصليّة **لا تقبل** تنسيق خياراتها -
// لا أيقونة في السطر، ولا علامة على المختار، ولا بحثاً داخلها.
//
// ولهذا تُبنى بالكامل: زرٌّ يفتح لوحةً من عناصر عاديّة، فيصير كلّ ما في
// اللوحة قابلاً للتصميم - وتُستعاد بالمقابل كلّ ما تعطيه الأصليّة مجّاناً:
//
//   لوحة المفاتيح  سهمان وبداية ونهاية وإدخال وهروب، وكتابةٌ سريعة تقفز
//                  إلى أوّل خيارٍ يبدأ بها (كما تفعل الأصليّة تماماً)
//   قارئ الشاشة    `combobox` + `listbox` + `aria-activedescendant`
//   النماذج        حقلٌ مخفيّ يحمل القيمة، فترسلها النماذج غير المُدارة
//
// **والبوّابة ليست ترفاً:** اللوحة تُصيَّر في `<body>` لأنّ أيّ سلفٍ عليه
// `overflow` أو `transform` يقصّها - وهو حال الشريط الجانبيّ وكلّ بطاقة
// ذات `overflow-hidden`. راجع `Portal.tsx`.
//
// **وعلى الهاتف ترسو اللوحة إلى الشاشة لا إلى الزرّ**: الرسوّ إلى حافّة
// الزرّ يدفعها خارج الشاشة في الواجهة العربية - قاعدةٌ ثبتت في المنتج
// قبل اليوم، وتُطبَّق هنا بالقياس الفعليّ لا بالتخمين.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Portal } from "./Portal";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface SelectOption {
  value: string;
  /** النصّ المعروض - يصل مُترجَماً من موضع النداء، فالمكوّن لا يعرف مجاله */
  label: string;
  /** أيقونة أو شارة تسبق النصّ: علم دولة، لون منصّة، حالة */
  icon?: React.ReactNode;
  /** سطرٌ ثانٍ خافت تحت النصّ - للفرق الذي لا يُفهم من الاسم وحده */
  hint?: string;
  /** عنوان المجموعة التي ينتمي إليها - يُرسَم فاصلاً فوق أوّل عضوٍ فيها.
   *  قائمةٌ أطول من أن تُمسح بالعين تُقرأ بمجموعاتها لا سطراً سطراً. */
  group?: string;
  disabled?: boolean;
}

/** ما دون هذا العدد يُرى كلّه بلمحة، فحقل البحث فيه ضجيجٌ لا عون. */
const SEARCH_THRESHOLD = 8;
/** عرض الشاشة الذي تحته ترسو اللوحة إلى الشاشة لا إلى الزرّ (`sm` في تيلويند) */
const MOBILE_MAX = 640;

export function Select({
  value,
  onChange,
  options,
  locale,
  label,
  placeholder,
  searchable,
  size = "md",
  disabled = false,
  name,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  locale: Locale;
  /** عنوانٌ صغير داخل الزرّ فوق القيمة - يبقى مقروءاً بعد الاختيار،
   *  بخلاف العنوان الذي يختفي فور الكتابة فيُنسى ما الحقل أصلاً */
  label?: string;
  placeholder?: string;
  /** الافتراضيّ: يظهر البحث حين تتجاوز الخيارات ما يُرى بلمحة */
  searchable?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  /** يُصيَّر حقلاً مخفيّاً - للنماذج التي تُرسَل بلا حالة React */
  name?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** الكتابة السريعة: أحرفٌ متتابعة تُجمَع ثمّ تُنسى بعد صمتٍ قصير */
  const typeahead = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const showSearch = searchable ?? options.length >= SEARCH_THRESHOLD;

  const selected = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLocaleLowerCase();
    return options.filter(
      (o) => o.label.toLocaleLowerCase().includes(q) || o.hint?.toLocaleLowerCase().includes(q)
    );
  }, [options, query]);

  // ── موضع اللوحة ───────────────────────────────────────────────────
  // تُقاس من الزرّ لا تُورَث منه: اللوحة في `<body>` فلا سلف يضعها.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; drop: "down" | "up" } | null>(null);
  const [mobile, setMobile] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const isMobile = window.innerWidth < MOBILE_MAX;
      setMobile(isMobile);
      if (isMobile) return;
      const r = el.getBoundingClientRect();
      // فوق الزرّ حين لا يتّسع تحته - القائمة التي تُفتح خارج الشاشة
      // تبدو للمستخدم قائمةً لم تُفتح.
      const below = window.innerHeight - r.bottom;
      const drop: "down" | "up" = below < 260 && r.top > below ? "up" : "down";
      setPos({
        top: drop === "down" ? r.bottom + 6 : r.top - 6,
        left: r.left,
        width: r.width,
        drop,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // ── الفتح والإغلاق ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const i = options.findIndex((o) => o.value === value);
      setActiveIndex(i >= 0 ? i : options.findIndex((o) => !o.disabled));
      // التركيز على البحث إن وُجد، وإلّا يبقى على الزرّ ليعمل السهمان.
      if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // السطر النشط يبقى مرئياً مع التنقّل بالسهمين في قائمةٍ أطول من إطارها.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function commit(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function step(delta: number) {
    if (visible.length === 0) return;
    let i = activeIndex;
    for (let n = 0; n < visible.length; n++) {
      i = (i + delta + visible.length) % visible.length;
      if (!visible[i]?.disabled) break;
    }
    setActiveIndex(i);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(visible.findIndex((o) => !o.disabled));
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(visible.length - 1);
        break;
      case "Enter":
      case " ": {
        // المسافة حرفٌ صالح داخل البحث، فلا تُخطَف منه.
        if (e.key === " " && showSearch) return;
        e.preventDefault();
        const opt = visible[activeIndex];
        if (opt) commit(opt);
        break;
      }
      default: {
        if (showSearch || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        const now = Date.now();
        const text = now - typeahead.current.at < 700 ? typeahead.current.text + e.key : e.key;
        typeahead.current = { text, at: now };
        const i = visible.findIndex(
          (o) => !o.disabled && o.label.toLocaleLowerCase().startsWith(text.toLocaleLowerCase())
        );
        if (i >= 0) setActiveIndex(i);
      }
    }
  }

  const pad = size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-3.5 py-2.5 text-[13.5px]";

  const panel = (
    <div
      ref={panelRef}
      // 🔴🔴 **علامةٌ تنقذ كلّ لوحةٍ تحتوي هذه القائمة.**
      //
      // اللوحة تُصيَّر في `<body>` هرباً من القصّ، فتصير - بالنسبة لأيّ
      // مكوّنٍ يغلق نفسه على «دوسةٍ خارج إطاري» - دوسةً خارجية. وهذا ما
      // وقع فعلاً: اختيار نمط المقارنة داخل منتقي التاريخ **يُغلق
      // المنتقي كلّه** قبل أن يُسجَّل الاختيار، فيقرأ المستخدم أنّ
      // المقارنة لا تعمل - والقائمة هي التي هدمت الحوار من تحته.
      //
      // فتُوسَم اللوحة، ويتخطّاها كلّ حارسِ دوسةٍ خارجية.
      data-portal-panel="true"
      className={
        mobile
          ? "pop-shadow fixed inset-x-3 bottom-3 z-[70] max-h-[70vh] overflow-hidden rounded-2xl border border-border-visible bg-surface p-1.5"
          : "pop-shadow fixed z-[70] overflow-hidden rounded-2xl border border-border-visible bg-surface p-1.5"
      }
      style={
        mobile || !pos
          ? undefined
          : {
              top: pos.drop === "down" ? pos.top : undefined,
              bottom: pos.drop === "up" ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              minWidth: pos.width,
            }
      }
      role="presentation"
    >
      {showSearch && (
        <div className="relative mb-1.5">
          <Search
            size={14}
            className="pointer-events-none absolute inset-inline-start-0 top-1/2 -translate-y-1/2 text-text-faint"
            style={{ insetInlineStart: "0.625rem" }}
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t(locale, "select.search")}
            className="field field-sm field-icon-start"
            aria-controls={listboxId}
          />
        </div>
      )}

      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel ?? label}
        className="max-h-64 overflow-y-auto overscroll-contain"
      >
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-text-muted">
            {t(locale, "select.noResults")}
          </p>
        ) : (
          visible.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === activeIndex;
            // العنوان يُرسم عند تغيّر المجموعة - فيبقى صحيحاً بعد البحث
            // الذي قد يُفرغ مجموعةً بأكملها.
            const startsGroup = o.group && o.group !== visible[i - 1]?.group;
            return (
              <div key={o.value}>
              {startsGroup && (
                <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-faint">
                  {o.group}
                </p>
              )}
              <div
                id={`${baseId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                onClick={() => commit(o)}
                onMouseEnter={() => !o.disabled && setActiveIndex(i)}
                className={[
                  "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors",
                  o.disabled ? "cursor-not-allowed opacity-50" : "",
                  isSelected ? "bg-accent-dim font-medium text-accent" : "text-text-primary",
                  isActive && !isSelected ? "bg-surface-raised" : "",
                ].join(" ")}
              >
                {o.icon && <span className="flex shrink-0 items-center">{o.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && (
                    <span className="mt-0.5 block truncate text-[11.5px] font-normal text-text-muted">
                      {o.hint}
                    </span>
                  )}
                </span>
                {isSelected && <Check size={16} className="shrink-0 text-accent" />}
              </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        data-open={open || undefined}
        className={`field select-trigger ${pad} ${
          open ? "border-accent shadow-[0_0_0_3px_var(--accent-dim)]" : ""
        }`}
      >
        {selected?.icon && <span className="flex shrink-0 items-center">{selected.icon}</span>}
        <span className="min-w-0 flex-1">
          {label && (
            <span className="block truncate text-[11px] leading-tight text-text-faint">{label}</span>
          )}
          <span className={`block truncate ${selected ? "" : "text-text-faint"}`}>
            {selected?.label ?? placeholder ?? t(locale, "select.placeholder")}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && <Portal>{panel}</Portal>}
    </div>
  );
}
