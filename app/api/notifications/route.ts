// app/api/notifications/route.ts
//
// بيرجّع كل إشعارات الجرس (SUGGESTION/ALERT/ACCOUNT) مرتبة الأحدث الأول -
// نفس جدول ActionFeedItem، مش جدول منفصل، عشان مفيش تكرار منطق.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) return NextResponse.json({ notifications: [], unreadCount: 0 });

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const notifications = await prisma.actionFeedItem.findMany({
    where: {
      workspaceId: workspace.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: since ? undefined : 50,
  });

  const unreadCount = await prisma.actionFeedItem.count({
    where: { workspaceId: workspace.id, read: false },
  });

  return NextResponse.json({
    notifications: notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      severity: n.severity,
      title: n.title,
      description: n.description,
      linkUrl: n.linkUrl,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
