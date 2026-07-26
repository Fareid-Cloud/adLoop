// app/api/workspaces/[id]/experiments/[experimentId]/route.ts
//
// تعديل تجربة أو حذفها. القياس نفسه لا يُعدَّل يدوياً - يُعاد حسابه من
// البيانات - لكن الوصف والملاحظة والمؤشرات المتابَعة ونافذة القياس تخصّ
// المستخدم وله تغييرها.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { EXPERIMENT_METRICS } from "@/lib/experimentEngine";

const ALLOWED_METRICS: string[] = EXPERIMENT_METRICS.map((m) => m.key);
const ALLOWED_TYPES = ["BUDGET", "AD_COPY", "CREATIVE", "LANDING_PAGE", "TARGETING", "BID_STRATEGY", "PAUSE", "OTHER"];

async function assertOwnership(workspaceId: string, experimentId: string, userId: string) {
  return prisma.experimentLog.findFirst({
    where: { id: experimentId, workspaceId, workspace: { userId } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  const { id, experimentId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const experiment = await assertOwnership(id, experimentId, user.id);
  if (!experiment) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (typeof body.description === "string" && body.description.trim()) {
    data.description = body.description.trim().slice(0, 300);
  }
  if (typeof body.note === "string") data.note = body.note.trim().slice(0, 500) || null;
  if (ALLOWED_TYPES.includes(body.changeType)) data.changeType = body.changeType;

  if (Array.isArray(body.trackedMetrics)) {
    const metrics = body.trackedMetrics.filter(
      (m: unknown) => typeof m === "string" && ALLOWED_METRICS.includes(m)
    );
    if (metrics.length === 0) {
      return NextResponse.json({ error: "اختر مؤشراً واحداً على الأقل." }, { status: 400 });
    }
    data.trackedMetrics = metrics;
  }

  if ([3, 7, 14, 30].includes(Number(body.windowDays))) {
    // تغيير النافذة يعني أن النتيجة السابقة لم تعد تصف ما نقيسه - نعيدها
    // إلى القياس بدل ترك رقم قديم يوحي بأنه محسوب على النافذة الجديدة.
    data.windowDays = Number(body.windowDays);
    if (experiment.status !== "RUNNING") {
      data.status = "RUNNING";
      data.metricResults = null;
      data.measuredAt = null;
      data.confidenceLevel = "INSUFFICIENT_DATA";
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "لا يوجد أي حقل صالح للتعديل." }, { status: 400 });
  }

  const updated = await prisma.experimentLog.update({ where: { id: experimentId }, data });
  return NextResponse.json({ experiment: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; experimentId: string }> }
) {
  const { id, experimentId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const experiment = await assertOwnership(id, experimentId, user.id);
  if (!experiment) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.experimentLog.delete({ where: { id: experimentId } });
  return NextResponse.json({ ok: true });
}
