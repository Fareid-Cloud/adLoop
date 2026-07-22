// app/login/page.tsx
//
// نسخة وظيفية بسيطة عشان نقدر نختبر الـ auth كامل - التصميم النهائي
// (ألوان، خطوط، هوية بصرية) هنشتغل عليه في مرحلة الـ UI منفصلة.
// اللغة والاتجاه (RTL/LTR) بيتحددوا من متصفح المستخدم فعلياً، مش نص ثابت.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { t, Locale } from "@/lib/i18n/dictionary";

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // خطوة MFA - بتظهر بس لو الحساب مفعّل فيه التحقق بخطوتين
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    // نفس منطق detectLocale في السيرفر، بس هنا من متصفح المستخدم فعلياً
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
      setError(data.error ?? "الكود غير صحيح");
      return;
    }

    router.push("/dashboard");
  }

  if (pendingToken) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} style={{ maxWidth: 360, margin: "80px auto" }}>
        <h1>كود التحقق</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          افتح تطبيق المصادقة (Google Authenticator أو مشابه) وأدخل الكود المكوّن من 6 أرقام
        </p>
        <form onSubmit={handleMfaSubmit}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            required
            style={{ display: "block", width: "100%", marginBottom: 12, padding: 8, textAlign: "center", fontSize: 24, letterSpacing: 8 }}
          />
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
            {loading ? "جارٍ التحقق..." : "تأكيد"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      style={{ maxWidth: 360, margin: "80px auto", fontFamily: isRTL ? undefined : "sans-serif" }}
    >
      <h1>{t(locale, "auth.loginTitle")} - AdLoop</h1>

      <a
        href="/api/oauth/login-google/start"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: 10, marginBottom: 10, border: "1px solid #ddd",
          borderRadius: 6, textDecoration: "none", color: "#3c4043", background: "#fff",
        }}
      >
        {isRTL ? "الدخول بحساب جوجل" : "Continue with Google"}
      </a>
      <a
        href="/api/oauth/login-facebook/start"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: 10, marginBottom: 18, border: "none",
          borderRadius: 6, textDecoration: "none", color: "#fff", background: "#0866FF",
        }}
      >
        {isRTL ? "الدخول بحساب فيسبوك" : "Continue with Facebook"}
      </a>
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: "14px 0" }}>
        {isRTL ? "أو" : "or"}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder={t(locale, "auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 12, padding: 8 }}
        />
        <input
          type="password"
          placeholder={t(locale, "auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 12, padding: 8 }}
        />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? t(locale, "auth.loginLoading") : t(locale, "auth.loginButton")}
        </button>
      </form>
      <a href="/forgot-password" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        نسيت كلمة المرور؟
      </a>
      <p style={{ marginTop: 16 }}>
        {t(locale, "auth.noAccount")} <a href="/signup">{t(locale, "auth.createAccount")}</a>
      </p>
    </div>
  );
}

