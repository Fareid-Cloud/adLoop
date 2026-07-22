// app/api/action-feed/[id]/apply/route.ts
//
// إصلاح أمني حرج (BOLA - OWASP API Security #1): كان مفيش فحص ملكية
// خالص - أي مستخدم مسجّل دخول كان يقدر ينفّذ قرار أتمتة بتاع مستخدم تاني
// تماماً (زي إيقاف حملة أو تغيير ميزانية) لو عرف الـ ID بس.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { applyActionFeedItem } from "@/lib/actionFeed";
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

  try {
    await applyActionFeedItem(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    // فشل تنفيذ حقيقي (زي فشل استدعاء API عند المنصة) - لازم يوصل
    // للمستخدم بوضوح، مش يختفي كإنه نجح
    console.error(`فشل تنفيذ إجراء ${id}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل التنفيذ" },
      { status: 500 }
    );
  }
}
