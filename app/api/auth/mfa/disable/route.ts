// app/api/auth/mfa/disable/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteAccountSchema, validateOrError } from "@/lib/validation/schemas";
import { verifyCsrfToken } from "@/lib/csrf";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(deleteAccountSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // إصلاح باگ حقيقي: حساب OAuth بلا باسورد خالص - bcrypt.compare كانت
  // هترمي خطأ وقت التشغيل. حساب OAuth بس فعلياً مينفعش يأكد بباسورد
  // مش موجود أصلاً - رفض واضح، مش تخمين أو محاولة تجاوز
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: t(locale, "apiErr.mfaNoPassword") },
      { status: 400 }
    );
  }

  const isValid = await bcrypt.compare(validation.data.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: t(locale, "apiErr.wrongPassword") }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  return NextResponse.json({ success: true });
}
