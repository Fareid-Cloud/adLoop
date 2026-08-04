"use client";

// app/dashboard/billing/PlansClient.tsx
//
// صفحة الباقات. تبيع لا تعرض جدولاً:
//
// • **الفرق أوّلاً لا السعر.** الرقم بلا مقابل غالٍ دائماً - لذلك يسبق كل
//   سعرٍ سطرُ ما يفتحه فعلاً.
// • **الباقة المُبرَزة هي الأنسب لأغلب العملاء لا الأغلى.** إبراز الأغلى
//   يبدو بعيداً فيُتجاهَل، وإبراز الأوسط يرفع متوسّط الاشتراك.
// • **جدول المقارنة مطويّ.** من حسم أمره لا يُجبَر على قراءته، ومن تردّد
//   يجده بضغطة.
// • **الخصم السنوي يُقال بالمبلغ لا بالنسبة.** "توفّر ٥٬٠٠٠ ج.م" تُقرأ،
//   و"وفّر ١٧٪" تُحسب.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Minus, Sparkles, ChevronDown, Loader2, Zap, X, ArrowLeft, ShieldCheck,
} from "lucide-react";
import {
  PLANS, COMPARISON_ROWS, CREDIT_PACKS, MIN_CUSTOM_CREDITS, MAX_CUSTOM_CREDITS,
  planPrice, yearlySaving, priceForCredits,
  type BillingCurrency, type BillingCycle, type Plan, type PlanKey, type PlanLimits,
} from "@/lib/plans";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { TH } from "@/app/components/ui/tableStyles";

