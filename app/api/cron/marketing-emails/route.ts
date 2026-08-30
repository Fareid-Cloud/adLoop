// app/api/cron/marketing-emails/route.ts
//
// حملات البريد التسويقي - تشغيل يومي واحد.
//
// **لماذا كرون منفصل عن المزامنة:** المزامنة تستغرق دقائق لكلّ مساحة
// عمل وقد تفشل لأسباب خارجية (توكن منتهٍ، حدّ استدعاءات المنصّة). ربط
// البريد بها يعني أنّ فشل مزامنة جوجل يمنع رسالة تجربة على وشك الانتهاء.
//
// التوقيت 09:00 UTC = منتصف النهار في الخليج وصباحاً في مصر - داخل ساعات
// العمل لا في الليل.

import { NextRequest } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { runMarketingCampaigns } from "@/lib/marketing/send";
import { finishCronRun } from "@/lib/cronRun";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // نفس حارس بقيّة مهامّ الكرون: بدونه يستطيع أيّ أحد إطلاق حملة بريدية
  // على كلّ المشتركين بطلب واحد.
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const startedAt = Date.now();
  const result = await runMarketingCampaigns();

  // الحملة لا تُفشِل نفسها على مستخدمٍ واحد (تلتقط الخطأ وتكمل)، فالمقياس
  // هنا هو ما أُرسل مقابل ما اعتُبر - ويبقى صفٌّ يشهد أنّها جرت أصلاً.
  return finishCronRun(
    {
      job: "marketing-emails",
      total: result.considered,
      succeeded: result.sent,
      failed: 0,
      startedAt,
    },
    { ...result }
  );
}
