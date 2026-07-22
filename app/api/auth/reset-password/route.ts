// app/api/auth/reset-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema, validateOrError } from "@/lib/validation/schemas";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // اكتشاف من الفحص النهائي قبل اختبار القوة الغاشمة: مفيش حد استخدام
  // على الـ endpoint ده خالص - التوكن صعب التخمين (32 بايت عشوائي) لكن
  // دفاع متعدد الطبقات أفضل من الاعتماد على صعوبة التخمين بس
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "reset-password", 5, 15);
  if (!allowed) {
    return NextResponse.json({ error: "محاولات كتير - حاول تاني بعد شوية" }, { status: 429 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(resetPasswordSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { token, newPassword } = validation.data;

  const user = await prisma.user.findUnique({ where: { resetPasswordToken: token } });

  if (!user) {
    return NextResponse.json({ error: "رابط إعادة التعيين غير صالح" }, { status: 400 });
  }

  if (!user.resetPasswordTokenExpiresAt || user.resetPasswordTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "انتهت صلاحية الرابط - اطلب رابط جديد" }, { status: 400 });
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
