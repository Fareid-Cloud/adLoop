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
import { countryFromRequest } from "@/lib/billingRegion";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth";
import { t, Locale } from "@/lib/i18n/dictionary";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { generateVerificationToken, sendVerificationEmail } from "@/lib/emailVerification";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { signupSchema, validateOrError } from "@/lib/validation/schemas";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { isCountryCode } from "@/lib/countries";
import { isOwnerEmail } from "@/lib/owner";

/** هل هذه منطقةٌ زمنيّةٌ يعرفها المتصفّح؟ نصٌّ من العميل لا يُوثَق به،
 *  و`Intl` ترفض غير الصالح برمي استثناء. */
function isValidTimezone(tz: unknown): boolean {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

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
  // الإنجليزية افتراضٌ، والعربية اختيارٌ صريح يرسله العميل.
  const locale: Locale = preferredLocale === "ar" ? "ar" : "en";

  // حساب المالك يُجهَّز، لا يُسجَّل نفسه. بدون هذا الرفض كان تسجيلٌ ببريد
  // المالك (أو نسخةٍ مختلفة الحالة منه، وقد طُبِّعت الآن في المخطَّط) يمنح
  // دور OWNER كاملاً عبر `isOwnerEmail` قبل أيّ فحص `isAdmin` - انتحالٌ كامل.
  if (isOwnerEmail(email)) {
    return NextResponse.json({ error: t(locale, "auth.emailExists") }, { status: 409 });
  }

  // الموافقة تُتحقَّق على الخادم لا في المتصفّح وحده: `required` على
  // المدخَل يمنع الإرسال من النموذج، ولا يمنع طلباً مباشراً إلى المسار.
  // حساب أُنشئ بلا موافقة مسجَّلة هو ثغرة قانونية لا خلل واجهة.
  if (rawBody?.acceptedTerms !== true) {
    return NextResponse.json(
      {
        error:
          locale === "ar"
            ? "يلزم الاطّلاع على شروط الاستخدام وسياسة الخصوصية والموافقة عليهما."
            : "You need to read and accept the Terms of Use and Privacy Policy.",
      },
      { status: 400 }
    );
  }

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
      { error: locale === "ar" ? "فشل التحقّق من الكابتشا، حاول مرة أخرى" : "CAPTCHA verification failed, please try again" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: t(locale, "auth.emailExists") }, { status: 409 });
  }

  // الحقول الإضافية (اختيارية) + التأكد إن اسم المستخدم غير مكرر
  const { username, companyName, gender, birthDate, howHeard, referralSource, country, adSpendMonthly, businessScale, timezone } = rawBody;
  const cleanUsername = username ? String(username).trim().toLowerCase() : null;
  if (cleanUsername) {
    const uExists = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (uExists) {
      return NextResponse.json(
        { error: locale === "ar" ? "اسم المستخدم مستخدم بالفعل، اختر اسماً آخر" : "This username is already taken, please choose another" },
        { status: 409 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { token: verificationToken, expiresAt: verificationTokenExpiresAt } = generateVerificationToken();

  const user = await prisma.user.create({
    data: {
      email, passwordHash, name, preferredLocale: locale,
      // قائمةُ السعر تُثبَّت هنا مرّةً واحدة، ولا يعدّلها صاحبُها بعدها.
      billingCountry: countryFromRequest(req.headers),
      // لحظة الموافقة لا مجرّد أنّها حدثت - راجع التعليق في المخطَّط
      acceptedTermsAt: new Date(),
      verificationToken, verificationTokenExpiresAt,
      username: cleanUsername,
      companyName: companyName ? String(companyName).trim() : null,
      gender: gender || null,
      // نصّ فارغ من حقل تاريخ غير مملوء ينتج `Invalid Date` -
      // يُحوَّل صراحةً أو يبقى null.
      birthDate: birthDate ? new Date(String(birthDate)) : null,
      howHeard: howHeard || null,
      referralSource: referralSource ? String(referralSource).trim() : null,
      // الحقل صار رمز ISO من قائمة مغلقة، فيُتحقَّق منه بدل تخزين ما يصل:
      // نداء مصوغ يدوياً كان سيكتب أيّ نصّ في عمود يُعرض في لوحة الدعم.
      country: isCountryCode(country) ? String(country) : null,
      // 🔴 المنطقة الزمنية من المتصفّح عند التسجيل - قيمةٌ أوليّةٌ صحيحةٌ
      // غالباً بدل افتراضٍ ثابتٍ يجعل تحيّة الصباح تصل مساءً لمن هو خارجها.
      // يبقى الحقل قابلاً للتعديل من الإعدادات: هذا تخمينٌ أوّل لا قرار.
      // والتحقّق بـ`Intl` لا بقائمةٍ عندنا: المناطق تتغيّر، والمتصفّح أدرى.
      ...(isValidTimezone(timezone) ? { timezone: String(timezone) } : {}),
      adSpendMonthly: adSpendMonthly || null,
      businessScale: businessScale || null,
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
