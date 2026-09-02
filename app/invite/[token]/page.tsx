// app/invite/[token]/page.tsx
//
// صفحةُ قبول الدعوة.
//
// **الرمزُ في المسار لا في `?query`**: روابطُ الاستعلام بتتسرّب في
// ترويسة `Referer` لأيّ طرفٍ خارجيّ تفتحه الصفحة، وده رمزُ وصول.

import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { AcceptInvite } from "./AcceptInvite";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getSessionUserFromCookies();

  // مش مسجّل: يسجّل ويرجع هنا. مابنعملش حساباً نيابةً عنه - كلمةُ سرٍّ
  // مانعرفهاش أو حسابٌ بلا كلمة سر، والاتنين أسوأ من خطوةٍ زيادة.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-accent/12 text-accent">
          <Users size={22} />
        </span>
        <h1 className="text-xl font-semibold text-text-primary">{t(locale, "team.title")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{user.email}</p>
        <AcceptInvite token={token} locale={locale} />
      </div>
    </main>
  );
}
