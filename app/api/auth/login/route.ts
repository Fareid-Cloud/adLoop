// app/api/auth/login/route.ts
//
// حماية من محاولات الدخول المتكررة (Brute Force): بعد 5 محاولات فاشلة
// متتالية، الحساب بيتقفل مؤقتاً 15 دقيقة - مش قفل دائم (عشان مستخدم نسي
// كلمة السر مايتحبسش)، بس كافي يوقف أي محاولة تخمين آلية.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, createMfaPendingToken } from "@/lib/auth";
import { t, Locale } from "@/lib/i18n/dictionary";
import { loginSchema, validateOrError } from "@/lib/validation/schemas";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";

import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// هاش bcrypt وهمي (مُولّد مسبقاً، مش بتاع حد حقيقي) - بنستخدمه بس عشان
// نضمن إن bcrypt.compare ياخد نفس الوقت تقريباً حتى لو الإيميل مش موجود
const DUMMY_HASH_FOR_TIMING_SAFETY = "$2a$12$K9Jk3z8QwXvN5tR7yLmF4uH2bC1dE6fG8iJ0kL2mN4oP6qR8sT0uV";

export async function POST(req: NextRequest) {
  // إصلاح حرج من الاختبار العدائي: القفل الموجود كان على مستوى الحساب
  // الواحد بس - مهاجم عنده باسورد واحد يقدر يجربه ضد آلاف الإيميلات
  // المختلفة من نفس الـ IP من غير ما يقفل حساب واحد (Credential Stuffing).
  // حد IP ده أعلى شوية من قفل الحساب (10 مش 5) عشان مايأثرش على استخدام
  // عادي (زي عيلة أو مكتب بيشاركوا نفس الشبكة)
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "login", 10, 15);
  if (!allowed) {
    return NextResponse.json({ error: "محاولات دخول كتير من نفس الجهاز - حاول تاني بعد شوية" }, { status: 429 });
  }
  const rawBody = await req.json();
  const validation = validateOrError(loginSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { email, password } = validation.data;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email/البريد الإلكتروني وكلمة المرور/password مطلوبين" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";

  // إصلاح من اختبار الاختراق: كان الرد بيرجع فوراً لو الإيميل مش موجود
  // (من غير ما ننده bcrypt.compare)، لكن بيستنى وقت bcrypt الحقيقي (بطيء
  // نسبياً) لو الإيميل موجود بس الباسورد غلط - فرق التوقيت ده بيسرّب
  // "الإيميل ده مسجّل عندنا ولا لأ" حتى لو رسالة الخطأ متطابقة تماماً.
  // الحل: ننده bcrypt.compare دايماً، حتى لو ضد هاش وهمي، عشان الزمن
  // يفضل شبه ثابت في الحالتين
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH_FOR_TIMING_SAFETY);
    return NextResponse.json({ error: t(locale, "auth.invalidCredentials") }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      {
        error:
          locale === "ar"
            ? `الحساب مقفول مؤقتاً بسبب محاولات دخول فاشلة كتير - حاول تاني بعد ${minutesLeft} دقيقة`
            : `Account temporarily locked due to too many failed attempts - try again in ${minutesLeft} minute(s)`,
      },
      { status: 429 }
    );
  }

  // إصلاح باگ حقيقي: حساب مسجّل بجوجل/فيسبوك بس معندوش passwordHash
  // خالص - bcrypt.compare(password, null) كانت هترمي خطأ وقت التشغيل،
  // مش ترفض بهدوء. بنستخدم نفس الهاش الوهمي المستخدم فوق لحماية التوقيت
  // (Timing Safety)، عشان الرفض هنا ياخد نفس زمن الرفض العادي بالظبط -
  // لو رجّعنا رفض فوري من غير bcrypt.compare، ده كان هيسرّب معلومة
  // (الحساب موجود بس بـOAuth) لمهاجم بيقيس زمن الاستجابة
  const isValid = user.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, DUMMY_HASH_FOR_TIMING_SAFETY).then(() => false);
  if (!isValid) {
    const newAttempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil:
          newAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : undefined,
      },
    });
    return NextResponse.json({ error: t(locale, "auth.invalidCredentials") }, { status: 401 });
  }

  // دخول ناجح - نصفّر عداد المحاولات الفاشلة ونسجل وقت آخر دخول
  if (user.isSuspended) {
    return NextResponse.json(
      { error: locale === "ar" ? "الحساب معلّق مؤقتاً - تواصل مع الدعم" : "Account temporarily suspended - contact support" },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  // لو MFA مفعّل، الباسورد الصح لوحده مش كافي - بنرجّع توكن مؤقت (5
  // دقايق) بس، والجلسة الكاملة بتتاح من endpoint تاني بعد التأكد من كود
  // التطبيق (verify-login)
  if (user.mfaEnabled) {
    const pendingToken = createMfaPendingToken(user.id);
    return NextResponse.json({ mfaRequired: true, pendingToken });
  }

  const token = createSessionToken(user.id);

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
  });

  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  // كوكي CSRF - غير httpOnly عمداً، عشان JavaScript في الواجهة يقدر
  // يقراها ويحطها في هيدر الطلبات (شرح كامل في lib/csrf.ts)
  response.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
