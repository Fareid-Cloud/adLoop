"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { t, Locale } from "@/lib/i18n/dictionary";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";
import { PlatformLogo } from "@/app/components/PlatformLogo";

const FIELD =
  "block w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors focus:border-accent";
const PRIMARY_BTN =
  "w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";

const GENDERS = [{ v: "male", ar: "ذكر", en: "Male" }, { v: "female", ar: "أنثى", en: "Female" }];
const COUNTRIES = ["السعودية", "مصر", "الإمارات", "الكويت", "قطر", "البحرين", "عُمان", "الأردن", "المغرب", "أخرى"];
const COUNTRIES_EN = ["Saudi Arabia", "Egypt", "UAE", "Kuwait", "Qatar", "Bahrain", "Oman", "Jordan", "Morocco", "Other"];
const AD_SPEND = [
  { v: "lt_500", ar: "أقل من 500$", en: "< $500" },
  { v: "500_2k", ar: "500$ – 2000$", en: "$500 – $2K" },
  { v: "2k_10k", ar: "2000$ – 10000$", en: "$2K – $10K" },
  { v: "10k_50k", ar: "10000$ – 50000$", en: "$10K – $50K" },
  { v: "50k_plus", ar: "أكثر من 50000$", en: "$50K+" },
];
const CLIENTS = [
  { v: "solo", ar: "عميل واحد (نفسي)", en: "Just myself" },
  { v: "1_5", ar: "1 – 5", en: "1 – 5" },
  { v: "5_20", ar: "5 – 20", en: "5 – 20" },
  { v: "20_50", ar: "20 – 50", en: "20 – 50" },
  { v: "50_plus", ar: "أكثر من 50", en: "50+" },
];
const HEARD = [
  { v: "google", ar: "بحث Google", en: "Google search" },
  { v: "social", ar: "وسائل التواصل", en: "Social media" },
  { v: "friend", ar: "صديق / زميل", en: "Friend / colleague" },
  { v: "youtube", ar: "YouTube", en: "YouTube" },
  { v: "other", ar: "أخرى", en: "Other" },
];

export function SignupForm() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [f, setF] = useState({
    name: "", username: "", email: "", password: "", confirm: "",
    companyName: "", gender: "", country: "", adSpendMonthly: "", businessScale: "", howHeard: "", referralSource: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => setLocale(navigator.language.toLowerCase().startsWith("en") ? "en" : "ar"), []);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    (window as any).onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    return () => { document.body.removeChild(script); delete (window as any).onTurnstileSuccess; };
  }, []);

  const ar = locale === "ar";
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.password !== f.confirm) {
      setError(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, preferredLocale: locale, turnstileToken }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? t(locale, "auth.invalidCredentials")); return; }
    router.push("/dashboard");
  }

  const L = (arTxt: string, enTxt: string) => (ar ? arTxt : enTxt);

  return (
    <div dir={ar ? "rtl" : "ltr"} data-accent="blue" data-mode="light" className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 font-display">
      <div className="w-full max-w-lg rounded-2xl card-shadow border border-border bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="text-lg font-bold tracking-tight text-text-primary">AdLoop</div>
          <div className="mt-1 text-sm text-text-muted">{t(locale, "auth.signupTitle")}</div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <a href="/api/oauth/login-google/start" className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium no-underline" style={{ background: "#fff", color: "#3c4043", border: "1px solid #dadce0" }}>
            <PlatformLogo platform="GOOGLE_ADS" size={18} /> Google
          </a>
          <a href="/api/oauth/login-facebook/start" className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white no-underline" style={{ background: "#0866FF" }}>
            <PlatformLogo platform="FACEBOOK" size={18} /> Facebook
          </a>
        </div>

        <div className="mb-5 flex items-center gap-3 text-xs text-text-faint">
          <span className="h-px flex-1 bg-border" /> {t(locale, "auth.or")} <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input className={FIELD} placeholder={L("الاسم الكامل *", "Full name *")} value={f.name} onChange={(e) => set("name", e.target.value)} required />
            <input className={FIELD} placeholder={L("اسم المستخدم *", "Username *")} value={f.username} onChange={(e) => set("username", e.target.value)} required />
          </div>
          <input className={FIELD} type="email" placeholder={L("البريد الإلكتروني *", "Email *")} value={f.email} onChange={(e) => set("email", e.target.value)} required />

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input className={`${FIELD} pe-10`} type={showPw ? "text" : "password"} placeholder={L("كلمة المرور *", "Password *")} value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
              <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <div className="relative">
              <input className={`${FIELD} pe-10`} type={showPw2 ? "text" : "password"} placeholder={L("تأكيد كلمة المرور *", "Confirm password *")} value={f.confirm} onChange={(e) => set("confirm", e.target.value)} required minLength={8} />
              <button type="button" tabIndex={-1} onClick={() => setShowPw2((v) => !v)} className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary">{showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <PasswordRequirements password={f.password} />

          <div className="grid grid-cols-2 gap-3">
            <input className={FIELD} placeholder={L("اسم الشركة (اختياري)", "Company (optional)")} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} />
            <select className={FIELD} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">{L("النوع", "Gender")}</option>
              {GENDERS.map((g) => <option key={g.v} value={g.v}>{ar ? g.ar : g.en}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select className={FIELD} value={f.country} onChange={(e) => set("country", e.target.value)} required>
              <option value="">{L("الدولة *", "Country *")}</option>
              {COUNTRIES.map((c, i) => <option key={c} value={c}>{ar ? c : COUNTRIES_EN[i]}</option>)}
            </select>
            <select className={FIELD} value={f.adSpendMonthly} onChange={(e) => set("adSpendMonthly", e.target.value)} required>
              <option value="">{L("الإنفاق الإعلاني الشهري *", "Ad spend / month *")}</option>
              {AD_SPEND.map((a) => <option key={a.v} value={a.v}>{ar ? a.ar : a.en}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select className={FIELD} value={f.businessScale} onChange={(e) => set("businessScale", e.target.value)}>
              <option value="">{L("عدد العملاء الحاليين", "Current clients")}</option>
              {CLIENTS.map((c) => <option key={c.v} value={c.v}>{ar ? c.ar : c.en}</option>)}
            </select>
            <select className={FIELD} value={f.howHeard} onChange={(e) => set("howHeard", e.target.value)}>
              <option value="">{L("سمعت عن AdLoop من؟", "How did you hear about us?")}</option>
              {HEARD.map((h) => <option key={h.v} value={h.v}>{ar ? h.ar : h.en}</option>)}
            </select>
          </div>

          <input className={FIELD} placeholder={L("كود إحالة (اختياري)", "Referral code (optional)")} value={f.referralSource} onChange={(e) => set("referralSource", e.target.value)} />

          {error && <p className="text-xs text-critical">{error}</p>}
          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} data-callback="onTurnstileSuccess" />
          )}
          <button type="submit" disabled={loading} className={PRIMARY_BTN}>
            {loading ? t(locale, "auth.signupLoading") : t(locale, "auth.signupButton")}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-text-muted">
          {t(locale, "auth.hasAccount")}{" "}
          <a href="/login" className="text-accent no-underline">{t(locale, "auth.goToLogin")}</a>
        </p>
      </div>
    </div>
  );
}
