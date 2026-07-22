// app/api/account/delete/route.ts
//
// حق "المحو" (Right to Erasure) - مطلوب قانونياً بموجب قانون حماية
// البيانات المصري وGDPR. بيمسح الحساب وكل البيانات المرتبطة بيه عن طريق
// Cascade في الـ schema (مساحات العمل، الحملات المربوطة، كل البيانات).
//
// أمان: بنطلب كلمة السر تاني كتأكيد - حذف نهائي، مفيش تراجع.

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
  const { password } = validation.data;
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser) return NextResponse.json({ error: "not found" }, { status: 404 });

  // إصلاح باگ حقيقي: حساب OAuth بلا باسورد خالص - bcrypt.compare كانت
  // هترمي خطأ وقت التشغيل. عكس إلغاء التحقق بخطوتين، حذف الحساب حق
  // أساسي لازم يفضل متاح - لحساب OAuth بس، جلسة الدخول نفسها (اللي
  // لازم تكون شغالة أصلاً عشان توصل للـ endpoint ده) هي التأكيد الكافي
  const isValid = fullUser.passwordHash
    ? await bcrypt.compare(password ?? "", fullUser.passwordHash)
    : true;
  if (!isValid) {
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
  }

  // Cascade في الـ schema بيمسح كل البيانات المرتبطة (مساحات العمل،
  // الحملات، التقارير، إلخ) تلقائياً مع حذف المستخدم نفسه
  await prisma.user.delete({ where: { id: user.id } });

  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
