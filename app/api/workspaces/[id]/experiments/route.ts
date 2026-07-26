// app/api/workspaces/[id]/experiments/route.ts
//
// إنشاء تجربة يدوية. التجارب التلقائية تُنشأ من applyActionFeedItem مباشرة
// عند تنفيذ أي قرار حقيقي - لا تمرّ من هنا.
//
// النسخة السابقة كانت تلتقط "القيمة قبل" لمؤشر واحد فقط بحساب مبسّط (وكان
// CTR فيه يعيد عدد النقرات لا النسبة). القياس الآن مركزي في experimentEngine
// ويشمل عدة مؤشرات، ويُجرى بعد اكتمال النافذة على الجانبين معاً.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { recordExperiment, EXPERIMENT_METRICS } from "@/lib/experimentEngine";

const ALLOWED_TYPES = ["BUDGET", "AD_COPY", "LANDING_PAGE", "TARGETING", "BID_STRATEGY", "PAUSE", "OTHER"];
const ALLOWED_METRICS: string[] = EXPERIMENT_METRICS.map((m) => m.key);

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

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (typeof body.description !== "string" || !body.description.trim()) {
    return NextResponse.json({ error: "وصف التغيير مطلوب." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(body.changeType)) {
    return NextResponse.json({ error: "نوع التغيير غير معروف." }, { status: 400 });
  }

  const trackedMetrics = Array.isArray(body.trackedMetrics)
    ? body.trackedMetrics.filter((m: unknown) => typeof m === "string" && ALLOWED_METRICS.includes(m))
    : [];
  if (trackedMetrics.length === 0) {
    return NextResponse.json({ error: "اختر مؤشراً واحداً على الأقل للمقارنة." }, { status: 400 });
  }

  const windowDays = [3, 7, 14, 30].includes(Number(body.windowDays)) ? Number(body.windowDays) : 7;

  // الحملة - إن حُدِّدت - يجب أن تكون مرتبطة بمساحة العمل هذه فعلاً
  let campaignId: string | null = null;
  if (typeof body.campaignId === "string" && body.campaignId) {
    const link = await prisma.campaignLink.findFirst({
      where: { workspaceId: id, externalCampaignId: body.campaignId },
    });
    if (!link) return NextResponse.json({ error: "الحملة غير مرتبطة بمساحة العمل." }, { status: 400 });
    campaignId = body.campaignId;
  }

  const experiment = await recordExperiment({
    workspaceId: id,
    changeType: body.changeType,
    description: body.description.trim().slice(0, 300),
    note: typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null,
    campaignId,
    platform: typeof body.platform === "string" ? body.platform : null,
    trackedMetrics: trackedMetrics as any,
    windowDays,
    source: "MANUAL",
  });

  return NextResponse.json({ experiment }, { status: 201 });
}
