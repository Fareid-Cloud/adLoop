// app/api/action-feed/[id]/dismiss/route.ts
//
// نفس الإصلاح الأمني بتاع apply/route.ts - فحص ملكية إجباري قبل التنفيذ.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dismissActionFeedItem } from "@/lib/actionFeed";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const item = await prisma.actionFeedItem.findFirst({
    where: { id: id, workspace: { userId: user.id } },
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  await dismissActionFeedItem(id);
  return NextResponse.json({ success: true });
}
