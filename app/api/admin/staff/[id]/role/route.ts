// app/api/admin/staff/[id]/role/route.ts
//
// ترقية/تنزيل صلاحية موظّف.
//
// 🔴 **قاعدة صلبة: مايفضلش الحساب المالك الوحيد بلا صلاحية مالك.** بغيرها
// ضغطة واحدة غلط بتقفل الجميع بره اللوحة نهائياً، وماينفعش يتصلّح إلا
// بتعديل مباشر في قاعدة البيانات. بريد المالك (`lib/owner.ts`) بيفضل
// OWNER دايماً بغضّ النظر عن الحقل، فهو الحبل الأخير - والفحص ده بيمنع
// الوصول للحظة اللي بيتعلّق فيها كل شيء على متغيّر بيئة.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";
import { isOwnerEmail } from "@/lib/owner";
import { resolveAdminRole } from "@/lib/adminRole";

const schema = z.object({
  role: z.enum(["OWNER", "SUPPORT", "NONE"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, {
    capability: "staff.manage",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { role } = validation.data;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, isAdmin: true, adminRole: true, mfaEnabled: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  // بريد المالك مايتنزّلش من هنا: الحقل ماله أثر عليه أصلاً
  // (`resolveAdminRole` بيرجّعه OWNER دايماً)، فالنجاح كان هيبقى كاذباً.
  if (isOwnerEmail(target.email) && role !== "OWNER") {
    return NextResponse.json(
      { error: "the owner email is always OWNER — change OWNER_EMAIL instead" },
      { status: 400 }
    );
  }

  if (role !== "OWNER") {
    const remainingOwners = await prisma.user.count({
      where: {
        id: { not: id },
        isAdmin: true,
        // null معناها OWNER (حساب أدمن قديم بلا دور صريح) - راجع
        // `resolveAdminRole`. تجاهلها هنا كان هيعدّ صفر ملّاك وفي
        // الحقيقة فيه.
        OR: [{ adminRole: "OWNER" }, { adminRole: null }],
      },
    });
    if (remainingOwners === 0) {
      return NextResponse.json(
        { error: "this is the last owner account — promote someone else first" },
        { status: 400 }
      );
    }
  }

  // 🔴 التحقّق بخطوتين شرط دخول اللوحة (`app/admin/layout.tsx`). منح
  // صلاحية لحساب بلا MFA بيخلق حساباً موصوفاً بأدمن ومش قادر يدخل -
  // والرسالة هنا بتقول السبب بدل ما يكتشفه بعد أول محاولة.
  if (role !== "NONE" && !target.mfaEnabled) {
    return NextResponse.json(
      { error: "this account must enable two-factor authentication before it can hold an admin role" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id },
    data: {
      isAdmin: role !== "NONE",
      adminRole: role === "NONE" ? null : role,
      // إبطال جلسات الحساب المتأثّر فوراً: ترقية أو تنزيل لازم يسري على
      // التبويبات المفتوحة دلوقتي، مش بعد انتهاء جلسة عمرها ٣٠ يوم.
      sessionInvalidatedAt: new Date(),
    },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "STAFF_ROLE_CHANGE",
    targetUserId: id,
    details: `${guard.admin.email} set ${target.email} to ${role} (was ${resolveAdminRole(target) ?? "NONE"})`,
  });

  return NextResponse.json({ success: true, role });
}
