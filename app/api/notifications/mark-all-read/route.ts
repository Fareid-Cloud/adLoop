// app/api/notifications/mark-all-read/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/actionFeed";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) return NextResponse.json({ ok: true });

  await markAllNotificationsRead(workspace.id);
  return NextResponse.json({ ok: true });
}
