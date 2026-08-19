// app/api/admin/customers/[id]/notes/route.ts
//
// ملاحظة داخلية ووسوم على الحساب. **مابتظهرش للعميل أبداً** - سياق لمؤسس
// بمفرده بيتابع عشرات الحسابات ومش فاكر تفاصيل كل مكالمة.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";

const schema = z.object({
  notes: z.string().max(5_000).nullable().optional(),
  // وسوم قصيرة ومحدودة العدد: قائمة وسوم مفتوحة بتتحوّل بعد شهور لعشرات
  // الوسوم اللي بتعني نفس الحاجة، فبتفقد قيمتها كفلتر.
  tags: z.array(z.string().min(1).max(24)).max(8).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, { capability: "customers.annotate", mutating: true });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (validation.data.notes !== undefined) data.adminNotes = validation.data.notes || null;
  if (validation.data.tags !== undefined) {
    // تنظيف وتفريد: نفس الوسم بحرف كبير وصغير وسمان مختلفان في أي فلتر.
    data.adminTags = [...new Set(validation.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to change" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });
  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "ANNOTATE_CUSTOMER",
    targetUserId: id,
    details: `${guard.admin.email} updated notes/tags on ${target.email}`,
  });

  return NextResponse.json({ success: true });
}
