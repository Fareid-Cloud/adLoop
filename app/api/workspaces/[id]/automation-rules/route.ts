// app/api/workspaces/[id]/automation-rules/route.ts

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkAutomationRuleLimit } from "@/lib/entitlements";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rules = await prisma.automationRule.findMany({
    where: { workspaceId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, ...workspaceAccess(user.id) },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  
  // حدّ الباقة كان معرَّفاً ولا يُستدعى: باقة تعرض ثلاث قواعد

  // كانت تقبل أيّ عدد.

  const ruleCheck = await checkAutomationRuleLimit(user.id, id);

  if (!ruleCheck.allowed) {

    return NextResponse.json(

      {

        error:

          ruleCheck.limit === 0

            ? "باقتك الحالية لا تشمل الأتمتة. رقِّ باقتك لتفعيل هذه الميزة."

            : `باقتك الحالية تسمح بـ${ruleCheck.limit} قاعدة أتمتة. رقِّ باقتك لإضافة المزيد.`,

        limitReached: true,

        limit: ruleCheck.limit,

      },

      { status: 403 }

    );

  }

const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // تحقّق صريح: القيم كانت تُمرَّر إلى Prisma دون فحص، فأي قيمة enum غير
  // صالحة كانت تُسقط الطلب بخطأ 500 غامض بدل رسالة مفهومة.
  const ALLOWED_ACTIONS = ["PAUSE_CAMPAIGN", "PAUSE_AD", "REDUCE_BUDGET_PCT", "INCREASE_BUDGET_PCT", "ADJUST_BID_PCT", "SEND_ALERT_ONLY"];
  const ALLOWED_OPERATORS = ["GREATER_THAN", "LESS_THAN"];
  const ALLOWED_SCOPES = ["ALL_CAMPAIGNS", "SPECIFIC_CAMPAIGNS"];
  const ALLOWED_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"];

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: t(locale, "apiErr.ruleNameRequired") }, { status: 400 });
  }
  if (!ALLOWED_ACTIONS.includes(body.action)) {
    return NextResponse.json({ error: t(locale, "apiErr.unknownAction") }, { status: 400 });
  }
  if (!ALLOWED_OPERATORS.includes(body.operator)) {
    return NextResponse.json({ error: t(locale, "apiErr.unknownCondition") }, { status: 400 });
  }
  if (typeof body.threshold !== "number" || Number.isNaN(body.threshold)) {
    return NextResponse.json({ error: t(locale, "apiErr.thresholdInvalid") }, { status: 400 });
  }

  const appliesTo = ALLOWED_SCOPES.includes(body.appliesTo) ? body.appliesTo : "ALL_CAMPAIGNS";
  const platform = ALLOWED_PLATFORMS.includes(body.platform) ? body.platform : null;

  // نطاق محدد بلا حملات = قاعدة لا تعمل على شيء إطلاقاً
  const campaignIds: string[] = Array.isArray(body.specificCampaignIds)
    ? body.specificCampaignIds.filter((c: unknown) => typeof c === "string")
    : [];
  if (appliesTo === "SPECIFIC_CAMPAIGNS" && campaignIds.length === 0) {
    return NextResponse.json({ error: t(locale, "apiErr.scopeNeedsCampaign") }, { status: 400 });
  }

  // الحدّ يُفحص على الخادم: الواجهة تخفي الزرّ، لكن طلباً مباشراً يتجاوزها
  const limitCheck = await checkAutomationRuleLimit(user.id, id);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: "limit reached",
        limitKey: "reachedRules",
        limit: limitCheck.limit,
        suggestedPlan: limitCheck.suggestedPlan,
      },
      { status: 403 }
    );
  }

  const rule = await prisma.automationRule.create({
    data: {
      workspaceId: id,
      name: body.name.trim(),
      metric: body.metric,
      operator: body.operator,
      threshold: body.threshold,
      consecutiveDays: Math.min(Math.max(Number(body.consecutiveDays) || 1, 1), 30),
      attributionBasis: body.attributionBasis ?? "VERIFIED_ONLY",
      action: body.action,
      actionValue: typeof body.actionValue === "number" ? body.actionValue : null,
      maxSingleJumpPct: body.maxSingleJumpPct ?? 20,
      cooldownDays: body.cooldownDays ?? 3,
      requireApproval: body.requireApproval ?? true,
      platform,
      appliesTo,
      specificCampaignIds: campaignIds,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
