// lib/subscriptionAlerts.ts
//
// شبكة أمان احتياطية بجانب تنبيه الويب هوك (اللي بيتشغّل بس لو المستخدم
// جدول إلغاء بنفسه). هنا بنغطي حالة تانية: فشل الدفع (PAST_DUE) -
// بتحاول تجدد تلقائياً لفترة (Dunning)، لو فشلت كل المحاولات هيتلغي
// الاشتراك، فمهم نطمّن المستخدم يحدّث بيانات الدفع قبل ما يوصل لده.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";

const COOLDOWN_DAYS = 3;

export async function checkSubscriptionExpiryForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;

  const user = await prisma.user.findUnique({ where: { id: workspace.userId } });
  if (!user || user.subscriptionStatus !== "PAST_DUE") return;

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
  const recentSimilar = await prisma.actionFeedItem.findFirst({
    where: { workspaceId, title: { contains: "فشل الدفع" }, createdAt: { gte: cooldownStart } },
  });
  if (recentSimilar) return;

  await pushToActionFeed({
    workspaceId,
    type: "ACCOUNT",
    severity: "HIGH",
    title: "فشل الدفع - حدّث بيانات الدفع",
    description: "آخر محاولة تجديد فشلت. حدّث طريقة الدفع بسرعة قبل ما يتوقف اشتراكك تلقائياً.",
    linkUrl: "/dashboard/billing",
  });
}
