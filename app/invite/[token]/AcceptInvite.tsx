"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
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
      <p className="mt-5 flex items-center justify-center gap-1.5 text-[13px] text-verified">
        <Check size={15} /> {t(locale, "team.membersTitle")}
      </p>
    );
  }

  return (
    <div className="mt-5">
      <button onClick={accept} disabled={busy} className="btn btn-primary h-10 w-full">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        <span className="ms-1.5">{t(locale, "team.invite")}</span>
      </button>
      {error && <p role="alert" className="mt-2 text-[12px] text-critical">{error}</p>}
    </div>
  );
}
