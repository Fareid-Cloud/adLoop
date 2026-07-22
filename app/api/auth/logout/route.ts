// app/api/auth/logout/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // إصلاح B من الاختبار العدائي: كان بيمسح الكوكي بس، والتوكن يفضل صالح
  // فعلياً لحد الـ30 يوم حتى بعد "تسجيل الخروج" - لو اتسرق، نافذة إساءة
  // استخدام طويلة. دلوقتي بنحدّث وقت إبطال على مستوى المستخدم، فأي توكن
  // قديم (حتى لو من جهاز تاني) بيترفض فوراً
  const user = await getSessionUser(req);
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionInvalidatedAt: new Date() },
    });
  }

  const response = NextResponse.json({ success: true });
  // بنمسح الكوكيز بتاعة الجلسة بضبط تاريخ انتهاء في الماضي
  response.cookies.set("session", "", { maxAge: 0, path: "/" });
  return response;
}
