// app/api/auth/change-password/route.ts
//
// تغيير كلمة المرور من داخل الحساب - **بكلمة المرور الحالية شرطاً.**
//
// 🔴 **ولماذا الحالية ولو كان صاحب الجلسة معروفاً:** الجلسة تثبت أنّ
// المتصفّح دخل يوماً ما، لا أنّ الجالس أمامه الآن هو صاحبُ الحساب. جهازٌ
// مفتوحٌ في مكتب، أو جلسةٌ مسروقة، يكفيان لتغيير كلمة المرور وقفل صاحبها
// خارج حسابه. وطلبُ الحالية يجعل ذلك مستحيلاً بلا معرفتها.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ errorKey: "api.csrfFailed" }, { status: 403 });
  }

  const user = await getSessionUserFromCookies();
  if (!user) {
    return NextResponse.json({ errorKey: "api.unauthorized" }, { status: 401 });
  }

  // تخمينُ كلمة المرور الحالية هجومٌ ممكنٌ من داخل جلسةٍ مسروقة - فيُحدّ
  // كما يُحدّ تسجيل الدخول نفسه.
  const { allowed } = await checkRateLimit(user.id, "change-password", 5, 15);
  if (!allowed) {
    return NextResponse.json({ errorKey: "api.tooManyAttempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (next.length < 8) {
    return NextResponse.json({ errorKey: "api.passwordTooShort" }, { status: 400 });
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  // من دخل بجوجل أو فيسبوك فقط لا كلمة مرور له أصلاً. وضعُ واحدةٍ له من
  // هنا يعني أنّ جلسةً مسروقة تفتح مسار دخولٍ ثانياً لم يكن موجوداً -
  // فيُرفَض، ويُوجَّه إلى «نسيت كلمة المرور» حيث يُثبِت ملكية بريده.
  if (!record?.passwordHash) {
    return NextResponse.json({ errorKey: "api.noPasswordSet" }, { status: 400 });
  }

  const ok = await bcrypt.compare(current, record.passwordHash);
  if (!ok) {
    return NextResponse.json({ errorKey: "api.wrongCurrentPassword" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  return NextResponse.json({ success: true });
}
