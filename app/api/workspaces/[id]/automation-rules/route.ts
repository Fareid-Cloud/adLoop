// app/api/workspaces/[id]/automation-rules/route.ts

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

  const rules = await prisma.automationRule.findMany({
    where: { workspaceId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(
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

  const body = await req.json();

  const rule = await prisma.automationRule.create({
    data: {
      workspaceId: id,
      name: body.name,
      metric: body.metric,
      operator: body.operator,
      threshold: body.threshold,
      consecutiveDays: body.consecutiveDays ?? 1,
      attributionBasis: body.attributionBasis ?? "VERIFIED_ONLY",
      action: body.action,
      actionValue: body.actionValue ?? null,
      maxSingleJumpPct: body.maxSingleJumpPct ?? 20,
      cooldownDays: body.cooldownDays ?? 3,
      requireApproval: body.requireApproval ?? true,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
