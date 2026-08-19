// lib/billing.ts
//
// بدء الدفع. الملف كلّه مبنيّ حول سؤال واحد: **كيف نضمن ألّا يُشحن
// العميل مرّتين على شيء اشتراه مرّة؟**
//
// أربع طبقات، كل واحدة تسدّ ثغرة مختلفة:
//
// ١) **إعادة استخدام النيّة المعلّقة.** ضغطتان على "اشترك"، أو عودة بزرّ
//    المتصفّح، كانتا تُنشئان رابطَي دفع صالحين معاً. الآن نيّة معلّقة
//    حديثة لنفس الطلب تُعاد كما هي.
// ٢) **السعر من الخادم لا من العميل.** يصل مفتاح الباقة فقط؛ المبلغ
//    يُشتقّ هنا. لا يستطيع أحد شراء الوكالات بسعر البداية.
// ٣) **التفعيل من الويب هوك وحده.** صفحة النجاح تُفتح برابط مباشر بلا
//    دفع - بناء الاشتراك عليها ثغرة لا اختصار.
// ٤) **منع الشراء المكرّر للباقة نفسها** وهي فعّالة بالفعل.

import { prisma } from "@/lib/prisma";
import { createPaymentIntention, getUnifiedCheckoutUrl } from "@/lib/paymob";
import { logSubscriptionEvent } from "@/lib/subscriptionEvents";
import type { SubscriptionEventType } from "@prisma/client";
import { isFeatureEnabled } from "@/lib/featureFlags";
import {
  PLAN_BY_KEY, planPrice, priceForCredits, YEARLY_MONTHS_CHARGED,
  MIN_CUSTOM_CREDITS, MAX_CUSTOM_CREDITS,
  type BillingCurrency, type BillingCycle, type Plan, type PlanKey,
} from "@/lib/plans";

/**
 * نافذة إعادة استخدام النيّة المعلّقة. أقصر منها لا يحمي من ضغطة مكرّرة
 * بعد تردّد، وأطول منها يُعيد رابطاً قد تكون Paymob أبطلته.
 */
const REUSE_WINDOW_MINUTES = 30;

export interface StartResult {
  ok: boolean;
  url?: string;
  intentId?: string;
  /** أُعيدت نيّة قائمة بدل إنشاء جديدة - يُسجَّل ليظهر في التشخيص */
  reused?: boolean;
  errorKey?: string;
  errorVars?: Record<string, string | number>;
}

interface StartInput {
  userId: string;
  userEmail: string;
  currency: BillingCurrency;
}

// ==================== اشتراك ====================

export async function startSubscriptionCheckout(
  input: StartInput & { planKey: PlanKey; cycle: BillingCycle }
): Promise<StartResult> {
  if (!(await isFeatureEnabled("billing.checkout"))) return { ok: false, errorKey: "errGateway" };

  const plan = PLAN_BY_KEY.get(input.planKey);
  if (!plan || plan.key === "free") return { ok: false, errorKey: "errUnknownPlan" };

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true,
      customPriceOverrideCents: true, customPriceCurrency: true,
    },
  });

  // سعر متّفق عليه لهذا الحساب وحده يسبق الكتالوج - بديل عن اختراع باقة
  // جديدة لعميل واحد. **والعملة شرطٌ لا تحسين:** رقمٌ اتّفق عليه بالجنيه
  // لا يُحصَّل بالدولار لأنّ عملة المساحة تغيّرت، فعند اختلافها نرجع
  // للسعر المعلَن - رجوعٌ إلى ما يعرفه العميل أأمن من تحصيلٍ مفاجئ.
  const amount = resolveMonthlyChargeable(plan, input.currency, input.cycle, user);
  if (amount <= 0) return { ok: false, errorKey: "errUnknownPlan" };

  // شراء الباقة نفسها وهي فعّالة: لا فائدة منه وقد يكون ضغطة مكرّرة
  if (
    user?.subscriptionStatus === "ACTIVE" &&
    user.subscriptionPlan === input.planKey &&
    user.currentPeriodEnd &&
    user.currentPeriodEnd > new Date()
  ) {
    return { ok: false, errorKey: "errAlreadyOnPlan" };
  }

  return startOrReuse({
    ...input,
    kind: "SUBSCRIPTION",
    planKey: input.planKey,
    cycle: input.cycle,
    credits: null,
    amount,
    label: `AdLoop ${plan.key} (${input.cycle})`,
  });
}

