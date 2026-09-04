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

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Minus, Star, ChevronDown, Loader2, Zap, X, ArrowLeft, ShieldCheck,
} from "lucide-react";
import {
  PLANS, COMPARISON_ROWS, CREDIT_PACKS, MIN_CUSTOM_CREDITS, MAX_CUSTOM_CREDITS,
  planPrice, planListPrice, offerDiscountPct, yearlySaving, priceForCredits, aiModelTier,
  absentUntilNextPlan,
  type BillingCurrency, type BillingCycle, type Plan, type PlanKey, type PlanLimits,
} from "@/lib/plans";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { TH } from "@/app/components/ui/tableStyles";

export function PlansClient({
  locale,
  currency,
  currentPlan,
  creditsLeft,
  creditsAllowance,
  openCreditsOnLoad = false,
  subscription = null,
  offerActive = true,
}: {
  locale: Locale;
  currency: BillingCurrency;
  currentPlan: PlanKey;
  creditsLeft: number;
  creditsAllowance: number;
  openCreditsOnLoad?: boolean;
  /** عرض الإطلاق قائم؟ يأتي من مفتاح اللوحة عبر الخادم. */
  offerActive?: boolean;
  subscription?: {
    periodEnd: string;
    cancelAtPeriodEnd: boolean;
    autoRenew: boolean;
    cardBrand: string | null;
    cardLast4: string | null;
  } | null;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `plans.${k}`, v);
  const router = useRouter();

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [showCompare, setShowCompare] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(openCreditsOnLoad);
  const [error, setError] = useState<string | null>(null);

  const paid = PLANS.filter((p) => p.key !== "free").sort((a, b) => a.order - b.order);

  // موضعُ الشريط على الموبايل. يُقرأ من التمرير نفسه لا يُقاد به: المستخدمُ
  // يسحب بإصبعه، والنقاطُ تتبعه. جعلُها زراراً يقود التمرير يضيف تحكّماً
  // لا أحد يطلبه في أربع بطاقات، ويسرق السحبَ الطبيعيّ.
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);
  function onTrackScroll() {
    const el = trackRef.current;
    if (!el) return;
    const step = el.scrollWidth / paid.length;
    // القيمة المطلقة: في العربية التمرير سالب، فبغيرها يقف المؤشّر عند الأولى.
    setActiveCard(Math.min(paid.length - 1, Math.round(Math.abs(el.scrollLeft) / step)));
  }

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
      {subscription && (
        <SubscriptionPanel
          locale={locale}
          periodEnd={subscription.periodEnd}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          autoRenew={subscription.autoRenew}
          cardBrand={subscription.cardBrand}
          cardLast4={subscription.cardLast4}
          tr={tr}
        />
      )}
      <header className="mb-7 text-center">
        <span className="inline-block rounded-full bg-accent-dim px-2.5 py-1 text-[11.5px] font-medium text-accent">
          {tr("pricingEyebrow")}
        </span>
        <h2 className="mx-auto mt-2.5 max-w-xl text-[24px] font-semibold leading-snug text-text-primary sm:text-[28px]">
          {tr("pricingHeadline")}
        </h2>
        <div className="mt-4 inline-flex items-center gap-1 card p-1">
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
                // شارةٌ لا نصٌّ ملوّن: المكسبُ يُقرأ حين يُؤطَّر، ونصٌّ أخضر
                // جنبَ كلمةٍ سوداء يمرّ كجزءٍ من التسمية لا كعرض.
                <span
                  className={`ms-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    cycle === c ? "bg-white/20 text-white" : "bg-verified/12 text-verified"
                  }`}
                >
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
        <p className="note mb-4 justify-center border-critical/35 bg-critical/[0.06] text-center text-critical">
          {error}
        </p>
      )}

      {/* أربع باقات لا ثلاث بعد إضافة المؤسّسية - والشبكة تُوسَّع معها،
          وإلّا نزلت الرابعة وحدها في صفٍّ تحت الثلاث فبدت ملحقاً لا خياراً.

          🔴 **وعلى الموبايل شريطٌ أفقيّ لا عمودٌ من أربع بطاقات.** البطاقةُ
          الواحدة أطولُ من الشاشة، فأربعٌ فوق بعض تعني أنّ المقارنة - وهي
          الغرضُ كلُّه - تصير تمريراً بالذاكرة: تقرأ سعراً هنا وتنزل شاشتين
          لتقرأ الذي يليه. والشريطُ المنزلق بخطفةٍ واحدة يضع البطاقتين في
          نفس الحركة. وده CSS خالص (`scroll-snap`) - **مش محتاج تطبيقاً**،
          نفس السلوك اللي في تطبيقات الموبايل بيشتغل في المتصفّح زيّه. */}
      <div
        ref={trackRef}
        onScroll={onTrackScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
      >
        {paid.map((plan) => (
          <div key={plan.key} className="w-[85%] shrink-0 snap-center sm:w-auto sm:shrink">
            <PlanCard
              plan={plan}
              cycle={cycle}
              currency={currency}
              locale={locale}
              tr={tr}
              current={currentPlan === plan.key}
              busy={buying === plan.key}
              offerActive={offerActive}
              onPick={() => checkout(plan.key)}
            />
          </div>
        ))}
      </div>

      {/* مؤشّرُ الموضع - على الموبايل وحده، حيث يوجد ما يُمرَّر أصلاً */}
      <div className="mt-3 flex justify-center gap-1.5 sm:hidden">
        {paid.map((plan, i) => (
          <span
            key={plan.key}
            className={`h-1.5 rounded-full transition-all ${
              i === activeCard ? "w-5 bg-accent" : "w-1.5 bg-border"
            }`}
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
                        {p.key === "free" ? tr("freeForever") : `${fmt(planPrice(p, currency, cycle, offerActive))} ${currency}`}
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
  plan, cycle, currency, locale, tr, current, busy, offerActive, onPick,
}: {
  plan: Plan;
  cycle: BillingCycle;
  currency: BillingCurrency;
  locale: Locale;
  tr: (k: string, v?: Record<string, string | number>) => string;
  current: boolean;
  busy: boolean;
  offerActive: boolean;
  onPick: () => void;
}) {
  const price = planPrice(plan, currency, cycle, offerActive);
  const listed = planListPrice(plan, currency, cycle);
  const discount = offerActive ? offerDiscountPct(plan, currency) : 0;
  const saving = yearlySaving(plan, currency);
  // ثلاثةٌ سقفاً: ما بعدها يقلب «إليك ما تفتحه الترقية» إلى قائمة حرمان.
  const absent = absentUntilNextPlan(plan).slice(0, 3);

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border bg-surface p-5 transition-all ${
        plan.highlighted
          ? "border-accent bg-accent/[0.08] shadow-[0_0_0_1px_var(--accent)] lg:-translate-y-2"
          : "card-shadow border-border"
      }`}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white" style={{ insetInlineStart: 20 }}>
          <Star size={11} /> {tr("mostPopular")}
        </span>
      )}

      <h2 className="text-[17px] font-semibold text-text-primary">{tr(`p_${plan.key}`)}</h2>
      {/* 🔴 **ارتفاعان ثابتان، وإلّا لم تصطفّ الأزرار.** البطاقاتُ خلايا
          شبكةٍ مستقلّة، فكلُّ واحدةٍ تحسب ارتفاعَها وحدها: وصفٌ من سطرين
          جنبَ وصفٍ من ثلاثة، وباقةٌ لها سطرُ خصمٍ جنبَ «تواصل معنا» بلا
          سطرٍ فوقه - فينزل زرٌّ ويعلو آخر بعشرين بكسل. وصفُّ الأزرار ليس
          تجميلاً: العينُ تمسحها أفقياً لتقارن، فاهتزازُها يجعل المسحَ
          وقفاتٍ متتالية.
          وكتلةُ السعر تُحاذى من أسفل لا من أعلى، فيقع الرقمُ الكبير على
          خطٍّ واحدٍ في البطاقات الأربع مهما اختُلف ما فوقه. */}
      <p className="mt-1 min-h-[40px] text-[12.5px] leading-relaxed text-text-muted">{tr(`d_${plan.key}`)}</p>

      <div className="my-4 flex min-h-[76px] flex-col justify-end">
        {plan.contactOnly ? (
          // سعرُ هذه الباقة يُحدَّد بالاتّفاق، وعرضُ «0 جنيه» مكانه أسوأ من
          // عدم عرض شيء: يقرأها القارئ مجّانية.
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold leading-none tracking-tight text-text-primary">
              {tr("priceOnRequest")}
            </span>
          </div>
        ) : (
          <>
            {/* السعر الأساسي مشطوباً فوق السعر الحالي - لا جنبه.
                جنبه بيخلّي العين تقراهم رقمين للاختيار؛ فوقه بترتيبٍ أصغر
                وأبهت بيتقروا «كان وبقى»، وهو المقصود. ويختفي تماماً لمّا
                العرضُ يُطفأ فمافيش شطبٌ على سعرٍ هو السعر. */}
            {discount > 0 && (
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[14px] tabular-nums text-text-faint line-through">
                  {fmt(listed)} {currency}
                </span>
                <span className="rounded-full bg-verified/12 px-2 py-0.5 text-[11px] font-semibold text-verified">
                  {tr("offerOff", { pct: discount })}
                </span>
              </div>
            )}
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
          </>
        )}
      </div>

      {/* 🔴 **زرُّ الشراء كان آخرَ ما في البطاقة**، تحت قائمةٍ قد تطول -
          فيختلف موضعُه من بطاقةٍ إلى أخرى فلا تصطفّ الأزرار، ويُطلَب من
          القارئ أن ينزل ليقرّر. صعد تحت السعر مباشرةً: القرارُ عند
          الرقم، والقائمةُ تفصيلٌ يُقرأ بعده لمن أراد. */}
      {plan.contactOnly ? (
        // 🔴 **كان بيفتح شات الدعم** - فطلبُ شراءٍ بميزانية بيقع في نفس
        // الطابور مع «الرسم مش ظاهر عندي»، وبيوصل بلا اسمِ شركةٍ ولا حجم.
        // بقى بيفتح شاشةَ المبيعات: بتسأل مَن أنت وحجمك قدّ إيه، وبتوصل
        // لطابورٍ له حالاتُه (`/admin/sales`) لا لصندوق تذاكر.
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("adloop:contact-sales"))}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent bg-accent/[0.08] py-2.5 text-[13.5px] font-medium text-accent transition-colors hover:bg-accent/[0.14]"
        >
          {tr("contactSales")}
          <ArrowLeft size={14} className="rtl:rotate-0 ltr:rotate-180" />
        </button>
      ) : (
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
      )}

      {/* فاصلٌ منقّط: السعرُ والقرار فوقه، والتفصيلُ تحته */}
      <div className="mb-3 border-t border-dashed border-border" />

      <ul className="flex flex-1 flex-col gap-1.5">
        {(tr(`feats_${plan.key}`) || "").split("|").map((feat, i) => {
          // 🔴 **سطرُ الوراثة عنوانٌ لا بند.** «كل ما في الاحترافية» يساوي
          // عشرَ ميزاتٍ فوق ما تحته، وكان يُرسَم بنفس حجم «٩ متاجر» ونفس
          // لونه الباهت - فيمرّ كأنّه أصغرُ بنودها. وهو - في باقةٍ تُباع
          // بالترقية - أقوى سطرٍ في البطاقة كلّها.
          // والشرطُ من البيانات لا من نصّ السطر: كلُّ باقةٍ مدفوعةٍ فوق
          // البداية تبدأ قائمتُها بالوراثة بحكم البناء، فمطابقةُ النصّ
          // كانت ستنكسر في لغةٍ واحدة دون الأخرى.
          const isInherit = i === 0 && plan.order > 1;
          return (
            <li
              key={i}
              className={`flex items-start gap-2 leading-relaxed ${
                isInherit
                  ? "mb-1 text-[12.5px] font-semibold text-text-primary"
                  : "text-[12.5px] text-text-muted"
              }`}
            >
              {/* 🔴 **سطرُ الوراثة بلا علامةِ صحّ عن قصد.** العلامةُ تعني
                  «بندٌ واحد مشمول»، وهذا السطرُ ليس بنداً - هو عنوانٌ يقول
                  إنّ قائمةً كاملةً فوقه مشمولة. ووضعُ علامةٍ جنبَه يساويه
                  بـ«٩ متاجر» تحته، ويجعل القائمةَ تبدأ بصفٍّ زائد. */}
              {!isInherit && (
                <span className="mt-0.5 grid size-[17px] shrink-0 place-items-center rounded-md bg-accent/12">
                  <Check size={11} strokeWidth={3} className="text-accent" />
                </span>
              )}
              <span className={isInherit ? "" : "pt-px"}>
                {feat}
                {isInherit && <span className="text-text-faint">{tr("plusMore")}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {/* **غيرُ المشمول - إن وُجد فعلاً.**
          يُشتقّ من `PLANS` بشرط الغياب الصفريّ وحده (`absentUntilNextPlan`)،
          فما يظهر هنا صحيحٌ دائماً ولا يحتاج مراجعةً حين تتغيّر الحدود.
          ومن هنا صغرُ القائمة: بندٌ أو اثنان، وباقةُ الوكالات ليس فيها شيء.
          وهو المقصود - قائمةُ رفضٍ طويلةٌ تحت سعرٍ يُطلب دفعُه تجعل الباقةَ
          تبدو معطوبة، وهي ليست كذلك. */}
      {absent.length > 0 && (
        <div className="mt-3 border-t border-dashed border-border pt-2.5">
          <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-faint">
            {tr("notIncluded")}
          </p>
          <ul className="flex flex-col gap-1">
            {absent.map((key) => (
              <li key={key} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-text-faint">
                <Minus size={13} className="mt-0.5 shrink-0 opacity-60" />
                {tr(`f_${key}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <div className="card mb-4 flex items-center justify-between bg-surface-raised/70 p-3">
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

/**
 * **حالةُ الاشتراك، وزرُّ إنهائه.**
 *
 * 🔴 لم يكن للمشترك سبيلٌ لإلغاء اشتراكه من الواجهة إطلاقاً: العمود
 * `cancelAtPeriodEnd` كاتبُه الوحيد مسارُ الأدمن - **بينما صفحةُ الشروط
 * تَعِده بالإلغاء**. فمن أراد الخروج كان عليه مراسلةُ الدعم، وهو أسوأُ ما
 * يُقابَل به من قرّر ألّا يدفع: يقرؤه احتجازاً.
 *
 * والتاريخ يُقال صراحةً في الحالتين: من ألغى يحتاج أن يطمئنّ أنّ خدمته
 * تعمل إلى نهاية ما دفعه، لا أن تُقطَع الآن عقاباً على الإلغاء.
 */
function SubscriptionPanel({
  locale, periodEnd, cancelAtPeriodEnd, autoRenew, cardBrand, cardLast4, tr,
}: {
  locale: Locale;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** هل سيُحصَّل التجديد فعلاً من كارتٍ محفوظ؟ */
  autoRenew: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  tr: (k: string, v?: Record<string, string | number>) => string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const dateText = new Date(periodEnd).toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG-u-nu-latn", {
    year: "numeric", month: "long", day: "numeric",
  });

  async function submit(resume: boolean) {
    setBusy(true);
    try {
      const { getCsrfHeader } = await import("@/lib/csrfClient");
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify({ resume }),
      });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 card pad-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-text-primary">
            {cancelAtPeriodEnd
              ? tr("subEndingTitle")
              : autoRenew
                ? tr("subAutoRenewTitle")
                : tr("subActiveTitle")}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
            {/* 🔴 **لا يُقال «يتجدّد تلقائياً» إلّا حين يكون ذلك صحيحاً.**
                القاعدة أنّ الاشتراك يتجدّد ما لم يُلغَ، لكنّ التحصيل يحتاج
                كارتاً محفوظاً - فبلا كارتٍ يُقال الصدق: سنذكّرك. وعدٌ
                بخصمٍ لا يقع يُنتج انقطاعاً يظنّه صاحبُه مستحيلاً. */}
            {cancelAtPeriodEnd
              ? tr("subEndingBody", { date: dateText })
              : autoRenew
                ? tr("subAutoRenewBody", {
                    date: dateText,
                    card: tr("subCardLabel", {
                      brand: cardBrand ?? "card",
                      last4: cardLast4 ?? "••••",
                    }),
                  })
                : tr("subActiveBody", { date: dateText })}
          </p>
        </div>

        {cancelAtPeriodEnd ? (
          <button onClick={() => submit(true)} disabled={busy} className="btn btn-primary shrink-0">
            {busy ? <Loader2 size={14} className="animate-spin" /> : tr("subResume")}
          </button>
        ) : confirming ? (
          // تأكيدٌ بدرجتين - نفس عادة التنفيذ الحقيقيّ في المنتج، بلا نافذة
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => submit(false)} disabled={busy} className="btn btn-danger">
              {busy ? <Loader2 size={14} className="animate-spin" /> : tr("subCancelConfirm")}
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy} className="btn">
              {tr("subKeep")}
            </button>
          </div>
        ) : (
          // محايدٌ في وضعه الساكن وأحمرُ عند المرور: الإلغاءُ مش الفعلَ
          // الرئيسيّ في الصفحة فمايتصدّرش بلون، لكنّ اللونَ لازم يظهر قبل
          // الدوسة - زرارٌ رماديٌّ تماماً بيتقري «رجوع» ويتداس بالغلط.
          <button
            onClick={() => setConfirming(true)}
            className="btn shrink-0 transition-colors hover:border-critical hover:bg-critical/10 hover:text-critical"
          >
            {tr("subCancel")}
          </button>
        )}
      </div>
    </div>
  );
}

function LimitCell({
  value, kind, tr,
}: {
  value: PlanLimits[keyof PlanLimits];
  kind: "number" | "text" | "bool" | "model";
  tr: (k: string, v?: Record<string, string | number>) => string;
}) {
  if (kind === "bool") {
    return value
      ? <Check size={14} className="text-verified" />
      : <Minus size={14} className="text-text-faint" />;
  }
  if (kind === "model") {
    return <span className="text-[12.5px] text-text-primary">{tr(aiModelTier(String(value)))}</span>;
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