export function PlansClient({
  locale = "ar",
  currency,
  currentPlan,
  creditsLeft,
  creditsAllowance,
  openCreditsOnLoad = false,
}: {
  locale?: Locale;
  currency: BillingCurrency;
  currentPlan: PlanKey;
  creditsLeft: number;
  creditsAllowance: number;
  openCreditsOnLoad?: boolean;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `plans.${k}`, v);
  const router = useRouter();

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [showCompare, setShowCompare] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(openCreditsOnLoad);
  const [error, setError] = useState<string | null>(null);

  const paid = PLANS.filter((p) => p.key !== "free").sort((a, b) => a.order - b.order);

  async function checkout(planKey: PlanKey) {
    setBuying(planKey);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey, cycle }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBuying(null);

    if (data?.ok && data.url) { window.location.href = data.url; return; }
    setError(tr(data?.errorKey ?? "errGateway", data?.errorVars));
  }

  // شريط الاستهلاك يظهر عند ٨٠٪ فقط: قرار تسعير قبل الحاجة احتكاك،
  // وعندها حلّ. لا نُعلن عن الكريدت لمن لم يقترب من سقفه.
  const usedPct = creditsAllowance > 0
    ? Math.round(((creditsAllowance - creditsLeft) / creditsAllowance) * 100)
    : 0;
  const showCreditsBar = creditsAllowance > 0 && usedPct >= 80;

  return (
    <div className="mx-auto max-w-[1200px] pb-16">
      <header className="mb-7 text-center">
        <h1 className="text-[30px] font-semibold tracking-tight text-text-primary">{tr("title")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-text-muted">{tr("subtitle")}</p>

        <div className="mt-5 inline-flex items-center gap-1 card p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
                cycle === c ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tr(c === "monthly" ? "monthly" : "yearly")}
              {c === "yearly" && (
                <span className={`ms-1.5 text-[11px] ${cycle === c ? "text-white/80" : "text-verified"}`}>
                  {tr("twoMonthsFree")}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {showCreditsBar && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gap/35 bg-gap/[0.06] p-4">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-text-primary">
              {tr("creditsLow", { left: creditsLeft, total: creditsAllowance })}
            </div>
            <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-gap" style={{ width: `${Math.min(100, usedPct)}%` }} />
            </div>
          </div>
          <button
            onClick={() => setCreditsOpen(true)}
            className="btn btn-primary shrink-0"
          >
            <Zap size={14} /> {tr("buyCredits")}
          </button>
        </div>
      )}

      {error && (
        <p className="btn btn-danger mb-4 border border-critical/35 bg-critical/[0.06] p-3 text-center text-critical">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {paid.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            cycle={cycle}
            currency={currency}
            locale={locale}
            tr={tr}
            current={currentPlan === plan.key}
            busy={buying === plan.key}
            onPick={() => checkout(plan.key)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[12px] text-text-muted">
        <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-verified" /> {tr("trustSecure")}</span>
        <span className="flex items-center gap-1.5"><Check size={13} className="text-verified" /> {tr("trustCancel")}</span>
        <span className="flex items-center gap-1.5"><Check size={13} className="text-verified" /> {tr("trustNoSetup")}</span>
      </div>

      {/* المقارنة مطويّة: من حسم أمره لا يُجبَر على جدول من ثلاثة عشر صفّاً */}
      <div className="mt-8">
        <button
          onClick={() => setShowCompare((v) => !v)}
          className="mx-auto flex items-center gap-2 card px-5 py-2.5 text-[13px] font-medium text-text-primary"
        >
          {tr("compareAll")}
          <ChevronDown size={15} className={`transition-transform ${showCompare ? "rotate-180" : ""}`} />
        </button>

        {showCompare && (
          <div className="card-shadow mt-4 overflow-x-auto card">
            <table className="w-full min-w-[720px] text-start text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>{tr("feature")}</th>
                  {PLANS.map((p) => (
                    <th key={p.key} className="px-4 py-3 text-start">
                      <span className={`text-[13px] font-semibold ${p.highlighted ? "text-accent" : "text-text-primary"}`}>
                        {tr(`p_${p.key}`)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 text-[12.5px] text-text-muted">{tr(`f_${row.key}`)}</td>
                    {PLANS.map((p) => (
                      <td key={p.key} className="px-4 py-2.5">
                        <LimitCell value={p.limits[row.key]} kind={row.kind} tr={tr} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-border bg-surface-raised/40">
                  <td className="px-4 py-3 text-[12.5px] font-medium text-text-primary">{tr("price")}</td>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-4 py-3">
                      <span className="tabular-nums text-[13px] font-semibold text-text-primary">
                        {p.key === "free" ? tr("freeForever") : `${fmt(planPrice(p, currency, cycle))} ${currency}`}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creditsOpen && (
        <CreditsModal
          currency={currency}
          tr={tr}
          onClose={() => setCreditsOpen(false)}
          onError={(msg) => { setCreditsOpen(false); setError(msg); }}
        />
      )}
      <span className="hidden">{router ? "" : ""}</span>
    </div>
  );
}

// ==================== بطاقة الباقة ====================

function PlanCard({
  plan, cycle, currency, locale, tr, current, busy, onPick,
}: {
  plan: Plan;
  cycle: BillingCycle;
  currency: BillingCurrency;
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  current: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  const price = planPrice(plan, currency, cycle);
  const saving = yearlySaving(plan, currency);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-surface p-5 transition-all ${
        plan.highlighted
          ? "border-accent shadow-[0_0_0_1px_var(--accent)] lg:-translate-y-2"
          : "card-shadow border-border"
      }`}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white" style={{ insetInlineStart: 20 }}>
          <Sparkles size={11} /> {tr("mostPopular")}
        </span>
      )}

      <h2 className="text-[17px] font-semibold text-text-primary">{tr(`p_${plan.key}`)}</h2>
      <p className="mt-1 min-h-[36px] text-[12.5px] leading-relaxed text-text-muted">{tr(`d_${plan.key}`)}</p>

      <div className="my-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[32px] font-semibold leading-none tracking-tight tabular-nums text-text-primary">
            {fmt(price)}
          </span>
          <span className="text-[13px] text-text-muted">{currency}</span>
          <span className="text-[12.5px] text-text-faint">
            {cycle === "monthly" ? tr("perMonth") : tr("perYear")}
          </span>
        </div>
        {cycle === "yearly" && saving > 0 && (
          <div className="mt-1 text-[12px] font-medium text-verified">
            {tr("youSave", { amount: `${fmt(saving)} ${currency}` })}
          </div>
        )}
      </div>

      {/* ما يفتحه فعلاً - قبل القائمة الطويلة، لأنه سبب الشراء */}
      <p className="mb-3 rounded-xl bg-surface-raised/70 p-2.5 text-[12px] leading-relaxed text-text-primary">
        {tr(`unlock_${plan.key}`)}
      </p>

      <ul className="mb-5 flex flex-1 flex-col gap-1.5">
        {(tr(`feats_${plan.key}`) || "").split("|").map((feat, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-text-muted">
            <Check size={13} className="mt-0.5 shrink-0 text-verified" />
            {feat}
          </li>
        ))}
      </ul>

      <button
        onClick={onPick}
        disabled={busy || current}
        className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13.5px] font-medium transition-opacity disabled:opacity-60 ${
          plan.highlighted ? "bg-accent text-white" : "border border-border bg-surface-raised text-text-primary"
        }`}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        {current ? tr("currentPlan") : busy ? tr("opening") : tr("choosePlan")}
        {!busy && !current && <ArrowLeft size={14} className="rtl:rotate-0 ltr:rotate-180" />}
      </button>
      <span className="hidden">{locale}</span>
    </div>
  );
}

// ==================== شراء كريدت ====================

function CreditsModal({
  currency, tr, onClose, onError,
}: {
  currency: BillingCurrency;
  tr: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [credits, setCredits] = useState(CREDIT_PACKS[0].credits);
  const [busy, setBusy] = useState(false);

  const clamped = Math.min(MAX_CUSTOM_CREDITS, Math.max(MIN_CUSTOM_CREDITS, credits || 0));
  const price = priceForCredits(clamped, currency);

  async function buy() {
    setBusy(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "credits", credits: clamped }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (data?.ok && data.url) { window.location.href = data.url; return; }
    onError(tr(data?.errorKey ?? "errGateway", data?.errorVars));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow w-full max-w-md card pad-md">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[16px] font-semibold text-text-primary">
            <Zap size={16} className="text-accent" /> {tr("buyCredits")}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-surface-raised"><X size={16} /></button>
        </div>
        <p className="mb-4 text-[12.5px] leading-relaxed text-text-muted">{tr("creditsHint")}</p>

        <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {CREDIT_PACKS.map((p) => (
            <button
              key={p.credits}
              onClick={() => setCredits(p.credits)}
              className={`rounded-xl border p-2.5 text-center ${
                clamped === p.credits ? "border-accent bg-accent/[0.07]" : "border-border bg-surface-raised"
              }`}
            >
              <div className="text-[15px] font-semibold tabular-nums text-text-primary">{p.credits}</div>
              <div className="text-[11px] text-text-muted">{fmt(p.price[currency])} {currency}</div>
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[12px] text-text-muted">{tr("customAmount")}</label>
        <input
          type="number"
          min={MIN_CUSTOM_CREDITS}
          max={MAX_CUSTOM_CREDITS}
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          className="field mb-3 w-full text-[14px] tabular-nums"
        />

        {/* المعادلة صريحة: كم كريدت = كم بالعملة، تتغيّر مع كل رقم */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-raised/70 p-3">
          <span className="text-[12.5px] text-text-muted">
            {tr("creditsEquals", { n: clamped })}
          </span>
          <span className="text-[18px] font-semibold tabular-nums text-text-primary">
            {fmt(price)} <span className="text-[13px] font-normal text-text-muted">{currency}</span>
          </span>
        </div>

        <button
          onClick={buy}
          disabled={busy}
          className="btn btn-primary btn-block"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : null}
          {busy ? tr("opening") : tr("continueToPayment")}
        </button>
        <p className="mt-2 text-center text-[11px] text-text-faint">{tr("creditsNoExpiry")}</p>
      </div>
    </div>
  );
}

// ==================== أجزاء ====================

function LimitCell({
  value, kind, tr,
}: {
  value: PlanLimits[keyof PlanLimits];
  kind: "number" | "text" | "bool";
  tr: (k: string, v?: Record<string, string | number>) => string;
}) {
  if (kind === "bool") {
    return value
      ? <Check size={14} className="text-verified" />
      : <Minus size={14} className="text-text-faint" />;
  }
  if (kind === "text") {
    return <span className="text-[12.5px] text-text-primary">{tr(`v_${String(value)}`)}</span>;
  }
  if (value === -1) return <span className="text-[12.5px] text-verified">{tr("unlimited")}</span>;
  if (value === 0) return <Minus size={14} className="text-text-faint" />;
  return <span className="tabular-nums text-[12.5px] text-text-primary">{fmt(Number(value))}</span>;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
