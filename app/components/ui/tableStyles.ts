// app/components/ui/tableStyles.ts
//
// **هوية الجداول الموحّدة.**
//
// أحد عشر جدولاً في المنتج كانت تحمل ستّة أنماط مختلفة لرأس الجدول وحده
// (`px-4 py-3`، `px-3 py-2.5`، `px-5 py-2.5`، بمحاذاة وأوزان مختلفة).
// الفارق لا يُلاحَظ في صفحة واحدة، لكنه يُلاحَظ عند التنقّل بينها: كل
// جدول يبدو مبنيّاً في يوم مختلف.
//
// تُستورد هذه الثوابت بدل كتابة الأصناف يدوياً، فيتغيّر شكل كل الجداول
// من مكان واحد.

/** غلاف الجدول: الإطار والظلّ والتمرير الأفقي داخل الحاوية لا في الصفحة */
export const TABLE_WRAP =
  "overflow-x-auto rounded-2xl card-shadow border border-border bg-surface";

/** الجدول نفسه */
export const TABLE = "w-full text-start text-sm";

/** صفّ الرأس */
export const THEAD_ROW =
  "border-b border-border text-[12px] font-medium uppercase tracking-wide text-text-muted";

/** خلية الرأس - محاذاة البداية دائماً لتعمل في الاتجاهين */
export const TH = "px-4 py-3 text-start font-medium whitespace-nowrap";

/** خلية الرأس للأرقام: تُحاذى نهايةً لتصطفّ فوق أرقامها */
export const TH_NUM = "px-4 py-3 text-end font-medium whitespace-nowrap";

/** صفّ البيانات - فاصل خفيف وتظليل عند المرور */
export const TR =
  "border-b border-border/50 last:border-0 transition-colors hover:bg-surface-raised/50";

/** خلية بيانات */
export const TD = "px-4 py-3.5 align-middle text-text-primary";

/** خلية رقمية: `tabular-nums` تجعل الأرقام تصطفّ رأسياً مهما اختلفت */
export const TD_NUM = "px-4 py-3.5 text-end align-middle tabular-nums text-text-primary";

/** خلية ثانوية (وصف، تاريخ، ملاحظة) */
export const TD_MUTED = "px-4 py-3.5 align-middle text-[12.5px] text-text-muted";
