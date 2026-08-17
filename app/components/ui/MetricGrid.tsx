"use client";

// app/components/ui/MetricGrid.tsx
//
// **شبكة بطاقات المؤشّرات، ومَن يقرّر أيّها يُعرَض.**
//
// المشكلة التي بُنيت لها: صفحاتٌ تعرض إحدى عشرة بطاقة، وأخرى ثلاثاً
// وعشرين. والقارئ لا يقرأ ثلاثاً وعشرين رقماً - يبحث عن أربعةٍ يعرفها
// ويمرّ على البقيّة. فالبطاقات الزائدة لا تضيف معلومةً بل تُخفي المهمّ
// بينها، ولا يعرف **أيّها المهمّ** إلّا صاحب الحساب.
//
// **الاختيار محلّيّ لا في قاعدة البيانات**، وهو قرارٌ لا اختصار:
// «أيّ بطاقةٍ أراها» تفضيلُ عرضٍ يخصّ هذا المتصفّح - كطيّ الشريط الجانبيّ
// المحفوظ محلّياً منذ بنائه. وحفظُه في الخادم يعني نداءً عند كلّ تبديلٍ
// وصفّاً يكبر بعدد الأقسام، مقابل أن يتبع المستخدمَ بين أجهزته - وهي
// فائدةٌ لا تُوازن كلفتَها هنا.
//
// **ولا يُخفى شيءٌ بلا أثرٍ ظاهر:** الزرّ يقول كم بطاقةً مخفيّة، فمن
// أخفى بطاقةً ونسي لا يظنّ المنتج فقدها.

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Check, RotateCcw } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface MetricGridItem {
  /** مفتاحٌ ثابت لا يتغيّر بتغيّر الترتيب - المحفوظ محلّياً يشير إليه */
  key: string;
  /** الاسم كما يُعرَض في قائمة الاختيار */
  label: string;
  node: React.ReactNode;
  /** بطاقةٌ لا تُخفى: بلا هذا الرقم تفقد الصفحة معناها */
  required?: boolean;
}

export function MetricGrid({
  /** معرّف القسم - به يُحفظ اختيار كلّ صفحةٍ على حدة */
  sectionId,
  items,
  locale,
  className = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
}: {
  sectionId: string;
  items: MetricGridItem[];
  locale: Locale;
  className?: string;
}) {
  const storageKey = `adloop.metrics.${sectionId}`;
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  // الخادم لا يقرأ التخزين المحلّيّ، فأوّلُ تصييرٍ يعرض الكلّ ثمّ يُطبَّق
  // المحفوظ بعد الترطيب. وبدون هذا العلَم يختلف ما بناه المتصفّح عمّا
  // أرسله الخادم فيشتكي React.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setHidden(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [storageKey]);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function reset() {
    setHidden([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }

  const visible = useMemo(
    () => (ready ? items.filter((i) => i.required || !hidden.includes(i.key)) : items),
    [items, hidden, ready]
  );

  const hiddenCount = items.length - visible.length;
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `metricGrid.${k}`, v);

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <SlidersHorizontal size={13} />
          {hiddenCount > 0 ? tr("customizeWithCount", { n: hiddenCount }) : tr("customize")}
        </button>
      </div>

      {open && (
        <div className="card-shadow mb-3 rounded-2xl border border-border-visible bg-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[12px] text-text-muted">{tr("hint")}</p>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="flex shrink-0 items-center gap-1 text-[12px] text-accent hover:underline"
              >
                <RotateCcw size={12} />
                {tr("showAll")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => {
              const isOn = item.required || !hidden.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => !item.required && toggle(item.key)}
                  disabled={item.required}
                  title={item.required ? tr("alwaysOn") : undefined}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[12.5px] transition-colors ${
                    isOn
                      ? "border-accent/40 bg-accent-dim text-accent"
                      : "border-border-visible text-text-muted hover:text-text-primary"
                  } ${item.required ? "cursor-default opacity-70" : ""}`}
                >
                  {isOn && <Check size={12} />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={className}>
        {visible.map((item) => (
          <div key={item.key}>{item.node}</div>
        ))}
      </div>
    </div>
  );
}
