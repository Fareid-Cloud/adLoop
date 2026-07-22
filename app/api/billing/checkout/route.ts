// app/api/billing/checkout/route.ts
//
// بننشئ "نية دفع" عند Paymob، ونرجّع رابط صفحة الدفع المستضافة عندها.
// نفس مبدأ الأمان اللي طبّقناه مع Stripe: العميل بيبعت "مفتاح خطة"
// بسيط (starter/pro)، والمبلغ الحقيقي بيتحدد في السيرفر بس.

import { NextRequest, NextResponse } from "next/server";
import { createPaymentIntention, getUnifiedCheckoutUrl } from "@/lib/paymob";
import { getSessionUser } from "@/lib/auth";

const PLAN_PRICES_CENTS: Record<string, number> = {
  starter: Number(process.env.PLAN_PRICE_STARTER_CENTS ?? 0),
  pro: Number(process.env.PLAN_PRICE_PRO_CENTS ?? 0),
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
};

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan } = await req.json();
  const amountCents = PLAN_PRICES_CENTS[plan];
  if (!amountCents) return NextResponse.json({ error: "خطة غير معروفة" }, { status: 400 });

  const intention = await createPaymentIntention({
    amountCents,
    currency: "EGP",
    userId: user.id,
    userEmail: user.email,
    planLabel: PLAN_LABELS[plan],
  });

  return NextResponse.json({ url: getUnifiedCheckoutUrl(intention.clientSecret) });
}
