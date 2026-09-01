// lib/paymob.ts
//
// عميل Paymob - بنستخدم Intention API (المعيار الحديث الموصى بيه رسمياً،
// اتأكدنا من بنيتها من مصدرين مستقلين: مواصفة OpenAPI ومكتبة Python
// الرسمية). القاعدة المصرية: https://accept.paymob.com

import type { BillingCurrency } from "@/lib/plans";
import { getAppUrl } from "@/lib/appUrl";

const PAYMOB_BASE_URL = "https://accept.paymob.com";

export interface CreateIntentionParams {
  amountCents: number;
  /** 🔴 **كانت `"EGP" | "SAR" | "AED"` - ومجموعةٌ لا تطابق ما يُنتَج.**
   *
   *  `billingCurrencyFor` تُرجع `EGP | SAR | USD`: فالدولار **يُرسَل ولا
   *  يُقبَل هنا**، والدرهم **مقبولٌ ولا يُرسَل أبداً**. ولم يمسكها المترجم
   *  لأنّ `lib/billing.ts` كان يُمرّرها بـ`as` - وهو تأكيدٌ يُسكِت الخطأ
   *  الوحيد الذي كان سيكشفها.
   *
   *  والأثر ليس نظرياً: الدولار هو الافتراضيّ لكلّ مساحةٍ ليست بالجنيه أو
   *  الريال، فكلّ عميلٍ منهم يصطدم بـ`417` من Paymob. النوع الآن هو
   *  `BillingCurrency` نفسه، فأيّ افتراقٍ لاحق يسقط عند البناء. */
  currency: BillingCurrency;
  userId: string;
  userEmail: string;
  planLabel: string;
  /** معرّف نيّة الدفع عندنا - يعود في الويب هوك فنطابق الدفع بنيّة بعينها */
  intentId: string;
}

export interface PaymobIntentionResponse {
  id: string;
  clientSecret: string;
  intentionOrderId: number;
}

export async function createPaymentIntention(params: CreateIntentionParams): Promise<PaymobIntentionResponse> {
  const res = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
    },
    body: JSON.stringify({
      amount: params.amountCents,
      currency: params.currency,
      payment_methods: [Number(process.env.PAYMOB_INTEGRATION_ID)],
      items: [{ name: params.planLabel, amount: params.amountCents, quantity: 1 }],
      billing_data: {
        first_name: params.userEmail.split("@")[0],
        last_name: "N/A",
        email: params.userEmail,
        phone_number: "+201000000000",
        apartment: "NA", floor: "NA", street: "NA", building: "NA",
        city: "Cairo", state: "NA", country: "EG",
      },
      extras: { userId: params.userId, planLabel: params.planLabel, intentId: params.intentId },
      // 🔴 **رابطُ العودة في لوحة Paymob ثابتٌ بلا معرّف عملية.**
      //
      // وصفحةُ النتيجة تسأل عن نيّةٍ بعينها (`?intent=`)، فبلا المعرّف
      // يعود **كلّ من نجح دفعُه** إلى رسالة فشل. يُرسَل هنا مع كلّ نيّة
      // فيحمل معرّفها، ولا يعتمد على ما ضُبط في اللوحة.
      redirection_url: `${getAppUrl()}/dashboard/billing/result?intent=${params.intentId}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`فشل إنشاء نية دفع Paymob: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    clientSecret: data.client_secret,
    intentionOrderId: data.intention_order_id,
  };
}

export function getUnifiedCheckoutUrl(clientSecret: string): string {
  const publicKey = process.env.PAYMOB_PUBLIC_KEY;
  return `${PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`;
}

// ─────────────────────────────────────────────────────────────────────────
// التحصيل التلقائيّ للتجديد (Merchant-Initiated Transaction)
//
// 🔴 **هذا المسار يُحرّك مالاً حقيقياً من بطاقةٍ محفوظةٍ والعميلُ غائب.**
//
// وهو **مغلقٌ ببنيته**، لا برايةٍ يسهل قلبها: لا يُطلَق نداءٌ واحد ما لم
// يكن `PAYMOB_MOTO_INTEGRATION_ID` مضبوطاً - وهذا المتغيّر لا يوجد إلّا
// بعد أن يُفعّل المالكُ خدمة MOTO/التجديد في لوحة Paymob (موافقةٌ منهم،
// ثمّ تكاملٌ منفصلٌ عن تكامل الدفع التفاعليّ). فحتى تُفعَّل، سلوكُ التجديد
// هو سلوكُ اليوم بالضبط: تذكيرٌ ثمّ `PAST_DUE`، بلا أيّ خصمٍ تلقائيّ.
//
// وترتيبُ حقول MOTO لم يُتحقَّق بدفعةٍ حقيقيّة بعد - تماماً كما كان توقيعُ
// الويب هوك تخميناً حتى أثبتَته دفعةٌ واحدة. فأوّلُ تجديدٍ تلقائيٍّ حقيقيّ
// يجب أن يُراقَب (موثَّق في `activation-checklist.md`) قبل الاعتماد عليه.

