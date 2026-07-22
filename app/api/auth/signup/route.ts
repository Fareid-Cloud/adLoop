// app/api/auth/signup/route.ts
//
// اشتراك بيوزر واحد بس - مفيش مفهوم "دعوة أعضاء فريق" هنا على الإطلاق.
// أول تسجيل دخول = إنشاء الحساب، وبعد كده الحساب ده بيفضل بتاعك بس.
//
// طبقة حماية الحساب: كابتشا (Cloudflare Turnstile) قبل الإنشاء، وتحقق
// بريد إلكتروني بعده (الحساب بيتعمل ويقدر يسجل دخول فوراً، لكن بيفضل
// "غير مؤكد" لحد ما يضغط على رابط التحقق - قرار متعمد: منمنعش الوصول
// بالكامل، عشان مانخسرش مستخدم بسبب تأخير وصول إيميل، لكن بنعلّم الحساب
// بوضوح في الواجهة).

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";
import { t, Locale } from "@/lib/i18n/dictionary";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { generateVerificationToken, sendVerificationEmail } from "@/lib/emailVerification";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { signupSchema, validateOrError } from "@/lib/validation/schemas";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  // حد استخدام إضافي فوق الكابتشا (دفاع متعدد الطبقات) - حتى لو حد لقى
  // طريقة يتجاوز بيها الكابتشا، الحد ده بيوقف محاولات إنشاء حسابات جماعية
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "signup", 5, 60);
  if (!allowed) {
    return NextResponse.json({ error: "too many signup attempts, try again later" }, { status: 429 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(signupSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { email, password, name, preferredLocale, turnstileToken } = validation.data;
  const locale: Locale = preferredLocale === "en" ? "en" : "ar";

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      {
        error:
          locale === "ar"
            ? "البريد الإلكتروني مطلوب، وكلمة المرور يجب أن تكون 8 أحرف على الأقل"
            : "Email is required, and password must be at least 8 characters",
      },
      { status: 400 }
    );
  }

  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const captchaValid = await verifyTurnstileToken(turnstileToken, remoteIp);
  if (!captchaValid) {
    return NextResponse.json(
      { error: locale === "ar" ? "فشل التحقق من الكابتشا، حاول تاني" : "CAPTCHA verification failed, please try again" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: t(locale, "auth.emailExists") }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { token: verificationToken, expiresAt: verificationTokenExpiresAt } = generateVerificationToken();

  const user = await prisma.user.create({
    data: {
      email, passwordHash, name, preferredLocale: locale,
      verificationToken, verificationTokenExpiresAt,
    },
  });

  await sendVerificationEmail({ toEmail: user.email, token: verificationToken, locale });

  const token = createSessionToken(user.id);

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
  });

  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 يوم
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
