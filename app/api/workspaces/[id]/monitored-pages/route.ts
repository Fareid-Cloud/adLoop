// app/api/workspaces/[id]/monitored-pages/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkTrackingPresence } from "@/lib/trackingCoverage";

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

  const pages = await prisma.monitoredPage.findMany({
    where: { workspaceId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pages });
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

  const { url, label } = await req.json();
  if (!url) return NextResponse.json({ error: "الرابط مطلوب" }, { status: 400 });

  // بنفحص فوراً وقت الإضافة، مش بنستنى الجدولة الدورية عشان المستخدم
  // يشوف النتيجة فوراً
  const result = await checkTrackingPresence(url);

  const page = await prisma.monitoredPage.create({
    data: {
      workspaceId: id,
      url,
      label: label || null,
      trackingDetected: result.detected,
      lastCheckedAt: new Date(),
      lastError: result.error,
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
