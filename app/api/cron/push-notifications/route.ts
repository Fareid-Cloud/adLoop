// app/api/cron/push-notifications/route.ts
//
// كرون يومي منفصل - على مستوى المستخدم مش الـWorkspace، فمنطقي يكون
// endpoint مستقل بجدول زمني خاص بيه. نفس نمط حماية CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { checkInactivityPushNotifications, checkSubscriptionExpiryPushNotifications } from "@/lib/pushNotificationChecks";

// بيمرّ على كلّ المستخدمين ويبعت لكلّ جهاز مشترك - بيطول مع العدد.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  await checkInactivityPushNotifications();
  await checkSubscriptionExpiryPushNotifications();

  return NextResponse.json({ ok: true });
}
