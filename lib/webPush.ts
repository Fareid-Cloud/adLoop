// lib/webPush.ts
//
// إرسال Web Push حقيقي - مكتبة web-push القياسية على npm، موثّقة
// رسمياً لبروتوكول Push API.

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// بنضبط مفاتيح VAPID كسول (lazy) - لو ضبطناها وقت الـ import، البناء نفسه
// بيفشل لما المفاتيح لسه مش موجودة (web-push بيرمي وقت الاستيراد). بنضبطها
// أول مرة نحتاج نبعت فعلاً، ولو المفاتيح ناقصة بنتخطى الإرسال بهدوء.
let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "support@example.com"}`,
    pub,
    priv
  );
  vapidReady = true;
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureVapid()) return; // مفاتيح Push مش متضبطة - إشعارات الموبايل متعطّلة
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`فشل إرسال Web Push للمستخدم ${userId}:`, err.message ?? err);
      }
    }
  }
}