/**
 * المبلغ المُحصَّل فعلاً لهذه الباقة على هذا الحساب.
 *
 * مفصولة عن `planPrice` عمداً: تلك تجيب سعر الكتالوج المعلَن (وبتتستخدم
 * في صفحة الأسعار وجدول المقارنة)، ودي بتجيب المبلغ المُحصَّل - والاتنين
 * بيختلفوا لحساب واحد بس ومعاه اتّفاق. خلطهما كان معناه إن صفحة الأسعار
 * العامة تعرض خصماً خاصاً بحساب واحد لكل الزوّار.
 */
export function resolveMonthlyChargeable(
  plan: Plan,
  currency: BillingCurrency,
  cycle: BillingCycle,
  override: { customPriceOverrideCents?: number | null; customPriceCurrency?: string | null } | null
): number {
  const cents = override?.customPriceOverrideCents;
  if (cents && cents > 0 && override?.customPriceCurrency === currency) {
    const monthly = cents / 100;
    return cycle === "yearly" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
  }
  return planPrice(plan, currency, cycle);
}

// ==================== كريدت ====================

export async function startCreditsCheckout(
  input: StartInput & { credits: number }
): Promise<StartResult> {
  if (!(await isFeatureEnabled("billing.checkout"))) return { ok: false, errorKey: "errGateway" };

  const credits = Math.floor(input.credits);
  if (!Number.isFinite(credits) || credits < MIN_CUSTOM_CREDITS || credits > MAX_CUSTOM_CREDITS) {
    return {
      ok: false,
      errorKey: "errCreditRange",
      errorVars: { min: MIN_CUSTOM_CREDITS, max: MAX_CUSTOM_CREDITS },
    };
  }

  const amount = priceForCredits(credits, input.currency);
  return startOrReuse({
    ...input,
    kind: "CREDITS",
    planKey: null,
    cycle: null,
    credits,
    amount,
    label: `AdLoop ${credits} AI credits`,
  });
}

// ==================== المشترك ====================

async function startOrReuse(input: {
  userId: string;
  userEmail: string;
  currency: BillingCurrency;
  kind: "SUBSCRIPTION" | "CREDITS";
  planKey: string | null;
  cycle: string | null;
  credits: number | null;
  amount: number;
  label: string;
}): Promise<StartResult> {
  const amountCents = Math.round(input.amount * 100);
  const since = new Date(Date.now() - REUSE_WINDOW_MINUTES * 60 * 1000);

  // الطبقة الأولى: نيّة معلّقة مطابقة وحديثة تُعاد بدل إنشاء غيرها
  const existing = await prisma.paymentIntent.findFirst({
    where: {
      userId: input.userId,
      status: "PENDING",
      kind: input.kind,
      planKey: input.planKey,
      credits: input.credits,
      amountCents,
      currency: input.currency,
      createdAt: { gte: since },
      checkoutUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.checkoutUrl) {
    return { ok: true, url: existing.checkoutUrl, intentId: existing.id, reused: true };
  }

  // السجلّ يُنشأ **قبل** النداء الخارجي: لو نجح الإنشاء عند Paymob ثم
  // انقطع الاتصال، تبقى لدينا نيّة معلّقة نطابق بها الويب هوك - بدلها
  // كان الدفع سيصل بلا ما يقابله عندنا.
  //
  // 🔴 والتفرّد من قاعدة البيانات: البحثُ أعلاه يخدم الحالة الشائعة، لكنّه
  // لا يمنع طلبين متوازيين يريان معاً «لا شيء معلّق» فينشئان رابطَي دفعٍ
  // صالحين. القيد وحده يمنع ذلك، والتصادمُ ليس خطأً بل هو الجواب: نيّةُ
  // الطلب الآخر قائمة، فتُعاد.
  const dedupeKey = [
    input.userId, input.kind, input.planKey ?? "-", input.credits ?? "-",
    amountCents, input.currency,
  ].join(":");

  let intent;
  try {
    intent = await prisma.paymentIntent.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        planKey: input.planKey,
        cycle: input.cycle,
        credits: input.credits,
        amountCents,
        currency: input.currency,
        status: "PENDING",
        dedupeKey,
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "P2002") throw err;
    // سبَقنا طلبٌ آخر بأجزاء الثانية. ننتظر أن يكتب رابطه ثمّ نعيده -
    // ولا ننشئ ثانياً، فذلك بالضبط ما يُخصَم مرّتين.
    const winner = await prisma.paymentIntent.findUnique({ where: { dedupeKey } });
    if (winner?.checkoutUrl) {
      return { ok: true, url: winner.checkoutUrl, intentId: winner.id, reused: true };
    }
    return { ok: false, errorKey: "errCheckoutInProgress" };
  }

  try {
    const intention = await createPaymentIntention({
      amountCents,
      currency: input.currency as "EGP" | "SAR" | "AED",
      userId: input.userId,
      userEmail: input.userEmail,
      planLabel: input.label,
      // يعود في الويب هوك، فنطابق الدفع بنيّة بعينها لا بالمستخدم وحده
      intentId: intent.id,
    });

    const url = getUnifiedCheckoutUrl(intention.clientSecret);
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { paymobIntentionId: String(intention.id), checkoutUrl: url },
    });

    return { ok: true, url, intentId: intent.id };
  } catch (err) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        // القيد يُفرَغ مع الخروج من التعليق: يمنع نيّتين معلّقتين لنفس
        // الشراء، لا أن يشتري العميل الشيء نفسه مرّةً أخرى لاحقاً.
        status: "FAILED",
        dedupeKey: null,
        failureReason: err instanceof Error ? err.message.slice(0, 300) : "unknown",
      },
    });
    return { ok: false, errorKey: "errGateway" };
  }
}

