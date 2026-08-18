// app/api/workspaces/[id]/report-views/[viewId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const { id, viewId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // الملكية تُفحص على الصفّ نفسه لا على مساحة العمل وحدها - بدون ذلك يستطيع
  // مستخدم في نفس مساحة العمل تعديل عرض غيره بمعرّف مخمَّن.
  const existing = await prisma.savedReportView.findFirst({
    where: { id: viewId, workspaceId: id, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const data: { name?: string; isFavorite?: boolean; lastOpenedAt?: Date } = {};
  if (typeof body?.name === "string") data.name = body.name.trim().slice(0, 80);
  if (typeof body?.isFavorite === "boolean") data.isFavorite = body.isFavorite;
  if (body?.touch === true) data.lastOpenedAt = new Date();

  const view = await prisma.savedReportView.update({ where: { id: viewId }, data });
  return NextResponse.json({ view });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const { id, viewId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const existing = await prisma.savedReportView.findFirst({
    where: { id: viewId, workspaceId: id, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.savedReportView.delete({ where: { id: viewId } });
  return NextResponse.json({ ok: true });
}
