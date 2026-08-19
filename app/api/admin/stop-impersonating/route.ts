// app/api/admin/stop-impersonating/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getSessionUser, verifyImpersonatorToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/adminRole";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest) {
  const raw = req.cookies.get("impersonating_by")?.value;
  if (!raw) return NextResponse.json({ error: "not impersonating" }, { status: 400 });

  // 🔴 كانت الكوكي دي بتتقرا كمعرّف خام وتتحوّل لجلسة صالحة مباشرة، من
  // غير أي توقيع - أي حد يعرف معرّف مستخدم يقدر يصدّر لنفسه جلسته. الآن
  // لازم توقيع صالح (createImpersonatorToken في lib/auth.ts) الأول.
  const adminId = verifyImpersonatorToken(raw);
  if (!adminId) return NextResponse.json({ error: "invalid" }, { status: 403 });

  // طبقة تانية مقصودة: حتى لو التوقيع اتسرّب يوماً (سرّ JWT اتسرّب مثلاً)،
  // مايتصدّرش جلسة إلا لحساب إداريّ فعلاً موجود دلوقتي في قاعدة البيانات
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    // البريد والدور مطلوبين مع الحقل: المالك بيتعرّف ببريده، وفحص
    // `isAdmin` لوحده كان بيحبسه جوّه جلسة العميل من غير طريق رجوع.
    select: { email: true, isAdmin: true, adminRole: true },
  });
  if (!isAdminUser(admin)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // بداية الانتحال متسجّلة في IMPERSONATE - من غير نهاية مسجّلة، السجلّ
  // بيقول "دخل" وما بيقولش "قعد قدّ إيه"، وده نصّ الحكاية بس.
  // الكوكي الحالية هي جلسة العميل المُنتحَل نفسه - منها بنعرف مين اللي
  // كان مفتوح. لو رجعت فاضية (الحساب اتعلّق في نصّ الجلسة مثلاً) بنسجّل
  // النهاية من غير هدف، أحسن من ما نسجّلش خالص.
  const impersonated = await getSessionUser(req);
  await logAdminAction({
    adminUserId: adminId,
    action: "IMPERSONATE_END",
    targetUserId: impersonated?.id,
    details: "returned to own session",
  });

  const adminToken = createSessionToken(adminId);

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", adminToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  response.cookies.delete("impersonating_by");

  return response;
}
