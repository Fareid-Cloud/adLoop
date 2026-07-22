// app/api/products/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { productSchema, validateOrError } from "@/lib/validation/schemas";

async function assertOwnership(productId: string, userId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, workspace: { userId } },
  });
  return product;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const product = await assertOwnership(id, user.id);
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rawBody = await req.json();
  const validation = validateOrError(productSchema, rawBody);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const body = validation.data;

  const ALLOWED = [
    "name", "currentPrice", "cogs", "outboundShippingCost", "returnShippingCost",
    "rtoRatePct", "avgAdCostPerOrder", "desiredMarginPct",
  ];

  const data: Record<string, any> = {};
  for (const key of ALLOWED) {
    if (key in body) data[key] = (body as any)[key];
  }
  // لو التكلفة (cogs) اتغيرت، بنحدث تاريخ آخر تحديث - بيُستخدم في فحص
  // "التكلفة قديمة" جوه diagnoseMarginIssue
  if ("cogs" in body) data.cogsLastUpdatedAt = new Date();

  const updated = await prisma.product.update({ where: { id: id }, data });
  return NextResponse.json({ product: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const product = await assertOwnership(id, user.id);
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.product.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
