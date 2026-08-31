// app/api/webhooks/paymob/route.ts
//
// الويب هوك = مصدر الحقيقة الوحيد لنجاح الدفع (نفس مبدأ Stripe بالظبط).
//
// التوقيع: SHA-512 على نصٍّ مركَّب من حقول الردّ بترتيبٍ معيَّن. وكان هذا
// الترتيب تخميناً حتى ٣١ أغسطس ٢٠٢٦، فرُفضت كلُّ دفعةٍ ناجحة بـ401 -
// راجع `HMAC_FIELD_ORDER` أدناه. صار الآن من توثيق Paymob مباشرة.
//
// والفشل يبقى مغلقاً: ما لا يُطابَق توقيعُه يُرفَض.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { markEventAsProcessed } from "@/lib/webhookSecurity";
import { pushToActionFeed } from "@/lib/actionFeed";
import { fulfillPaymentIntent } from "@/lib/billing";
import { logSubscriptionEvent } from "@/lib/subscriptionEvents";

/**
 * ترتيب حقول HMAC كما توثّقه Paymob - **لم يعد تخميناً.**
 *
 * 🔴 كان الحقل التاسع مكتوباً `is_auction`، والحقل الحقيقيّ `is_auth`.
 * وحرفان زائدان يكفيان: `getNestedValue` تُعيد سلسلةً فارغة لحقلٍ لا
 * وجود له، فيُبنى نصٌّ مختلفٌ عن نصّ Paymob، ويختلف التوقيع، **فتُرفض
 * كلّ دفعةٍ ناجحة بـ401**. الكارت يُخصَم والاشتراك لا يُفعَّل أبداً.
 *
 * وهذا ما حدث فعلاً: سجلّ Vercel أظهر نداءين من Paymob على هذا المسار
 * ردُّهما `401`، بينما بقيت النيّات `PENDING` وحساب المالك `NONE`.
 *
 * المصدر: توثيق Paymob لحساب HMAC - القائمة أدناه بترتيبها حرفياً.
 * و`id` هنا تكافئ `obj.id` في التوثيق: ما يُمرَّر إلى الدالّة هو `body.obj`
 * نفسه، فالمسار النسبيّ منه `id`.
 */
