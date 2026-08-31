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
//
// 🔴 **وكانت هذه الصفحة سطراً في منتصف بياض.** لحظةُ ما بعد الدفع هي أكثر
// لحظةٍ يشكّ فيها الدافع: هل وصل المبلغ؟ كم خُصم؟ وماذا صار لديّ الآن؟
// وسطرٌ رماديّ وحيد لا يجيب واحداً منها - فيبدو المنتج معطّلاً في اللحظة
// التي يجب أن يبدو فيها جديراً بما دُفع. الصفحة الآن إيصالٌ يقول: المبلغ
// وعملته، والباقة، وموعد التجديد، وما فُتح فعلاً.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, Loader2, Clock, ArrowLeft, Check, ReceiptText,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

type Phase = "checking" | "paid" | "failed" | "slow";

interface IntentView {
  status: string;
  kind: "SUBSCRIPTION" | "CREDITS";
  planKey: string | null;
  credits: number | null;
  cycle: string | null;
  amountCents: number | null;
  currency: string | null;
  listAmountCents: number | null;
  listCurrency: string | null;
  currentPeriodEnd: string | null;
}

/** كل ثانيتين، حتى ٤٠ ثانية - أطول من زمن وصول أي ويب هوك سليم */
const POLL_MS = 2_000;
const MAX_ATTEMPTS = 20;

