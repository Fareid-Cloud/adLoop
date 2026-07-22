// app/api/admin/support/route.ts - لوحة المالك: عرض المحادثات والرد عليها
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function isOwner(user: { isAdmin: boolean; email: string }): boolean {
  return user.isAdmin || user.email === process.env.OWNER_EMAIL;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !isOwner(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const threads = await prisma.supportThread.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    take: 100,
  });
  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !isOwner(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { threadId, text } = await req.json();
  if (!threadId || !text?.trim()) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msg = await prisma.supportMessage.create({
    data: { threadId, fromSupport: true, body: text.trim(), imageUrls: [], readByUser: false },
  });
  await prisma.supportThread.update({ where: { id: threadId }, data: { status: "ANSWERED", updatedAt: new Date() } });
  return NextResponse.json({ message: msg }, { status: 201 });
}
