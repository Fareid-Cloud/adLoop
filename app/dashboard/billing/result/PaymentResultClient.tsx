"use client";

// app/dashboard/billing/result/PaymentResultClient.tsx
//
// صفحة العودة من بوّابة الدفع.
//
// **لا تُفعّل شيئاً — تسأل فقط.** الرابط يُفتح مباشرةً بلا دفع، فبناء
// الاشتراك عليه ثغرة لا اختصار. التفعيل يحدث في الويب هوك وحده، وهذه
// الصفحة تنتظر أثره.
//
// **أخطر حالة هنا هي التأخّر لا الفشل:** المستخدم دفع، والويب هوك تأخّر،
// فيظنّ أن شيئاً لم يحدث ويدفع مرّة أخرى. لذلك بعد انقضاء المهلة تُقال
// الجملة صراحةً: *لا تدفع مرّة أخرى* — وتُشرح الخطوة التالية.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Clock, ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

type Phase = "checking" | "paid" | "failed" | "slow";

/** كل ثانيتين، حتى ٤٠ ثانية - أطول من زمن وصول أي ويب هوك سليم */
const POLL_MS = 2_000;
const MAX_ATTEMPTS = 20;

export function PaymentResultClient({
  intentId, locale = "ar",
}: {
  intentId: string;
  locale?: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `payResult.${k}`, v);
  const [phase, setPhase] = useState<Phase>("checking");
  const [credits, setCredits] = useState<number | null>(null);
  const attempts = useRef(0);

  useEffect(() => {
    let alive = true;

    async function poll() {
      if (!alive) return;
      attempts.current++;

      const res = await fetch(`/api/billing/intent/${intentId}`).catch(() => null);
      const data = await res?.json().catch(() => null);
      const status = data?.intent?.status;

      if (status === "PAID") {
        setCredits(data.intent.kind === "CREDITS" ? data.intent.credits : null);
        setPhase("paid");
        return;
      }
      if (status === "FAILED" || status === "EXPIRED") {
        setPhase("failed");
        return;
      }
      if (attempts.current >= MAX_ATTEMPTS) {
        setPhase("slow");
        return;
      }
      setTimeout(poll, POLL_MS);
    }

    poll();
    return () => { alive = false; };
  }, [intentId]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      {phase === "checking" && (
        <>
          <Loader2 size={40} className="mb-4 animate-spin text-accent" />
          <h1 className="text-[20px] font-semibold text-text-primary">{tr("checking")}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{tr("checkingBody")}</p>
        </>
      )}

      {phase === "paid" && (
        <>
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-verified/12">
            <CheckCircle2 size={30} className="text-verified" />
          </span>
          <h1 className="page-title">{tr("paidTitle")}</h1>
          <p className="mt-2 text-[13.5px] text-text-muted">
            {credits !== null ? tr("paidCredits", { n: credits }) : tr("paidSub")}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-medium text-white no-underline"
          >
            {tr("goDashboard")}
            <ArrowLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
          </Link>
        </>
      )}

      {phase === "failed" && (
        <>
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-critical/12">
            <XCircle size={30} className="text-critical" />
          </span>
          <h1 className="page-title">{tr("failedTitle")}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{tr("failedBody")}</p>
          <Link
            href="/dashboard/billing"
            className="mt-6 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-medium text-white no-underline"
          >
            {tr("retry")}
          </Link>
        </>
      )}

      {phase === "slow" && (
        <>
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gap/12">
            <Clock size={30} className="text-gap" />
          </span>
          <h1 className="text-[20px] font-semibold text-text-primary">{tr("pendingLongTitle")}</h1>
          {/* الجملة الحاسمة: "لا تدفع مرّة أخرى" - غيابها هو ما يُنتج
              الشحن المزدوج فعلياً، لا خلل في الكود */}
          <p className="mt-2 rounded-xl border border-gap/35 bg-gap/[0.06] p-3 text-[13px] leading-relaxed text-text-primary">
            {tr("pendingLongBody")}
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-6 card px-5 py-2.5 text-[13.5px] text-text-primary no-underline"
          >
            {tr("backToPlans")}
          </Link>
        </>
      )}
    </div>
  );
}
