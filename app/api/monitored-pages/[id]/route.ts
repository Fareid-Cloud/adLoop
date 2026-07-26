// app/api/monitored-pages/[id]/route.ts
//
// حذف صفحة من قائمة المراقبة. ضروري: الصفحات المُضافة تُفحص تلقائياً
// وتؤثر على درجة التشخيص، فرابط أُضيف بالخطأ يبقى يخفض الدرجة إلى الأبد
// دون وسيلة لإزالته.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const page = await prisma.monitoredPage.findFirst({
    where: { id, workspace: { userId: user.id } },
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.monitoredPage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
