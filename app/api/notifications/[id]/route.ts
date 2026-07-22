// app/api/notifications/[id]/route.ts
//
// PATCH = تعليم كمقروء (لما تتفتح في الجرس). DELETE = حذف (زرار X).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { markNotificationRead, deleteNotification } from "@/lib/actionFeed";

async function verifyOwnership(userId: string, notificationId: string) {
  const item = await prisma.actionFeedItem.findUnique({
    where: { id: notificationId },
    include: { workspace: true },
  });
  return item && item.workspace.userId === userId ? item : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const item = await verifyOwnership(user.id, id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  await markNotificationRead(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const item = await verifyOwnership(user.id, id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  await deleteNotification(id);
  return NextResponse.json({ ok: true });
}