// ==================== الإتمام (يُستدعى من الويب هوك وحده) ====================

export interface FulfillResult {
  ok: boolean;
  kind?: "SUBSCRIPTION" | "CREDITS";
  planKey?: string | null;
  credits?: number | null;
  alreadyDone?: boolean;
  /** معاملةٌ موقّعةٌ لا تطابق اقتصاد نيّتها - تُسوّى يدوياً */
  mismatch?: boolean;
}

/**
 * يُنفَّذ من الويب هوك بعد التحقّق من التوقيع. `updateMany` بشرط
 * `status: PENDING` يجعل الانتقال ذرّياً: ويب هوكان متزامنان لنفس
 * المعاملة يفوز أحدهما فقط، فلا يُضاف الرصيد مرّتين.
 */
export async function fulfillPaymentIntent(
  intentId: string,
  transactionId: string,
  /**
   * ما دفعه العميل فعلاً كما ورد من المزوّد - يُطابَق بما طلبناه.
   *
   * 🔴 **كان الإتمام يثق بـ`intentId` وحده.** توقيعُ HMAC يثبت أنّ الرسالة
   * من Paymob، ولا يثبت أنّ هذه المعاملة تخصّ هذه النيّة: معاملةٌ موقّعةٌ
   * صحيحةً يشير `extras` فيها إلى نيّةٍ أخرى - بخطأ ربطٍ عند المزوّد أو
   * تكاملٍ مُعدٍّ خطأً - كانت تفعّل الخطّة أو تزيد الرصيد بلا أن يُقارَن
   * مبلغٌ ولا عملة. أي: يُدفع جنيهٌ ويُمنَح اشتراكُ ألف.
   *
   * والمطابقة داخل شرط `updateMany` نفسِه لا قبله: فحصٌ سابقٌ للتحديث
   * يترك نافذةً بينهما، وهذا يجعل الانتقال والتحقّق فعلاً واحداً.
   */
  observed?: { amountCents: number; currency: string; userId: string }
): Promise<FulfillResult> {
  const flipped = await prisma.paymentIntent.updateMany({
    where: {
      id: intentId,
      status: "PENDING",
      ...(observed
        ? { amountCents: observed.amountCents, currency: observed.currency, userId: observed.userId }
        : {}),
    },
    // القيد يُفرَغ مع الدفع - راجع `dedupeKey` في المخطّط.
    data: { status: "PAID", paidAt: new Date(), transactionId, dedupeKey: null },
  });

  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) return { ok: false };

  if (flipped.count === 0) {
    // 🔴 صفرٌ له سببان مختلفان تماماً، وخلطُهما يمنح اشتراكاً بلا ثمنه.
    //
    // إن كانت النيّة قد صارت مدفوعةً فعلاً فهذا تكرارُ ويب هوك: نُبلغ
    // بالنجاح ولا نكرّر الأثر. أمّا إن بقيت معلّقةً فالشرط لم يتطابق -
    // مبلغٌ أو عملةٌ أو صاحبُ حسابٍ مختلف - وهذه **ليست نجاحاً**: تُرفض
    // وتُسجَّل بما لا يتطابق كي تُسوّى يدوياً، لا أن تمرّ صامتة.
    if (intent.status !== "PAID") {
      console.error("[billing] معاملة موقّعة لا تطابق نيّتها - رُفض الإتمام", {
        intentId,
        transactionId,
        expected: { amountCents: intent.amountCents, currency: intent.currency, userId: intent.userId },
        observed,
      });
      return { ok: false, mismatch: true };
    }
    return { ok: true, alreadyDone: true, kind: intent.kind, planKey: intent.planKey, credits: intent.credits };
  }

  if (intent.kind === "SUBSCRIPTION" && intent.planKey) {
    const periodEnd = new Date();
    if (intent.cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    // الباقة السابقة تُقرأ **قبل** التحديث: بعده يصير الصفّ يحمل الجديدة،
    // فيضيع الفرق الذي يُصنَّف منه الحدث (ترقية أم تخفيض أم تجديد).
    const before = await prisma.user.findUnique({
      where: { id: intent.userId },
      select: { subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true },
    });

    await prisma.user.update({
      where: { id: intent.userId },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionPlan: intent.planKey,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    await logSubscriptionEvent({
      userId: intent.userId,
      type: classifyPaidEvent(before, intent.planKey),
      fromPlan: before?.subscriptionPlan ?? null,
      toPlan: intent.planKey,
      amountCents: intent.amountCents,
      currency: intent.currency,
    });
  } else if (intent.kind === "CREDITS" && intent.credits) {
    await prisma.user.update({
      where: { id: intent.userId },
      data: { aiCreditsPurchased: { increment: intent.credits } },
    });
  }

  return { ok: true, kind: intent.kind, planKey: intent.planKey, credits: intent.credits };
}

/** حالة النيّة لصفحة العودة - تسأل حتى يصل الويب هوك */
export async function getIntentStatus(userId: string, intentId: string) {
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, userId },
    select: { status: true, kind: true, planKey: true, credits: true, failureReason: true },
  });
  return intent;
}


