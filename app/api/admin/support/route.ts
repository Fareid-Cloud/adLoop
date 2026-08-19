// app/api/admin/support/route.ts - لوحة المالك: عرض المحادثات والرد عليها
//
// 🔴 المسار ده كان بيفحص `isAdmin` بس، **بلا توكن CSRF** - يعني صفحة
// خبيثة يفتحها المالك وهو مسجّل دخول كانت تقدر تبعت ردود باسمه لأي
// محادثة دعم. باقي مسارات اللوحة بتفحصه من زمان، وده كان الاستثناء.
// دلوقتي بيعدّي من نفس البوابة (`guardAdmin`) زي أي مسار كتابة تاني.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { isSupportCategory } from "@/lib/supportCategories";

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "support.handle" });
  if (!guard.ok) return guard.response;

  const threads = await prisma.supportThread.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    take: 100,
  });
  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req, { capability: "support.handle", mutating: true });
  if (!guard.ok) return guard.response;
  const locale = localeOf(guard.admin);

  const body = await req.json().catch(() => null);
  const threadId: string | undefined = body?.threadId;
  const text: string = typeof body?.text === "string" ? body.text.trim() : "";
  // نفس سقف العميل: ستّ صور كحدّ أقصى للرسالة الواحدة.
  const imageUrls: string[] = Array.isArray(body?.imageUrls) ? body.imageUrls.slice(0, 6) : [];
  const category = body?.category;

  // صورة وحدها ردّ صالح - اشتراط النصّ كان يمنع إرسال لقطة شاشة بلا تعليق.
  if (!threadId || (!text && imageUrls.length === 0)) {
    return NextResponse.json({ error: t(locale, "apiErr.missingFields") }, { status: 400 });
  }
  if (category !== undefined && category !== null && !isSupportCategory(category)) {
    return NextResponse.json({ error: "unknown category" }, { status: 400 });
  }

  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msg = await prisma.supportMessage.create({
    data: { threadId, fromSupport: true, body: text, imageUrls, readByUser: false },
  });
  await prisma.supportThread.update({
    where: { id: threadId },
    data: {
      status: "ANSWERED",
      updatedAt: new Date(),
      // التصنيف وقت الردّ لا وقت الإغلاق بس: المحادثة اللي مابتتقفلش
      // صراحةً كانت هتفضل بلا موضوع للأبد، وهي الحالة الغالبة فعلاً.
      ...(category !== undefined ? { category: category ?? null } : {}),
      // الردّ على محادثة مقفولة بيعيد فتحها - ولحظة الإغلاق بتتمسح، وإلا
      // بقى زمن الحلّ المحسوب منها أقصر من الحقيقة.
      ...(thread.closedAt ? { closedAt: null } : {}),
    },
  });
  return NextResponse.json({ message: msg }, { status: 201 });
}
