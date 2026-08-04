// app/components/ImpersonationBanner.tsx

"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function ImpersonationBanner({ locale = "ar" }: { locale?: Locale }) {
  const [returning, setReturning] = useState(false);

  async function handleReturn() {
    setReturning(true);
    await fetch("/api/admin/stop-impersonating", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <div className="btn btn-danger btn-sm justify-between">
      <span>{t(locale, "ui.impersonating")}</span>
      <button
        onClick={handleReturn}
        disabled={returning}
        className="rounded-full bg-white/20 px-3 py-1 text-white hover:bg-white/30"
      >
        {returning ? t(locale, "ui.impersonateGoing") : t(locale, "ui.impersonateBack")}
      </button>
    </div>
  );
}
