// app/api/live/route.ts
//
// نقطة تحديث موحّدة وخفيفة جداً. قبلها كان فيه 3 مؤقتات منفصلة (الجرس 30ث،
// البوب-أب 15ث، الدعم 25ث) = ~500 طلب/ساعة لكل تاب مفتوح، وكل طلب بيجيب
// قوائم كاملة - وده اللي استهلك حصة نقل البيانات كلها في أيام.
//
// هنا: طلب واحد بيرجّع **أعداد فقط** + العناصر الجديدة منذ آخر فحص (غالباً
// مصفوفة فاضية). القوائم الكاملة بتتجاب عند فتح الجرس/الدعم فقط (فعل مستخدم).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { supportUnreadCount } from "@/lib/supportUnread";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new URL(req.url).searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;

  const workspace = await getActiveWorkspace(user.id);

  // بلا مساحةِ عمل مافيش فيدُ قرارات - لكن الدعمَ مالوش علاقةٌ بمساحة
  // عمل أصلاً. حسابٌ جديد سأل الدعم قبل ما يربط حساباً كان بيتردّ عليه
  // بلا شارةٍ تقول إنّ فيه ردّ.
  if (!workspace) {
    return NextResponse.json({
      unreadCount: 0,
      supportUnread: await supportUnreadCount(user.id),
      new: [],
    });
  }

  const [unreadCount, supportUnread, fresh] = await Promise.all([
    prisma.actionFeedItem.count({ where: { workspaceId: workspace.id, read: false } }),
    // نفس دالّة العدّ اللي بتستعملها الودجت: الشارةُ والودجت كانوا
    // بيعدّوا نطاقين مختلفين، فالشارة كانت بتفضل مولّعة على ردٍّ مافيش
    // شاشة تعرضه.
    supportUnreadCount(user.id),
    sinceDate
      ? prisma.actionFeedItem.findMany({
          where: { workspaceId: workspace.id, createdAt: { gt: sinceDate } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, type: true, severity: true, title: true, description: true, linkUrl: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    unreadCount,
    supportUnread,
    new: fresh.map((n: any) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}
