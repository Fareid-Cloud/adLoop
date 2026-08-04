"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { t, Locale } from "@/lib/i18n/dictionary";
import { useAuthLocale } from "@/app/components/useAuthLocale";
import { PasswordRequirements, PasswordMatch } from "@/app/components/PasswordRequirements";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { AuthShell } from "@/app/components/AuthShell";
import { SocialButton, FIELD as F, PRIMARY_BTN as PB } from "@/app/components/AuthControls";

const FIELD = F;
const PRIMARY_BTN = PB;

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
      body: JSON.stringify({ ...f, preferredLocale: locale, turnstileToken, acceptedTerms }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? t(locale, "auth.invalidCredentials")); return; }
    // تحميل كامل لا `router.push`: الكوكي وصل للتوّ في رأس الاستجابة، بينما
    // راوتر العميل قد يخدم حمولة RSC مخبّأة من قبل تسجيل الدخول - فتبقى
    // الصفحة مكانها بلا رسالة ولا انتقال. التحميل الكامل يقرأ الجلسة الجديدة.
    window.location.assign("/dashboard");
  }

  const L = (arTxt: string, enTxt: string) => (ar ? arTxt : enTxt);

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
            <input className={FIELD} placeholder={L("الاسم الكامل *", "Full name *")} value={f.name} onChange={(e) => set("name", e.target.value)} required />
            <input className={FIELD} placeholder={L("اسم المستخدم *", "Username *")} value={f.username} onChange={(e) => set("username", e.target.value)} required />
          </div>
          <input className={FIELD} type="email" placeholder={L("البريد الإلكتروني *", "Email *")} value={f.email} onChange={(e) => set("email", e.target.value)} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <input className={`${FIELD} pe-10`} type={showPw ? "text" : "password"} placeholder={L("كلمة المرور *", "Password *")} value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
              <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <div className="relative">
              <input className={`${FIELD} pe-10`} type={showPw2 ? "text" : "password"} placeholder={L("تأكيد كلمة المرور *", "Confirm password *")} value={f.confirm} onChange={(e) => set("confirm", e.target.value)} required minLength={8} />
              <button type="button" tabIndex={-1} onClick={() => setShowPw2((v) => !v)} className="absolute inset-y-0 end-2.5 flex items-center text-text-faint hover:text-text-primary">{showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <PasswordRequirements password={f.password} locale={locale} />
          <PasswordMatch password={f.password} confirm={f.confirm} locale={locale} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={FIELD} placeholder={L("اسم الشركة (اختياري)", "Company (optional)")} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} />
            {/* تاريخ الميلاد: `type="date"` يعطي منتقي المتصفّح الأصلي -
                لا مكتبة ولا ثلاث قوائم منسدلة. `max` اليوم يمنع تاريخاً
                مستقبلياً قبل أن يُرسل. */}
            <input
              className={FIELD}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={f.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              aria-label={L("تاريخ الميلاد", "Date of birth")}
              title={L("تاريخ الميلاد", "Date of birth")}
            />

            <select className={FIELD} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">{L("النوع", "Gender")}</option>
              {GENDERS.map((g) => <option key={g.v} value={g.v}>{ar ? g.ar : g.en}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className={FIELD} value={f.country} onChange={(e) => set("country", e.target.value)} required>
              <option value="">{L("الدولة *", "Country *")}</option>
              {COUNTRIES.map((c, i) => <option key={c} value={c}>{ar ? c : COUNTRIES_EN[i]}</option>)}
            </select>
            <select className={FIELD} value={f.adSpendMonthly} onChange={(e) => set("adSpendMonthly", e.target.value)} required>
              <option value="">{L("الإنفاق الإعلاني الشهري *", "Ad spend / month *")}</option>
              {AD_SPEND.map((a) => <option key={a.v} value={a.v}>{ar ? a.ar : a.en}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              {L("أوافق على ", "I agree to the ")}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                {L("شروط الاستخدام", "Terms of Use")}
              </a>
              {L(" و", " and ")}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                {L("سياسة الخصوصية", "Privacy Policy")}
              </a>
              {L("، وعلى استخدام ملفّات تعريف الارتباط الضرورية لتشغيل الحساب.", ", and to the cookies required to run the account.")}
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
