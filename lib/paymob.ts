// lib/paymob.ts
//
// عميل Paymob - بنستخدم Intention API (المعيار الحديث الموصى بيه رسمياً،
// اتأكدنا من بنيتها من مصدرين مستقلين: مواصفة OpenAPI ومكتبة Python
// الرسمية). القاعدة المصرية: https://accept.paymob.com

const PAYMOB_BASE_URL = "https://accept.paymob.com";

export interface CreateIntentionParams {
  amountCents: number;
  currency: "EGP" | "SAR" | "AED";
  userId: string;
  userEmail: string;
  planLabel: string;
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
      extras: { userId: params.userId, planLabel: params.planLabel },
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
