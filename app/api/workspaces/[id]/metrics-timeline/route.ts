// app/api/workspaces/[id]/metrics-timeline/route.ts
//
// بيرجّع سلسلة زمنية يومية لأي مجموعة مقاييس يختارها المستخدم (زي صفحة
// Overview في Google Ads بالظبط) - النطاق الزمني وعدد المقاييس مفتوحين،
// مش ثابتين على 30 يوم زي الملخص العام في صفحة "لمحة".

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export type TimelineMetricKey =
  | "impressions" | "clicks" | "cost" | "raw_conversions" | "verified_conversions"
  | "ctr" | "cpc" | "cpl_raw" | "cpl_verified" | "inflation_rate";

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const metricsParam = searchParams.get("metrics") ?? "";
  const requestedMetrics = metricsParam.split(",").filter(Boolean) as TimelineMetricKey[];

  // أقصى 6 مقاييس مع بعض - نفس حد Google Ads Overview بالظبط، عشان
  // الرسم يفضل مقروء ومفيش زحمة خطوط فوق بعض
  const metrics = requestedMetrics.slice(0, 6);

  if (!from || !to || metrics.length === 0) {
    return NextResponse.json({ error: "missing from/to/metrics" }, { status: 400 });
  }

  const snapshots = await prisma.metricSnapshot.findMany({
    where: {
      workspaceId: id,
      date: { gte: new Date(from), lte: new Date(to) },
    },
    select: {
      date: true,
      impressions: true,
      clicks: true,
      cost: true,
      rawConversions: true,
      verifiedConversions: true,
    },
    orderBy: { date: "asc" },
  });

  // بنجمع كل منصات نفس اليوم في نقطة واحدة، بعدين نحسب المقاييس المشتقة
  // (CTR, CPC, CPL...) من الإجماليات اليومية، مش من متوسط نسب منفصلة
  const byDate = new Map<
    string,
    { impressions: number; clicks: number; cost: number; rawConversions: number; verifiedConversions: number }
  >();

  for (const s of snapshots) {
    const key = s.date.toISOString().slice(0, 10);
    const existing = byDate.get(key) ?? {
      impressions: 0, clicks: 0, cost: 0, rawConversions: 0, verifiedConversions: 0,
    };
    existing.impressions += s.impressions;
    existing.clicks += s.clicks;
    existing.cost += s.cost;
    existing.rawConversions += s.rawConversions;
    existing.verifiedConversions += s.verifiedConversions;
    byDate.set(key, existing);
  }

  const series = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const point: Record<string, string | number> = { date: date.slice(5) }; // MM-DD

      for (const metric of metrics) {
        point[metric] = computeMetric(metric, d);
      }

      return point;
    });

  return NextResponse.json({ series, metrics });
}

function computeMetric(
  metric: TimelineMetricKey,
  d: { impressions: number; clicks: number; cost: number; rawConversions: number; verifiedConversions: number }
): number {
  switch (metric) {
    case "impressions": return d.impressions;
    case "clicks": return d.clicks;
    case "cost": return round2(d.cost);
    case "raw_conversions": return d.rawConversions;
    case "verified_conversions": return d.verifiedConversions;
    case "ctr": return d.impressions > 0 ? round2((d.clicks / d.impressions) * 100) : 0;
    case "cpc": return d.clicks > 0 ? round2(d.cost / d.clicks) : 0;
    case "cpl_raw": return d.rawConversions > 0 ? round2(d.cost / d.rawConversions) : 0;
    case "cpl_verified": return d.verifiedConversions > 0 ? round2(d.cost / d.verifiedConversions) : 0;
    case "inflation_rate":
      return d.verifiedConversions > 0
        ? round2(((d.rawConversions - d.verifiedConversions) / d.rawConversions) * 100)
        : 0;
    default: return 0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
