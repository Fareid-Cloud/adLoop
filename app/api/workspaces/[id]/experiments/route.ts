// app/api/workspaces/[id]/experiments/route.ts

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

  const logs = await prisma.experimentLog.findMany({
    where: { workspaceId: id },
    orderBy: { changedAt: "desc" },
  });

  return NextResponse.json({ logs });
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

  const { changeType, description, relatedCampaignId, measuredMetric } = await req.json();

  if (!changeType || !description) {
    return NextResponse.json({ error: "نوع التعديل والوصف مطلوبين" }, { status: 400 });
  }

  // نلتقط "القيمة قبل التعديل" تلقائياً - متوسط المقياس المختار لآخر 7 أيام
  // قبل لحظة التسجيل، عشان نقدر نقيس الأثر الحقيقي بعدين
  let beforeMetricValue: number | null = null;
  if (measuredMetric) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const where: any = { workspaceId: id, date: { gte: sevenDaysAgo } };
    if (relatedCampaignId) where.campaignId = relatedCampaignId;

    const agg = await prisma.metricSnapshot.aggregate({
      where,
      _sum: { cost: true, verifiedConversions: true, rawConversions: true, clicks: true },
    });

    beforeMetricValue = computeMetricFromAgg(measuredMetric, agg._sum);
  }

  const log = await prisma.experimentLog.create({
    data: {
      workspaceId: id,
      changeType,
      description,
      relatedCampaignId: relatedCampaignId || null,
      measuredMetric: measuredMetric || null,
      beforeMetricValue,
      confidenceLevel: "INSUFFICIENT_DATA",
    },
  });

  return NextResponse.json({ log }, { status: 201 });
}

function computeMetricFromAgg(
  metric: string,
  sums: { cost: number | null; verifiedConversions: number | null; rawConversions: number | null; clicks: number | null }
): number {
  const cost = sums.cost ?? 0;
  const verified = sums.verifiedConversions ?? 0;
  const raw = sums.rawConversions ?? 0;
  const clicks = sums.clicks ?? 0;

  switch (metric) {
    case "cpl_verified": return verified > 0 ? Math.round((cost / verified) * 100) / 100 : 0;
    case "cpl_raw": return raw > 0 ? Math.round((cost / raw) * 100) / 100 : 0;
    case "verified_conversions": return verified;
    case "ctr": return clicks; // مبسّطة - محتاجة impressions أيضاً لحساب CTR فعلي دقيق
    default: return 0;
  }
}
