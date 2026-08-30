// app/api/cron/push-notifications/route.ts
//
// كرون يومي منفصل - على مستوى المستخدم مش الـWorkspace، فمنطقي يكون
// endpoint مستقل بجدول زمني خاص بيه. نفس نمط حماية CRON_SECRET.

import { NextRequest } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { checkInactivityPushNotifications, checkSubscriptionExpiryPushNotifications } from "@/lib/pushNotificationChecks";
import { finishCronRun } from "@/lib/cronRun";

// بيمرّ على كلّ المستخدمين ويبعت لكلّ جهاز مشترك - بيطول مع العدد.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const startedAt = Date.now();

  // 🔴 كان النداءان **بلا `try`**، والراوت يردّ `{ok:true}` دائماً: فشلُ
  // أحدهما يرمي فيخرج الطلب بلا صفٍّ ولا أثر، ونجاحُهما يبدو مطابقاً له
  // تماماً. كلٌّ على حدة الآن، فسقوطُ أحدهما لا يمنع الآخر ويظهر في الرمز.
  const failures: Array<{ step: string; error: string }> = [];
  const steps: Array<[string, () => Promise<unknown>]> = [
    ["inactivity", checkInactivityPushNotifications],
    ["subscriptionExpiry", checkSubscriptionExpiryPushNotifications],
  ];

  for (const [step, run] of steps) {
    try {
      await run();
    } catch (err) {
      failures.push({ step, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
      console.error(`[cron:push-notifications] فشلت الخطوة ${step}:`, err);
    }
  }

  return finishCronRun({
    job: "push-notifications",
    total: steps.length,
    succeeded: steps.length - failures.length,
    failed: failures.length,
    startedAt,
    errors: failures,
  });
}
