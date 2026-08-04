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
// الاستعادة، فتحمل ما يحتاجه فعلاً — إلى أيّ بريد أُرسل، ومدّة الصلاحية،
// وطريق العودة.

"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, ArrowRight, RotateCcw, Mail } from "lucide-react";
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
      body: JSON.stringify({ email, locale }),
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

          {/* بلون الهويّة لا رمادي: الصندوق الرمادي يُقرأ كتحذير، وهذه
              معلومة مساعدة لا تنبيه. */}
          <div className="mb-5 flex flex-col gap-1.5 rounded-xl border border-accent/25 bg-accent/[0.07] px-3.5 py-3 text-start text-[12.5px] leading-relaxed text-text-muted">
            <p>{tr("forgotHintExpiry")}</p>
            <p>{tr("forgotHintSpam")}</p>
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
          <h2 className="mb-1.5 text-center text-[19px] font-bold text-text-primary">{tr("forgotTitle")}</h2>
          <p className="mb-6 text-center text-[13px] leading-relaxed text-text-muted">{tr("forgotSub")}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* الأيقونة يساراً دائماً لا `start`: الحقل نفسه `dir="ltr"`
                لأنّ البريد لاتينيّ دائماً، فلو تبعت الأيقونة اتّجاه الصفحة
                وقعت يميناً في العربية والنصّ يساراً - فيتصادمان. */}
            <div className="relative" dir="ltr">
              <Mail
                size={16}
                className="pointer-events-none absolute inset-y-0 left-3.5 my-auto text-text-faint"
              />
              <input
                type="email"
                placeholder={tr("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                dir="ltr"
                className={`${FIELD} pl-10 text-left`}
              />
            </div>

            <button type="submit" disabled={loading} className={PRIMARY_BTN}>
              {loading ? tr("sending") : tr("sendResetLink")}
              {/* سهم أفقيّ لا طائرة: طائرة lucide مائلة لأعلى اليمين، فتُقرأ
                  في زرّ مصطفٍّ أفقياً كأنّها تشير لمكان خطأ. السهم يتبع
                  اتّجاه القراءة ويُقلب في العربية كبقية أسهم الشاشة. */}
              {!loading && <ArrowRight size={15} className="rtl:rotate-180" />}
            </button>
          </form>

          {/* فاصل: يفصل الإجراء الأساسي عن المخرج، فلا يُقرأ الزرّان بوزن واحد */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11.5px] text-text-faint">{tr("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Link href="/login" className="btn btn-secondary btn-lg btn-block no-underline">
            <ArrowRight size={15} className="rtl:rotate-180" />
            {tr("backToLogin")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
