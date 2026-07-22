// app/api/auth/mfa/verify-login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyMfaPendingToken, createSessionToken } from "@/lib/auth";
import { decryptMfaSecret, verifyMfaCode } from "@/lib/mfa";
import { validateOrError } from "@/lib/validation/schemas";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const schema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().length(6, "الكود 6 أرقام"),
});

export async function POST(req: NextRequest) {
  // إصلاح حرج من اختبار الاختراق: كود MFA (6 أرقام = مليون احتمال بس)
  // كان بدون أي حد استخدام - قابل للتخمين بالقوة الغاشمة فعلياً. حد
  // صارم جداً هنا (5 محاولات/10 دقايق لكل IP) بيقفل الباب عملياً
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "mfa-verify", 5, 10);
  if (!allowed) {
    return NextResponse.json({ error: "محاولات كتير - حاول تاني بعد شوية" }, { status: 429 });
  }
  const rawBody = await req.json();
  const validation = validateOrError(schema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { pendingToken, code } = validation.data;

  const userId = verifyMfaPendingToken(pendingToken);
  if (!userId) {
    return NextResponse.json({ error: "انتهت صلاحية الجلسة المؤقتة - سجّل دخول تاني" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = decryptMfaSecret(user.mfaSecret);
  const isValid = await verifyMfaCode(secret, code);

  if (!isValid) {
    return NextResponse.json({ error: "الكود غير صحيح" }, { status: 401 });
  }

  // منع إعادة الاستخدام (Replay): نفس الكود لو نجح قبل كده، مرفوض تاني
  // حتى لو لسه صالح داخل نافذة الوقت (30-90 ثانية تقريباً)
  if (user.mfaLastUsedCode === code) {
    return NextResponse.json({ error: "الكود ده اتستخدم قبل كده - استنى كود جديد" }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { mfaLastUsedCode: code } });

  const token = createSessionToken(user.id);
  const response = NextResponse.json({ success: true });

  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  response.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
