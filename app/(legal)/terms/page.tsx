// app/(legal)/terms/page.tsx
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
    <DocShell title={t(locale, "legal.termsTitle")} updated={updated} locale={locale}>
      <DocSection locale={locale} doc="terms" id="accept" />
      <DocSection locale={locale} doc="terms" id="service" />
      <DocSection locale={locale} doc="terms" id="accuracy" listCount={5} />
      <DocSection locale={locale} doc="terms" id="user" listCount={9} />
      <DocSection locale={locale} doc="terms" id="acceptable" listCount={5} />
      <DocSection locale={locale} doc="terms" id="automation" listCount={5} />
      <DocSection locale={locale} doc="terms" id="ip" />
      <DocSection locale={locale} doc="terms" id="dataOwn" />
      <DocSection locale={locale} doc="terms" id="trial" />
      <DocSection locale={locale} doc="terms" id="billing" listCount={7} />
      <DocSection locale={locale} doc="terms" id="availability" />
      <DocSection locale={locale} doc="terms" id="thirdParty" />
      <DocSection locale={locale} doc="terms" id="liability" listCount={7} />
      <DocSection locale={locale} doc="terms" id="indemnity" listCount={5} />
      <DocSection locale={locale} doc="terms" id="termination" />
      <DocSection locale={locale} doc="terms" id="support" />
      <DocSection locale={locale} doc="terms" id="changes" />
      <DocSection locale={locale} doc="terms" id="force" />
      <DocSection locale={locale} doc="terms" id="law" />
      <DocSection locale={locale} doc="terms" id="general" hasIntro={false} listCount={6} />
    </DocShell>
  );
}