const money = (cents: number, currency: string, locale: Locale) =>
  `${(cents / 100).toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;

export function PaymentResultClient({
  intentId, locale,
}: {
  intentId: string;
  locale: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `payResult.${k}`, v);
  const [phase, setPhase] = useState<Phase>("checking");
  const [intent, setIntent] = useState<IntentView | null>(null);
  const attempts = useRef(0);

  useEffect(() => {
    let alive = true;

    async function poll() {
      if (!alive) return;
      attempts.current++;

      const res = await fetch(`/api/billing/intent/${intentId}`).catch(() => null);
      const data = await res?.json().catch(() => null);
      const view: IntentView | null = data?.intent ?? null;
      if (view) setIntent(view);

      if (view?.status === "PAID") { setPhase("paid"); return; }
      if (view?.status === "FAILED" || view?.status === "EXPIRED") { setPhase("failed"); return; }
      if (attempts.current >= MAX_ATTEMPTS) { setPhase("slow"); return; }
      setTimeout(poll, POLL_MS);
    }

    poll();
    return () => { alive = false; };
  }, [intentId]);

  // ما فُتح بهذه الباقة - من القاموس نفسه الذي تعرضه صفحة الباقات، فلا
  // تُكتب قائمةٌ ثانية تفترق عنها عند أوّل تعديل في الباقات.
  const features =
    intent?.kind === "SUBSCRIPTION" && intent.planKey
      ? t(locale, `plans.feats_${intent.planKey}`).split("|").filter(Boolean).slice(0, 6)
      : [];

  const planName =
    intent?.planKey ? t(locale, `plans.p_${intent.planKey}`) : null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      {phase === "checking" && (
        <Shell tone="accent" icon={<Loader2 size={28} className="animate-spin text-accent" />}>
          <h1 className="page-title">{tr("checking")}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{tr("checkingBody")}</p>
          <div className="mt-6 space-y-2" aria-hidden>
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-surface-raised" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-raised" />
          </div>
        </Shell>
      )}

      {phase === "paid" && (
        <Shell tone="verified" icon={<CheckCircle2 size={30} className="text-verified" />}>
          <h1 className="page-title">{tr("paidTitle")}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
            {intent?.kind === "CREDITS" && intent.credits !== null
              ? tr("paidCredits", { n: intent.credits })
              : tr("paidSub")}
          </p>

          {/* ── الإيصال: ما دُفع فعلاً ───────────────────────────── */}
          {intent?.amountCents !== null && intent?.amountCents !== undefined && intent.currency && (
            <dl className="mt-6 overflow-hidden rounded-2xl border border-border text-start">
              <Row
                label={tr("rcAmount")}
                value={money(intent.amountCents, intent.currency, locale)}
                strong
              />
              {/* السعر المعروض يُذكر حين يخالف عملة التحصيل - وإلّا بدا
                  المبلغ المخصوم رقماً لا صلة له بما رآه على الشاشة. */}
              {intent.listCurrency &&
                intent.listCurrency !== intent.currency &&
                intent.listAmountCents !== null && (
                  <Row
                    label={tr("rcListed")}
                    value={money(intent.listAmountCents, intent.listCurrency, locale)}
                  />
                )}
              {planName && <Row label={tr("rcPlan")} value={planName} />}
              {intent.currentPeriodEnd && (
                <Row
                  label={tr("rcRenews")}
                  value={new Date(intent.currentPeriodEnd).toLocaleDateString(
                    locale === "ar" ? "ar-EG-u-nu-latn" : "en-US",
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                />
              )}
            </dl>
          )}

          {/* ── ما فُتح فعلاً ────────────────────────────────────── */}
          {features.length > 0 && (
            <div className="mt-5 rounded-2xl border border-verified/25 bg-verified/[0.05] p-4 text-start">
              <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-verified">
                {tr("rcUnlocked")}
              </p>
              <ul className="m-0 grid list-none gap-1.5 p-0">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-text-primary">
                    <Check size={14} className="mt-0.5 shrink-0 text-verified" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/dashboard" className="btn btn-primary">
              {tr("goDashboard")}
              <ArrowLeft size={15} className="rtl:rotate-0 ltr:rotate-180" />
            </Link>
            <Link href="/dashboard/billing" className="btn btn-secondary">
              <ReceiptText size={15} />
              {tr("rcViewBilling")}
            </Link>
          </div>
        </Shell>
      )}

      {phase === "failed" && (
        <Shell tone="critical" icon={<XCircle size={30} className="text-critical" />}>
          <h1 className="page-title">{tr("failedTitle")}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{tr("failedBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/billing" className="btn btn-primary">{tr("retry")}</Link>
            <Link href="/dashboard" className="btn btn-secondary">{tr("goDashboard")}</Link>
          </div>
        </Shell>
      )}

      {phase === "slow" && (
        <Shell tone="gap" icon={<Clock size={30} className="text-gap" />}>
          <h1 className="page-title">{tr("pendingLongTitle")}</h1>
          {/* الجملة الحاسمة: "لا تدفع مرّة أخرى" - غيابها هو ما يُنتج
              الشحن المزدوج فعلياً، لا خلل في الكود */}
          <p className="mt-3 rounded-2xl border border-gap/35 bg-gap/[0.06] p-3.5 text-start text-[13px] leading-relaxed text-text-primary">
            {tr("pendingLongBody")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/billing" className="btn btn-secondary">{tr("backToPlans")}</Link>
          </div>
        </Shell>
      )}
    </div>
  );
}

/** الإطار المشترك: بطاقةٌ واحدة بنبرةٍ دلاليّة، لا سطرٌ في فراغ. */
function Shell({
  tone, icon, children,
}: {
  tone: "verified" | "critical" | "gap" | "accent";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const ring = {
    verified: "border-verified/30",
    critical: "border-critical/30",
    gap: "border-gap/30",
    accent: "border-border",
  }[tone];
  const halo = {
    verified: "bg-verified/12",
    critical: "bg-critical/12",
    gap: "bg-gap/12",
    accent: "bg-accent/12",
  }[tone];

  return (
    <section className={`card-shadow card ${ring} p-6 text-center sm:p-8`}>
      <span className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${halo}`}>
        {icon}
      </span>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
      <dt className="text-[12.5px] text-text-muted">{label}</dt>
      <dd
        className={`m-0 tabular-nums ${
          strong ? "text-[15px] font-semibold text-text-primary" : "text-[13px] text-text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
