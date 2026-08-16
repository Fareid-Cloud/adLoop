"use client";

// app/components/ui/StorePicker.tsx
//
// **أيّ قناة بيعٍ تعرضها صفحات «متجري» الآن؟**
//
// سؤالٌ لم يكن له وجود ما دامت المساحة تحمل قناةً واحدة. وبعد أن صار
// للتاجر قناتان - سلّة وشوبيفاي بنفس المنتجات، أو تجزئة وجملة - صار
// المجموع وحده يخفي ما جاء يبحث عنه.
//
// يعيش الاختيار في `?store=` لا في حالةٍ محلّية: الصفحات تُصيَّر في
// الخادم، فالرابط هو ما يصل إليها. وميزةٌ ثانية أنّ الاختيار يُنسخ مع
// الرابط - يرسله التاجر لشريكه فيرى ما رآه.
//
// ولا يظهر بقناةٍ واحدة: خيارٌ بلا بديلٍ ضجيج.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Store } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function StorePicker({
  options,
  selectedId,
  locale,
}: {
  options: Array<{ id: string; name: string }>;
  selectedId: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (options.length < 2) return null;

  function choose(value: string) {
    // بقيّة المعاملات تبقى: تغييرُ القناة لا يجوز أن يُلغي الفترة المختارة.
    const next = new URLSearchParams(params.toString());
    if (value) next.set("store", value);
    else next.delete("store");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-[12.5px]">
      <Store size={14} className="shrink-0 text-text-faint" />
      <span className="text-text-muted">{t(locale, "storePicker.label")}</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => choose(e.target.value)}
        className="field py-1.5 text-[12.5px]"
      >
        <option value="">{t(locale, "storePicker.all")}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
