// app/api/automation-rules/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";

async function assertOwnership(ruleId: string, userId: string) {
  return prisma.automationRule.findFirst({
    where: { id: ruleId, workspace: { userId } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rule = await assertOwnership(id, user.id);
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.automationRule.update({
    where: { id: id },
    data: { enabled: body.enabled },
  });

  return NextResponse.json({ rule: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const rule = await assertOwnership(id, user.id);
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.automationRule.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
