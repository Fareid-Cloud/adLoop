// app/dashboard/billing/result/page.tsx
//
// العودة من بوّابة الدفع. الصفحة تقرأ ولا تُفعّل: التفعيل من الويب هوك
// وحده، لأن هذا الرابط يُفتح مباشرةً بلا أي دفع.

import { getSessionUserFromCookies } from "@/lib/auth";
import { PaymentResultClient } from "./PaymentResultClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const raw = Array.isArray(sp.intent) ? sp.intent[0] : sp.intent;
  if (!raw) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "payResult.failedBody")}</div>;
  }

  return <PaymentResultClient intentId={raw} locale={locale} />;
}
