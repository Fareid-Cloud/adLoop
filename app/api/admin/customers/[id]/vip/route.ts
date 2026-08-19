// app/api/admin/customers/[id]/vip/route.ts
//
// وسم VIP - **حكم المالك، مش خوارزمية.** اللوحة بتعرض جنبه قائمة "الأعلى
// إيراداً" كاقتراح، لكن الوسم نفسه بيتحطّ بالإيد: عميل صغير النهاردة
// وبيجيب ثلاث إحالات مش هيظهر في أي ترتيب بالإيراد.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, { capability: "customers.annotate", mutating: true });
  if (!guard.ok) return guard.response;

  const target = await prisma.user.findUnique({ where: { id }, select: { email: true, isVip: true } });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const next = !target.isVip;
  await prisma.user.update({ where: { id }, data: { isVip: next } });
  await logAdminAction({
    adminUserId: guard.admin.id,
    action: next ? "VIP_ADD" : "VIP_REMOVE",
    targetUserId: id,
    details: `${guard.admin.email} ${next ? "marked" : "unmarked"} ${target.email} as VIP`,
  });

  return NextResponse.json({ success: true, isVip: next });
}
