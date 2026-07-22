import { getAppUrl } from "@/lib/appUrl";
// app/api/workspaces/[id]/share-link/route.ts

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

  // بنرجع الرابط النشط الموجود لو فيه، أو ننشئ واحد جديد - مش بننشئ
  // رابط جديد كل مرة يطلب، عشان المستخدم يقدر يشارك نفس الرابط باستمرار
  let link = await prisma.sharedReportLink.findFirst({
    where: { workspaceId: id, active: true },
  });

  if (!link) {
    link = await prisma.sharedReportLink.create({
      data: { workspaceId: id },
    });
  }

  return NextResponse.json({ url: `${getAppUrl()}/report/${link.token}` });
}

export async function DELETE(
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

  // بنعطّل الرابط، مش بنمسحه - عشان لو حد ضغط عليه قبل كده يفضل عندنا سجل
  await prisma.sharedReportLink.updateMany({
    where: { workspaceId: id },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
