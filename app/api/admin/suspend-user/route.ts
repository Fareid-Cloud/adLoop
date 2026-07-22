// app/api/admin/suspend-user/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { suspendUserSchema, validateOrError } from "@/lib/validation/schemas";
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
  const validation = validateOrError(suspendUserSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { targetUserId, suspend } = validation.data;

  const targetUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { isSuspended: !!suspend },
  });

  await logAdminAction({
    adminUserId: admin.id,
    action: suspend ? "SUSPEND_USER" : "UNSUSPEND_USER",
    targetUserId,
    details: `${suspend ? "تعليق" : "إلغاء تعليق"} حساب ${targetUser.email}`,
  });

  return NextResponse.json({ success: true, isSuspended: targetUser.isSuspended });
}
