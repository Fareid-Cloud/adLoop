// lib/admin/shared.ts
//
// الأساس المشترك بين كل تحليلات لوحة المالك: نطاق الزمن، وتحويل العملة،
// والسعر الفعليّ للحساب الواحد.
//
// **الثلاثة هنا مش في كل ملف** عشان رقم الإيراد في الرئيسية والتحليلات
// وصفحة العميل يبقى نفس الرقم بالظبط. تكرار حسبة السعر في تلاتة أماكن
// معناه إن سعراً مخصّصاً يظهر في واحدة ويختفي من التانيتين.

import { prisma } from "@/lib/prisma";
import { PLAN_BY_KEY, YEARLY_MONTHS_CHARGED, type BillingCurrency } from "@/lib/plans";

// ==================== الزمن ====================

export interface DateRange {
  from: Date;
  to: Date;
}

export function lastNDays(n: number): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - n);
  return { from, to };
}

/** الفترة السابقة بنفس الطول - أساس أي مقارنة "مقابل الفترة السابقة" */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from) };
}

/** أوّل يوم في الشهر - مفتاح تجميع السلاسل الشهرية */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** نسبة التغيّر - `null` لمّا الأساس صفر (القسمة على صفر مش "+100%") */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ==================== العملة ====================

/**
 * تحويل إلى الدولار بأسعار الصرف اللي الكرون بيسجّلها يومياً.
 *
 * **العملة اللي مالهاش سعر صرف بتترجع منفصلة، مش بتتحوّل بواحد.** معاملة
 * الجنيه كأنّه دولار كانت هتضخّم الإيراد خمسين ضعف في رقم المالك بيبني
 * عليه قرار - والغياب الصريح أصدق من رقم مطمئن غلط. نفس المبدأ المطبَّق
 * في `lib/usageCaps.ts` بالظبط.
 */
export interface UsdConversion {
  usd: number;
  /** العملات اللي مالهاش سعر صرف - مبالغها **مش** داخلة في `usd` */
  unconverted: Record<string, number>;
}

export async function toUsd(byCurrency: Record<string, number>): Promise<UsdConversion> {
  const out: UsdConversion = { usd: 0, unconverted: {} };
  const needed = Object.keys(byCurrency).filter((c) => c !== "USD");

  const rates = new Map<string, number>();
  if (needed.length > 0) {
    // آخر لقطة لكل عملة - `orderBy date desc` مع `distinct` بيدّي الأحدث
    const snaps = await prisma.exchangeRateSnapshot.findMany({
      where: { fromCurrency: "USD", toCurrency: { in: needed } },
      orderBy: { date: "desc" },
      distinct: ["toCurrency"],
      select: { toCurrency: true, rate: true },
    });
    for (const s of snaps) if (s.rate > 0) rates.set(s.toCurrency, s.rate);
  }

  for (const [cur, amount] of Object.entries(byCurrency)) {
    if (amount === 0) continue;
    if (cur === "USD") {
      out.usd += amount;
      continue;
    }
    const rate = rates.get(cur);
    if (rate) out.usd += amount / rate;
    else out.unconverted[cur] = (out.unconverted[cur] ?? 0) + amount;
  }
  return out;
}

// ==================== السعر الفعليّ للحساب ====================

/** الحد الأدنى من الحساب اللي محتاجينه عشان نحسب اشتراكه الشهري */
export interface PricedUser {
  subscriptionPlan: string | null;
  subscriptionStatus: string;
  currentPeriodEnd: Date | null;
  customPriceOverrideCents: number | null;
  customPriceCurrency: string | null;
}

export interface MonthlyValue {
  cents: number;
  currency: BillingCurrency;
}

/**
 * القيمة الشهرية المتكرّرة لهذا الحساب - `null` لو مش اشتراك نشط مدفوع.
 *
 * **الاشتراك السنويّ بيتقسم على 12 مش بيتحسب كامل** في الشهر اللي اتدفع
 * فيه: MRR معناها "الإيراد الشهريّ المتكرّر"، وحساب سنة كاملة في شهر
 * واحد بيخلّي الرسم البيانيّ قفزة كاذبة بتنزل الشهر اللي بعده.
 *
 * والعملة بتيجي من السعر المخصّص لو موجود، وإلا من `fallbackCurrency`
 * (عملة مساحة عمل الحساب) - مش من عملة ثابتة مفترضة.
 */
export function monthlyRecurringOf(
  user: PricedUser,
  fallbackCurrency: BillingCurrency
): MonthlyValue | null {
  const active =
    user.subscriptionStatus === "ACTIVE" &&
    !!user.currentPeriodEnd &&
    user.currentPeriodEnd > new Date();
  if (!active || !user.subscriptionPlan) return null;

  const plan = PLAN_BY_KEY.get(user.subscriptionPlan as never);
  if (!plan || plan.key === "free") return null;

  if (
    user.customPriceOverrideCents &&
    user.customPriceOverrideCents > 0 &&
    isBillingCurrency(user.customPriceCurrency)
  ) {
    return { cents: user.customPriceOverrideCents, currency: user.customPriceCurrency };
  }

  return { cents: Math.round(plan.price[fallbackCurrency] * 100), currency: fallbackCurrency };
}

export function isBillingCurrency(v: string | null | undefined): v is BillingCurrency {
  return v === "EGP" || v === "SAR" || v === "USD";
}

/** قيمة الدفعة الواحدة موزّعة شهرياً - للسنويّ 1/10 مش 1/12، لأنّ
 *  السنويّ بيتحصّل عشر شهور مقابل اثني عشر (الشهران هدية الكتالوج). */
export function amortizeIntent(amountCents: number, cycle: string | null): number {
  return cycle === "yearly" ? amountCents / YEARLY_MONTHS_CHARGED : amountCents;
}
