// app/api/cron/push-notifications/route.ts
//
// كرون يومي منفصل - على مستوى المستخدم مش الـWorkspace، فمنطقي يكون
// endpoint مستقل بجدول زمني خاص بيه. نفس نمط حماية CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { checkInactivityPushNotifications, checkSubscriptionExpiryPushNotifications } from "@/lib/pushNotificationChecks";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await checkInactivityPushNotifications();
  await checkSubscriptionExpiryPushNotifications();

  return NextResponse.json({ ok: true });
}