const HMAC_FIELD_ORDER = [
  "amount_cents", "created_at", "currency", "error_occured",
  "has_parent_transaction", "id", "integration_id", "is_3d_secure",
  "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
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


/**
 * ربطُ معاملةِ Paymob بنيّتنا.
 *
 * 🔴 **الاعتماد على `extras` وحدها أسقط الإتمام صامتاً.** نُرسل
 * `extras` مع النيّة، لكنّ Paymob تضعها في الحمولة حيث تشاء - وقد لا
 * تكون حيث نبحث. وحين لا نجدها كان المسار يردّ `200` ولا يفعل شيئاً:
 * الكارت مخصوم، والنيّة `PENDING`، ولا خطأ في أيّ مكان. وهو بالضبط ما
 * حدث بعد إصلاح التوقيع - انتقل الفشل من `401` صريح إلى `200` صامت.
 *
 * فتُجرَّب المواضع المعروفة، ثمّ يبقى **رقم الطلب** وهو الرابط المضمون:
 * نخزّنه عند إنشاء النيّة (`paymobOrderId`)، و`obj.order.id` هو نفسه.
 */
async function resolveIntent(transaction: any): Promise<{ intentId: string; userId: string } | null> {
  const candidates = [
    transaction?.order?.extras,
    transaction?.extras,
    transaction?.payment_key_claims?.extra,
    transaction?.payment_key_claims?.extras,
  ];
  for (const extras of candidates) {
    if (extras?.intentId && extras?.userId) {
      return { intentId: String(extras.intentId), userId: String(extras.userId) };
    }
  }

  const orderId = transaction?.order?.id;
  if (orderId) {
    const byOrder = await prisma.paymentIntent.findFirst({
      where: { paymobOrderId: String(orderId) },
      select: { id: true, userId: true },
    });
    if (byOrder) return { intentId: byOrder.id, userId: byOrder.userId };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { searchParams } = new URL(req.url);
  const receivedHmac = searchParams.get("hmac");

  const transaction = body.obj;
  if (!transaction) return NextResponse.json({ received: true });

  if (!verifyPaymobHmac(transaction, receivedHmac)) {
    // 🔴 **الرفض الصامت يخفي الفرق بين مهاجمٍ وإعدادٍ خاطئ.**
    //
    // ترتيبُ حقول الـHMAC عندنا **تخمينٌ** لم يُؤكَّد من لوحة Paymob بعد
    // (بند A1 في `docs/open-audit-findings.md`). فلو كان خطأً، تُرفَض
    // **كلّ** دفعةٍ صحيحة بهذا السطر بالضبط: الكارت مخصوم والاشتراك لا
    // يُفعَّل. والسطر الواحد في السجلّ لا يكفي - يُطبَع ما يُميّز الحالتين:
    // معرّفُ العملية ومبلغُها، فيُقارَن بلوحة Paymob مباشرة.
    console.error(
      "[paymob-webhook] رُفض التوقيع. لو تكرّر هذا مع كلّ دفعةٍ ناجحة فالسبب " +
        "ترتيبُ حقول HMAC أو أنّ PAYMOB_HMAC_SECRET يخصّ تكاملاً آخر - لا مهاجم.",
      {
        transactionId: transaction?.id ?? null,
        orderId: transaction?.order?.id ?? null,
        amountCents: transaction?.amount_cents ?? null,
        success: transaction?.success ?? null,
        hmacReceived: Boolean(receivedHmac),
      }
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 🔴 **لا تُعلَّم المعاملة "معالَجة" قبل إتمامها.** الشكل القديم كان
  // يسجّل الحدث هنا أولاً، فإن رمى أيّ شيءٍ بعده (بحث المستخدم، داخل
  // `fulfillPaymentIntent` بين تحديث الحالة ومنح الاستحقاق) رجع 500،
  // فتعيد Paymob الإرسال، فتسقط الإعادة على `P2002` وتُردّ "مكرّر" - ولا
  // يُعاد الإتمام أبداً: العميل دفع ولم يُفعَّل اشتراكه، بلا مصالحة.
  // منع التكرار الحقيقي هو انتقال النيّة الذرّي (`updateMany where PENDING`)
  // في `fulfillPaymentIntent`؛ وسمُ الحدث يأتي **بعد** الإتمام كطبقةٍ ثانية
  // لا كبوّابةٍ تمنع إعادة المحاولة.

  if (transaction.success !== true) {
    // 🔴 كان الفرع ده بيرجع صامتاً تماماً، فنيّة الدفع بتفضل `PENDING`
    // للأبد بعد رفض حقيقي من البنك - يعني "مدفوعات فاشلة" في أي تقرير
    // رقم صفر دايماً، والعميل اللي كارته اترفض مايظهرش في أي قائمة.
    const failedResolved = await resolveIntent(transaction);
    const failedIntentId = failedResolved?.intentId;
    if (failedIntentId) {
      const failed = await prisma.paymentIntent.updateMany({
        where: { id: String(failedIntentId), status: "PENDING" },
        data: {
          status: "FAILED",
          // يُفرَغ القيد كي يستطيع العميل إعادة المحاولة بعد الرفض.
          dedupeKey: null,
          transactionId: String(transaction.id),
          failureReason: String(transaction.data?.message ?? "declined").slice(0, 300),
        },
      });
      if (failed.count > 0 && failedResolved?.userId) {
        const intent = await prisma.paymentIntent.findUnique({
          where: { id: String(failedIntentId) },
          select: { planKey: true, amountCents: true, currency: true },
        });
        await logSubscriptionEvent({
          userId: String(failedResolved.userId),
          type: "PAYMENT_FAILED",
          toPlan: intent?.planKey ?? null,
          amountCents: intent?.amountCents ?? null,
          currency: intent?.currency ?? null,
        });
      }
    }
    return NextResponse.json({ received: true });
  }

  const resolved = await resolveIntent(transaction);
  if (!resolved) {
    // لا يُبتلع الأمر بردٍّ صامت: يُطبَع شكلُ الحمولة كي يُعرَف أين وضعت
    // Paymob المعرّفات هذه المرّة، بدل تخمينٍ ثانٍ.
    console.error("[paymob-webhook] تعذّر ربط المعاملة بنيّة دفع", {
      transactionId: transaction?.id ?? null,
      orderId: transaction?.order?.id ?? null,
      topLevelKeys: Object.keys(transaction ?? {}),
      orderKeys: Object.keys(transaction?.order ?? {}),
    });
    return NextResponse.json({ received: true });
  }
  const { intentId, userId } = resolved;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ received: true });

  // الإتمام كلّه في محرّك واحد: انتقال ذرّي للحالة، ثم أثر واحد لا يتكرّر.
  // بدون `intentId` لا نستطيع الجزم بما اشتراه، فنسجّل ولا نخمّن - منح
  // اشتراك بناءً على تخمين أسوأ من عدم منحه.
  if (!intentId) {
    console.error("Paymob webhook بلا intentId - لا يمكن تحديد ما اشتُري", transaction.id);
    return NextResponse.json({ received: true, unmatched: true });
  }

  // ما دفعه العميل فعلاً - يُطابَق بما طلبناه داخل الانتقال الذرّي نفسه.
  const paidCents = Number(transaction.amount_cents);
  const paidCurrency = String(transaction.currency ?? "").toUpperCase();
  const result = await fulfillPaymentIntent(String(intentId), String(transaction.id), {
    amountCents: paidCents,
    currency: paidCurrency,
    userId: String(userId),
  });
  if (result.mismatch) {
    // لا نمنح شيئاً، ولا نُخفي الحدث: يُردّ استلامٌ كي لا يعيد Paymob
    // المحاولة إلى الأبد، والسجلّ أعلاه يحمل ما لم يتطابق.
    return NextResponse.json({ received: true, mismatch: true });
  }
  if (!result.ok || result.alreadyDone) return NextResponse.json({ received: true });

  const workspace = await prisma.workspace.findFirst({ where: { userId } });
  if (workspace) {
    const ar = (user.preferredLocale ?? "en") === "ar";
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

  // الآن وقد تمّ الإتمام فعلاً: نسم الحدث معالَجاً. إعادةٌ لاحقةٌ لنفس
  // المعاملة تجد الوسم فلا تكرّر العمل، والانتقال الذرّي في الإتمام كان قد
  // منع التكرار على أيّ حال. `false` (وسمٌ سابق) مقبولة - لا نرمي.
  await markEventAsProcessed("paymob", String(transaction.id));

  return NextResponse.json({ received: true });
}
