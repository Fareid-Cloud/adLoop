// app/signup/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { t, Locale } from "@/lib/i18n/dictionary";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";

export default function SignupPage() {
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

  // تحميل سكريبت Cloudflare Turnstile وتفعيل الويدجت - عنصر غير مرئي
  // (Invisible) مش صور أو ألغاز، بيشتغل في الخلفية تلقائياً
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return; // في بيئة التطوير من غير مفتاح، الفورم بيشتغل عادي من غيرها

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
    <div dir={isRTL ? "rtl" : "ltr"} style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>{t(locale, "auth.signupTitle")} - AdLoop</h1>

      <a
        href="/api/oauth/login-google/start"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: 10, marginBottom: 10, border: "1px solid #ddd",
          borderRadius: 6, textDecoration: "none", color: "#3c4043", background: "#fff",
        }}
      >
        {isRTL ? "التسجيل بحساب جوجل" : "Sign up with Google"}
      </a>
      <a
        href="/api/oauth/login-facebook/start"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: 10, marginBottom: 18, border: "none",
          borderRadius: 6, textDecoration: "none", color: "#fff", background: "#0866FF",
        }}
      >
        {isRTL ? "التسجيل بحساب فيسبوك" : "Sign up with Facebook"}
      </a>
      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: "14px 0" }}>
        {isRTL ? "أو" : "or"}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={locale === "ar" ? "الاسم" : "Name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 12, padding: 8 }}
        />
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
          placeholder={`${t(locale, "auth.password")} (${t(locale, "auth.passwordHint")})`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ display: "block", width: "100%", marginBottom: 4, padding: 8 }}
        />
        <PasswordRequirements password={password} />
        {error && <p style={{ color: "red" }}>{error}</p>}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div
            className="cf-turnstile"
            data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            data-callback="onTurnstileSuccess"
            style={{ marginBottom: 12 }}
          />
        )}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? t(locale, "auth.signupLoading") : t(locale, "auth.signupButton")}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        {t(locale, "auth.hasAccount")} <a href="/login">{t(locale, "auth.goToLogin")}</a>
      </p>
    </div>
  );
}
