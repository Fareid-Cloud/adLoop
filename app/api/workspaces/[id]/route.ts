// app/api/workspaces/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyCsrfToken } from "@/lib/csrf";

const ALLOWED_FIELDS = [
  "name",
  "currency",
  "targetLocation",
  "profitMarginPct",
  "monthlyChangeCeilingPct",
  "facebookPageId",
  "useModeledAttribution",
  "responseTimeThresholdMinutes",
  "messengerInactivityThresholdMinutes",
  "primaryConversionSource",
  "autoReplyText",
  "enableAIInsights",
  "enableAutomationRules",
  "enableDailyDiagnostics",
  "enablePricingHealthChecks",
  "adFatigueFrequencyThreshold",
  "ctrDropThresholdPct",
  "pricingWarningThresholdPct",
  "pricingCriticalThresholdPct",
  "rtoAnomalyMultiplier",
  "automationMonthlyBudgetChangeCeilingPct",
  "notifyUrgentByEmail",
  "notifyHighByEmail",
  "notificationEmail",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // تحقق الملكية - نفس المبدأ في كل مكان (ADR §7)
  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) data[field] = body[field];
  }

  const updated = await prisma.workspace.update({
    where: { id: id },
    data,
  });

  return NextResponse.json({ workspace: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // إصلاح من اختبار الاختراق: حذف Workspace كامل كان من غير حماية CSRF
  // - فعل تدميري يستاهل نفس مستوى حماية حذف الحساب بالظبط
  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  // onDelete: Cascade في الـ schema بيتكفل بمسح كل البيانات المرتبطة تلقائياً
  await prisma.workspace.delete({ where: { id: id } });

  return NextResponse.json({ success: true });
}
