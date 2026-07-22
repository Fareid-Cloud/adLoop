// lib/dataRetention.ts
//
// فجوة كانت موثّقة صراحة في SECURITY.md قسم 15: "بلا حد زمني، بيانات
// بتتراكم للأبد". الكود ده بيمسح بس البيانات الخام قصيرة القيمة (كليكات
// فردية، نوافذ حد الاستخدام) - مش الأرقام المجمّعة اليومية (MetricSnapshot)
// اللي هي أساس أي تقرير تاريخي حقيقي، دي بتفضل للأبد.

import { prisma } from "@/lib/prisma";

// كليك فردي (CtaClickEvent) قيمته الحقيقية في أول 30 يوم بس (نافذة
// التحقق ونوافذ الإسناد المستخدمة في النظام كله) - بعدها بقاؤه مجرد
// تراكم بيانات شخصية (IP، User Agent) بلا فايدة تحليلية إضافية
const CTA_CLICK_RETENTION_DAYS = 90;

// نوافذ حد الاستخدام (RateLimitEntry) قيمتها لحظية بحتة - بعد أسبوع مفيش
// أي سبب نحتفظ بيها
const RATE_LIMIT_RETENTION_DAYS = 7;

export async function purgeExpiredData() {
  const ctaClickCutoff = new Date();
  ctaClickCutoff.setDate(ctaClickCutoff.getDate() - CTA_CLICK_RETENTION_DAYS);

  const rateLimitCutoff = new Date();
  rateLimitCutoff.setDate(rateLimitCutoff.getDate() - RATE_LIMIT_RETENTION_DAYS);

  const [deletedClicks, deletedRateLimits] = await Promise.all([
    prisma.ctaClickEvent.deleteMany({
      where: { clickedAt: { lt: ctaClickCutoff } },
    }),
    prisma.rateLimitEntry.deleteMany({
      where: { windowStart: { lt: rateLimitCutoff } },
    }),
  ]);

  return {
    deletedClicks: deletedClicks.count,
    deletedRateLimits: deletedRateLimits.count,
  };
}
