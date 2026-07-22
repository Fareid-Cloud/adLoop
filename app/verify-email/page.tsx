// app/verify-email/page.tsx

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { t, Locale } from "@/lib/i18n/dictionary";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [locale, setLocale] = useState<Locale>("ar");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocale(navigator.language.toLowerCase().startsWith("en") ? "en" : "ar");
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError(null);
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json();
          setStatus("error");
          setError(data.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setError(t(locale, "auth.genericError"));
      });
  }, [token]);

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      className="flex min-h-screen items-center justify-center bg-bg px-4 font-display"
    >
      <div className="w-full max-w-sm rounded-2xl card-shadow border border-border bg-surface p-8 text-center">
        <div className="mb-4 text-lg font-bold tracking-tight text-text-primary">AdLoop</div>
        {status === "loading" && <p className="text-text-muted">{t(locale, "auth.verifying")}</p>}
        {status === "success" && (
          <>
            <h1 className="mb-2 text-lg font-semibold text-verified">{t(locale, "auth.verifySuccess")}</h1>
            <a href="/dashboard" className="text-sm text-accent no-underline">
              {t(locale, "auth.goToDashboard")}
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="mb-2 text-lg font-semibold text-critical">{t(locale, "auth.verifyFailed")}</h1>
            <p className="text-sm text-text-muted">{error ?? t(locale, "auth.invalidLink")}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
