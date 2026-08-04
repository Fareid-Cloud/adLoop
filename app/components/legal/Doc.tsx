// app/components/legal/Doc.tsx
//
// عناصر عرض الوثائق القانونية.
//
// **الوثيقة القانونية لا تُترجَم آلياً.** كلّ نصّ مكتوب في اللغتين بصياغة
// مستقلّة: الترجمة الحرفية لبند قانوني تُنتج التزاماً مختلفاً عمّا قُصد.
//
// **التصميم:** وثيقة طويلة تُقرأ لا تُتصفَّح — عمود قراءة مريح، وأقسام
// مرقَّمة تلقائياً بعدّاد CSS فلا يُرقَّم بند يدوياً ولا ينكسر الترقيم عند
// إدراج بند في المنتصف.

import type { ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DocShell({
  title,
  updated,
  locale,
  children,
}: {
  title: string;
  updated: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <article dir={locale === "en" ? "ltr" : "rtl"}>
      <header className="mb-9 border-b border-border pb-7">
        <h1 className="mb-2 text-[30px] font-bold leading-tight tracking-tight text-text-primary sm:text-[34px]">
          {title}
        </h1>
        <p className="text-[12.5px] text-text-faint">
          {t(locale, "legal.updated", { date: updated })}
        </p>
      </header>

      <div className="doc-body flex flex-col gap-9">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="doc-section">
      <h2 className="mb-3 flex items-baseline gap-2.5 text-[17px] font-semibold leading-snug text-text-primary">
        <span className="doc-num num shrink-0 text-[13px] font-bold text-accent" />
        <span>{title}</span>
      </h2>
      <div className="flex flex-col gap-2.5 ps-[26px] text-[14px] leading-[1.9] text-text-muted">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-[14px] leading-[1.9] text-text-muted">
          {/* نقطة بلون الهوية بدل رمز القائمة الافتراضي: محاذاتها تعمل في
              الاتّجاهين دون اعتماد على `list-style` الذي ينقلب موضعه. */}
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/45" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * قسم كامل من القاموس: العنوان، وفقرة اختيارية، وقائمة اختيارية.
 * الصفحات صارت بيانات لا JSX مكرَّراً في لغتين.
 */
export function DocSection({
  locale,
  doc,
  id,
  hasIntro = true,
  listCount = 0,
}: {
  locale: Locale;
  doc: "privacy" | "terms" | "cookies";
  id: string;
  hasIntro?: boolean;
  listCount?: number;
}) {
  const k = (suffix: string) => t(locale, `legal.${doc}.${id}${suffix}`);
  return (
    <Section title={k("Title")}>
      {hasIntro && <p>{k("Body")}</p>}
      {listCount > 0 && (
        <List items={Array.from({ length: listCount }, (_, i) => k(`L${i + 1}`))} />
      )}
    </Section>
  );
}
