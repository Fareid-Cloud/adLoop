// lib/admin/business.ts
//
// أرقام الأعمال: الإيراد المتكرّر، الإيراد المحصَّل، متوسّط الحساب،
// حركة الإيراد، والمدفوعات الفاشلة.
//
// **كل رقم هنا من بيانات موجودة فعلاً.** اللي مالوش مصدر (تكلفة اكتساب
// العميل، والمرتجعات) مذكور صراحة كفجوة في `KNOWN_GAPS` تحت بدل ما
// يتحسب بتقريب مالوش أساس - رقم مخترع في لوحة بيتاخد عليها قرار أسوأ
// من خانة فاضية مكتوب جنبها "مش متاح".

import { prisma } from "@/lib/prisma";
import { billingCurrencyFor, PLAN_BY_KEY, type BillingCurrency } from "@/lib/plans";
import {
  amortizeIntent, monthKey, monthlyRecurringOf, pctChange, toUsd,
  type DateRange, type UsdConversion,
} from "./shared";

/**
 * فجوات معروفة تُعرض في الواجهة كما هي.
 *
 * وجودها في الكود مقصود: خانة فاضية بلا تفسير بتتقري "الرقم صفر"، والرقم
 * صفر قرار غلط. الجملة هنا بتقول "مش مقيس" وبتقول ليه.
 */
export const KNOWN_GAPS = [
  {
    metric: "CAC",
    reason:
      "No acquisition-cost data exists. Nothing in the product records marketing spend or ties a signup to its cost — howHeard and referralSource are self-reported channel labels, not money.",
  },
  {
    metric: "Refunds",
    reason:
      "The payment integration has no refund state or refund flow. PaymentIntentStatus is PENDING / PAID / FAILED / EXPIRED only, so a refund would be invisible here even if one were issued.",
  },
] as const;

export interface MrrBreakdown {
  byCurrency: Record<string, number>;
  usd: UsdConversion;
  payingCustomers: number;
  byPlan: Record<string, { customers: number; usdCents: number }>;
  concentration: RevenueConcentration;
}

/**
 * الإيراد الشهريّ المتكرّر - **من الاشتراكات النشطة، مش من الدفعات.**
 *
 * الفرق جوهريّ: مجموع الدفعات الشهر ده بيخلط تجديدات مع اشتراكات سنوية
 * دُفعت مرّة واحدة، فبيقفز وينزل بلا علاقة بحجم العمل الفعليّ. أما
 * "مجموع ما يدفعه المشتركون النشطون شهرياً" فبيوصف الأساس الحقيقيّ.
 */
