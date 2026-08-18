// app/api/auth/mfa/email-code/route.ts
//
// **«فقدت هاتفي وورقتي» - يُرسَل كودٌ إلى بريد الحساب.**
//
// الشروط التي تجعل هذا مخرجاً لا ثغرة:
//   ١) لا يُطلَب إلّا برمز انتظارٍ صالح - أي بعد إثبات كلمة المرور.
//      فمن لا يعرفها لا يستطيع إرسال بريدٍ إلى أحد أصلاً.
//   ٢) يُرسَل إلى بريد الحساب المسجَّل وحده، لا إلى بريدٍ يختاره الطالب.
//   ٣) دقيقةٌ بين الطلب والطلب، وحدٌّ صارم على المحاولات - فلا يصير
//      الزرّ أداةَ إغراقٍ لصندوق غيرك.
//   ٤) الردّ واحدٌ سواءٌ وُجد الحساب أم لا: «إن كان لهذا الحساب بريدٌ
//      مسجَّل فقد وصله كود». الفارق في الردّ يكشف مَن عندنا ومَن ليس.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyMfaPendingToken } from "@/lib/auth";
import {
  generateEmailCode, hashEmailCode,
  EMAIL_CODE_TTL_MINUTES, EMAIL_CODE_RESEND_SECONDS,
} from "@/lib/mfa";
import { sendMfaEmailCode } from "@/lib/mfaEmailCode";
import { validateOrError } from "@/lib/validation/schemas";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { localeOfRequest } from "@/lib/apiLocale";

const schema = z.object({ pendingToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const locale = localeOfRequest(req);

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "mfa-email-code", 5, 30);
  if (!allowed) {
    return NextResponse.json({ error: t(locale, "apiErr.tooManyAttempts") }, { status: 429 });
  }

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const userId = verifyMfaPendingToken(validation.data.pendingToken);
  if (!userId) {
    return NextResponse.json({ error: t(locale, "apiErr.mfaSessionExpired") }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, mfaEnabled: true,
      mfaEmailCodeSentAt: true, preferredLocale: true,
    },
  });

  // ردٌّ واحد مهما كانت الحقيقة - راجع الشرط الرابع أعلاه.
  const sameAnswer = NextResponse.json({ sent: true, ttlMinutes: EMAIL_CODE_TTL_MINUTES });

  // 🔴 **الردّ موحَّد للخارج، والسبب مسجَّل عندنا.**
  //
  // توحيدُ الردّ مقصودٌ ويبقى: لولاه لصارت هذه الصفحة أداةَ استعلامٍ عن
  // البُرد المسجَّلة. لكنّه كان يبتلع السبب عنّا نحن أيضاً - فمن لا يصله
  // الكود لا يعرف، ولا نعرف نحن أين انقطع المسار. السطر هنا يفصل
  // الأمرين: الجوابُ واحدٌ للجميع، والتشخيصُ في سجلّ الخادم.
  if (!user || !user.mfaEnabled || !user.email) {
    console.warn(
      `[mfa-email] لم يُرسَل: ${!user ? "لا مستخدم لهذا الرمز" : !user.mfaEnabled ? "التحقّق بخطوتين غير مفعَّل على الحساب" : "لا بريد على الحساب"}`
    );
    return sameAnswer;
  }

  // إعادة إرسالٍ متقاربة: يُقال «أُرسل» ولا يُرسَل ثانياً. والصندوق أهمّ
  // من دقّة الرسالة هنا - ورسالةٌ في الطريق أصلاً.
  const lastSent = user.mfaEmailCodeSentAt?.getTime() ?? 0;
  if (Date.now() - lastSent < EMAIL_CODE_RESEND_SECONDS * 1000) {
    const left = Math.ceil((EMAIL_CODE_RESEND_SECONDS * 1000 - (Date.now() - lastSent)) / 1000);
    console.warn(`[mfa-email] لم يُرسَل: مهلة إعادة الإرسال - باقٍ ${left} ثانية`);
    return sameAnswer;
  }

  const code = generateEmailCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEmailCodeHash: await hashEmailCode(code),
      mfaEmailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000),
      mfaEmailCodeSentAt: new Date(),
    },
  });

  // 🔴 **الإرسال نفسه كان يبتلع فشله.** `sendMfaEmailCode` تلتقط الخطأ
  // وتطبعه وتعود بهدوء، فمفتاحٌ ناقص أو نطاقٌ غير موثَّق عند المزوّد
  // يُنهي المسار كأنّه نجح. صارت تُرجع نتيجةً تُقرأ - والردّ للخارج يبقى
  // موحَّداً كما هو.
  const sent = await sendMfaEmailCode({
    toEmail: user.email,
    code,
    locale: (user.preferredLocale as Locale) ?? locale,
  });
  if (!sent.ok) {
    console.error(`[mfa-email] فشل الإرسال فعلياً: ${sent.reason}`);
  }

  return sameAnswer;
}
