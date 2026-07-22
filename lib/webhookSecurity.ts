// lib/webhookSecurity.ts
//
// أدوات أمان مشتركة لأي webhook بيستقبله النظام (سلة، شوبيفاي، واتساب،
// إلخ) - بدل ما نكرر نفس منطق التحقق من التوقيع والحماية من التكرار في
// كل route لوحده وممكن ننسى نطبقه صح في مكان جديد.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ==================== التحقق من التوقيع (HMAC-SHA256) ====================
// معظم مزودي الـ webhooks (سلة، شوبيفاي، ستريب) بيستخدموا نفس الأسلوب:
// HMAC-SHA256 على الـ body الخام (مش الـ JSON بعد ما اتحلل)، ومقارنة
// "زمنية آمنة" (timing-safe) عشان محدش يقدر يخمّن التوقيع بالتجربة.

export function verifyHmacSignature(
  rawBody: string,
  receivedSignature: string | null,
  secret: string
): boolean {
  if (!receivedSignature || !secret) return false;

  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // لازم يكونوا نفس الطول قبل المقارنة الزمنية الآمنة، وإلا بترمي استثناء
  if (computedSignature.length !== receivedSignature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(receivedSignature)
  );
}

// ==================== الحماية من إعادة المعالجة (Idempotency) ====================
// بترجع true لو ده أول مرة نشوف الحدث ده (خلاص اتسجل، كمّل معالجته)،
// وbfalse لو سبق معالجته (تجاهله بأمان، حتى لو المصدر بعته تاني بسبب
// إعادة محاولة تلقائية بعد timeout).

export async function markEventAsProcessed(
  source: string,
  externalEventId: string
): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({
      data: { source, externalEventId },
    });
    return true; // نجح التسجيل = أول مرة
  } catch (err: any) {
    // فشل بسبب unique constraint = الحدث ده اتعالج قبل كده بالفعل
    if (err?.code === "P2002") return false;
    throw err; // أي خطأ تاني (قاعدة البيانات واقعة مثلاً) لازم يظهر، مش يتبلع
  }
}
