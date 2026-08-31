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

// 🔴 **جدولان يحملان بياناتٍ شخصية كانا خارج السياسة كلّها.**
//
// `UnmatchedClick` يحمل `ipAddress` و`userAgent` - وهما بيانان شخصيّان
// بنصّ القانون - و`AttributionResult` يتراكم بلا حدٍّ زمنيّ أصلاً. وقانون
// حماية البيانات الشخصية المصريّ يوجب حدّاً للاحتفاظ (راجع
// `docs/security-audit-2026-07-18.md`).
//
// والنافذة نفسها نافذةُ الكليك: قيمةُ النقرة غير المطابَقة في مطابقتها،
// وبعد تسعين يوماً لم يعد لها ما تُطابَق به.
const UNMATCHED_CLICK_RETENTION_DAYS = 90;
// نتيجةُ الإسناد تُبقى أطول: تقارير المقارنة السنوية تقرأ منها، وهي لا
// تحمل عنواناً ولا بصمة - معرّفَ محادثةٍ وتوزيعاً احتمالياً فقط.
const ATTRIBUTION_RETENTION_DAYS = 400;

export async function purgeExpiredData() {
  const ctaClickCutoff = new Date();
  ctaClickCutoff.setDate(ctaClickCutoff.getDate() - CTA_CLICK_RETENTION_DAYS);

  const rateLimitCutoff = new Date();
  rateLimitCutoff.setDate(rateLimitCutoff.getDate() - RATE_LIMIT_RETENTION_DAYS);

  const unmatchedCutoff = new Date();
  unmatchedCutoff.setDate(unmatchedCutoff.getDate() - UNMATCHED_CLICK_RETENTION_DAYS);

  const attributionCutoff = new Date();
  attributionCutoff.setDate(attributionCutoff.getDate() - ATTRIBUTION_RETENTION_DAYS);

  const [deletedClicks, deletedRateLimits, deletedUnmatched, deletedAttribution] =
    await Promise.all([
      prisma.ctaClickEvent.deleteMany({
        where: { clickedAt: { lt: ctaClickCutoff } },
      }),
      prisma.rateLimitEntry.deleteMany({
        where: { windowStart: { lt: rateLimitCutoff } },
      }),
      prisma.unmatchedClick.deleteMany({
        where: { clickedAt: { lt: unmatchedCutoff } },
      }),
      prisma.attributionResult.deleteMany({
        where: { receivedAt: { lt: attributionCutoff } },
      }),
    ]);

  return {
    deletedClicks: deletedClicks.count,
    deletedRateLimits: deletedRateLimits.count,
    deletedUnmatched: deletedUnmatched.count,
    deletedAttribution: deletedAttribution.count,
  };
}
