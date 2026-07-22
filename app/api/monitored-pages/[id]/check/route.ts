// app/api/monitored-pages/[id]/check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkTrackingPresence } from "@/lib/trackingCoverage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const page = await prisma.monitoredPage.findFirst({
    where: { id: id, workspace: { userId: user.id } },
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await checkTrackingPresence(page.url);

  const updated = await prisma.monitoredPage.update({
    where: { id: id },
    data: {
      trackingDetected: result.detected,
      lastCheckedAt: new Date(),
      lastError: result.error,
    },
  });

  return NextResponse.json({ page: updated });
}
