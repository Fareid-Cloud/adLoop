// app/api/agent/chats/[id]/route.ts
//
// محادثة واحدة: رسائلها، أو حذفها.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // 🔴 الملكيّة في `where` لا بعد الجلب: شرطٌ يُفحص بعد القراءة يعني أنّ
  // الصفّ قد قُرئ فعلاً، وأيّ سهوٍ لاحق يسرّبه.
  const chat = await prisma.agentChat.findFirst({
    where: { id, ...workspaceAccess(user.id) },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(chat);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // حذفٌ لا يُلغى - يُحمى من طلبٍ مزوَّر عبر موقع آخر. الرسالة إنجليزية
  // تقنية كنظائرها في المشروع: لا تُعرَض لمستخدم، بل تُقرأ في السجلّ.
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const { id } = await params;
  const owned = await prisma.agentChat.findFirst({
    where: { id, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  // الرسائل تسقط مع المحادثة بـ`onDelete: Cascade` في المخطّط - لا حذف
  // يدويّ هنا يمكن أن يُنسى فيترك رسائل يتيمة.
  await prisma.agentChat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
