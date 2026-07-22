// app/api/auth/mfa/disable/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteAccountSchema, validateOrError } from "@/lib/validation/schemas";
import { verifyCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
      { error: "حسابك مسجّل بجوجل/فيسبوك من غير باسورد - تأكيد الباسورد مش متاح، تواصل معنا لإلغاء التحقق بخطوتين" },
      { status: 400 }
    );
  }

  const isValid = await bcrypt.compare(validation.data.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  return NextResponse.json({ success: true });
}
