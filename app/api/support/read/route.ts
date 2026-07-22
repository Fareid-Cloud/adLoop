// app/api/support/read/route.ts - العميل شاف ردود الدعم، نعلّمها مقروءة
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { threadId } = await req.json();
  const thread = await prisma.supportThread.findFirst({ where: { id: threadId, userId: user.id } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.supportMessage.updateMany({
    where: { threadId: thread.id, fromSupport: true, readByUser: false },
    data: { readByUser: true },
  });
  return NextResponse.json({ ok: true });
}
