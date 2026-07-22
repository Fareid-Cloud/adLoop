// app/forgot-password/page.tsx

"use client";

import { useState, useEffect } from "react";
import { t, Locale } from "@/lib/i18n/dictionary";

export default function ForgotPasswordPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocale(navigator.language.toLowerCase().startsWith("en") ? "en" : "ar");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true); // نفس الرسالة دائماً، بغضّ النظر عن وجود البريد أم لا
  }

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      className="flex min-h-screen items-center justify-center bg-bg px-4 font-display"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold tracking-tight text-text-primary">AdLoop</div>
          <div className="mt-1 text-sm text-text-muted">{t(locale, "auth.forgotTitle")}</div>
        </div>
        {sent ? (
          <p className="text-center text-sm text-verified">{t(locale, "auth.forgotSent")}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder={t(locale, "auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mb-3 block w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t(locale, "auth.sending") : t(locale, "auth.sendResetLink")}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-[13px]">
          <a href="/login" className="text-accent no-underline">
            {t(locale, "auth.goToLogin")}
          </a>
        </p>
      </div>
    </div>
  );
}
