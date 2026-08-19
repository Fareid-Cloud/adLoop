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
  allowCompare = false,
  children,

  flush,
}: {
  locale: Locale;
  preset: PresetKey;
  range: DateRange;
  compare: DateRange | null;
  compareMode?: CompareMode;
  /** 🔴 **الافتراضي `false` عمداً، وكان `true`.**
   *
   *  خانة «قارن» كانت تظهر في كلّ صفحة فيها هذا الشريط - أربع عشرة
   *  صفحة - **وصفحةٌ واحدة فقط تقرأ نتيجتها** (التقارير). فيختار
   *  المستخدم المقارنة، ويؤكّد المنتقي أنّها مختارة، ولا يتغيّر رقمٌ
   *  واحد على الشاشة. ووصفها المالك بدقّة: «كأني ما اخترتش كومبير».
   *
   *  وضبطُه `true` افتراضاً يعني أنّ كلّ صفحة تَعِد بما لا تفي به ما لم
   *  تنتبه هي. وضبطُه `false` يعني أنّ الصفحة **تُثبت** أنّها تقرأ
   *  المقارنة قبل أن تعرضها - فالخطأ الافتراضيّ صمتٌ لا وعدٌ كاذب.
   *
   *  فلا تمرّره إلّا وأنت واثق أنّ استعلامات صفحتك تستعمل
   *  `period.compare` فعلاً، لا أنّها تمرّره إلى هذا الشريط وحده. */
  allowCompare?: boolean;
  /** أي أدوات إضافية تخصّ الصفحة - تظهر بجوار المنتقي */
  children?: React.ReactNode;
  /**
   * بلا الهامش السفليّ - حين يوضع المنتقي **داخل صفٍّ** بجانب عنصرٍ آخر.
   *
   * 🔴 `mb-4` مكتوبةٌ هنا لأنّ المنتقي في أغلب الصفحات يقف وحده فوق
   * المحتوى ويحتاج فاصلاً. لكنّه حين يصير أحدَ عنصرَي صفٍّ متوسِّطٍ رأسياً،
   * يصير ذلك الهامشُ جزءاً من صندوقه: فيوسِّط الأبُ صندوقاً أطولَ بستّة
   * عشر بكسلاً من جاره، ويرتفع **محتواه** ثمانيةً - نصفَ الفرق.
   *
   * قِيس على الصفحة الحيّة: فرقُ المركزين ثمانية بكسلات، وبإلغاء الهامش
   * صار صفراً. وليست مشكلةَ ارتفاعٍ - كلاهما أربعةٌ وأربعون بكسلاً بالضبط،
   * ولذلك لم يُصلحه ضبطُ الارتفاعات مرّةً بعد مرّة.
   */
  flush?: boolean;
}) {
  return (
    <div className={`${flush ? "" : "mb-4"} flex flex-wrap items-center justify-end gap-2`}>
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
