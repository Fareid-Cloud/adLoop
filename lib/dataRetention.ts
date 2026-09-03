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

// 🔴 **`WaClick` كان خارج السياسة كلّها - وهو أثقلها بياناتٍ شخصية.**
//
// الجدول يحمل رقم هاتف، وعنوان IP، وبصمة متصفّح - أي أنّه أكثر جداولنا
// حساسيةً على الإطلاق. وهو يعيش في **قاعدة البيانات نفسها** (متتبّع واتساب
// يُضبط على `DATABASE_URL` عينه)، لكنّ الكاتب فيه هو المشروع الآخر - فسقط
// من مهمّة التنظيف بصمت: كلُّ جدولٍ آخر يُطهَّر وهذا يتراكم بلا حدٍّ منذ
// اليوم الأوّل.
//
// **ويُطمَس ولا يُحذَف** - وهذا فرقٌ مقصود. الصفُّ نفسه سجلُّ إسنادٍ
// تقرأ منه تقاريرُ المتتبّع التاريخية (أيُّ حملةٍ، طُوبقت أم لا)، وحذفُه
// يمحو تاريخاً لا يحمل ضرراً. الضررُ في ثلاثة أعمدة بعينها: الهاتف
// والعنوان والبصمة. فتُفرَّغ وحدها، ويبقى السجلّ.
//
// والنافذةُ تسعون يوماً لأنّها نافذةُ المطابقة نفسها - وهي أيضاً أقصى
// نافذةِ رفعِ تحويلٍ تقبلها جوجل، فبعدها لا يبقى للهاتف استعمالٌ أصلاً.
// والاحتفاظُ بلا حدٍّ مخالفةٌ صريحة لما يوجبه قانون حماية البيانات
// الشخصية المصريّ (راجع `docs/security-audit-2026-07-18.md`).
const WA_CLICK_RETENTION_DAYS = 90;

// **الأرشيفُ مش مخزناً دائماً.** نقلُ المحادثة لهناك قرارٌ بأنّها خلصت،
// وشهرٌ بعده وقتٌ كافٍ لأيّ مراجعة. واللي مارجعهاش من الأرشيف خلال
// الشهر ده يبقى فعلاً مش محتاجها.
//
// والعدُّ من `archivedAt` لا من `updatedAt`: التاني بيتحرّك بأيّ تعديل
// (وسم، تعيين)، فالعدّادُ كان هيرجع لصفره بفعلٍ عابر ومايخلصش أبداً.
const ARCHIVE_RETENTION_DAYS = 30;

// 🔴 **طلبُ المبيعات بيحمل بيانات شخصٍ ممكن مايبقاش عميلاً أبداً.**
//
// اسمٌ وبريدٌ وهاتفٌ لواحدٍ سأل عن السعر مرّةً ومشي. وكان الجدولُ الوحيد
// الجديد خارج السياسة دي كلّها.
//
// **ويُطمَس ولا يُحذَف** - نفس قرار `WaClick` بالظبط ولنفس السبب: الصفُّ
// نفسه تاريخُ خطِّ المبيعات (شركةٌ بحجمٍ كذا سألت في تاريخ كذا وانتهت
// لكذا)، وهو سجلٌّ تجاريٌّ مشروعٌ يفضل للأبد ومالوش ضرر. الضررُ في تلات
// أعمدة بعينها: الاسم والبريد والهاتف. فتتفرّغ وحدها ويفضل السجلّ.
//
// وده بيغني عن تصدير البيانات لشيتٍ خارجيّ عشان «ما تضيعش»: التاريخُ
// موجودٌ في القاعدة أصلاً، والنقلُ لشيتٍ كان هيرجّع نفس المشكلة في مكانٍ
// حمايتُه أضعف.
//
// واتنعشر شهراً لأنّ الليدَ اللي محدّش لمسه سنة ميّتٌ مهما كانت حالتُه
// مكتوبة - والعدُّ من `updatedAt` عشان المتابعةُ الحقيقية تجدّده.
const SALES_ENQUIRY_RETENTION_DAYS = 365;

export async function purgeExpiredData() {
  const ctaClickCutoff = new Date();
  ctaClickCutoff.setDate(ctaClickCutoff.getDate() - CTA_CLICK_RETENTION_DAYS);

  const rateLimitCutoff = new Date();
  rateLimitCutoff.setDate(rateLimitCutoff.getDate() - RATE_LIMIT_RETENTION_DAYS);

  const unmatchedCutoff = new Date();
  unmatchedCutoff.setDate(unmatchedCutoff.getDate() - UNMATCHED_CLICK_RETENTION_DAYS);

  const attributionCutoff = new Date();
  attributionCutoff.setDate(attributionCutoff.getDate() - ATTRIBUTION_RETENTION_DAYS);

  const waClickCutoff = new Date();
  waClickCutoff.setDate(waClickCutoff.getDate() - WA_CLICK_RETENTION_DAYS);

  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_RETENTION_DAYS);

  const salesCutoff = new Date();
  salesCutoff.setDate(salesCutoff.getDate() - SALES_ENQUIRY_RETENTION_DAYS);

  const [deletedClicks, deletedRateLimits, deletedUnmatched, deletedAttribution, purgedArchive] =
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
      // حذفٌ صلبٌ عن قصد: الرسائلُ والملاحظاتُ بتروح معاها بـ`onDelete:
      // Cascade`. الأرشيفُ هو «راجعتُها وخلصت»، وحذفٌ ناعمٌ بعده بيخلّي
      // الصفوفَ تتراكم للأبد بلا أحدٍ يقراها.
      prisma.supportThread.deleteMany({
        where: { status: "ARCHIVED", archivedAt: { lt: archiveCutoff } },
      }),
    ]);

  // شرطُ «أحدُها ليس فارغاً» ليس تجميلاً: من دونه تُعاد كتابةُ كلِّ صفٍّ
  // قديم في كلّ تشغيل، فينتفخ الجدول بنسخٍ ميّتة بلا داعٍ.
  const redactedWaClicks = await prisma.waClick.updateMany({
    where: {
      createdAt: { lt: waClickCutoff },
      OR: [
        { phoneNumber: { not: null } },
        { ipAddress: { not: null } },
        { userAgent: { not: null } },
      ],
    },
    data: { phoneNumber: null, ipAddress: null, userAgent: null },
  });

  // نفس شرط «أحدُها ليس فارغاً»: من دونه كلُّ تشغيلٍ بيعيد كتابة كلّ صفٍّ
  // قديم بلا تغييرٍ فعليّ.
  const redactedEnquiries = await prisma.salesEnquiry.updateMany({
    where: {
      updatedAt: { lt: salesCutoff },
      OR: [{ name: { not: "" } }, { email: { not: "" } }, { phone: { not: null } }],
    },
    // الاسمُ والبريدُ مطلوبان في الـschema فمينفعش `null`: بيتحطّ فيهم
    // علامةٌ صريحة بدل فراغٍ يتقري «البيانات ضاعت».
    data: { name: "[redacted]", email: "[redacted]", phone: null },
  });

  return {
    deletedClicks: deletedClicks.count,
    deletedRateLimits: deletedRateLimits.count,
    deletedUnmatched: deletedUnmatched.count,
    deletedAttribution: deletedAttribution.count,
    purgedArchivedThreads: purgedArchive.count,
    redactedWaClicks: redactedWaClicks.count,
    redactedSalesEnquiries: redactedEnquiries.count,
  };
}
