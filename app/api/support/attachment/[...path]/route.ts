// app/api/support/attachment/[...path]/route.ts
//
// **مرفقات الدعم تُقدَّم من هنا وحدها، بعد فحص من يقرأ.**
//
// 🔴 كانت تُرفع إلى التخزين بـ`access: "public"`، أي **رابطٌ بلا مصادقة
// يعمل للأبد** - بعد إغلاق التذكرة، وبعد حذف الحساب، ولأيّ من وصله
// الرابط. ولقطاتُ الدعم هي بالضبط حيث تقع بيانات العملاء: لوحةُ طلبات،
// محادثةُ واتساب، تصديرُ فورم ليدز.
//
// فصار الملفّ خاصّاً في التخزين، وهذا المسار هو الباب الوحيد إليه:
// يقرؤه صاحبُ التذكرة التي وردت فيها، أو الدعم. والملكية تُثبَت من
// قاعدة البيانات لا من شكل المسار - المسار يحمل معرّف الرافع، وهو ما
// يمكن تخمينه، بينما وجود الرابط في رسالةِ تذكرةٍ يملكها القارئ لا يُخمَّن.

import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOwnerEmail } from "@/lib/owner";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { path } = await params;
  // `..` لا يمرّ: المسار يُبنى من مقاطع، وأيّ صعودٍ يُخرِج القارئ من مجلّد
  // الدعم إلى ملفّاتٍ أخرى في المتجر نفسه.
  if (!path?.length || path.some((p) => p === "." || p === ".." || p.includes("\\"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const rest = path.join("/");
  const publicPath = `/api/support/attachment/${rest}`;

  // الدعم يقرأ كلّ المرفقات؛ وغيرُه لا يقرأ إلّا ما ورد في تذكرةٍ له هو.
  const isSupport = user.isAdmin || isOwnerEmail(user.email);
  if (!isSupport) {
    const owned = await prisma.supportMessage.findFirst({
      where: { imageUrls: { has: publicPath }, thread: { userId: user.id } },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await get(`support/${rest}`, { access: "private" });
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(result.stream as unknown as BodyInit, {
    headers: {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      // خاصٌّ لا مشترك: وسيطٌ يخزّنه مشتركاً يعيد تقديمه لمن لا يملكه.
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
    },
  });
}
