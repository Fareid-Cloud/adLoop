// app/api/workspaces/[id]/export-csv/route.ts

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

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? 30);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshots = await prisma.metricSnapshot.findMany({
    where: { workspaceId: id, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const links = await prisma.campaignLink.findMany({ where: { workspaceId: id } });
  const nameByKey = new Map(links.map((l: any) => [`${l.platform}::${l.externalCampaignId}`, l.campaignName]));

  const headers = [
    "التاريخ", "المنصة", "الحملة", "الظهور", "الكليكات", "التكلفة",
    "التحويلات المعلنة", "التحويلات الحقيقية", "تكلفة العميل المعلنة", "تكلفة العميل الحقيقية",
  ];

  const rows = snapshots.map((s: any) => {
    const campaignName = nameByKey.get(`${s.platform}::${s.campaignId}`) ?? s.campaignId;
    const cplRaw = s.rawConversions > 0 ? round2(s.cost / s.rawConversions) : "";
    const cplVerified = s.verifiedConversions > 0 ? round2(s.cost / s.verifiedConversions) : "";
    return [
      s.date.toISOString().slice(0, 10), s.platform, campaignName,
      s.impressions, s.clicks, s.cost, s.rawConversions, s.verifiedConversions, cplRaw, cplVerified,
    ];
  });

  // BOM في الأول عشان إكسل يقرأ العربي صح لو فيه أسماء حملات عربية،
  // مشكلة شائعة جداً وسهل حلها من غير ما نتجاهلها
  const csvContent =
    "\uFEFF" + [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adloop-export-${workspace.name}.csv"`,
    },
  });
}

function escapeCsvCell(value: any): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
