// lib/billingRegion.ts
//
// **مسألتان منفصلتان كانتا مخلوطتين في واحدة.**
//
//   ١) **بأيّ قائمةِ سعرٍ نحاسب؟** قرارٌ تجاريّ: مصر لها خصمٌ إقليميّ،
//      والسعودية بسعر الدولار نفسه، وبقيّة العالم بالدولار.
//   ② **بأيّ عملةٍ نحصّل؟** قدرةُ البوّابة: تكامل MIGS عند Paymob يقبل
//      الجنيه وحده، ولا شأن للعميل بذلك.
//
// وخلطُهما كان يُنتج أسوأ نتيجةٍ ممكنة: **عميلٌ يُرفَض دفعُه** لأنّ عملة
// حسابه الإعلانيّ ليست الجنيه. وهذا لا معنى له - أيّ بطاقةٍ في العالم
// تُخصَم بالجنيه، ومصرفُ صاحبها هو من يُجري التحويل. فالعميل الأمريكيّ
// والهنديّ والبرازيليّ والإيطاليّ يدفعون جميعاً ببطاقاتهم كما هي.

import { prisma } from "@/lib/prisma";
import type { BillingCurrency } from "@/lib/plans";

/** ما تقبله بوّابتنا فعلياً. ليست خياراً للعميل ولا تظهر له. */
export const CHARGE_CURRENCY = "EGP" as const;

/**
 * سعرُ صرفٍ احتياطيّ **لا يُستعمل إلّا إذا غاب سعر اليوم**.
 *
 * والغياب ممكن: الكرون اليوميّ قد يفشل. والبديل عن الاحتياطيّ هو رفضُ
 * الدفع - أي إعادةُ العلّة نفسها التي وُجد هذا الملفّ لإزالتها. ويُختار
 * **أقلّ** من السوق عمداً: خطؤه يُنقص ما نحصّله ولا يزيده على العميل.
 */
const FALLBACK_USD_EGP = 48;

/** دولٌ لها قائمةُ سعرٍ خاصّة. ما عداها على الدولار. */
const PRICE_LIST_BY_COUNTRY: Record<string, BillingCurrency> = {
  // الخصم الإقليميّ - مصر وحدها بقرارٍ صريح من المالك.
  EG: "EGP",
  // السعودية بسعر الدولار نفسه؛ الريال هنا **عرضٌ محلّيّ لا خصم**
  // (١٤٩$ × ٣٫٧٥ = ٥٥٩ ريالاً، وهو سعر القائمة حرفياً).
  SA: "SAR",
};

/**
 * قائمةُ السعر التي يراها صاحبُ هذا الحساب.
 *
 * **مصدرٌ واحد للعرض وللخصم معاً.** كانت صفحةُ الباقات تقرأ
 * `workspace.currency` ومسارُ الدفع يقرأ `workspace.dataCurrency`، فتُعرَض
 * ٢٬٤٩٩ جنيهاً ويُطلَب من البوّابة ١٤٩ دولاراً - رقمان مختلفان لعمليةٍ
 * واحدة. لا يُقرأ السعر من مكانٍ آخر بعد اليوم.
 */
export function priceListFor(billingCountry: string | null | undefined): BillingCurrency {
  if (!billingCountry) return "USD";
  return PRICE_LIST_BY_COUNTRY[billingCountry.trim().toUpperCase()] ?? "USD";
}

/** سعرُ صرف اليوم من الأرشيف اليوميّ (`fetchAndStoreExchangeRate`). */
async function usdToEgpRate(): Promise<number> {
  const snap = await prisma.exchangeRateSnapshot.findFirst({
    where: { fromCurrency: "USD", toCurrency: "EGP" },
    orderBy: { date: "desc" },
    select: { rate: true },
  });
  return snap?.rate && snap.rate > 0 ? snap.rate : FALLBACK_USD_EGP;
}

async function usdToSarRate(): Promise<number> {
  const snap = await prisma.exchangeRateSnapshot.findFirst({
    where: { fromCurrency: "USD", toCurrency: "SAR" },
    orderBy: { date: "desc" },
    select: { rate: true },
  });
  return snap?.rate && snap.rate > 0 ? snap.rate : 3.75;
}

export interface ChargeAmount {
  /** ما يُرسَل إلى Paymob - بالجنيه وبالقرش. */
  chargeCents: number;
  /** سعرُ الصرف المستعمل، يُحفَظ مع العملية لتفسير الرقم لاحقاً. */
  rateUsed: number;
}

/**
 * تحويلُ السعر المعروض إلى المبلغ المُحصَّل بالجنيه.
 *
 * والسعرُ المعروض هو المرجع دائماً: من رأى ١٤٩ دولاراً يُخصَم منه ما
 * يعادلها بالجنيه اليوم، لا رقمٌ آخر.
 */
export async function toChargeAmount(
  listCurrency: BillingCurrency,
  listCents: number
): Promise<ChargeAmount> {
  if (listCurrency === "EGP") {
    // القائمة بالجنيه أصلاً - لا تحويل ولا سعر صرف يتدخّل.
    return { chargeCents: Math.round(listCents), rateUsed: 1 };
  }

  const usdEgp = await usdToEgpRate();
  if (listCurrency === "USD") {
    return { chargeCents: Math.round(listCents * usdEgp), rateUsed: usdEgp };
  }

  // الريال يمرّ بالدولار: أرشيفنا كلّه مبنيّ على `USD -> X`.
  const usdSar = await usdToSarRate();
  const usdCents = listCents / usdSar;
  return { chargeCents: Math.round(usdCents * usdEgp), rateUsed: usdEgp / usdSar };
}

/**
 * بلدُ الفوترة من ترويسة Vercel الجغرافية.
 *
 * تُقرأ عند التسجيل مرّةً واحدة. و`null` مقبولة: تعني الدولار، وهو
 * الافتراضيّ الأعلى - فالخطأ في القياس لا يمنح خصماً.
 */
export function countryFromRequest(headers: Headers): string | null {
  const raw = headers.get("x-vercel-ip-country");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * بلدُ الفوترة لحسابٍ بعينه، ويُثبَّت عند أوّل قراءة إن كان غائباً.
 *
 * 🔴 **الالتقاط عند التسجيل وحده يترك كلّ حسابٍ قائمٍ على الدولار أبداً.**
 * الحقل أُضيف اليوم، فكلّ من سجّل قبله - وهم كلّ المستخدمين - `null`.
 * ومطالبتُهم بمراسلة الدعم ليأخذوا سعر بلدهم ليست تصميماً.
 *
 * فيُقرأ من الترويسة عند أوّل حاجةٍ إليه **ويُكتَب**: مرّةً واحدة، ثمّ
 * يصير مخزَّناً كحال المسجَّل حديثاً. والكتابةُ هي ما يُبقي الأمر
 * التقاطاً لا استنتاجاً متكرّراً - ولو ظلّ يُقرأ من الشبكة في كلّ طلب
 * لصار تبديلُ الـVPN لحظةَ الدفع كافياً لتبديل السعر.
 */
export async function resolveBillingCountry(
  userId: string,
  stored: string | null | undefined,
  headers: Headers
): Promise<string | null> {
  if (stored) return stored;

  const detected = countryFromRequest(headers);
  if (!detected) return null;

  // سباقُ طلبين لا يضرّ: كلاهما يكتب القيمة نفسها.
  await prisma.user
    .update({ where: { id: userId }, data: { billingCountry: detected } })
    .catch(() => {});
  return detected;
}
