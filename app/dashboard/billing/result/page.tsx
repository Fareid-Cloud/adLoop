// app/dashboard/billing/result/page.tsx
//
// العودة من بوّابة الدفع. الصفحة تقرأ ولا تُفعّل: التفعيل من الويب هوك
// وحده، لأن هذا الرابط يُفتح مباشرةً بلا أي دفع.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  // 🔴 **بلا `?intent=` كانت الصفحة تعلن الفشل فوراً - لكلّ من نجح دفعُه.**
  //
  // نُرسل الرابط الآن مع كلّ نيّة فيحمل معرّفها (`lib/paymob.ts`)، لكنّ
  // رابط لوحة Paymob ثابتٌ بلا معرّف، وهو ما يُستعمل إن ضُبط هناك أو إن
  // تغيّر الإعداد. فيبقى المخرج: أحدثُ نيّةٍ معلّقةٍ لهذا الحساب - وهي
  // بالتعريف العمليةُ التي عاد منها للتوّ.
  //
  // والبحث مقصورٌ على **صاحب الجلسة**، فلا يرى أحدٌ حالة دفع غيره.
  const raw = Array.isArray(sp.intent) ? sp.intent[0] : sp.intent;
  let intentId = raw ?? null;

  if (!intentId) {
    const recent = await prisma.paymentIntent.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    intentId = recent?.id ?? null;
  }

  if (!intentId) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "payResult.failedBody")}</div>;
  }

  return <PaymentResultClient intentId={intentId} locale={locale} />;
}
