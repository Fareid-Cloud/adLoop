// app/api/admin/support/route.ts - لوحة المالك: عرض المحادثات والرد عليها
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { isOwnerEmail } from "@/lib/owner";

function isOwner(user: { isAdmin: boolean; email: string }): boolean {
  return user.isAdmin || isOwnerEmail(user.email);
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
  const locale = localeOf(user);

  const body = await req.json();
  const threadId: string | undefined = body.threadId;
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  // نفس سقف العميل: ستّ صور كحدّ أقصى للرسالة الواحدة.
  const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 6) : [];

  // صورة وحدها ردّ صالح - اشتراط النصّ كان يمنع إرسال لقطة شاشة بلا تعليق.
  if (!threadId || (!text && imageUrls.length === 0)) {
    return NextResponse.json({ error: t(locale, "apiErr.missingFields") }, { status: 400 });
  }

  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msg = await prisma.supportMessage.create({
    data: { threadId, fromSupport: true, body: text, imageUrls, readByUser: false },
  });
  await prisma.supportThread.update({ where: { id: threadId }, data: { status: "ANSWERED", updatedAt: new Date() } });
  return NextResponse.json({ message: msg }, { status: 201 });
}
