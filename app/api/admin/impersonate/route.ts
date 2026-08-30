// app/api/admin/impersonate/route.ts
//
// أهم أداة دعم فني لمؤسس بمفرده - يشوف حساب العميل بالظبط زي ما هو شايفه
// من غير ما يطلب باسورده. قوة كبيرة، فلازم تيجي مع تسجيل إجباري
// (lib/adminAudit.ts) وتحقّق طازج (lib/adminElevation.ts) - مفيش استثناء.

import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, createImpersonatorToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { impersonateSchema, validateOrError } from "@/lib/validation/schemas";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { resolveAdminRole } from "@/lib/adminRole";

export async function POST(req: NextRequest) {
  // انتحال هوية عميل من أخطر أفعال اللوحة - جلسة أدمن قديمة (حتى لو
  // مسروقة) مش كافية، لازم تحقّق طازج بكلمة السر أو MFA.
  const guard = await guardAdmin(req, {
    capability: "customers.impersonate",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const admin = guard.admin;
  const locale = localeOf(admin);

  const validation = validateOrError(impersonateSchema, await req.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { targetUserId } = validation.data;
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return NextResponse.json({ error: "not found" }, { status: 404 });

  // إصلاح من اختبار الاختراق: منع تقمّص حساب أدمن تاني - لو حصل وأدمن
  // اتنازل عن جلسته (اختراق مثلاً)، ده كان هيسمح بتصعيد إضافي أو إخفاء
  // الأثر عن طريق "لبس" هوية أدمن تاني
  if (resolveAdminRole(targetUser) !== null) {
    return NextResponse.json({ error: t(locale, "apiErr.cantImpersonateAdmin") }, { status: 403 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: "IMPERSONATE",
    targetUserId,
    details: `${admin.email} signed in as ${targetUser.email}`,
  });

  // موسومٌ بهويّة الأدمن ومنتهٍ بعد أربع ساعاتٍ من الخادم لا من المتصفّح -
  // والوسم هو ما يرفض به `middleware.ts` أيَّ كتابةٍ أثناء العرض كـ.
  const impersonatedToken = createSessionToken(targetUser.id, admin.id);

  const response = NextResponse.json({ success: true });

  // نحط توكن العميل كجلسة نشطة، لكن بنحتفظ بهوية الأدمن الأصلية في
  // كوكي منفصلة عشان نقدر نرجّعه لحسابه تاني من غير ما يسجل دخول من جديد
  response.cookies.set("session", impersonatedToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 4, path: "/",
  });
  // موقّعة، مش معرّف خام - راجع التعليق فوق createImpersonatorToken في lib/auth.ts
  response.cookies.set("impersonating_by", createImpersonatorToken(admin.id), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 4, path: "/",
  });

  return response;
}
