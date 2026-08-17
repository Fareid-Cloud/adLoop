// app/api/auth/mfa/verify-login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyMfaPendingToken, createSessionToken } from "@/lib/auth";
import {
  decryptMfaSecret, verifyMfaCode, matchBackupCode, matchEmailCode,
  generateDeviceToken, hashDeviceToken, describeDevice,
  TRUSTED_DEVICE_COOKIE, TRUSTED_DEVICE_DAYS,
} from "@/lib/mfa";
import { validateOrError } from "@/lib/validation/schemas";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { t } from "@/lib/i18n/dictionary";
import { localeOfRequest } from "@/lib/apiLocale";


/** **الجلسة وكوكيّاتها في مكانٍ واحد.**
 *
 * كانت الكتلة نفسها مكتوبةً مرّتين (كود التطبيق، وكود الورقة)، والثالث
 * كان سيصير ثلاثاً. وثلاثُ نسخٍ من ضبط الكوكيّات تعني أنّ إصلاح واحدةٍ
 * يوماً يترك الاثنتين - وأخطرها كوكي CSRF: نسيانها في فرعٍ واحد يجعل
 * المستخدم يدخل ثمّ يفشل أوّلُ طلبٍ يكتب شيئاً، وهو عطلٌ يظهر بعد النجاح
 * فيصعب ربطه بسببه.
 */
async function finishLogin(
  userId: string,
  req: NextRequest,
  rememberDeviceRequested: boolean,
  extra: Record<string, unknown> = {},
): Promise<NextResponse> {
  const response = NextResponse.json({ success: true, ...extra });

  response.cookies.set("session", createSessionToken(userId), {
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

  if (rememberDeviceRequested) {
    await rememberDevice(response, userId, req.headers.get("user-agent"));
  }
  return response;
}

const schema = z.object({
  pendingToken: z.string().min(1),
  // ثلاثة أشكال لا شكل: ستّة أرقام من التطبيق أو من البريد، وعشرة محارف
  // من ورقة الاسترجاع. والحدّ الأدنى يمنع الفارغ، والأعلى يمنع الإغراق.
  code: z.string().min(6).max(24),
});

/** يمنح الجهازَ الحاليَّ ثقةً موقّتة إن طلب المستخدم ذلك.
 *
 *  🔴 **يُستدعى بعد التحقّق الناجح وحده.** منحُ الثقة قبل إثبات الهوية
 *  يعني أنّ من يعرف كلمة المرور فقط يستطيع تعليم جهازه موثوقاً ثمّ الدخول
 *  بلا كود إلى الأبد - أي إلغاء التحقّق بخطوتين لا تسهيله. */
async function rememberDevice(
  res: NextResponse,
  userId: string,
  userAgent: string | null,
) {
  const token = generateDeviceToken();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: await hashDeviceToken(token),
      label: describeDevice(userAgent),
      expiresAt,
    },
  });

  res.cookies.set(TRUSTED_DEVICE_COOKIE, token, {
    // `httpOnly` قاطعة: لا شيء في الواجهة يحتاج قراءتها، وإتاحتُها
    // لجافاسكريبت تجعل ثغرةَ XSS واحدةً كافيةً لسرقة ثقة الجهاز.
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function POST(req: NextRequest) {
  // لا جلسة بعد في هذا المسار، فاللغة من ترويسة المتصفّح
  const locale = localeOfRequest(req);
  // إصلاح حرج من اختبار الاختراق: كود MFA (6 أرقام = مليون احتمال بس)
  // كان بدون أي حد استخدام - قابل للتخمين بالقوة الغاشمة فعلياً. حد
  // صارم جداً هنا (5 محاولات/10 دقايق لكل IP) بيقفل الباب عملياً
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "mfa-verify", 5, 10);
  if (!allowed) {
    return NextResponse.json({ error: t(locale, "apiErr.tooManyAttempts") }, { status: 429 });
  }
  const rawBody = await req.json();
  const validation = validateOrError(schema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { pendingToken, code } = validation.data;
  const rememberDeviceRequested = rawBody?.rememberDevice === true;

  const userId = verifyMfaPendingToken(pendingToken);
  if (!userId) {
    return NextResponse.json({ error: t(locale, "apiErr.mfaSessionExpired") }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const secret = decryptMfaSecret(user.mfaSecret);
  const isValid = await verifyMfaCode(secret, code);

  // 🔴 **مسارُ من فقد هاتفه.** كودُ التطبيق أو كودُ استرجاعٍ من الورقة التي
  // أُعطيت له عند التفعيل - ولولاه لبقي مقفولاً خارج حسابه بلا حيلة.
  //
  // ولا يُجرَّب إلّا بعد فشل كود التطبيق: هو المسار الطبيعيّ، ومطابقةُ
  // الأكواد المخزَّنة عمليةٌ أثقل (bcrypt لكلّ واحد) فلا تُشغَّل بلا داعٍ.
  if (!isValid) {
    // ⚠️ **`pendingUntilConfirmed` لا تُفلتَر هنا عمداً - لا تُضِفها.**
    //
    // المعلَّقة أوراقٌ رآها المستخدم على شاشته وقد يكون نسخها فعلاً ولم
    // يضغط «حفظتها». ومن ضاع هاتفه في تلك اللحظة بالذات يجب أن تفتح له
    // ورقتُه - القديمة أو الجديدة. الحالة تحكم **أيّهما يُبطَل متى**،
    // ولا تحكم أيّهما يُقبَل عند الدخول.
    const stored = await prisma.mfaBackupCode.findMany({
      where: { userId: user.id, usedAt: null },
      select: { id: true, codeHash: true },
    });
    const matchedId = await matchBackupCode(code, stored);

    // 🔴 **المخرج الثالث: كودٌ أُرسل إلى بريد الحساب.**
    //
    // ترتيبُ المحاولة مقصود - التطبيق، فالورقة، فالبريد - لأنّ البريد
    // آخر الطرق لا أسهلها. ويُحرَق فور نجاحه كما تُحرَق الورقة.
    if (!matchedId) {
      const emailOk = await matchEmailCode(code, {
        hash: user.mfaEmailCodeHash,
        expiresAt: user.mfaEmailCodeExpiresAt,
      });
      if (!emailOk) {
        return NextResponse.json({ error: t(locale, "apiErr.codeInvalid") }, { status: 401 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null },
      });
      return finishLogin(user.id, req, rememberDeviceRequested, { usedEmailCode: true });
    }

    // يُحرَق فور استعماله: ورقةٌ مصوَّرةٌ أو منسوخة لا تفتح الحساب مرّتين.
    await prisma.mfaBackupCode.update({
      where: { id: matchedId },
      data: { usedAt: new Date() },
    });

    return finishLogin(user.id, req, rememberDeviceRequested, {
      usedBackupCode: true,
      remainingBackupCodes: stored.length - 1,
    });
  }

  // منع إعادة الاستخدام (Replay): نفس الكود لو نجح قبل كده، مرفوض تاني
  // حتى لو لسه صالح داخل نافذة الوقت (30-90 ثانية تقريباً)
  if (user.mfaLastUsedCode === code) {
    return NextResponse.json({ error: t(locale, "apiErr.codeUsed") }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { mfaLastUsedCode: code } });

  return finishLogin(user.id, req, rememberDeviceRequested);
}
