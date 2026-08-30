// app/(legal)/cookies/page.tsx
//
// الوثيقة نفسها في اللغتين من قاموس واحد. النصّان محرَّران لا منقولان:
// الترجمة الحرفية لبند قانوني تُنتج التزاماً مختلفاً عمّا قُصد.

import type { Metadata } from "next";
import { getSessionUserFromCookies } from "@/lib/auth";
import { DocShell, DocSection } from "@/app/components/legal/Doc";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const metadata: Metadata = { title: "AdLoop" };

export default async function LegalPage() {
  const user = await getSessionUserFromCookies().catch(() => null);
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  const updated = locale === "en" ? "4 August 2026" : "4 أغسطس 2026";

  return (
    <DocShell title={t(locale, "legal.cookiesTitle")} updated={updated} locale={locale}>
      <DocSection locale={locale} doc="cookies" id="what" />
      <DocSection locale={locale} doc="cookies" id="types" />
      <DocSection locale={locale} doc="cookies" id="list" listCount={5} />
      <DocSection locale={locale} doc="cookies" id="third" />
      <DocSection locale={locale} doc="cookies" id="legal" />
      <DocSection locale={locale} doc="cookies" id="control" />
    </DocShell>
  );
}
