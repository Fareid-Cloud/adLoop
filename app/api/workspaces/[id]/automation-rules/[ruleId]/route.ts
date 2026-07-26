// app/api/workspaces/[id]/automation-rules/[ruleId]/route.ts
//
// تعديل قاعدة أو حذفها. الإيقاف وحده لا يكفي: القواعد الموقوفة تتراكم
// فتزدحم الصفحة، والتعديل يمنع الاضطرار إلى الحذف وإعادة الإنشاء لتغيير
// رقم واحد.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const ALLOWED_SCOPES = ["ALL_CAMPAIGNS", "SPECIFIC_CAMPAIGNS"];
const ALLOWED_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"];

async function assertOwnership(workspaceId: string, ruleId: string, userId: string) {
  return prisma.automationRule.findFirst({
    where: { id: ruleId, workspaceId, workspace: { userId } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const { id, ruleId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rule = await assertOwnership(id, ruleId, user.id);
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 160);
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.requireApproval === "boolean") data.requireApproval = body.requireApproval;
  if (typeof body.threshold === "number" && !Number.isNaN(body.threshold)) data.threshold = body.threshold;
  if (typeof body.actionValue === "number") data.actionValue = body.actionValue;
  if (typeof body.consecutiveDays === "number") {
    data.consecutiveDays = Math.min(Math.max(body.consecutiveDays, 1), 30);
  }
  if (typeof body.cooldownDays === "number") {
    data.cooldownDays = Math.min(Math.max(body.cooldownDays, 0), 60);
  }
  if (body.platform === null || ALLOWED_PLATFORMS.includes(body.platform)) {
    data.platform = body.platform ?? null;
  }

  if (ALLOWED_SCOPES.includes(body.appliesTo)) {
    const ids: string[] = Array.isArray(body.specificCampaignIds)
      ? body.specificCampaignIds.filter((c: unknown) => typeof c === "string")
      : [];
    if (body.appliesTo === "SPECIFIC_CAMPAIGNS" && ids.length === 0) {
      return NextResponse.json({ error: "اختر حملة واحدة على الأقل عند تحديد النطاق." }, { status: 400 });
    }
    data.appliesTo = body.appliesTo;
    data.specificCampaignIds = body.appliesTo === "SPECIFIC_CAMPAIGNS" ? ids : [];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "لا يوجد أي حقل صالح للتعديل." }, { status: 400 });
  }

  const updated = await prisma.automationRule.update({ where: { id: ruleId }, data });
  return NextResponse.json({ rule: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const { id, ruleId } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rule = await assertOwnership(id, ruleId, user.id);
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.automationRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
