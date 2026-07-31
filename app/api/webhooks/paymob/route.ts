// app/api/webhooks/paymob/route.ts
//
// الويب هوك = مصدر الحقيقة الوحيد لنجاح الدفع (نفس مبدأ Stripe بالظبط).
//
// ⚠️ ملاحظة أمانة حرجة: اتأكدنا إن Paymob بتستخدم SHA-512 على "نص
// مُركّب" (concatenated string) من حقول الرد - لكن **مقدرناش نوصل
// لترتيب الحقول بالضبط** (صفحة التوثيق بتتحمّل بجافاسكريبت، أداة الجلب
// عندنا مقدرش تشغّلها). الترتيب المكتوب تحت **تخمين مبني على نمط شائع
// في توثيق Paymob القديم** - **لازم تتأكد منه فعلياً من لوحة تحكم
// Paymob (Settings → Payment Integrations → HMAC) قبل أي استخدام حقيقي
// بفلوس فعلية.** لحد ما يتأكد، النظام هيرفض أي حاجة توقيعها مش متطابق -
// آمن افتراضياً (فشل مغلق)، مش خطر.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { markEventAsProcessed } from "@/lib/webhookSecurity";
import { pushToActionFeed } from "@/lib/actionFeed";
import { fulfillPaymentIntent } from "@/lib/billing";

const HMAC_FIELD_ORDER = [
  "amount_cents", "created_at", "currency", "error_occured",
  "has_parent_transaction", "id", "integration_id", "is_3d_secure",
  "is_auction", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order.id", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];

function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((acc, key) => acc?.[key], obj)?.toString() ?? "";
}

function verifyPaymobHmac(transaction: any, receivedHmac: string | null): boolean {
  if (!receivedHmac || !process.env.PAYMOB_HMAC_SECRET) return false;

  const concatenated = HMAC_FIELD_ORDER.map((field) => getNestedValue(transaction, field)).join("");
  const computed = crypto
    .createHmac("sha512", process.env.PAYMOB_HMAC_SECRET)
    .update(concatenated)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { searchParams } = new URL(req.url);
  const receivedHmac = searchParams.get("hmac");

  const transaction = body.obj;
  if (!transaction) return NextResponse.json({ received: true });

  if (!verifyPaymobHmac(transaction, receivedHmac)) {
    console.error("توقيع HMAC غير صحيح من Paymob webhook - الطلب مرفوض");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const isNew = await markEventAsProcessed("paymob", String(transaction.id));
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  if (transaction.success !== true) {
    return NextResponse.json({ received: true });
  }

  const extras = transaction.order?.extras ?? transaction.extras ?? {};
  const userId = extras.userId;
  const intentId = extras.intentId;
  if (!userId) return NextResponse.json({ received: true });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ received: true });

  // الإتمام كلّه في محرّك واحد: انتقال ذرّي للحالة، ثم أثر واحد لا يتكرّر.
  // بدون `intentId` لا نستطيع الجزم بما اشتراه، فنسجّل ولا نخمّن - منح
  // اشتراك بناءً على تخمين أسوأ من عدم منحه.
  if (!intentId) {
    console.error("Paymob webhook بلا intentId - لا يمكن تحديد ما اشتُري", transaction.id);
    return NextResponse.json({ received: true, unmatched: true });
  }

  const result = await fulfillPaymentIntent(String(intentId), String(transaction.id));
  if (!result.ok || result.alreadyDone) return NextResponse.json({ received: true });

  const workspace = await prisma.workspace.findFirst({ where: { userId } });
  if (workspace) {
    const ar = (user.preferredLocale ?? "ar") === "ar";
    await pushToActionFeed({
      workspaceId: workspace.id,
      type: "ACCOUNT",
      severity: "LOW",
      title: result.kind === "CREDITS"
        ? ar ? `أُضيف ${result.credits} كريدت إلى رصيدك` : `${result.credits} credits added to your balance`
        : ar ? "تم تفعيل اشتراكك" : "Your subscription is active",
      description: result.kind === "CREDITS"
        ? ar ? "الرصيد المشترى لا ينتهي بنهاية الشهر." : "Purchased credits do not expire at month end."
        : ar ? "كل ميزات باقتك متاحة الآن." : "Every feature in your plan is available now.",
      linkUrl: "/dashboard/billing",
    });
  }

  return NextResponse.json({ received: true });
}
