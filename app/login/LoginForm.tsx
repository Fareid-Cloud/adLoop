"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { t, Locale } from "@/lib/i18n/dictionary";
import { useAuthLocale } from "@/app/components/useAuthLocale";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { AuthShell } from "@/app/components/AuthShell";
import { SocialButton, FIELD, PRIMARY_BTN } from "@/app/components/AuthControls";

export function LoginForm({ nextPath = "/dashboard", expired = false }: { nextPath?: string; expired?: boolean }) {
  const router = useRouter();
  const [locale, setLocale] = useAuthLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const ar = locale === "ar";

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
    // تحميل كامل لا `router.push`: الكوكي وصل للتوّ في رأس الاستجابة، بينما
    // راوتر العميل قد يخدم حمولة RSC مخبّأة من قبل تسجيل الدخول - فتبقى
    // الصفحة مكانها بلا رسالة ولا انتقال. التحميل الكامل يقرأ الجلسة الجديدة.
    window.location.assign(nextPath);
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/verify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingToken, code: mfaCode, rememberDevice }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? t(locale, "auth.mfaInvalid"));
      return;
    }
    // تحميل كامل لا `router.push`: الكوكي وصل للتوّ في رأس الاستجابة، بينما
    // راوتر العميل قد يخدم حمولة RSC مخبّأة من قبل تسجيل الدخول - فتبقى
    // الصفحة مكانها بلا رسالة ولا انتقال. التحميل الكامل يقرأ الجلسة الجديدة.
    window.location.assign(nextPath);
  }

  return (
    <AuthShell locale={locale} onLocaleChange={setLocale}>
      <div className="mb-7">
        <div className="mb-6 text-[17px] font-bold tracking-tight text-text-primary">AdLoop</div>
        <h1 className="page-title">
          {pendingToken ? t(locale, "auth.mfaTitle") : t(locale, "auth.loginTitle")}
        </h1>
        {!pendingToken && (
          <p className="mt-1.5 text-[14px] text-text-muted">
            {ar ? "أهلاً بعودتك — سجّل الدخول للمتابعة." : "Welcome back — sign in to continue."}
          </p>
        )}
      </div>

      {/* لا تُعرض مع شاشة التحقّق بخطوتين: من وصل إليها قد سجّل دخوله
          الآن، فتذكيره بجلسةٍ انتهت قبل دقيقة يربكه بلا فائدة. */}
      {expired && !pendingToken && (
        <div className="mb-5 rounded-xl border border-gap/30 bg-gap/[0.07] p-3 text-[12.5px] leading-relaxed text-text-primary">
          {t(locale, "auth.sessionExpiredNotice")}
        </div>
      )}

      {pendingToken ? (
        <form onSubmit={handleMfaSubmit}>
          <p className="mb-4 text-[13px] text-text-muted">{t(locale, "auth.mfaHint")}</p>
          {/* 🔴 **كان `maxLength={6}` و`inputMode="numeric"`** - فكودُ
              الاسترجاع (عشرةُ محارفَ بحروف) **يستحيل كتابتُه هنا أصلاً**،
              ويبقى مسارُ من فقد هاتفه مبنيّاً في الخادم وغيرَ قابلٍ للوصول
              من الواجهة. الطول يتّسع للاثنين، والإدخال نصّيّ. */}
          <input
            type="text"
            maxLength={11}
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            required
            autoComplete="one-time-code"
            className={`${FIELD} mb-3 text-center font-mono text-2xl tracking-[0.3em]`}
          />

          {/* «لا تسألني على هذا الجهاز»: السؤالُ عند كلّ دخولٍ من الحاسوب
              نفسه احتكاكٌ يوميّ يدفع الناس إلى إطفاء التحقّق كلّه. والحماية
              تبقى حيث تنفع - أوّلُ دخولٍ من جهازٍ جديد يُسأل دائماً. */}
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-[12.5px] text-text-muted">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t(locale, "auth.rememberDevice")}
          </label>

          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <button type="submit" disabled={loading} className={PRIMARY_BTN}>
            {loading ? t(locale, "auth.mfaVerifying") : t(locale, "auth.mfaConfirm")}
          </button>
          <p className="mt-3 text-center text-[11.5px] leading-relaxed text-text-faint">
            {t(locale, "auth.mfaLostPhone")}
          </p>
        </form>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-2.5">
            <SocialButton href="/api/oauth/login-google/start" logo={<PlatformLogo platform="GOOGLE" size={18} />}>
              {t(locale, "auth.googleContinue")}
            </SocialButton>
            <SocialButton href="/api/oauth/login-facebook/start" logo={<PlatformLogo platform="FACEBOOK" size={18} />}>
              {t(locale, "auth.facebookContinue")}
            </SocialButton>
          </div>

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
              className={`${FIELD} mb-3`}
            />
            <div className="relative mb-3">
              <input
                type={showPw ? "text" : "password"}
                placeholder={t(locale, "auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${FIELD} field-icon-end`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 end-3 flex items-center text-text-faint hover:text-text-primary"
                aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && <p className="mb-2 text-xs text-critical">{error}</p>}
            <button type="submit" disabled={loading} className={PRIMARY_BTN}>
              {loading ? t(locale, "auth.loginLoading") : t(locale, "auth.loginButton")}
            </button>
          </form>

          <div className="mt-5 flex flex-col gap-2 text-center text-[13px]">
            <a href="/forgot-password" className="text-text-muted no-underline hover:text-text-primary">
              {t(locale, "auth.forgotPassword")}
            </a>
            <p className="text-text-muted">
              {t(locale, "auth.noAccount")}{" "}
              <a href="/signup" className="font-medium text-accent no-underline">
                {t(locale, "auth.createAccount")}
              </a>
            </p>
          </div>
        </>
      )}
    </AuthShell>
  );
}
