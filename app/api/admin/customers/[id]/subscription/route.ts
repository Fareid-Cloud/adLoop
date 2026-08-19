// app/api/admin/customers/[id]/subscription/route.ts
//
// تمديد أو إهداء اشتراك - **أخطر فعل غير قابل للتراجع في اللوحة كلها.**
//
// بيدّي وصولاً كامل بلا دفع، فمحمي بأربع طبقات: دور OWNER، توكن CSRF،
// تحقّق طازج (step-up)، وسجلّ تدقيق. وبيكتب `SubscriptionEvent` بـ
// `actorAdminId` مضبوط - وده اللي بيمنع الهدية إنها تتحسب "إيراد جديد"
// في تقرير النموّ وتخلّي المالك يقرا كرمه هو كأنّه سوق.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/adminGuard";
import { logAdminAction } from "@/lib/adminAudit";
import { logSubscriptionEvent } from "@/lib/subscriptionEvents";
import { validateOrError } from "@/lib/validation/schemas";
import { PLAN_BY_KEY } from "@/lib/plans";

/** سقف على التمديد الواحد. مش حماية من نيّة سيئة - حماية من صفر زيادة. */
const MAX_DAYS = 730;

const schema = z.object({
  action: z.enum(["extend", "gift", "cancel"]),
  /** للتمديد: أيام تُضاف لنهاية الفترة الحالية (أو لليوم لو منتهية) */
  days: z.number().int().min(1).max(MAX_DAYS).optional(),
  /** للهدية: الباقة الممنوحة */
  planKey: z.string().optional(),
  reason: z.string().min(3).max(500),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await guardAdmin(req, {
    capability: "customers.subscription",
    mutating: true,
    elevated: true,
  });
  if (!guard.ok) return guard.response;

  const validation = validateOrError(schema, await req.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
  const body = validation.data;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true },
  });
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date();

  if (body.action === "cancel") {
    await prisma.user.update({
      where: { id },
      data: { subscriptionStatus: "CANCELED", cancelAtPeriodEnd: true },
    });
    await logSubscriptionEvent({
      userId: id,
      type: "CANCELLED",
      fromPlan: target.subscriptionPlan,
      actorAdminId: guard.admin.id,
      note: body.reason,
    });
    await logAdminAction({
      adminUserId: guard.admin.id,
      action: "SUBSCRIPTION_CANCEL",
      targetUserId: id,
      details: `${guard.admin.email} cancelled ${target.email} (${target.subscriptionPlan ?? "none"}) — ${body.reason}`,
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "extend") {
    if (!body.days) return NextResponse.json({ error: "days required" }, { status: 400 });
    if (!target.subscriptionPlan) {
      // تمديد لا شيء لا معنى له - الهدية هي الفعل الصحيح هنا، والرسالة
      // بتقول كده بدل ما تنجح صامتة وتسيب الحساب زي ما هو.
      return NextResponse.json(
        { error: "this account has no plan to extend — use gift instead" },
        { status: 400 }
      );
    }

    // البداية من نهاية الفترة الحالية لو لسه سارية، ومن النهاردة لو
    // خلصت. البداية من النهاردة دايماً كانت هتاكل الأيام المتبقّية
    // المدفوعة، والبداية من النهاية دايماً كانت هتدّي تمديداً بيبدأ في
    // الماضي لحساب منتهي من شهور.
    const base = target.currentPeriodEnd && target.currentPeriodEnd > now ? target.currentPeriodEnd : now;
    const periodEnd = new Date(base.getTime() + body.days * 86_400_000);

    await prisma.user.update({
      where: { id },
      data: { subscriptionStatus: "ACTIVE", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false },
    });
    await logSubscriptionEvent({
      userId: id,
      type: "EXTENDED",
      fromPlan: target.subscriptionPlan,
      toPlan: target.subscriptionPlan,
      actorAdminId: guard.admin.id,
      note: `+${body.days}d — ${body.reason}`,
    });
    await logAdminAction({
      adminUserId: guard.admin.id,
      action: "SUBSCRIPTION_EXTEND",
      targetUserId: id,
      details: `${guard.admin.email} extended ${target.email} by ${body.days} days to ${periodEnd.toISOString().slice(0, 10)} — ${body.reason}`,
    });
    return NextResponse.json({ success: true, currentPeriodEnd: periodEnd });
  }

  // ==================== هدية ====================
  if (!body.planKey || !body.days) {
    return NextResponse.json({ error: "planKey and days required" }, { status: 400 });
  }
  const plan = PLAN_BY_KEY.get(body.planKey as never);
  if (!plan || plan.key === "free") {
    return NextResponse.json({ error: "unknown plan" }, { status: 400 });
  }

  const periodEnd = new Date(now.getTime() + body.days * 86_400_000);
  await prisma.user.update({
    where: { id },
    data: {
      subscriptionStatus: "ACTIVE",
      subscriptionPlan: plan.key,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
  });
  await logSubscriptionEvent({
    userId: id,
    type: "GIFTED",
    fromPlan: target.subscriptionPlan,
    toPlan: plan.key,
    // بلا مبلغ عن قصد: الهدية مالهاش قيمة محصَّلة، وكتابة سعر الكتالوج
    // هنا كانت هتخلّيها تتجمّع مع الإيراد الحقيقي في أي استعلام مجاميع.
    actorAdminId: guard.admin.id,
    note: `${body.days}d — ${body.reason}`,
  });
  await logAdminAction({
    adminUserId: guard.admin.id,
    action: "SUBSCRIPTION_GIFT",
    targetUserId: id,
    details: `${guard.admin.email} gifted ${plan.key} to ${target.email} for ${body.days} days — ${body.reason}`,
  });

  return NextResponse.json({ success: true, currentPeriodEnd: periodEnd, plan: plan.key });
}
