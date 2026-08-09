// app/api/auth/reset-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema, validateOrError } from "@/lib/validation/schemas";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { t } from "@/lib/i18n/dictionary";
import { localeOfRequest } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  // لا جلسة بعد في هذا المسار، فاللغة من ترويسة المتصفّح
  const locale = localeOfRequest(req);
  // اكتشاف من الفحص النهائي قبل اختبار القوة الغاشمة: مفيش حد استخدام
  // على الـ endpoint ده خالص - التوكن صعب التخمين (32 بايت عشوائي) لكن
  // دفاع متعدد الطبقات أفضل من الاعتماد على صعوبة التخمين بس
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "reset-password", 5, 15);
  if (!allowed) {
    return NextResponse.json({ error: t(locale, "apiErr.tooManyAttempts") }, { status: 429 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(resetPasswordSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { token, newPassword } = validation.data;

  const user = await prisma.user.findUnique({ where: { resetPasswordToken: token } });

  if (!user) {
    return NextResponse.json({ error: t(locale, "apiErr.resetLinkInvalid") }, { status: 400 });
  }

  if (!user.resetPasswordTokenExpiresAt || user.resetPasswordTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: t(locale, "apiErr.resetLinkExpired") }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordTokenExpiresAt: null,
      // إعادة تعيين كلمة السر = إلغاء أي قفل موجود بسبب محاولات فاشلة
      // سابقة - المستخدم أثبت ملكية الحساب عن طريق الإيميل
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  return NextResponse.json({ success: true });
}
