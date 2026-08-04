// app/dashboard/help/page.tsx - مركز المساعدة كصفحة كاملة (نفس محتوى زر ؟)
import { HELP_SECTIONS, helpText } from "@/lib/helpContent";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const metadata = { title: "Help Center — AdLoop" };

export default async function HelpPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string) => t(locale, `helpPage.${k}`);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-[26px] font-semibold tracking-tight text-text-primary">{tr("title")}</h1>
      <p className="mb-6 text-sm text-text-muted">{tr("subtitle")}</p>

      <div className="flex flex-col gap-6">
        {HELP_SECTIONS.map((s) => (
          <section key={s.title.en}>
            <h2 className="mb-2.5 section-title">
              {helpText(locale, s.title)}
            </h2>
            <div className="flex flex-col gap-2">
              {s.articles.map((a) => (
                <details key={a.id} className="card-shadow group card pad-md">
                  <summary className="cursor-pointer list-none text-[14px] font-medium text-text-primary">
                    {helpText(locale, a.q)}
                  </summary>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-muted">
                    {helpText(locale, a.a)}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card-shadow mt-8 card-inset pad-md text-center text-sm text-text-muted">
        {tr("noAnswer")}
      </div>
    </div>
  );
}
