// app/components/AuthControls.tsx
//
// عناصر موحّدة لشاشات الحساب: زر الدخول الاجتماعي (نفس التصميم لكل المنصات -
// إطار محايد ولوجو، بدل ألوان مختلفة لكل زر)، وأنماط الحقول والأزرار.

import type { ReactNode } from "react";

// **ثلاث حالات، حدٌّ واحد في كلٍّ منها:**
//   ساكن  - حدّ محايد
//   تحويم - الحدّ يغمق فيُعرف أنّه قابل للكتابة قبل النقر
//   تركيز - الحدّ يأخذ لون الهويّة، ومعه هالة بعشر المعتمة
//
// الهالة `3px` بشفافية 10٪ (`--accent-dim`) لا حلقة `4px` بـ15٪: الحلقة
// السميكة تُقرأ **حدّاً ثانياً** بجانب الحدّ الملوّن، فيبدو الحقل بإطارين.
// الهالة الخفيفة تُقرأ عمقاً لا خطّاً.
//
// وبلا ظلّ ساكن: الظلّ حول حقل إدخال يوحي بأنّه مرتفع فوق السطح، وهو ليس
// كذلك - الحقل مستوى مُحفَر لا بطاقة.
export const FIELD =
  "block w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none transition-[border-color,box-shadow] duration-150 hover:border-border-visible focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)]";

export const PRIMARY_BTN =
  "w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export function SocialButton({
  href,
  logo,
  children,
}: {
  href: string;
  logo: ReactNode;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      // إطار وحده بلا ظلّ: الظلّ يرفع الزرّ عن السطح فيبدو بطاقة لا خياراً،
      // وثلاث بطاقات مرفوعة فوق فورم مسطّح تشوّش تسلسل العمق.
      className="flex w-full items-center justify-center gap-2.5 card py-3 text-sm font-medium text-text-primary no-underline transition-colors hover:border-border-visible hover:bg-surface-raised"
    >
      {logo}
      {children}
    </a>
  );
}
