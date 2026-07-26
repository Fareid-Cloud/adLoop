// app/components/AuthControls.tsx
//
// عناصر موحّدة لشاشات الحساب: زر الدخول الاجتماعي (نفس التصميم لكل المنصات -
// إطار محايد ولوجو، بدل ألوان مختلفة لكل زر)، وأنماط الحقول والأزرار.

import type { ReactNode } from "react";

export const FIELD =
  "block w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent";

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
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface py-3 text-sm font-medium text-text-primary no-underline transition-colors hover:border-border-visible hover:bg-surface-raised"
    >
      {logo}
      {children}
    </a>
  );
}
