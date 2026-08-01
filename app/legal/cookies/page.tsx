// app/legal/cookies/page.tsx
//
// الوثيقة نفسها في اللغتين من قاموس واحد. النصّان محرَّران لا منقولان:
// الترجمة الحرفية لبند قانوني تُنتج التزاماً مختلفاً عمّا قُصد.

import type { Metadata } from "next";
import { getSessionUserFromCookies } from "@/lib/auth";
import { DocShell, DocSection } from "../Doc";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const metadata: Metadata = { title: "AdLoop" };

export default async function LegalPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const updated = locale === "en" ? "22 July 2026" : "22 يوليو 2026";

  return (
    <DocShell title={t(locale, "legal.cookiesTitle")} updated={updated} locale={locale}>
      <DocSection locale={locale} doc="cookies" id="what" />
      <DocSection locale={locale} doc="cookies" id="types" listCount={4} />
      <DocSection locale={locale} doc="cookies" id="third" />
      <DocSection locale={locale} doc="cookies" id="control" />
    </DocShell>
  );
}
