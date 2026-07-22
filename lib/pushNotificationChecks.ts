// lib/pushNotificationChecks.ts
//
// بندين مختلفين طلبهم المستخدم:
// 1) تنبيه "معملتش فتح البرنامج من فترة" - افتراضي 48 ساعة، قابل للتخصيص
// 2) تذكير قرب انتهاء الباقة - مرتين قبل الانتهاء، وبعد الانتهاء كل مدة معينة

import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webPush";

const INACTIVITY_THRESHOLD_HOURS = Number(process.env.PUSH_INACTIVITY_THRESHOLD_HOURS ?? 48);
const INACTIVITY_REMINDER_COOLDOWN_DAYS = 7;

const BEFORE_EXPIRY_REMINDER_DAYS = [7, 1];
const AFTER_EXPIRY_REMINDER_INTERVAL_DAYS = 3;

export async function checkInactivityPushNotifications() {
  const thresholdDate = new Date();
  thresholdDate.setHours(thresholdDate.getHours() - INACTIVITY_THRESHOLD_HOURS);

  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - INACTIVITY_REMINDER_COOLDOWN_DAYS);

  const inactiveUsers = await prisma.user.findMany({
    where: {
      lastActiveAt: { lt: thresholdDate },
      pushSubscriptions: { some: {} },
      OR: [
        { lastInactivityPushAt: null },
        { lastInactivityPushAt: { lt: cooldownDate } },
      ],
    },
  });

  for (const user of inactiveUsers) {
    await sendPushToUser(user.id, {
      title: "فاتك حاجات في AdLoop",
      body: "مليش عليك من فترة - في تحديثات وقرارات مستنياك تراجعها.",
      url: "/dashboard",
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastInactivityPushAt: new Date() } });
  }
}

export async function checkSubscriptionExpiryPushNotifications() {
  const now = new Date();

  const users = await prisma.user.findMany({
    where: {
      currentPeriodEnd: { not: null },
      subscriptionStatus: { in: ["ACTIVE", "PAST_DUE"] },
      pushSubscriptions: { some: {} },
    },
  });

  for (const user of users) {
    if (!user.currentPeriodEnd) continue;
    const daysUntilExpiry = Math.ceil((user.currentPeriodEnd.getTime() - now.getTime()) / 86400000);

    if (daysUntilExpiry > 0 && BEFORE_EXPIRY_REMINDER_DAYS.includes(daysUntilExpiry)) {
      await sendPushToUser(user.id, {
        title: "اشتراكك هيخلص قريب",
        body: `باقيلك ${daysUntilExpiry} يوم على انتهاء اشتراكك - جدّده عشان متتقفش الميزات.`,
        url: "/dashboard/billing",
      });
    } else if (daysUntilExpiry <= 0) {
      const daysSinceExpiry = Math.abs(daysUntilExpiry);
      if (daysSinceExpiry % AFTER_EXPIRY_REMINDER_INTERVAL_DAYS === 0) {
        await sendPushToUser(user.id, {
          title: "اشتراكك منتهي",
          body: "جدّد اشتراكك عشان ترجع تستخدم AdLoop بكامل ميزاته.",
          url: "/dashboard/billing",
        });
      }
    }
  }
}