// ==================== تسجيل أحداث الاشتراك ====================

/**
 * تصنيف حدث الدفع الناجح: تفعيل أوّل، أم تجديد، أم تغيير باقة.
 *
 * **التصنيف هنا لا في التقرير.** حسابه وقت العرض معناه إعادة استنتاجه من
 * تواريخ متفرّقة كلّ مرّة، وبنتيجة مختلفة كلّما تغيّر منطق الاستنتاج -
 * بينما اللحظة التي نعرف فيها الحقيقة يقيناً هي هذه، ونحن نمسك الحالتين.
 */
function classifyPaidEvent(
  before: { subscriptionPlan: string | null; subscriptionStatus: string; currentPeriodEnd: Date | null } | null,
  toPlan: string
): SubscriptionEventType {
  if (!before || before.subscriptionPlan === null) return "ACTIVATED";
  if (before.subscriptionPlan !== toPlan) return "PLAN_CHANGED";
  // نفس الباقة وفترتها لم تنتهِ بعد = تجديد. انتهت = عودة بعد انقطاع،
  // وهي تفعيل في حساب النموّ لا تجديداً - الفرق يظهر في معدّل العودة.
  const stillActive = !!before.currentPeriodEnd && before.currentPeriodEnd > new Date();
  return stillActive ? "RENEWED" : "ACTIVATED";
}
