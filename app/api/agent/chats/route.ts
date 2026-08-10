// app/api/agent/chats/route.ts
//
// سجلّ محادثات الوكيل. القراءة فقط - الإنشاء يحدث في `/api/ai/chat`
// نفسه لحظة الجواب، فلا محادثة فارغة تُنشأ ثمّ تُترك.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

/** سقف السجلّ المعروض - أقدم من ذلك لا يُفتح عملياً */
const MAX_CHATS = 60;

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) return NextResponse.json({ chats: [] });

  // الملكيّة على المستخدم **والمساحة** معاً: السجلّ يخصّ المساحة النشطة،
  // فمن يبدّل مساحته لا يرى محادثات الأخرى مختلطةً بها.
  const chats = await prisma.agentChat.findMany({
    where: { userId: user.id, workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    take: MAX_CHATS,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    chats: chats.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    })),
  });
}
