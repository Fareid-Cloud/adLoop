// app/api/admin/support/[threadId]/close/route.ts
//
// إغلاق محادثة دعم بموضوع محدّد.
//
// الحقلين الجديدين (`category`, `closedAt`) هما اللي بيخلّوا سؤالين
// تشغيليين ليهم إجابة: "أكتر مشكلة بتتكرر؟" و"بناخد قد إيه نحلّ؟".
// `updatedAt` مش بديل عن `closedAt` - بيتحرّك مع كل ردّ، فأي محادثة
// اتردّ عليها بعد الإغلاق كانت هتدّي زمن حلّ غلط.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { isSupportCategory } from "@/lib/supportCategories";

export async function POST(req: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const guard = await guardAdmin(req, { capability: "support.handle", mutating: true });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const category = body?.category;
  if (category !== undefined && category !== null && !isSupportCategory(category)) {
    return NextResponse.json({ error: "unknown category" }, { status: 400 });
  }
  const reopen = body?.reopen === true;

  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { email: true, subject: true, closedAt: true },
  });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.supportThread.update({
    where: { id: threadId },
    data: {
      status: reopen ? "OPEN" : "CLOSED",
      // إعادة الفتح بتمسح لحظة الإغلاق: زمن حلّ محسوب من إغلاق اتراجَع
      // عنه رقم كاذب بيقصّر المتوسّط.
      closedAt: reopen ? null : thread.closedAt ?? new Date(),
      ...(category !== undefined ? { category: category ?? null } : {}),
    },
  });

  await logAdminAction({
    adminUserId: guard.admin.id,
    action: reopen ? "SUPPORT_REOPEN" : "SUPPORT_CLOSE",
    details: `${guard.admin.email} ${reopen ? "reopened" : "closed"} "${thread.subject}" (${thread.email})${category ? ` as ${category}` : ""}`,
  });

  return NextResponse.json({ success: true });
}
