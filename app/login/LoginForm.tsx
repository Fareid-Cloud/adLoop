"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { t, Locale } from "@/lib/i18n/dictionary";
import { PlatformLogo } from "@/app/components/PlatformLogo";

const INPUT_CLASS =
  "mb-3 block w-full rounded-xl card-shadow border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent";
const PRIMARY_BTN =
  "w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export function LoginForm() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    setLocale(browserLang.startsWith("en") ? "en" : "ar");
  }, []);

  const isRTL = locale === "ar";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? t(locale, "auth.invalidCredentials"));
      return;
    }
    if (data.mfaRequired) {
      setPendingToken(data.pendingToken);
      return;
    }
    router.push("/dashboard");
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingToken, code: mfaCode }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? t(locale, "auth.mfaInvalid"));
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      className="flex min-h-screen items-center justify-center bg-bg px-4 font-display"
    >
      <div className="w-full max-w-sm rounded-2xl card-shadow border border-border bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold tracking-tight text-text-primary">AdLoop</div>
          <div className="mt-1 text-sm text-text-muted">
            {pendingToken ? t(locale, "auth.mfaTitle") : t(locale, "auth.loginTitle")}
          </div>
        </div>

        {pendingToken ? (
          <form onSubmit={handleMfaSubmit}>
            <p className="mb-4 text-center text-xs text-text-muted">{t(locale, "auth.mfaHint")}</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              required
              className="mb-3 block w-full rounded-xl card-shadow border border-border bg-surface-raised px-3.5 py-2.5 text-center font-mono text-2xl tracking-[0.4em] text-text-primary outline-none focus:border-accent"
            />
            {error && <p className="mb-2 text-xs text-critical">{error}</p>}
            <button type="submit" disabled={loading} className={PRIMARY_BTN}>
              {loading ? t(locale, "auth.mfaVerifying") : t(locale, "auth.mfaConfirm")}
            </button>
          </form>
        ) : (
          <>
            <a
              href="/api/oauth/login-google/start"
              className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-xl py-2.5 text-sm font-medium no-underline"
              style={{ background: "#fff", color: "#3c4043", border: "1px solid #dadce0" }}
            >
              <PlatformLogo platform="GOOGLE_ADS" size={18} />
              {t(locale, "auth.googleContinue")}
            </a>
            <a
              href="/api/oauth/login-facebook/start"
              className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl py-2.5 text-sm font-medium text-white no-underline"
              style={{ background: "#0866FF" }}
            >
              <PlatformLogo platform="FACEBOOK" size={18} />
              {t(locale, "auth.facebookContinue")}
            </a>

            <div className="mb-5 flex items-center gap-3 text-xs text-text-faint">
              <span className="h-px flex-1 bg-border" />
              {t(locale, "auth.or")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder={t(locale, "auth.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={INPUT_CLASS}
              />
              <div className="relative mb-3">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder={t(locale, "auth.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full rounded-xl card-shadow border border-border bg-surface-raised px-3.5 py-2.5 pe-10 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary"
                  aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {error && <p className="mb-2 text-xs text-critical">{error}</p>}
              <button type="submit" disabled={loading} className={PRIMARY_BTN}>
                {loading ? t(locale, "auth.loginLoading") : t(locale, "auth.loginButton")}
              </button>
            </form>

            <div className="mt-4 flex flex-col gap-2 text-center text-[13px]">
              <a href="/forgot-password" className="text-text-muted no-underline hover:text-text-primary">
                {t(locale, "auth.forgotPassword")}
              </a>
              <p className="text-text-muted">
                {t(locale, "auth.noAccount")}{" "}
                <a href="/signup" className="text-accent no-underline">
                  {t(locale, "auth.createAccount")}
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
