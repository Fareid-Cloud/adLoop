// app/api/admin/sales/[id]/route.ts - تحديثُ حالة طلب المبيعات وملاحظته
//
// مش `elevated`: تغييرُ حالةِ طلبٍ مالوش أثرٌ على فلوسٍ ولا صلاحيات - المنحُ
// نفسه بيحصل من صفحة العميل وله حارسُه المرفوع هناك. فرضُ تحقّقٍ طازج على
// كلّ دوسةِ «اتّصلنا» كان هيخلّي الطابور يتساب بلا تحديث، والحالةُ اللي
// مابتتحدّثش أسوأ من غيابها: بتقول «جديد» على واحدٍ اتكلّمنا معاه إمبارح.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { validateOrError } from "@/lib/validation/schemas";
import { ENQUIRY_STATUSES } from "@/lib/salesEnquiry";

const schema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  internalNote: z.string().max(4000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardAdmin(req, { capability: "customers.subscription", mutating: true });
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const body = validation.data;

  const existing = await prisma.salesEnquiry.findUnique({
    where: { id },
    select: { id: true, company: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.internalNote !== undefined) data.internalNote = body.internalNote.trim() || null;
  if (body.status !== undefined) {
    data.status = body.status;
    // مين لمسه وإمتى - بيتكتب مع الحالة لا مع الملاحظة: تغييرُ الحالة هو
    // الفعلُ اللي معناه «أنا ماسكه».
    data.handledById = guard.admin.id;
    data.handledAt = new Date();
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

  await prisma.salesEnquiry.update({ where: { id }, data });

  if (body.status !== undefined && body.status !== existing.status) {
    await logAdminAction({
      adminUserId: guard.admin.id,
      action: "SALES_ENQUIRY_STATUS",
      details: `${guard.admin.email} moved ${existing.company} from ${existing.status} to ${body.status}`,
    });
  }

  return NextResponse.json({ ok: true });
}
