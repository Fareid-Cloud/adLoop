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

import { NextRequest, NextResponse } from "next/server";
import { denyUnlessCron } from "@/lib/cronAuth";
import { runMarketingCampaigns } from "@/lib/marketing/send";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // نفس حارس بقيّة مهامّ الكرون: بدونه يستطيع أيّ أحد إطلاق حملة بريدية
  // على كلّ المشتركين بطلب واحد.
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const started = Date.now();
  const result = await runMarketingCampaigns();

  return NextResponse.json({ ...result, durationMs: Date.now() - started });
}
