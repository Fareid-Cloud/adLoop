// app/api/notifications/route.ts
//
// بيرجّع كل إشعارات الجرس (SUGGESTION/ALERT/ACCOUNT) مرتبة الأحدث الأول -
// نفس جدول ActionFeedItem، مش جدول منفصل، عشان مفيش تكرار منطق.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { itemTitle, itemDescription } from "@/lib/localizedRecord";
import type { Locale } from "@/lib/i18n/dictionary";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locale: Locale = (user.preferredLocale as Locale) ?? "en";
  const workspace = await getActiveWorkspace(user.id);
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
      // الترجمة هنا لا في المكوّن: الجرس والبوب-أب مكوّنان عميلان يقرآن
      // هذه الاستجابة كما هي، فلو أرسلنا النصّ المخزَّن لظهر بلغة الكرون.
      title: itemTitle(locale, n),
      description: itemDescription(locale, n) || null,
      linkUrl: n.linkUrl,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
