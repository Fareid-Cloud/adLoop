// lib/csrf.ts
//
// نمط "Double Submit Cookie": توكن عشوائي بيتحط في كوكي غير httpOnly
// (عشان JavaScript يقدر يقراه) + لازم يتبعت في هيدر مخصص مع كل طلب
// تغييري. موقع خبيث يقدر يخلي متصفحك يبعت الكوكي تلقائياً (ده أساس
// هجوم CSRF)، لكن مقدرش يقرا قيمتها ويحطها في هيدر - عشان Same-Origin
// Policy بتمنعه. لو الهيدر مطابقش الكوكي، الطلب مرفوض.

import { NextRequest } from "next/server";
import crypto from "crypto";

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyCsrfToken(req: NextRequest): boolean {
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = req.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) return false;

  // مقارنة بوقت ثابت (Timing-Safe) - تمنع هجوم قياس الوقت لتخمين
  // التوكن حرف بحرف
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
