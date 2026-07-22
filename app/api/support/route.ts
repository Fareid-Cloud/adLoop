// app/api/support/route.ts
//
// GET: يجيب محادثة الدعم الحالية للمستخدم + الرسائل + عدد ردود الدعم غير المقروءة.
// POST: يفتح محادثة جديدة (لو فيها subject) أو يضيف رسالة متابعة (لو فيها threadId).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { notifyOwnerNewSupport } from "@/lib/supportEmail";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const thread = await prisma.supportThread.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!thread) return NextResponse.json({ thread: null });

  const unread = thread.messages.filter((m) => m.fromSupport && !m.readByUser).length;
  return NextResponse.json({ thread, unread });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 6) : [];

  // متابعة على محادثة قائمة
  if (body.threadId) {
    const thread = await prisma.supportThread.findFirst({ where: { id: body.threadId, userId: user.id } });
    if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!body.text?.trim()) return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });

    const msg = await prisma.supportMessage.create({
      data: { threadId: thread.id, fromSupport: false, body: body.text.trim(), imageUrls, readByUser: true },
    });
    await prisma.supportThread.update({ where: { id: thread.id }, data: { status: "OPEN", updatedAt: new Date() } });
    void notifyOwnerNewSupport({
      name: thread.name, email: thread.email, phone: thread.phone, country: thread.country,
      subject: thread.subject, body: body.text.trim(), isReply: true,
    });
    return NextResponse.json({ message: msg }, { status: 201 });
  }

  // فتح محادثة جديدة
  const { name, email, phone, country, subject, text } = body;
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "الاسم والبريد والموضوع والتفاصيل مطلوبة" }, { status: 400 });
  }

  const thread = await prisma.supportThread.create({
    data: {
      userId: user.id,
      name: name.trim(), email: email.trim(), phone: phone?.trim() || null,
      country: country?.trim() || null, subject: subject.trim(),
      messages: { create: { fromSupport: false, body: text.trim(), imageUrls, readByUser: true } },
    },
    include: { messages: true },
  });

  void notifyOwnerNewSupport({ name, email, phone, country, subject, body: text.trim() });
  return NextResponse.json({ thread }, { status: 201 });
}
