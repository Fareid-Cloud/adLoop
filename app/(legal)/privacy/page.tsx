// app/(legal)/privacy/page.tsx
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
    <DocShell title={t(locale, "legal.privacyTitle")} updated={updated} locale={locale}>
      <DocSection locale={locale} doc="privacy" id="intro" />
      <DocSection locale={locale} doc="privacy" id="collect" listCount={5} />
      <DocSection locale={locale} doc="privacy" id="basis" listCount={4} />
      <DocSection locale={locale} doc="privacy" id="use" listCount={5} />
      <DocSection locale={locale} doc="privacy" id="share" listCount={5} />
      <DocSection locale={locale} doc="privacy" id="processors" listCount={5} />
      <DocSection locale={locale} doc="privacy" id="transfer" />
      <DocSection locale={locale} doc="privacy" id="security" listCount={4} />
      <DocSection locale={locale} doc="privacy" id="retention" listCount={5} />
      <DocSection locale={locale} doc="privacy" id="rights" listCount={5} />
      <DocSection locale={locale} doc="privacy" id="children" />
      <DocSection locale={locale} doc="privacy" id="complaint" />
      <DocSection locale={locale} doc="privacy" id="updates" />
      <DocSection locale={locale} doc="privacy" id="contact" />
    </DocShell>
  );
}
