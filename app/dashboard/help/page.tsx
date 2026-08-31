// app/dashboard/help/page.tsx - مركز المساعدة كصفحة كاملة (نفس محتوى زر ؟)
import { HELP_SECTIONS, helpText } from "@/lib/helpContent";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { LifeBuoy } from "lucide-react";

export const metadata = { title: "Help centre — AdLoop" };

export default async function HelpPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string) => t(locale, `helpPage.${k}`);

  return (
    <div className="mx-auto max-w-3xl">
      {/* كانت الصفحة الوحيدة برأسٍ يدويّ بلا أيقونة ولا نبرة، بينما يحمل
          `PageHeader` هويّة كلّ صفحةٍ أخرى - ففُقدت هويّتها عند فتحها. */}
      <PageHeader
        icon={LifeBuoy}
        tone="accent"
        title={tr("title")}
        description={tr("subtitle")}
      />

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