export async function getMrr(): Promise<MrrBreakdown> {
  const users = await prisma.user.findMany({
    where: { subscriptionStatus: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    select: {
      subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true,
      customPriceOverrideCents: true, customPriceCurrency: true,
      workspaces: { select: { currency: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });

  const byCurrency: Record<string, number> = {};
  const byPlan: Record<string, { customers: number; usdCents: number }> = {};
  let payingCustomers = 0;

  const perPlanCurrency: Record<string, Record<string, number>> = {};
  // نصيب كلّ عميل على حدة - لحساب التركّز. بيتخزّن بعملته وبيتحوّل مرّة
  // واحدة في الآخر، عشان مانناديش سعر الصرف لكلّ عميل.
  const perCustomer: Array<Record<string, number>> = [];

  for (const u of users) {
    const fallback: BillingCurrency = billingCurrencyFor(u.workspaces[0]?.currency ?? "USD");
    const mrr = monthlyRecurringOf(u, fallback);
    if (!mrr) continue;
    payingCustomers += 1;
    byCurrency[mrr.currency] = (byCurrency[mrr.currency] ?? 0) + mrr.cents;
    perCustomer.push({ [mrr.currency]: mrr.cents });

    const key = u.subscriptionPlan ?? "unknown";
    byPlan[key] ??= { customers: 0, usdCents: 0 };
    byPlan[key].customers += 1;
    perPlanCurrency[key] ??= {};
    perPlanCurrency[key][mrr.currency] = (perPlanCurrency[key][mrr.currency] ?? 0) + mrr.cents;
  }

  const usd = await toUsd(byCurrency);
  for (const [key, buckets] of Object.entries(perPlanCurrency)) {
    byPlan[key].usdCents = (await toUsd(buckets)).usd;
  }

  // **التركّز مقياس مخاطرة لا نموّ.** MRR بيقول "بتكسب قدّ إيه"، وده بيقول
  // "لو أكبر عميل مشي بكرة تفقد قدّ إيه". منتج شابّ عادةً بيبقى مركَّزاً
  // بشدّة، والرقم بيفضل مخفيّاً في المتوسّطات لحد ما العميل ده يمشي فعلاً.
  const customerUsd: number[] = [];
  for (const c of perCustomer) customerUsd.push((await toUsd(c)).usd);
  customerUsd.sort((a, z) => z - a);

  const total = usd.usd;
  // تحت خمسة عملاء التركّز بديهيّ (واحد من تلاتة = ٣٣٪) والرقم بيتقري
  // كإنذار وهو وصفٌ للحجم - فبيتخفي بدل ما يكدّب.
  const meaningful = total > 0 && customerUsd.length >= 5;

  return {
    byCurrency,
    usd,
    payingCustomers,
    byPlan,
    concentration: {
      topCustomerPct: meaningful ? (customerUsd[0] / total) * 100 : null,
      topThreePct: meaningful
        ? (customerUsd.slice(0, 3).reduce((a, z) => a + z, 0) / total) * 100
        : null,
      note: "Share of MRR held by the largest accounts - a risk measure, not a growth one. Hidden below five paying customers, where the number describes the size rather than a concentration problem.",
    },
  };
}

export interface RevenuePoint {
  month: string;
  /** بالسنت، بعد التحويل للدولار */
  usdCents: number;
  payments: number;
}

/** الإيراد المحصَّل فعلاً شهراً بشهر - من النيّات المدفوعة لا من الحالة */
export async function getRevenueSeries(months: number): Promise<RevenuePoint[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  from.setDate(1);

  const paid = await prisma.paymentIntent.findMany({
    where: { status: "PAID", paidAt: { gte: from } },
    select: { paidAt: true, amountCents: true, currency: true },
    orderBy: { paidAt: "asc" },
  });

  const buckets = new Map<string, { byCurrency: Record<string, number>; payments: number }>();
  for (const p of paid) {
    if (!p.paidAt) continue;
    const k = monthKey(p.paidAt);
    const b = buckets.get(k) ?? { byCurrency: {}, payments: 0 };
    b.byCurrency[p.currency] = (b.byCurrency[p.currency] ?? 0) + p.amountCents;
    b.payments += 1;
    buckets.set(k, b);
  }

  const out: RevenuePoint[] = [];
  for (const [month, b] of [...buckets.entries()].sort((a, z) => a[0].localeCompare(z[0]))) {
    out.push({ month, usdCents: (await toUsd(b.byCurrency)).usd, payments: b.payments });
  }
  return out;
}

export interface MrrMovement {
  newUsdCents: number;
  expansionUsdCents: number;
  contractionUsdCents: number;
  churnedUsdCents: number;
  /** عدد الأحداث في الفترة - صفر معناه "مافيش تاريخ بعد" لا "مافيش حركة" */
  events: number;
  /** عدد الحسابات الجديدة والفاقدة في الفترة - مقام معدّل الفقد. */
  newCount: number;
  churnedCount: number;
}

/**
 * حركة الإيراد من `SubscriptionEvent`.
 *
 * ⚠️ **الجدول ده اتضاف مع لوحة المالك، فمافيهوش تاريخ قبل تاريخ إضافته.**
 * الأرقام دي بتبقى صادقة تماماً من دلوقتي ورايح، وفاضية للماضي - وده
 * مذكور في الواجهة بدل ما يتعرض صفر يتقري "مافيش نموّ".
 */
export async function getMrrMovement(range: DateRange): Promise<MrrMovement> {
  const events = await prisma.subscriptionEvent.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    select: { type: true, fromPlan: true, toPlan: true, amountCents: true, currency: true, actorAdminId: true },
  });

  const buckets: Record<"newUsdCents" | "expansionUsdCents" | "contractionUsdCents" | "churnedUsdCents", Record<string, number>> = {
    newUsdCents: {}, expansionUsdCents: {}, contractionUsdCents: {}, churnedUsdCents: {},
  };
  let newCount = 0;
  let churnedCount = 0;

  for (const e of events) {
    // الهدية مش إيراد. تصنيفها كنموّ بيخلّي رقم النموّ يعكس كرم المالك
    // مش سوق المنتج - وده أخطر تشويه ممكن في لوحة بيتاخد عليها قرار.
    if (e.actorAdminId) continue;
    const cur = e.currency ?? "USD";
    const amt = e.amountCents ?? 0;

    if (e.type === "ACTIVATED") {
      buckets.newUsdCents[cur] = (buckets.newUsdCents[cur] ?? 0) + amt;
      newCount += 1;
    } else if (e.type === "PLAN_CHANGED" && e.fromPlan && e.toPlan) {
      const before = PLAN_BY_KEY.get(e.fromPlan as never)?.order ?? 0;
      const after = PLAN_BY_KEY.get(e.toPlan as never)?.order ?? 0;
      const target = after > before ? buckets.expansionUsdCents : buckets.contractionUsdCents;
      target[cur] = (target[cur] ?? 0) + amt;
    } else if (e.type === "CANCELLED" || e.type === "EXPIRED") {
      buckets.churnedUsdCents[cur] = (buckets.churnedUsdCents[cur] ?? 0) + amt;
      churnedCount += 1;
    }
  }

  return {
    newUsdCents: (await toUsd(buckets.newUsdCents)).usd,
    expansionUsdCents: (await toUsd(buckets.expansionUsdCents)).usd,
    contractionUsdCents: (await toUsd(buckets.contractionUsdCents)).usd,
    churnedUsdCents: (await toUsd(buckets.churnedUsdCents)).usd,
    events: events.length,
    newCount,
    churnedCount,
  };
}

export interface PaymentHealth {
  failedThisPeriod: number;
  pendingOlderThanDay: number;
  pastDueAccounts: number;
  /** 🔴 نيّةٌ عالقةٌ بعد نصف ساعة = **دفعةٌ بلا خدمة على الأرجح**. */
  stuckAwaitingWebhook: number;
  /** هل وصل ويب هوك واحد من Paymob أصلاً؟ غيابُه التامّ عطبُ إعداد. */
  paymobWebhooksEverReceived: number;
}

export async function getPaymentHealth(range: DateRange): Promise<PaymentHealth> {
  const dayAgo = new Date(Date.now() - 86_400_000);
  // نصف ساعة تكفي وتزيد: ويب هوك Paymob السليم يصل في ثوانٍ.
  const halfHourAgo = new Date(Date.now() - 30 * 60_000);
  const [
    failedThisPeriod, pendingOlderThanDay, pastDueAccounts,
    stuckAwaitingWebhook, paymobWebhooksEverReceived,
  ] = await Promise.all([
    prisma.paymentIntent.count({
      where: { status: "FAILED", updatedAt: { gte: range.from, lte: range.to } },
    }),
    // نيّة معلّقة من أكتر من يوم = العميل بدأ يدفع ومارجعش. مش خطأ نظام
    // بالضرورة، لكنها أقرب فرصة إيراد ضايعة يقدر المالك يلحقها.
    prisma.paymentIntent.count({ where: { status: "PENDING", createdAt: { lt: dayAgo } } }),
    prisma.user.count({ where: { subscriptionStatus: "PAST_DUE" } }),
    // 🔴 **المال يصل والخدمة لا تُفعَّل، بلا أثرٍ يقول ذلك.**
    //
    // التفعيل كلّه معلَّقٌ على ويب هوك Paymob. فإن لم يُضبَط رابطُه، أو
    // رُفض توقيعُه (وترتيبُ حقول الـHMAC عندنا **تخمينٌ** لم يُؤكَّد بعد -
    // راجع `docs/open-audit-findings.md` بند A1)، تُخصَم البطاقة وتبقى
    // النيّة `PENDING` إلى الأبد: العميل دفع ولم يحصل على شيء، ولا شيء
    // في المنتج كلّه يقول ذلك. هذا العدّاد هو ما يقوله.
    prisma.paymentIntent.count({
      where: { status: "PENDING", createdAt: { lt: halfHourAgo } },
    }),
    prisma.processedWebhookEvent.count({ where: { source: "paymob" } }),
  ]);
  return {
    failedThisPeriod, pendingOlderThanDay, pastDueAccounts,
    stuckAwaitingWebhook, paymobWebhooksEverReceived,
  };
}

export interface BusinessSummary {
  mrr: MrrBreakdown;
  arrUsdCents: number;
  arpuUsdCents: number;
  revenue: RevenuePoint[];
  revenueDeltaPct: number | null;
  movement: MrrMovement;
  payments: PaymentHealth;
  ltv: { usdCents: number; note: string } | null;
  /** معدّل فقد شهريّ - `null` حين لا يوجد مقام يُعتدّ به */
  churn: ChurnRate | null;
  /** صافي الاحتفاظ بالإيراد - أهمّ رقم بعد MRR نفسه */
  nrr: NetRetention | null;
  concentration: RevenueConcentration;
}

export interface ChurnRate {
  /** نسبة مئوية شهرية، مُطبَّعة على ٣٠ يوماً مهما كان طول الفترة */
  monthlyPct: number;
  churnedCount: number;
  /** الحسابات في **بداية** الفترة - المقام الصحيح */
  startingCustomers: number;
  note: string;
}

export interface NetRetention {
  /** ١٠٠٪ = محافظ. فوقها = التوسّع بيغطّي الفقد. */
  pct: number;
  startingMrrUsdCents: number;
  note: string;
}

export interface RevenueConcentration {
  /** نصيب أكبر عميل من MRR - مقياس مخاطرة لا نموّ */
  topCustomerPct: number | null;
  topThreePct: number | null;
  note: string;
}

export async function getBusinessSummary(range: DateRange): Promise<BusinessSummary> {
  const [mrr, revenue, movement, payments] = await Promise.all([
    getMrr(),
    getRevenueSeries(12),
    getMrrMovement(range),
    getPaymentHealth(range),
  ]);

  const arpuUsdCents = mrr.payingCustomers > 0 ? mrr.usd.usd / mrr.payingCustomers : 0;

  const last = revenue[revenue.length - 1]?.usdCents ?? 0;
  const prev = revenue[revenue.length - 2]?.usdCents ?? 0;

  // 🔴 **معدّل الفقد كان محسوباً غلط، وLTV كان مبنيّاً عليه.**
  //
  // كان: `كلّ الإلغاءات من أوّل يوم ÷ العملاء الحاليين`. ودي مش نسبة
  // أصلاً - مالهاش فترة زمنيّة، فبسطُها بيكبر للأبد كل ما الوقت يعدّي
  // بينما مقامُها لقطة لحظيّة. النتيجة رقم بيتضخّم مع عمر المنتج بلا
  // علاقة بالأداء، وLTV (‏ARPU ÷ الفقد) بيتضاءل معاه بنفس الغلط.
  //
  // الصحيح: **الفاقد في الفترة ÷ اللي كانوا موجودين في بدايتها**،
  // مُطبَّعاً على شهر. ومافيش لقطة تاريخية للبداية، فبتُشتقّ ممّا نعرفه:
  // الموجودون الآن، ناقص مَن دخل في الفترة، زائد مَن خرج فيها.
  const rangeDays = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)
  );
  const startingCustomers = mrr.payingCustomers - movement.newCount + movement.churnedCount;

  // المقام لازم يكون معتبَراً: خمسة عملاء وواحد مشي = ٢٠٪ فقد، وهو رقم
  // صحيح حسابياً وبلا معنى إحصائيّ. عرضه بيدعو لقرار على ضجيج.
  const MIN_DENOMINATOR = 10;
  const churn: ChurnRate | null =
    startingCustomers >= MIN_DENOMINATOR
      ? {
          monthlyPct: (movement.churnedCount / startingCustomers) * (30 / rangeDays) * 100,
          churnedCount: movement.churnedCount,
          startingCustomers,
          note: `Churned in the period ÷ customers at its start, normalised to 30 days. SubscriptionEvent history began with the owner panel, so periods before that read as zero churn rather than unknown.`,
        }
      : null;

  // LTV بيتبني على الفقد المصحَّح - ولمّا الفقد `null` أو صفر، LTV `null`
  // لا لانهاية. قسمةٌ على صفر بتدّي رقماً هائلاً يتقري "العميل بيفضل
  // للأبد"، وهو أسوأ من خانة فاضية.
  const monthlyChurnFraction = churn ? churn.monthlyPct / 100 : 0;
  const ltv =
    monthlyChurnFraction > 0
      ? {
          usdCents: arpuUsdCents / monthlyChurnFraction,
          note: "ARPU ÷ monthly churn. Both firm up as SubscriptionEvent accumulates history.",
        }
      : null;

  // صافي الاحتفاظ: الإيراد اللي فضل من قاعدة أوّل الفترة، بعد التوسّع
  // والانكماش والفقد - **وبدون الجديد**، لأنّ إضافته بتخلّي الرقم يقيس
  // البيع لا الاحتفاظ، وشركة بتفقد نصّ عملائها بتبان سليمة لو بتبيع بسرعة.
  const startingMrrUsdCents =
    mrr.usd.usd -
    movement.newUsdCents -
    movement.expansionUsdCents +
    movement.contractionUsdCents +
    movement.churnedUsdCents;

  const nrr: NetRetention | null =
    startingMrrUsdCents > 0 && movement.events > 0
      ? {
          pct:
            ((startingMrrUsdCents +
              movement.expansionUsdCents -
              movement.contractionUsdCents -
              movement.churnedUsdCents) /
              startingMrrUsdCents) *
            100,
          startingMrrUsdCents,
          note: "Expansion minus contraction and churn, over the starting base. New customers are excluded on purpose - including them measures selling, not retention.",
        }
      : null;

  return {
    mrr,
    arrUsdCents: mrr.usd.usd * 12,
    arpuUsdCents,
    revenue,
    revenueDeltaPct: pctChange(last, prev),
    movement,
    payments,
    ltv,
    churn,
    nrr,
    concentration: mrr.concentration,
  };
}

/** سجلّ الدفع لحساب واحد - صفحة العميل بتعرضه كما هو بلا تجميع */
export async function getCustomerBilling(userId: string) {
  const intents = await prisma.paymentIntent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, kind: true, planKey: true, cycle: true, credits: true,
      amountCents: true, currency: true, status: true, paidAt: true,
      createdAt: true, failureReason: true, transactionId: true,
    },
  });

  const paidByCurrency: Record<string, number> = {};
  let monthlyEquivalentCents = 0;
  for (const i of intents) {
    if (i.status !== "PAID") continue;
    paidByCurrency[i.currency] = (paidByCurrency[i.currency] ?? 0) + i.amountCents;
    if (i.kind === "SUBSCRIPTION") monthlyEquivalentCents += amortizeIntent(i.amountCents, i.cycle);
  }

  return {
    intents,
    paidByCurrency,
    lifetimeUsdCents: (await toUsd(paidByCurrency)).usd,
    monthlyEquivalentCents,
  };
}
