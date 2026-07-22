// app/reset-password/page.tsx

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { t, Locale } from "@/lib/i18n/dictionary";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [locale, setLocale] = useState<Locale>("ar");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLocale(navigator.language.toLowerCase().startsWith("en") ? "en" : "ar");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return <p className="text-center text-sm text-critical">{t(locale, "auth.invalidLink")}</p>;
  }

  return (
    <>
      <div className="mb-6 text-center">
        <div className="text-lg font-bold tracking-tight text-text-primary">AdLoop</div>
        <div className="mt-1 text-sm text-text-muted">{t(locale, "auth.resetTitle")}</div>
      </div>
      {success ? (
        <p className="text-center text-sm text-verified">{t(locale, "auth.resetSuccess")}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder={t(locale, "auth.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="mb-1 block w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent"
          />
          <PasswordRequirements password={newPassword} />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t(locale, "auth.saving") : t(locale, "auth.savePassword")}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      dir="rtl"
      data-accent="blue"
      data-mode="light"
      className="flex min-h-screen items-center justify-center bg-bg px-4 font-display"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <Suspense fallback={<div />}>
          <ResetPasswordInner />
        </Suspense>
      </div>
    </div>
  );
}
