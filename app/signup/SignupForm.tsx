"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { t, Locale } from "@/lib/i18n/dictionary";
import { useAuthLocale } from "@/app/components/useAuthLocale";
import { PasswordRequirements, PasswordMatch } from "@/app/components/PasswordRequirements";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { AuthShell } from "@/app/components/AuthShell";
import { countriesForDisplay, PRIORITY_COUNTRY_CODES } from "@/lib/countries";
import { SocialButton, FIELD as F, PRIMARY_BTN as PB } from "@/app/components/AuthControls";
import { Select } from "@/app/components/ui/Select";

const FIELD = F;
const PRIMARY_BTN = PB;

const GENDERS = [{ v: "male", ar: "ذكر", en: "Male" }, { v: "female", ar: "أنثى", en: "Female" }];
// الدول من `lib/countries.ts`: كانت تسع دول عربية مكتوبة هنا، فمن يفتح
// المنتج من خارج المنطقة لا يجد بلده أصلاً.
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

export function SignupForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [locale, setLocale] = useAuthLocale();
  const [f, setF] = useState({
    name: "", username: "", email: "", password: "", confirm: "",
    companyName: "", gender: "", birthDate: "", country: "", adSpendMonthly: "", businessScale: "", howHeard: "", referralSource: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.password !== f.confirm) {
      setError(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    // فحص هنا رغم `required` على المدخَل: `required` وحده يمنع الإرسال
    // برسالة متصفّح عامّة بلغة النظام لا بلغة الواجهة.
    if (!acceptedTerms) {
      setError(
        ar
          ? "يلزم الاطّلاع على شروط الاستخدام وسياسة الخصوصية والموافقة عليهما."
          : "You need to read and accept the Terms of Use and Privacy Policy."
      );
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // منطقةُ المتصفّح الزمنيّة: قيمةٌ أوليّةٌ لحساب المستخدم، فتصل تحيّةُ
      // الصباح صباحاً عنده لا عند الخادم. يبدّلها من الإعدادات متى شاء.
      body: JSON.stringify({
        ...f,
        preferredLocale: locale,
        turnstileToken,
        acceptedTerms,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? t(locale, "auth.invalidCredentials")); return; }
    // تحميل كامل لا `router.push`: الكوكي وصل للتوّ في رأس الاستجابة، بينما
    // راوتر العميل قد يخدم حمولة RSC مخبّأة من قبل تسجيل الدخول - فتبقى
    // الصفحة مكانها بلا رسالة ولا انتقال. التحميل الكامل يقرأ الجلسة الجديدة.
    window.location.assign(nextPath);
  }


  return (
    <AuthShell
      wide
      locale={locale}
      // بلا headline/sub: النصّ التسويقي مصدره القشرة، فتُقرأ الرسالة
      // نفسها على شاشتي الدخول والتسجيل بدل نسختين تتباعدان.
      onLocaleChange={setLocale}
    >
      <div className="w-full">
        <div className="mb-7">
          <div className="mb-6 text-[17px] font-bold tracking-tight text-text-primary">AdLoop</div>
          <h1 className="page-title">{t(locale, "auth.signupTitle")}</h1>
        </div>

        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <SocialButton href="/api/oauth/login-google/start" logo={<PlatformLogo platform="GOOGLE" size={18} />}>Google</SocialButton>
          <SocialButton href="/api/oauth/login-facebook/start" logo={<PlatformLogo platform="FACEBOOK" size={18} />}>Facebook</SocialButton>
        </div>

        <div className="mb-5 flex items-center gap-3 text-xs text-text-faint">
          <span className="h-px flex-1 bg-border" /> {t(locale, "auth.or")} <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={FIELD} placeholder={t(locale, "signupForm.fullName")} value={f.name} onChange={(e) => set("name", e.target.value)} required />
            <input className={FIELD} placeholder={t(locale, "signupForm.username")} value={f.username} onChange={(e) => set("username", e.target.value)} required />
          </div>
          <input className={FIELD} type="email" placeholder={t(locale, "signupForm.email")} value={f.email} onChange={(e) => set("email", e.target.value)} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <input className={`${FIELD} field-icon-end`} type={showPw ? "text" : "password"} placeholder={t(locale, "signupForm.password")} value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
              <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <div className="relative">
              <input className={`${FIELD} field-icon-end`} type={showPw2 ? "text" : "password"} placeholder={t(locale, "signupForm.confirmPassword")} value={f.confirm} onChange={(e) => set("confirm", e.target.value)} required minLength={8} />
              <button type="button" tabIndex={-1} onClick={() => setShowPw2((v) => !v)} className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary">{showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <PasswordRequirements password={f.password} locale={locale} />
          <PasswordMatch password={f.password} confirm={f.confirm} locale={locale} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={FIELD} placeholder={t(locale, "signupForm.company")} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} />
            {/* تاريخ الميلاد: `type="date"` يعطي منتقي المتصفّح الأصلي -
                لا مكتبة ولا ثلاث قوائم منسدلة. `max` اليوم يمنع تاريخاً
                مستقبلياً قبل أن يُرسل. */}
            <input
              className={FIELD}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={f.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              aria-label={t(locale, "signupForm.dob")}
              title={t(locale, "signupForm.dob")}
            />

            <Select
              locale={locale}
              value={f.gender}
              onChange={(v) => set("gender", v)}
              placeholder={t(locale, "signupForm.gender")}
              ariaLabel={t(locale, "signupForm.gender")}
              options={GENDERS.map((g) => ({ value: g.v, label: ar ? g.ar : g.en }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* مجموعتان لا قائمة واحدة: مئتا خيار بلا فاصل تُخفي الأسواق
                التي يأتي منها أغلب المسجّلين خلف تمرير طويل. */}
            <Select
              locale={locale}
              value={f.country}
              onChange={(v) => set("country", v)}
              placeholder={t(locale, "signupForm.country")}
              ariaLabel={t(locale, "signupForm.country")}
              options={countriesForDisplay(locale).map((c, i) => ({
                value: c.code,
                label: ar ? c.ar : c.en,
                group:
                  i < PRIORITY_COUNTRY_CODES.length
                    ? t(locale, "signupForm.mostCommon")
                    : t(locale, "signupForm.allCountries"),
              }))}
            />
            <Select
              locale={locale}
              value={f.adSpendMonthly}
              onChange={(v) => set("adSpendMonthly", v)}
              placeholder={t(locale, "signupForm.adSpend")}
              ariaLabel={t(locale, "signupForm.adSpend")}
              options={AD_SPEND.map((a) => ({ value: a.v, label: ar ? a.ar : a.en }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              locale={locale}
              value={f.businessScale}
              onChange={(v) => set("businessScale", v)}
              placeholder={t(locale, "signupForm.currentClients")}
              ariaLabel={t(locale, "signupForm.currentClients")}
              options={CLIENTS.map((c) => ({ value: c.v, label: ar ? c.ar : c.en }))}
            />
            <Select
              locale={locale}
              value={f.howHeard}
              onChange={(v) => set("howHeard", v)}
              placeholder={t(locale, "signupForm.howHeard")}
              ariaLabel={t(locale, "signupForm.howHeard")}
              options={HEARD.map((h) => ({ value: h.v, label: ar ? h.ar : h.en }))}
            />
          </div>

          <input className={FIELD} placeholder={t(locale, "signupForm.referral")} value={f.referralSource} onChange={(e) => set("referralSource", e.target.value)} />

          {/* الموافقة قبل الزرّ مباشرةً: وضعها أعلى النموذج يجعلها تُمرَّر
              بلا قراءة، ووضعها بعد الزرّ يجعلها تُكتشف بعد المحاولة. */}
          <label className="flex cursor-pointer items-start gap-2.5 py-1 text-[12.5px] leading-relaxed text-text-muted">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
            />
            <span>
              {t(locale, "signupForm.agreePre")}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                {t(locale, "signupForm.termsLink")}
              </a>
              {t(locale, "signupForm.agreeMid")}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                {t(locale, "signupForm.privacyLink")}
              </a>
              {t(locale, "signupForm.agreePost")}
            </span>
          </label>

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
    </AuthShell>
  );
}
