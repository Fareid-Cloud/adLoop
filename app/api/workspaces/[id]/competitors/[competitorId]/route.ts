// app/api/workspaces/[id]/competitors/[competitorId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

async function owned(req: NextRequest, workspaceId: string, competitorId: string) {
  const user = await getSessionUser(req);
  if (!user) return false;
  // الملكية تُفحص على الصفّ نفسه لا على مساحة العمل وحدها
  const row = await prisma.competitor.findFirst({
    where: { id: competitorId, workspaceId, workspace: { userId: user.id } },
    select: { id: true },
  });
  return !!row;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await params;
  if (!(await owned(req, id, competitorId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim().slice(0, 80);
  if (typeof body?.notes === "string") data.notes = body.notes.slice(0, 500);
  if (typeof body?.country === "string") data.country = body.country.slice(0, 4);

  const competitor = await prisma.competitor.update({ where: { id: competitorId }, data });
  return NextResponse.json({ competitor });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await params;
  if (!(await owned(req, id, competitorId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.competitor.delete({ where: { id: competitorId } });
  return NextResponse.json({ ok: true });
}
