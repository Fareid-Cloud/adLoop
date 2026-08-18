// app/api/workspaces/[id]/products/route.ts

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const products = await prisma.product.findMany({
    where: { workspaceId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  if (!body.name || typeof body.currentPrice !== "number") {
    return NextResponse.json({ error: t(locale, "apiErr.nameAndPriceRequired") }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      workspaceId: id,
      name: body.name,
      sku: body.sku ?? null,
      currentPrice: body.currentPrice,
      cogs: body.cogs ?? 0,
      outboundShippingCost: body.outboundShippingCost ?? 0,
      returnShippingCost: body.returnShippingCost ?? 0,
      rtoRatePct: body.rtoRatePct ?? 0,
      avgAdCostPerOrder: body.avgAdCostPerOrder ?? 0,
      desiredMarginPct: body.desiredMarginPct ?? 20,
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
