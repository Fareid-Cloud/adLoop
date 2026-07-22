// app/api/site-scan/[id]/route.ts

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

  const scan = await prisma.siteScanResult.findFirst({
    where: { id: id, workspace: { userId: user.id } },
  });
  if (!scan) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(scan);
}
