// app/api/admin/suspend-user/route.ts
//
// تعليق حساب - ممكن يقفل عميل دافع برّه المنتج، فبيمرّ بنفس بوابة
// الانتحال بالظبط: دور، CSRF، وتحقّق طازج. الأربعة في `guardAdmin`.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { suspendUserSchema, validateOrError } from "@/lib/validation/schemas";
import { isOwnerEmail } from "@/lib/owner";
import { resolveAdminRole } from "@/lib/adminRole";

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req, {
    capability: "customers.suspend",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(suspendUserSchema, await req.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { targetUserId, suspend } = validation.data;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, isAdmin: true, adminRole: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 🔴 حسابان ماينفعش يتعلّقوا من هنا:
  //   • بريد المالك - تعليقه بيقفل صاحب المنتج بره منتجه، وماينفعش
  //     يتصلّح إلا بتعديل مباشر في قاعدة البيانات.
  //   • أدمن تاني بيد موظّف دعم - تصعيد صلاحيات جانبيّ: الدعم مالوش
  //     الحقّ يعطّل من هو أعلى منه.
  if (isOwnerEmail(target.email) && suspend) {
    return NextResponse.json({ error: "the owner account cannot be suspended" }, { status: 400 });
  }
  if (resolveAdminRole(target) !== null && guard.role !== "OWNER") {
    return NextResponse.json({ error: "only an owner can suspend another admin" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      isSuspended: !!suspend,
      // التعليق لازم يسري فوراً على الجلسات المفتوحة. من غير ده، الحساب
      // "معلَّق" في قاعدة البيانات وشغّال في تبويب مفتوح لحد ٣٠ يوم.
      ...(suspend ? { sessionInvalidatedAt: new Date() } : {}),
    },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: suspend ? "SUSPEND_USER" : "UNSUSPEND_USER",
    targetUserId,
    details: `${guard.admin.email} ${suspend ? "suspended" : "unsuspended"} ${updated.email}`,
  });

  return NextResponse.json({ success: true, isSuspended: updated.isSuspended });
}
