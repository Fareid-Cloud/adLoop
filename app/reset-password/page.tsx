// app/reset-password/page.tsx
//
// تعيين كلمة مرور جديدة من رابط الاستعادة.
//
// **لماذا أُعيد بناؤها:** كانت بطاقة معزولة على شاشة فارغة، فتبدو صفحة من
// منتج آخر في اللحظة التي يكون فيها المستخدم أكثر حذراً — وهي بالضبط
// اللحظة التي يجب أن يتعرّف فيها على المنتج فوراً. صارت على `AuthShell`
// نفسها التي تحمل الدخول والتسجيل.
//
// **ثلاث حالات لا حالتان:** رابط غير صالح، ونموذج، ونجاح. كلٌّ منها يقول
// ما حدث وما الخطوة التالية — «الرابط غير صالح» وحدها تترك المستخدم عالقاً
// بلا طريق.

"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, ArrowRight, Eye, EyeOff } from "lucide-react";
import { t } from "@/lib/i18n/dictionary";
import { useAuthLocale } from "@/app/components/useAuthLocale";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";
import { AuthShell } from "@/app/components/AuthShell";
import { FIELD, PRIMARY_BTN } from "@/app/components/AuthControls";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [locale, setLocale] = useAuthLocale();
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const tr = (k: string) => t(locale, `auth.${k}`);

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
    setTimeout(() => router.push("/login"), 2200);
  }

  // ── رابط غير صالح أو منتهٍ ──────────────────────────────────────
  if (!token) {
    return (
      <AuthShell locale={locale} onLocaleChange={setLocale}>
        <div className="card pad-lg text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-critical/12 text-critical">
            <ShieldAlert size={22} />
          </div>
          <h2 className="mb-2 text-[17px] font-semibold text-text-primary">{tr("invalidLink")}</h2>
          <p className="mb-5 text-[13.5px] leading-relaxed text-text-muted">{tr("resetInvalidBody")}</p>
          <Link
            href="/forgot-password"
            className={`${PRIMARY_BTN} inline-flex items-center justify-center gap-1.5 no-underline`}
          >
            {tr("sendResetLink")}
            <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  // ── تمّ التعيين ─────────────────────────────────────────────────
  if (success) {
    return (
      <AuthShell locale={locale} onLocaleChange={setLocale}>
        <div className="card pad-lg text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-verified/12 text-verified">
            <ShieldCheck size={22} />
          </div>
          <h2 className="mb-2 text-[17px] font-semibold text-text-primary">{tr("resetSuccess")}</h2>
          <p className="mb-5 text-[13.5px] leading-relaxed text-text-muted">{tr("resetDoneBody")}</p>
          <Link
            href="/login"
            className={`${PRIMARY_BTN} inline-flex items-center justify-center gap-1.5 no-underline`}
          >
            {tr("backToLogin")}
            <ArrowRight size={15} className="rtl:rotate-180" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  // ── النموذج ─────────────────────────────────────────────────────
  return (
    <AuthShell
      locale={locale}
      onLocaleChange={setLocale}
      sub={tr("resetSub")}
    >
      <div className="card pad-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder={tr("newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              className={`${FIELD} pe-10`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              aria-label={tr("newPassword")}
              className="absolute inset-y-0 end-3 flex items-center text-text-faint transition-colors hover:text-text-primary"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <PasswordRequirements password={newPassword} locale={locale} />

          {error && <p className="text-[12.5px] text-critical">{error}</p>}

          <button type="submit" disabled={loading} className={PRIMARY_BTN}>
            {loading ? tr("saving") : tr("savePassword")}
          </button>
        </form>

        <div className="mt-4 border-t border-border pt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted no-underline transition-colors hover:text-text-primary"
          >
            <ArrowRight size={13} className="rtl:rotate-180" />
            {tr("backToLogin")}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
