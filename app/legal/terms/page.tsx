// app/legal/terms/page.tsx
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
    <DocShell title={t(locale, "legal.termsTitle")} updated={updated} locale={locale}>
      <DocSection locale={locale} doc="terms" id="accept" />
      <DocSection locale={locale} doc="terms" id="service" />
      <DocSection locale={locale} doc="terms" id="user" listCount={5} />
      <DocSection locale={locale} doc="terms" id="automation" />
      <DocSection locale={locale} doc="terms" id="billing" listCount={5} />
      <DocSection locale={locale} doc="terms" id="liability" />
      <DocSection locale={locale} doc="terms" id="termination" />
    </DocShell>
  );
}