export interface MitChargeResult {
  ok: boolean;
  /** سببُ عدم المحاولة أو الفشل - يميّز "غير مُفعَّل" عن "رُفض الكارت". */
  reason?: "not_configured" | "no_token" | "declined" | "error";
  transactionId?: string;
  detail?: string;
}

/** هل التحصيل التلقائيّ مُفعَّلٌ أصلاً على هذا الحساب؟ نداءٌ صفريّ التكلفة. */
export function isAutoChargeConfigured(): boolean {
  return Boolean(process.env.PAYMOB_MOTO_INTEGRATION_ID && process.env.PAYMOB_SECRET_KEY);
}

/**
 * تحصيلُ مبلغِ التجديد من كارتٍ محفوظ عبر MOTO (customer not present).
 *
 * المسار الموثَّق: إنشاء طلب → مفتاح دفع بتكامل MOTO → دفعٌ بالتوكن. وأيّ
 * فشلٍ في أيّ خطوة يعود `{ ok:false }` فتلجأ مهمّةُ التجديد للمسار الآمن -
 * لا استثناءٌ يُوقف الدورة على بقيّة المشتركين.
 */
export async function chargeSavedCard(input: {
  cardToken: string;
  amountCents: number;
  email: string;
  /** يُخزَّن في وصف الطلب للمطابقة والتدقيق. */
  merchantOrderId: string;
}): Promise<MitChargeResult> {
  if (!isAutoChargeConfigured()) return { ok: false, reason: "not_configured" };
  if (!input.cardToken) return { ok: false, reason: "no_token" };

  const secret = process.env.PAYMOB_SECRET_KEY!;
  const motoIntegration = Number(process.env.PAYMOB_MOTO_INTEGRATION_ID);

  try {
    // ١) طلبٌ بلا عناصر - قيمتُه هي المبلغ. `merchant_order_id` يربطه بنا.
    const orderRes = await fetch(`${PAYMOB_BASE_URL}/api/ecommerce/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${secret}` },
      body: JSON.stringify({
        delivery_needed: false,
        amount_cents: input.amountCents,
        currency: "EGP",
        merchant_order_id: input.merchantOrderId,
        items: [],
      }),
    });
    if (!orderRes.ok) return { ok: false, reason: "error", detail: `order ${orderRes.status}` };
    const order = await orderRes.json();

    // ٢) مفتاحُ دفعٍ على تكامل MOTO تحديداً - لا على تكامل الدفع التفاعليّ.
    const keyRes = await fetch(`${PAYMOB_BASE_URL}/api/acceptance/payment_keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${secret}` },
      body: JSON.stringify({
        amount_cents: input.amountCents,
        currency: "EGP",
        order_id: order.id,
        integration_id: motoIntegration,
        billing_data: {
          first_name: input.email.split("@")[0], last_name: "N/A", email: input.email,
          phone_number: "+201000000000", apartment: "NA", floor: "NA", street: "NA",
          building: "NA", city: "Cairo", state: "NA", country: "EG",
        },
      }),
    });
    if (!keyRes.ok) return { ok: false, reason: "error", detail: `key ${keyRes.status}` };
    const { token: paymentKey } = await keyRes.json();

    // ٣) الدفعُ بالتوكن المحفوظ - customer not present، بلا CVV.
    const payRes = await fetch(`${PAYMOB_BASE_URL}/api/acceptance/payments/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { identifier: input.cardToken, subtype: "TOKEN" },
        payment_token: paymentKey,
      }),
    });
    if (!payRes.ok) return { ok: false, reason: "error", detail: `pay ${payRes.status}` };
    const pay = await payRes.json();

    if (pay.success === true) {
      return { ok: true, transactionId: String(pay.id) };
    }
    return { ok: false, reason: "declined", detail: String(pay.data?.message ?? "declined").slice(0, 200) };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
}
