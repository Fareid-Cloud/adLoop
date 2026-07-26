// app/dashboard/help/page.tsx - مركز المساعدة كصفحة كاملة (نفس محتوى زر ؟)
import { HELP_SECTIONS } from "@/lib/helpContent";

export const metadata = { title: "مركز المساعدة — AdLoop" };

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-[26px] font-semibold text-text-primary">مركز المساعدة</h1>
      <p className="mb-6 text-sm text-text-muted">
        إجابات عن أكثر ما يُسأل حول AdLoop: كيف يعمل التحقق، وكيف تُتخذ القرارات، وكيف تدير حسابك.
      </p>

      <div className="flex flex-col gap-6">
        {HELP_SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2.5 text-sm font-semibold text-text-primary">{s.title}</h2>
            <div className="flex flex-col gap-2">
              {s.articles.map((a) => (
                <details key={a.id} className="card-shadow group rounded-xl border border-border bg-surface p-4">
                  <summary className="cursor-pointer list-none text-[14px] font-medium text-text-primary">{a.q}</summary>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-muted">{a.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface-raised p-4 text-center text-sm text-text-muted">
        لم تجد إجابتك؟ استخدم زر المحادثة أسفل الشاشة وسيصلك الرد داخل المحادثة نفسها.
      </div>
    </div>
  );
}
