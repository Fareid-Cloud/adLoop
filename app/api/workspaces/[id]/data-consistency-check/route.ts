// app/api/workspaces/[id]/data-consistency-check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { auditDataConsistency } from "@/lib/dataConsistencyAudit";

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

  // بنفحص آخر 7 أيام - نطاق كافي يكشف مشكلة مزامنة حقيقية، ومش تقيل
  // زي فحص شهور كاملة كل مرة
  const to = new Date();
  to.setDate(to.getDate() - 1);
  const from = new Date();
  from.setDate(from.getDate() - 7);

  const result = await auditDataConsistency(id, {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });

  return NextResponse.json(result);
}
