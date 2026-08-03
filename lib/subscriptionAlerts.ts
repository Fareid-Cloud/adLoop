// lib/subscriptionAlerts.ts
//
// شبكة أمان احتياطية بجانب تنبيه الويب هوك (اللي بيتشغّل بس لو المستخدم
// جدول إلغاء بنفسه). هنا بنغطي حالة تانية: فشل الدفع (PAST_DUE) -
// بتحاول تجدد تلقائياً لفترة (Dunning)، لو فشلت كل المحاولات هيتلغي
// الاشتراك، فمهم نطمّن المستخدم يحدّث بيانات الدفع قبل ما يوصل لده.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t, type Locale } from "@/lib/i18n/dictionary";

const COOLDOWN_DAYS = 3;

export async function checkSubscriptionExpiryForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;

  const user = await prisma.user.findUnique({ where: { id: workspace.userId } });
  if (!user || user.subscriptionStatus !== "PAST_DUE") return;

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
  const recentSimilar = await prisma.actionFeedItem.findFirst({
    // الفحص بالمفتاح لا بنصّ العنوان: النصّ يتغيّر مع اللغة والصياغة،
    // فالبحث فيه كان يكسر منع التكرار بصمت عند أوّل إعادة صياغة.
    where: { workspaceId, titleKey: "alerts.paymentFailedTitle", createdAt: { gte: cooldownStart } },
  });
  if (recentSimilar) return;

  await pushToActionFeed({
    workspaceId,
    source: "ACCOUNT",
    type: "ACCOUNT",
    severity: "HIGH",
    title: t("ar", "alerts.paymentFailedTitle"),
    titleKey: "alerts.paymentFailedTitle",
    description: t("ar", "alerts.paymentFailedBody"),
    descKey: "alerts.paymentFailedBody",
    linkUrl: "/dashboard/billing",
  });
}
