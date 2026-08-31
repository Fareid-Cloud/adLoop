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
