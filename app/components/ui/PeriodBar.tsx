// app/components/ui/PeriodBar.tsx
//
// شريط الفترة الموحّد. مكوّن خادم رفيع يغلّف المنتقي، ليُضاف إلى أي صفحة
// بسطر واحد ولا تُعاد كتابة نفس الوصلات في أربع عشرة صفحة.
//
// وجوده قاعدة لا زينة: أي صفحة تعرض أرقاماً تتغيّر بالزمن يجب أن يستطيع
// المستخدم سؤالها "وماذا عن الأسبوع الماضي؟" - وإلا فهي لقطة واحدة مثبّتة.

import { DateRangePicker } from "./DateRangePicker";
import type { CompareMode, DateRange, PresetKey } from "@/lib/dateRange";
import type { Locale } from "@/lib/i18n/dictionary";

export function PeriodBar({
  locale,
  preset,
  range,
  compare,
  compareMode = "none",
  allowCompare = true,
  children,
}: {
  locale: Locale;
  preset: PresetKey;
  range: DateRange;
  compare: DateRange | null;
  compareMode?: CompareMode;
  allowCompare?: boolean;
  /** أي أدوات إضافية تخصّ الصفحة - تظهر بجوار المنتقي */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      {children}
      <DateRangePicker
        locale={locale}
        preset={preset}
        range={range}
        compare={compare}
        compareMode={compareMode}
        allowCompare={allowCompare}
      />
    </div>
  );
}
