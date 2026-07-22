// lib/relativeSpendThreshold.ts
//
// دالة مشتركة واحدة لحساب "عتبة صرف مهدر" بشكل نسبي لكل Workspace -
// بدل ما كل صفحة/دالة في المشروع تخترع رقم ثابت بعملة مش معروفة (باگ
// حقيقي لقيناه في 5 أماكن مختلفة: كتالوج ميتا، ترتيب الإعلانات، مصطلحات
// البحث، Shopping، أماكن ظهور جوجل - كلهم كانوا بيستخدموا أرقام زي 5
// أو 10 أو 15 أو 20 من غير أي وعي بالعملة).
//
// المبدأ: العتبة = نسبة من إجمالي صرف الـWorkspace في آخر 30 يوم -
// نفس العملة تلقائياً (صفر تحويل)، وبتتكيف تلقائياً مع حجم الحساب.

import { prisma } from "@/lib/prisma";

const DEFAULT_PCT_OF_TOTAL_SPEND = 0.01;

export async function getRelativeSpendThreshold(
  workspaceId: string,
  pctOfTotal: number = DEFAULT_PCT_OF_TOTAL_SPEND
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const agg = await prisma.metricSnapshot.aggregate({
    where: { workspaceId, date: { gte: thirtyDaysAgo } },
    _sum: { cost: true },
  });

  const totalSpend = agg._sum.cost ?? 0;
  return totalSpend * pctOfTotal;
}
