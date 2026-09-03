"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, LogOut } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function AcceptInvite({ token, locale }: { token: string; locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    setBusy(false);

    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? t(locale, "team.inviteFailed"));
      return;
    }
    setDone(true);
    // مهلةٌ قصيرة عشان التأكيد يُقرأ: تحويلٌ فوريّ بيخلّي الشاشة تومض
    // بلا ما يعرف صاحبها إن كان نجح.
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  if (done) {
    return (
      // 🔴 كانت بتعرض `team.membersTitle` («الأعضاء») كرسالةِ نجاح -
      // عنوانُ قائمةٍ في شاشةٍ تانية، مالوش أيُّ معنى هنا.
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-verified">
        <Check size={15} /> {t(locale, "invitePage.accepted")}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {/* 🔴 الزرارُ كان مكتوباً عليه `team.invite` («ادعُ») - وهو فعلُ
          الطرف التاني لا فعلُه هو. اللي قدّامه بيقبل، مش بيدعو. */}
      <button onClick={accept} disabled={busy} className="btn btn-primary h-10 w-full justify-center">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        <span className="ms-1.5">{t(locale, "invitePage.accept")}</span>
      </button>
      {error && <p role="alert" className="mt-2 text-center text-[12px] text-critical">{error}</p>}
    </div>
  );
}

/**
 * تبديلُ الحساب لمَن فتح الدعوة وهو داخلٌ ببريدٍ غير المدعوّ.
 *
 * الخروجُ `POST` لأنّه بيبطّل الجلسة على الخادم كمان (مش بيمسح كوكي وبس)،
 * فمينفعش يبقى رابطاً - ولازم كلاينت كومبوننت يندهه ويرجّعه للدعوة بعد
 * الدخول الصحيح.
 */
export function SwitchAccount({ token, label }: { token: string; label: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST", headers: getCsrfHeader() }).catch(() => {});
        window.location.assign(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      }}
      disabled={busy}
      className="btn btn-secondary btn-sm mt-2.5 w-full justify-center"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
      <span className="ms-1.5">{label}</span>
    </button>
  );
}
