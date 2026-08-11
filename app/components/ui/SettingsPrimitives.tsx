// app/components/ui/SettingsPrimitives.tsx
//
// لبنات صفحة الإعدادات - **سُلَّم طباعيّ واحد يُفرض بالبنية لا بالانضباط.**
//
// 🔴 **العلّة التي رآها المالك:** «مش بعرف الوصف تبع أنهي أوبشن أصلاً».
// وسببها سطرٌ واحد كان في الملف:
//
//     function FieldLabel({ children }) {
//       return <div className="mb-1.5 text-xs text-text-muted">…</div>;
//     }
//
// **عنوان الحقل كان بحرفيّة ستايل نصّ الشرح**: `text-xs` و`text-muted`
// للاثنين. فحين يتجاور حقلان، تقرأ العين أربعة أسطر متساوية الوزن واللون
// ولا شيء فيها يقول أيّ سطرٍ يخصّ أيّ حقل - وهو ما يجعل الصفحة «سايحة
// على بعضها». و`SettingsSection` كان `<div className="card p-6">` عارياً:
// بطاقةٌ بلا عنوان، فالأقسام نفسها لا تُميَّز عن بعضها.
//
// **السُّلَّم هنا أربع درجات، كلٌّ منها تختلف عن جارتها في شيئين معاً**
// (حجمٌ **و**لون، أو وزنٌ **و**لون) - لأن الفرق في بُعدٍ واحد لا تلتقطه
// العين في المسح السريع:
//
//   قسم    ١٥px / semibold / primary   ← «إعدادات البريد»
//   مجموعة ١١px / uppercase / faint    ← «تتبّع واتساب»
//   حقل    ١٣px / medium / primary     ← «معرّف صفحة فيسبوك»
//   شرح    ١٢px / normal / muted       ← «اختياريّ - يُحتاج فقط حين…»
//
// **وعنوان القسم في عمودٍ جانبيّ لا فوق البطاقة:** حين يكون فوقها يصير
// سطراً بين بطاقتين، فيبدو تابعاً للتي قبله بقدر ما يبدو تابعاً للتي بعده.
// وفي العمود الجانبيّ يصير القسم كتلةً واحدة: اسمٌ يمين وحقولُه يسار - وهو
// ما يجيب سؤال «هذا الحقل تبع أيّ قسم؟» قبل أن يُسأل.

import type { LucideIcon } from "lucide-react";

/** قسم كامل: اسمه ووصفه في عمود، وحقوله في بطاقة بجانبه.
 *
 *  على الهاتف ينهار العمودان إلى واحد (الاسم فوق البطاقة) - فعمودان في
 *  ٣٧٥ بكسل يعطيان اسماً مكسوراً على أربعة أسطر بجوار بطاقةٍ خانقة. */
export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  /** إجراء يخصّ القسم كلّه - زرّ «أضف» مثلاً. يقف مع الاسم لا داخل البطاقة. */
  aside,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-border py-8 first:pt-0 last:border-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
      <div className="md:pt-1">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-text-primary">
          {Icon && <Icon size={16} strokeWidth={2.2} className="shrink-0 text-text-muted" />}
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-[12.5px] leading-5 text-text-muted">{description}</p>
        )}
        {aside && <div className="mt-3">{aside}</div>}
      </div>

      <div className="card p-5">{children}</div>
    </section>
  );
}

/** مجموعة حقول داخل قسم - «تتبّع واتساب» داخل «الربط».
 *
 *  الحرف الكبير مع التباعد يجعلها تُقرأ عنواناً لا حقلاً، رغم صغرها -
 *  فلا تُخلَط بالحقل الذي تحتها مباشرةً. */
export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-5 first:border-0 first:pt-0 [&+&]:mt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-[12.5px] leading-5 text-text-muted">{description}</p>
      )}
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </div>
  );
}

/** حقل واحد: اسمه، ثمّ شرحه، ثمّ أداته.
 *
 *  🔴 **الشرح فوق الأداة لا تحتها.** حين يكون تحتها يفصل بينه وبين الحقل
 *  الذي يشرحه صندوقُ إدخالٍ كامل، فيلتصق بصرياً بالحقل **التالي** - وهو
 *  بالضبط ما جعل المالك لا يعرف «الوصف تبع أنهي أوبشن». */
export function Field({
  label,
  hint,
  htmlFor,
  required,
  optional,
  children,
  /** رسالة خطأ تخصّ هذا الحقل - تحت الأداة لأنها نتيجة إدخالٍ لا شرحٌ له */
  error,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  /** يُكتب «اختياريّ» بجانب الاسم بدل أن يُدفن في أوّل الشرح */
  optional?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium leading-5 text-text-primary"
      >
        {label}
        {required && (
          <span className="text-critical" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="text-[11px] font-normal text-text-faint">{optional}</span>
        )}
      </label>

      {hint && <p className="mt-1 text-[12px] leading-[1.55] text-text-muted">{hint}</p>}

      <div className="mt-2">{children}</div>

      {error && <p className="mt-1.5 text-[12px] leading-5 text-critical">{error}</p>}
    </div>
  );
}

/** صفّ لحقلٍ أداتُه صغيرة (مفتاح، عدد) - الاسم يمين والأداة يسار.
 *
 *  عمودياً يترك المفتاح فراغاً أفقياً كاملاً بجانبه بلا سبب، ويطيل
 *  القائمة ضعفين. */
export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-5 text-text-primary">{label}</div>
        {hint && <p className="mt-1 text-[12px] leading-[1.55] text-text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
