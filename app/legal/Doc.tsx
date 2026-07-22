// عناصر عرض موحّدة لصفحات السياسات - عشان الصفحات الثلاث تفضل متسقة
// الشكل من غير تكرار تنسيقات في كل ملف.
import type { ReactNode } from "react";

export function DocShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article>
      <h1 className="mb-1 text-2xl font-bold text-text-primary">{title}</h1>
      <p className="mb-6 text-xs text-text-faint">آخر تحديث: {updated}</p>
      <div className="mb-8 rounded-xl card-shadow border border-border bg-surface p-4 text-[13px] leading-relaxed text-text-muted">
        هذه الوثيقة مسودة أولية أُعدّت بناءً على وظائف المنصة، وهي للتوضيح ولا تُعدّ
        استشارة قانونية. يُنصح بمراجعتها من مختص قانوني قبل الاعتماد النهائي.
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
    <ul className="flex list-disc flex-col gap-1.5 pe-5 text-sm leading-relaxed text-text-muted">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
