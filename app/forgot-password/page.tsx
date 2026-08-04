// app/forgot-password/page.tsx
//
// طلب رابط استعادة كلمة المرور.
//
// **لماذا أُعيد بناؤها:** كانت بطاقة معزولة على شاشة فارغة بلا القشرة
// التي تحمل الدخول والتسجيل — فيبدو المستخدم وكأنه غادر المنتج في أثناء
// أكثر لحظاته قلقاً. صارت على `AuthShell` نفسها: نفس الخلفية والشعار
// ومبدّل اللغة والتذييل القانوني.
//
// **حالة الإرسال ليست سطراً أخضر:** الشاشة الثانية هي كلّ ما يراه من طلب
// الاستعادة، فتحمل ما يحتاجه فعلاً — إلى أيّ بريد أُرسل، ومدّة صلاحية
// الرابط، وماذا يفعل إن لم يصل، وطريق العودة.

"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, ArrowRight, RotateCcw } from "lucide-react";
import { t } from "@/lib/i18n/dictionary";
import { useAuthLocale } from "@/app/components/useAuthLocale";
import { AuthShell } from "@/app/components/AuthShell";
import { FIELD, PRIMARY_BTN } from "@/app/components/AuthControls";

export default function ForgotPasswordPage() {
  const [locale, setLocale] = useAuthLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const tr = (k: string) => t(locale, `auth.${k}`);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    // نفس النتيجة دائماً سواء وُجد البريد أم لا: التفريق بينهما يكشف
    // للمهاجم أيّ العناوين مسجَّلة لدينا.
    setSent(true);
  }

  return (
    <AuthShell
      locale={locale}
      onLocaleChange={setLocale}
      headline={sent ? tr("forgotSentTitle") : tr("forgotTitle")}
      sub={sent ? undefined : tr("forgotSub")}
    >
      {sent ? (
        <div className="card pad-lg text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-verified/12 text-verified">
            <MailCheck size={22} />
          </div>

          <h2 className="mb-2 text-[17px] font-semibold text-text-primary">{tr("forgotSentTitle")}</h2>

          {/* عرض البريد: الخطأ المطبعيّ فيه أشيع سبب لعدم الوصول، وإظهاره
              يجعل المستخدم يكتشفه بنفسه في ثانية. */}
          <p className="mb-5 text-[13.5px] leading-relaxed text-text-muted">
            {tr("forgotSentBody")}{" "}
            <span className="font-medium text-text-primary" dir="ltr">
              {email}
            </span>
          </p>

          <div className="card-inset pad-sm mb-5 flex flex-col gap-1.5 text-start text-[12.5px] leading-relaxed text-text-muted">
            <p>• {tr("forgotHintExpiry")}</p>
            <p>• {tr("forgotHintSpam")}</p>
            <p>• {tr("forgotHintNoEmail")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className={`${PRIMARY_BTN} inline-flex items-center justify-center gap-1.5 no-underline`}
            >
              {tr("backToLogin")}
              <ArrowRight size={15} className="rtl:rotate-180" />
            </Link>
            <button
              onClick={() => setSent(false)}
              className="inline-flex items-center justify-center gap-1.5 py-2 text-[12.5px] text-text-muted transition-colors hover:text-text-primary"
            >
              <RotateCcw size={13} />
              {tr("forgotTryAnother")}
            </button>
          </div>
        </div>
      ) : (
        <div className="card pad-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder={tr("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              dir="ltr"
              className={`${FIELD} text-start`}
            />
            <button type="submit" disabled={loading} className={PRIMARY_BTN}>
              {loading ? tr("sending") : tr("sendResetLink")}
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
      )}
    </AuthShell>
  );
}
