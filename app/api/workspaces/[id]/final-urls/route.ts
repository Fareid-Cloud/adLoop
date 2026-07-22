// app/api/workspaces/[id]/final-urls/route.ts
//
// بيرجّع روابط الوجهة الفعلية (Final URLs) من الإعلانات المزامنة فعلياً -
// عشان صفحة "فحص الموقع" تقترحها تلقائياً بدل ما المستخدم يكتبها يدوي.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await prisma.creativeSnapshot.findMany({
    where: { workspaceId: id, finalUrl: { not: null } },
    select: { finalUrl: true },
    distinct: ["finalUrl"],
    take: 20,
  });

  const urls = rows.map((r: { finalUrl: string | null }) => r.finalUrl).filter(Boolean);
  return NextResponse.json({ urls });
}
