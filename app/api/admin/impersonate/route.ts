// app/api/admin/impersonate/route.ts
//
// أهم أداة دعم فني لمؤسس لوحده - يشوف حساب العميل بالظبط زي ما هو شايفه
// من غير ما يطلب باسوورده. قوة كبيرة، فلازم تيجي مع تسجيل إجباري
// (lib/adminAudit.ts) - مفيش استثناء.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromCookies, createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { impersonateSchema, validateOrError } from "@/lib/validation/schemas";
import { verifyCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromCookies();
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const rawBody = await req.json();
  const validation = validateOrError(impersonateSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { targetUserId } = validation.data;
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return NextResponse.json({ error: "not found" }, { status: 404 });

  // إصلاح من اختبار الاختراق: منع تقمّص حساب أدمن تاني - لو حصل وأدمن
  // اتنازل عن جلسته (اختراق مثلاً)، ده كان هيسمح بتصعيد إضافي أو إخفاء
  // الأثر عن طريق "لبس" هوية أدمن تاني
  if (targetUser.isAdmin) {
    return NextResponse.json({ error: "مينفعش تتقمّص حساب أدمن تاني" }, { status: 403 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: "IMPERSONATE",
    targetUserId,
    details: `الأدمن ${admin.email} دخل كـ ${targetUser.email}`,
  });

  const impersonatedToken = createSessionToken(targetUser.id);

  const response = NextResponse.json({ success: true });

  // نحط توكن العميل كجلسة نشطة، لكن بنحتفظ بهوية الأدمن الأصلية في
  // كوكي منفصلة عشان نقدر نرجّعه لحسابه تاني من غير ما يسجل دخول من جديد
  response.cookies.set("session", impersonatedToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 4, path: "/",
  });
  response.cookies.set("impersonating_by", admin.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 4, path: "/",
  });

  return response;
}
