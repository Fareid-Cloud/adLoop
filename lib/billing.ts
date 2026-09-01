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
import {
  createPaymentIntention, getUnifiedCheckoutUrl,
  chargeSavedCard, isAutoChargeConfigured,
} from "@/lib/paymob";
import { logSubscriptionEvent } from "@/lib/subscriptionEvents";
import type { SubscriptionEventType } from "@prisma/client";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { CHARGE_CURRENCY, toChargeAmount, priceListFor } from "@/lib/billingRegion";
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
  // 🔴 **السعر المعروض شيء، والعملة المُحصَّل بها شيء آخر.**
  //
  // تكامل MIGS عند Paymob يقبل الجنيه وحده. وربطُ ذلك بعملة العميل كان
  // **يرفض دفعه كلّياً** - وهو خلطٌ لا لزوم له: أيّ بطاقةٍ في العالم
  // تُخصَم بالجنيه ومصرفُ صاحبها يُجري التحويل. فالأمريكيّ والهنديّ
  // والبرازيليّ يدفعون ببطاقاتهم كما هي، ويصلنا جنيهٌ مصريّ.
  //
  // فيبقى المعروضُ مرجعاً (`listAmountCents`) ويُحسَب المُحصَّل منه.
  const listCents = Math.round(input.amount * 100);
  const { chargeCents, rateUsed } = await toChargeAmount(input.currency, listCents);
  const amountCents = chargeCents;
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
      currency: CHARGE_CURRENCY,
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
    amountCents, CHARGE_CURRENCY,
  ].join(":");

  // 🔴 **قفلٌ على مستوى المعاملة، لا قيدُ تفرّدٍ في المخطّط.**
  //
  // المطلوب أن يمرّ الطلبان المتوازيان واحداً بعد الآخر، فيرى الثاني ما
  // أنشأه الأوّل بدل أن ينشئ رابط دفعٍ ثانياً. وقيدُ `@unique` كان يفعلها،
  // لكنّ إضافته تجعل `prisma db push` يطلب `--accept-data-loss` - وهي راية
  // تُسقط أعمدةً وجداول، ورفضُها في سكربت البناء صحيح. فلا يُضعَّف البناء
  // لأجل قفل.
  //
  // و`pg_advisory_xact_lock` يُحرَّر عند انتهاء المعاملة نفسِها، فلا يبقى
  // معلّقاً على اتصالٍ في المجمّع (pooler) إن انقطع الطلب - وهو الفرق بينه
  // وبين قفل الجلسة الذي لا يصحّ خلف مجمّع اتصالات.
  const existingByKey = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dedupeKey}))`;

    const pending = await tx.paymentIntent.findFirst({
      where: { dedupeKey, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (pending) return pending;

    return tx.paymentIntent.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        planKey: input.planKey,
        cycle: input.cycle,
        credits: input.credits,
        amountCents,
        currency: CHARGE_CURRENCY,
        listAmountCents: listCents,
        listCurrency: input.currency,
        fxRateUsed: rateUsed,
        status: "PENDING",
        dedupeKey,
      },
    });
  });

  // نيّةٌ سابقةٌ لها رابطٌ جاهز: تُعاد كما هي ولا يُنشأ رابطٌ ثانٍ.
  if (existingByKey.checkoutUrl) {
    return { ok: true, url: existingByKey.checkoutUrl, intentId: existingByKey.id, reused: true };
  }

  const intent = existingByKey;

  try {
    const intention = await createPaymentIntention({
      amountCents,
      currency: CHARGE_CURRENCY,
      userId: input.userId,
      userEmail: input.userEmail,
      planLabel: input.label,
      // يعود في الويب هوك، فنطابق الدفع بنيّة بعينها لا بالمستخدم وحده
      intentId: intent.id,
    });

    const url = getUnifiedCheckoutUrl(intention.clientSecret);
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        paymobIntentionId: String(intention.id),
        // رقم الطلب هو ما يصل في الويب هوك (`obj.order.id`)
        paymobOrderId: String(intention.intentionOrderId),
        checkoutUrl: url,
      },
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
    // 🔴 **رسالةٌ عامّة أخفت سبباً دقيقاً قاله المزوّد بلفظه.**
    // Paymob تُعيد `417` مع «تركيبة خاطئة بين رقم الانتجريشن والعملة» حين
    // لا تدعم الانتجريشن المضبوطة عملةَ المساحة - وهو خطأ إعدادٍ يُصلَح
    // في دقيقة، بينما «تعذّر فتح صفحة الدفع» يُرسل صاحبه يفتّش في كلّ شيء.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Integration ID + Currency")) {
      return { ok: false, errorKey: "errCurrencyUnsupported" };
    }
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
  // 🔴 الانتقال الذرّي (`PENDING → PAID`) ومنحُ الاستحقاق في **معاملةٍ
  // واحدة**. الشكل القديم كان يفصلهما: انهيارٌ بينهما يترك النيّة `PAID`
  // بلا اشتراكٍ مُمنَح، ثمّ تجدها الإعادة `PAID` فتُبلّغ "تمّ سلفاً" ولا
  // تمنح شيئاً أبداً - العميل دفع ولم يُفعَّل. الآن: rollback عند أيّ فشل
  // يُبقيها `PENDING` فتُعاد المحاولة نظيفة. تسجيلُ الحدث (سجلٌّ ثانوي)
  // يبقى بعد الـcommit كي لا يوسّع نطاق المعاملة بلا داعٍ.
  const outcome = await prisma.$transaction(async (tx) => {
    const flipped = await tx.paymentIntent.updateMany({
      where: {
        id: intentId,
        status: "PENDING",
        ...(observed
          ? { amountCents: observed.amountCents, currency: observed.currency, userId: observed.userId }
          : {}),
      },
      data: { status: "PAID", paidAt: new Date(), transactionId, dedupeKey: null },
    });

    const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent) return { result: { ok: false } as FulfillResult };

    if (flipped.count === 0) {
      // صفرٌ له سببان: نيّةٌ صارت مدفوعةً (تكرار webhook → نجاحٌ بلا تكرار
      // أثر)، أو شرطٌ لم يتطابق (مبلغ/عملة/صاحب مختلف → رفضٌ يُسوّى يدوياً).
      if (intent.status !== "PAID") {
        console.error("[billing] معاملة موقّعة لا تطابق نيّتها - رُفض الإتمام", {
          intentId, transactionId,
          expected: { amountCents: intent.amountCents, currency: intent.currency, userId: intent.userId },
          observed,
        });
        return { result: { ok: false, mismatch: true } as FulfillResult };
      }
      return { result: { ok: true, alreadyDone: true, kind: intent.kind, planKey: intent.planKey, credits: intent.credits } as FulfillResult };
    }

    if (intent.kind === "SUBSCRIPTION" && intent.planKey) {
      const periodEnd = new Date();
      if (intent.cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      // الباقة السابقة تُقرأ **قبل** التحديث لتصنيف الحدث (ترقية/تخفيض/تجديد).
      const before = await tx.user.findUnique({
        where: { id: intent.userId },
        select: { subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true },
      });

      await tx.user.update({
        where: { id: intent.userId },
        data: {
          subscriptionStatus: "ACTIVE",
          subscriptionPlan: intent.planKey,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          // الدورة تُخزَّن على الحساب كي تعرفها مهمّةُ التجديد لاحقاً - كانت
          // على النيّة وحدها، فالتجديد لا يعرف كم يُحصّل ولا كم يمدّد.
          subscriptionCycle: intent.cycle ?? "monthly",
          // نجاحُ دفعةٍ يدويّ يصفّر عدّاد فشل التجديد: الكارت يعمل الآن.
          renewalAttemptCount: 0,
        },
      });

      return {
        result: { ok: true, kind: intent.kind, planKey: intent.planKey, credits: intent.credits } as FulfillResult,
        event: {
          userId: intent.userId,
          type: classifyPaidEvent(before, intent.planKey),
          fromPlan: before?.subscriptionPlan ?? null,
          toPlan: intent.planKey,
          amountCents: intent.amountCents,
          currency: intent.currency,
        },
      };
    } else if (intent.kind === "CREDITS" && intent.credits) {
      await tx.user.update({
        where: { id: intent.userId },
        data: { aiCreditsPurchased: { increment: intent.credits } },
      });
    }

    return { result: { ok: true, kind: intent.kind, planKey: intent.planKey, credits: intent.credits } as FulfillResult };
  });

  // السجلّ الثانوي بعد نجاح المعاملة: فشلُه لا يُبطل دفعاً تمّ ومُنِح.
  if (outcome.event) {
    await logSubscriptionEvent(outcome.event);
  }

  return outcome.result;
}

/** حالة النيّة لصفحة العودة - تسأل حتى يصل الويب هوك */
export async function getIntentStatus(userId: string, intentId: string) {
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, userId },
    select: {
      status: true, kind: true, planKey: true, credits: true, failureReason: true,
      // صفحةُ العودة إيصالٌ لا إشارةُ نجاح: تعرض ما دُفع فعلاً وبأيّ عملة،
      // والسعر المعروض إن كان غير عملة التحصيل، ومتى يبدأ التجديد.
      amountCents: true, currency: true,
      listAmountCents: true, listCurrency: true,
      cycle: true, paidAt: true,
    },
  });
  if (!intent) return null;

  // تاريخُ التجديد من الحساب نفسه بعد أن يكتبه الويب هوك - لا يُحسَب هنا
  // مرّةً ثانية، فحسابان لتاريخٍ واحد يفترقان.
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentPeriodEnd: true },
  });

  return { ...intent, currentPeriodEnd: account?.currentPeriodEnd ?? null };
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


// ==================== التجديد التلقائيّ ====================
//
// **الاشتراك يتجدّد تلقائياً ما لم يُلغِه صاحبُه.** وهذه هي الدالّة التي
// تُنفّذ ذلك فعلاً: تُحصّل من الكارت المحفوظ وتمدّ الفترة.
//
// 🔴 **وهي مغلقةٌ ببنيتها حتى يُفعَّل MOTO:** `isAutoChargeConfigured`
// تُرجع `false` ما لم يوجد `PAYMOB_MOTO_INTEGRATION_ID`، فلا يُطلَق نداءٌ
// واحد ولا يتغيّر سلوكُ اليوم. راجع `lib/paymob.ts`.

/** أقصى عددِ محاولاتٍ فاشلةٍ قبل أن يُترَك الاشتراك ينقضي. */
export const MAX_RENEWAL_ATTEMPTS = 3;

/**
 * نافذةُ حجز المحاولة. ما دامت المحاولةُ الأخيرة داخلها، لا تبدأ أخرى -
 * فهي القفلُ الذي يمنع الخصم المزدوج. وطولُها يوازن بين خطرين: أقصرُ منها
 * يسمح لدورتين متقاربتين أن تخصما معاً، وأطولُ منها يحبس حساباً ماتت
 * محاولتُه في منتصفها بلا إعادةِ نظر.
 */
const RENEWAL_CLAIM_WINDOW_MINUTES = 60;

export interface RenewalOutcome {
  ok: boolean;
  reason?: "not_configured" | "no_token" | "not_eligible" | "claimed_elsewhere" | "declined" | "error";
  detail?: string;
}

/**
 * محاولةُ تجديدٍ تلقائيّ لحسابٍ انتهت فترتُه.
 *
 * 🔴 **الخصمُ المزدوج هو الخطر الأوّل هنا، لا الفشل.** دورتا كرون
 * متزامنتان - أو إعادةُ تشغيلٍ بعد مهلة - كانتا ستقرآن الحساب نفسه
 * وتخصمان مرّتين. فتُحجَز المحاولة أوّلاً بتحديثٍ شرطيٍّ ذرّيّ
 * (`updateMany` مشروطٌ بقيمة `currentPeriodEnd` التي قرأناها): من يفوز
 * بالحجز وحده يُحصّل، والخاسر يخرج بلا نداء.
 *
 * وسجلُّ الدفع يُنشأ **قبل** النداء الخارجيّ - نفس مبدأ المسار التفاعليّ:
 * خصمٌ نجح وضاع ردُّه يبقى له صفٌّ يُطابَق به، لا مالٌ بلا أثر.
 */
export async function renewViaSavedCard(userId: string): Promise<RenewalOutcome> {
  if (!isAutoChargeConfigured()) return { ok: false, reason: "not_configured" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, subscriptionPlan: true, subscriptionCycle: true,
      subscriptionStatus: true, currentPeriodEnd: true, cancelAtPeriodEnd: true,
      savedCardToken: true, billingCountry: true, renewalAttemptCount: true,
      customPriceOverrideCents: true, customPriceCurrency: true,
    },
  });

  if (!user || !user.savedCardToken) return { ok: false, reason: "no_token" };
  if (
    user.subscriptionStatus !== "ACTIVE" ||
    user.cancelAtPeriodEnd ||
    !user.currentPeriodEnd ||
    !user.subscriptionPlan ||
    user.renewalAttemptCount >= MAX_RENEWAL_ATTEMPTS
  ) {
    return { ok: false, reason: "not_eligible" };
  }

  const plan = PLAN_BY_KEY.get(user.subscriptionPlan as PlanKey);
  if (!plan || plan.key === "free") return { ok: false, reason: "not_eligible" };

  const cycle = (user.subscriptionCycle === "yearly" ? "yearly" : "monthly") as BillingCycle;
  const listCurrency = priceListFor(user.billingCountry);
  const listAmount = resolveMonthlyChargeable(plan, listCurrency, cycle, user);
  if (listAmount <= 0) return { ok: false, reason: "not_eligible" };

  const listCents = Math.round(listAmount * 100);
  const { chargeCents, rateUsed } = await toChargeAmount(listCurrency, listCents);

  // ── حجزُ المحاولة ──────────────────────────────────────────────────
  //
  // 🔴 **الشرط لا يكفي أن يكون على `currentPeriodEnd` وحده.** الحجز لا
  // يغيّر الفترة، فدورتان متزامنتان تقرآن القيمة نفسها وتُطابقها كلتاهما،
  // فتمرّان معاً وتخصمان مرّتين - وهو بالضبط ما جاء الحجز ليمنعه.
  //
  // فيدخل في الشرط ما **يغيّره الحجزُ نفسه**: `lastRenewalAttempt`. الأولى
  // تجده فارغاً أو قديماً فتفوز وتكتب الآن، والثانية تجده حديثاً فلا
  // تُطابق وتخرج بلا نداء. وهذا يجعل التحديثَ الشرطيّ قفلاً حقيقياً.
  //
  // والنافذة تُبقي التعثّر قابلاً للإصلاح: محاولةٌ ماتت في منتصفها لا
  // تحجز الحساب إلى الأبد، بل يُعاد النظر فيها بعد ساعة.
  const periodAtRead = user.currentPeriodEnd;
  const claimCutoff = new Date(Date.now() - RENEWAL_CLAIM_WINDOW_MINUTES * 60_000);
  const claimed = await prisma.user.updateMany({
    where: {
      id: user.id,
      currentPeriodEnd: periodAtRead,
      cancelAtPeriodEnd: false,
      OR: [{ lastRenewalAttempt: null }, { lastRenewalAttempt: { lt: claimCutoff } }],
    },
    data: { lastRenewalAttempt: new Date(), renewalAttemptCount: { increment: 1 } },
  });
  if (claimed.count === 0) return { ok: false, reason: "claimed_elsewhere" };

  const intent = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      kind: "SUBSCRIPTION",
      planKey: user.subscriptionPlan,
      cycle,
      credits: null,
      amountCents: chargeCents,
      currency: CHARGE_CURRENCY,
      listAmountCents: listCents,
      listCurrency,
      fxRateUsed: rateUsed,
      status: "PENDING",
    },
  });

  const charge = await chargeSavedCard({
    cardToken: user.savedCardToken,
    amountCents: chargeCents,
    email: user.email,
    merchantOrderId: intent.id,
  });

  if (!charge.ok) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "FAILED",
        failureReason: `auto-renew: ${charge.reason}${charge.detail ? ` - ${charge.detail}` : ""}`.slice(0, 300),
      },
    });
    await logSubscriptionEvent({
      userId: user.id,
      type: "PAYMENT_FAILED",
      toPlan: user.subscriptionPlan,
      amountCents: chargeCents,
      currency: CHARGE_CURRENCY,
    });
    return { ok: false, reason: charge.reason === "declined" ? "declined" : "error", detail: charge.detail };
  }

  // ── نجح الخصم: تُمدّ الفترة من نهايتها لا من اليوم ────────────────
  // التمديدُ من `periodAtRead` يمنع ضياع الأيّام حين تتأخّر الدورة، ومن
  // «الآن» حين تكون النهاية قد مضت بأكثر من فترة.
  const base = periodAtRead > new Date() ? periodAtRead : new Date();
  const nextEnd = new Date(base);
  if (cycle === "yearly") nextEnd.setFullYear(nextEnd.getFullYear() + 1);
  else nextEnd.setMonth(nextEnd.getMonth() + 1);

  await prisma.$transaction([
    prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "PAID", paidAt: new Date(), transactionId: charge.transactionId ?? null },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: nextEnd,
        renewalAttemptCount: 0,
      },
    }),
  ]);

  await logSubscriptionEvent({
    userId: user.id,
    type: "RENEWED",
    fromPlan: user.subscriptionPlan,
    toPlan: user.subscriptionPlan,
    amountCents: chargeCents,
    currency: CHARGE_CURRENCY,
  });

  return { ok: true };
}
