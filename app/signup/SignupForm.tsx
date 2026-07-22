"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { t, Locale } from "@/lib/i18n/dictionary";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";

const INPUT_CLASS =
  "mb-3 block w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent";
const PRIMARY_BTN =
  "w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export function SignupForm() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    setLocale(browserLang.startsWith("en") ? "en" : "ar");
  }, []);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    (window as any).onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    return () => {
      document.body.removeChild(script);
      delete (window as any).onTurnstileSuccess;
    };
  }, []);

  const isRTL = locale === "ar";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, preferredLocale: locale, turnstileToken }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? t(locale, "auth.invalidCredentials"));
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 font-display"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold tracking-tight text-text-primary">AdLoop</div>
          <div className="mt-1 text-sm text-text-muted">{t(locale, "auth.signupTitle")}</div>
        </div>

        <a
          href="/api/oauth/login-google/start"
          className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium no-underline"
          style={{ background: "#fff", color: "#3c4043", border: "1px solid #dadce0" }}
        >
          {t(locale, "auth.googleSignup")}
        </a>
        <a
          href="/api/oauth/login-facebook/start"
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white no-underline"
          style={{ background: "#0866FF" }}
        >
          {t(locale, "auth.facebookSignup")}
        </a>

        <div className="mb-5 flex items-center gap-3 text-xs text-text-faint">
          <span className="h-px flex-1 bg-border" />
          {t(locale, "auth.or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder={t(locale, "auth.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            type="email"
            placeholder={t(locale, "auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={INPUT_CLASS}
          />
          <input
            type="password"
            placeholder={t(locale, "auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={INPUT_CLASS.replace("mb-3", "mb-1")}
          />
          <PasswordRequirements password={password} />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div
              className="cf-turnstile mb-3"
              data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              data-callback="onTurnstileSuccess"
            />
          )}
          <button type="submit" disabled={loading} className={PRIMARY_BTN}>
            {loading ? t(locale, "auth.signupLoading") : t(locale, "auth.signupButton")}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-text-muted">
          {t(locale, "auth.hasAccount")}{" "}
          <a href="/login" className="text-accent no-underline">
            {t(locale, "auth.goToLogin")}
          </a>
        </p>
      </div>
    </div>
  );
}
