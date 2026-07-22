// lib/rateLimit.ts
//
// حماية الـ endpoints المفتوحة (بدون تسجيل دخول) من إساءة الاستخدام -
// نافذة زمنية ثابتة (Fixed Window) بسيطة وكافية لحالتنا، مش محتاجين دقة
// نافذة متحركة (Sliding Window) معقدة لحجم الاستخدام الحالي.

import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number
): Promise<RateLimitResult> {
  // بنقرّب الوقت الحالي لبداية النافذة (مثلاً كل 10 دقايق) - أي طلب في
  // نفس النافذة بيتحسب على نفس الصف، مش صف جديد لكل طلب
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  try {
    const entry = await prisma.rateLimitEntry.upsert({
      where: { identifier_endpoint_windowStart: { identifier, endpoint, windowStart } },
      create: { identifier, endpoint, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });

    return {
      allowed: entry.count <= maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
    };
  } catch (err) {
    // لو فحص الحد نفسه فشل (مشكلة قاعدة بيانات مؤقتة)، منمنعش المستخدم
    // الشرعي بسبب عطل عندنا - بنسمح بالطلب ونسجل الخطأ بس
    console.error("فشل فحص حد الاستخدام:", err);
    return { allowed: true, remaining: maxRequests };
  }
}

export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
