// app/legal/Doc.tsx
//
// عناصر عرض موحّدة لصفحات السياسات، ثنائية اللغة.
//
// **الوثيقة القانونية لا تُترجَم آلياً.** كل نصّ هنا مكتوب في اللغتين
// بصياغة مستقلّة: الترجمة الحرفية لبند قانوني تُنتج التزاماً مختلفاً عمّا
// قُصد. لذلك النصّان محرَّران لا منقولان.

import type { ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DocShell({
  title, updated, locale, children,
}: {
  title: string;
  updated: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <article dir={locale === "en" ? "ltr" : "rtl"}>
      <h1 className="mb-1 text-2xl font-bold text-text-primary">{title}</h1>
      <p className="mb-6 text-xs text-text-faint">{t(locale, "legal.updated", { date: updated })}</p>
      <div className="mb-8 rounded-xl card-shadow border border-border bg-surface p-4 text-[13px] leading-relaxed text-text-muted">
        {t(locale, "legal.disclaimer")}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-text-primary">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pe-5 ps-5 text-sm leading-relaxed text-text-muted">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/**
 * قسم كامل من القاموس: العنوان، وفقرة اختيارية، وقائمة اختيارية.
 * الصفحات صارت بيانات لا JSX مكرّراً في لغتين.
 */
export function DocSection({
  locale, doc, id, hasIntro = true, listCount = 0,
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
