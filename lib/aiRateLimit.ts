// lib/aiRateLimit.ts
//
// رصيد شهري (150 مرة، تقريباً 5/يوم بالمتوسط)، بس موزّع بحد أقصى ساعي
// (مرتين في الساعة) عشان محدش يستهلك الرصيد كله دفعة واحدة في نص ساعة
// ويفضل من غير أي رصيد لباقي الشهر. لو حد محتاجها فعلاً أكتر، بيقدر
// يستنى شوية بدل ما نمنعه نهائياً.

import { prisma } from "@/lib/prisma";
import { checkCredits, consumePurchasedCreditIfNeeded, getEntitlements } from "@/lib/entitlements";

// إعادة معايرة عشان نضمن سقف التكلفة الشهري لكل مشترك عبر التلاتة ميزات.
// ⚠️ الأرقام هنا **عدد نداءات** لا دولارات - وتكلفة النداء الواحد ارتفعت
// بتشغيل التفكير (٧ أغسطس ٢٠٢٦)، فالسقف صار ~$5 بنفس هذه الحدود.
// الرقم الحاليّ وتفصيله في `docs/claude-api-usage-map.md` - حدِّثه هناك،
// فرقمٌ قديمٌ في تعليقٍ هنا أضلُّ من ألّا يكون تعليق.
// اللي بتستخدم Claude (راجع docs/claude-api-usage-map.md للحساب الكامل)
// الحد اليدوي = 80 مرة شهرياً + استدعاء تلقائي واحد يومياً (Cron) = 20-30/شهر تقريباً
// **سقف تقني لا تجاري.** يضمن ألّا تتجاوز كلفة Claude لمشترك واحد الحدّ
// المرصود (راجع docs/claude-api-usage-map.md)، ويُطبَّق فوق حدّ الباقة.
// الفعليّ = الأقلّ بين الاثنين.
export const MONTHLY_LIMIT = 80;
const HOURLY_LIMIT = 2;

export interface QuotaResult {
  allowed: boolean;
  remainingThisMonth: number;
  reason?: "monthly_exhausted" | "hourly_exhausted";
  retryAfterMinutes?: number; // لو اترفض بسبب الحد الساعي، تقول له يستنى قد إيه
}

export async function checkAndConsumeAIRefreshQuota(
  userId: string
): Promise<QuotaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      aiRefreshMonthlyCount: true,
      aiRefreshMonthlyReset: true,
      aiRefreshHourlyCount: true,
      aiRefreshHourlyReset: true,
    },
  });

  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 كان السقف رقماً واحداً (80) لكلّ المشتركين، فباقة `free` المُعلَن
  // فيها صفر تحليلات كانت تحصل على ثمانين، ورصيد الكريدت المشترى لا
  // يُخصَم منه شيء أبداً. أي أنّ الباقات كانت معروضة بحدود غير موجودة.
  // `checkCredits` هي مصدر الحقيقة لحساب «مخصّص الباقة + المشترى». كتابة
  // الحساب هنا مرّة ثانية تعني رقمين يفترقان عند أوّل تعديل في الباقات.
  const credits = await checkCredits(userId, 0);
  // 🔴 كان `Math.min(MONTHLY_LIMIT, credits.left)`: سقف مسطّح ٨٠ فوق كلّ
  // باقة. فباقة Agency تَعِد بستّمئة تحليل وتُسلّم ثمانين - أي أنّ ما يدفع
  // فيه العميل رقمٌ لا يصل إليه. الرصيد المُعلَن صار هو الرصيد الفعليّ.
  //
  // الحماية من الاستنزاف لم تسقط، انتقلت إلى محلّها: حدّ **معدّل** بالساعة
  // (تحت) يوقف الحلقة الجامحة، بينما السقف الشهريّ يحترم ما بيع فعلاً.
  const effectiveMonthly = credits.left;

  const now = new Date();

  // ==== إعادة ضبط العداد الشهري لو دخلنا شهر جديد ====
  const isNewMonth =
    now.getMonth() !== user.aiRefreshMonthlyReset.getMonth() ||
    now.getFullYear() !== user.aiRefreshMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.aiRefreshMonthlyCount;

  if (monthlyCount >= effectiveMonthly) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  // ==== إعادة ضبط العداد الساعي لو عدت الساعة ====
  const hourDiffMs = now.getTime() - user.aiRefreshHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.aiRefreshHourlyCount;

  if (hourlyCount >= HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil(
      (60 * 60 * 1000 - hourDiffMs) / 60000
    );
    return {
      allowed: false,
      remainingThisMonth: effectiveMonthly - monthlyCount,
      reason: "hourly_exhausted",
      retryAfterMinutes,
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiRefreshMonthlyCount: monthlyCount + 1,
      aiRefreshMonthlyReset: isNewMonth ? now : user.aiRefreshMonthlyReset,
      aiRefreshHourlyCount: hourlyCount + 1,
      aiRefreshHourlyReset: isNewHour ? now : user.aiRefreshHourlyReset,
    },
  });

  // الخصم من الرصيد المشترى يبدأ بعد نفاد مخصّص الباقة وحده - وإلّا كان
  // المستخدم يدفع ثمن رصيد إضافي لا يُستهلك.
  await consumePurchasedCreditIfNeeded(userId, monthlyCount + 1);

  return {
    allowed: true,
    remainingThisMonth: effectiveMonthly - (monthlyCount + 1),
  };
}

// ==================== فحص جودة صور الإعلانات ====================
// كانت من غير أي حد أقصى خالص - ثغرة مالية حقيقية. 30/شهر، 5/ساعة
// (سقف أعلى نسبياً - فحص إعلانات كتير مرة واحدة استخدام شرعي متوقّع)
const IMAGE_QUALITY_MONTHLY_LIMIT = 30;
const IMAGE_QUALITY_HOURLY_LIMIT = 5;

export async function checkAndConsumeImageQualityQuota(userId: string): Promise<QuotaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      imageQualityMonthlyCount: true,
      imageQualityMonthlyReset: true,
      imageQualityHourlyCount: true,
      imageQualityHourlyReset: true,
    },
  });
  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 كان السقف رقماً واحداً (80) لكلّ المشتركين، فباقة `free` المُعلَن
  // فيها صفر تحليلات كانت تحصل على ثمانين، ورصيد الكريدت المشترى لا
  // يُخصَم منه شيء أبداً. أي أنّ الباقات كانت معروضة بحدود غير موجودة.
  // `checkCredits` هي مصدر الحقيقة لحساب «مخصّص الباقة + المشترى». كتابة
  // الحساب هنا مرّة ثانية تعني رقمين يفترقان عند أوّل تعديل في الباقات.
  const credits = await checkCredits(userId, 0);
  const effectiveMonthly = Math.min(MONTHLY_LIMIT, credits.left);

  const now = new Date();
  const isNewMonth =
    now.getMonth() !== user.imageQualityMonthlyReset.getMonth() ||
    now.getFullYear() !== user.imageQualityMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.imageQualityMonthlyCount;

  if (monthlyCount >= IMAGE_QUALITY_MONTHLY_LIMIT) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  const hourDiffMs = now.getTime() - user.imageQualityHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.imageQualityHourlyCount;

  if (hourlyCount >= IMAGE_QUALITY_HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil((60 * 60 * 1000 - hourDiffMs) / 60000);
    return { allowed: false, remainingThisMonth: IMAGE_QUALITY_MONTHLY_LIMIT - monthlyCount, reason: "hourly_exhausted", retryAfterMinutes };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      imageQualityMonthlyCount: monthlyCount + 1,
      imageQualityMonthlyReset: isNewMonth ? now : user.imageQualityMonthlyReset,
      imageQualityHourlyCount: hourlyCount + 1,
      imageQualityHourlyReset: isNewHour ? now : user.imageQualityHourlyReset,
    },
  });

  return { allowed: true, remainingThisMonth: IMAGE_QUALITY_MONTHLY_LIMIT - (monthlyCount + 1) };
}

// ==================== الفحص العميق لصفحة الهبوط ====================
// كانت من غير أي حد أقصى خالص - أغلى ميزة بالمشروع (4 نداءات Claude
// لكل فحص). 5/شهر، 1/ساعة (فحص عميق فعل نادر ومقصود، مش حاجة تتكرر)
// 🔴 كان رقماً مسطّحاً (5) للجميع، بينما `deepScans` في `PlanLimits` تعطي
// Agency عشرين وPro خمسةً وStarter صفراً. باقةٌ تَعِد بعشرين وتُسلّم خمسةً
// هي الحدّ نفسه الذي أصلحناه في مساحات العمل، في ميزةٍ أغلى: كلّ فحص نداءُ
// ذكاءٍ اصطناعيّ بصور. الحدّ يُقرأ من الباقة الآن.
//
// ولا يُخصَم من رصيد التحليلات: الفحص العميق ميزةٌ بحدّها الخاصّ في جدول
// الباقات، فخصمه من رصيدٍ آخر يعني أنّ استعمال ميزةٍ يستهلك حصّة ميزةٍ
// أخرى - وهو ما لا تقوله صفحة الباقات لأحد.

const SITE_SCAN_HOURLY_LIMIT = 1;

export async function checkAndConsumeSiteScanQuota(userId: string): Promise<QuotaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      siteScanMonthlyCount: true,
      siteScanMonthlyReset: true,
      siteScanHourlyCount: true,
      siteScanHourlyReset: true,
    },
  });
  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 كان السقف رقماً واحداً (80) لكلّ المشتركين، فباقة `free` المُعلَن
  // فيها صفر تحليلات كانت تحصل على ثمانين، ورصيد الكريدت المشترى لا
  // يُخصَم منه شيء أبداً. أي أنّ الباقات كانت معروضة بحدود غير موجودة.
  // `checkCredits` هي مصدر الحقيقة لحساب «مخصّص الباقة + المشترى». كتابة
  // الحساب هنا مرّة ثانية تعني رقمين يفترقان عند أوّل تعديل في الباقات.
  const { limits } = await getEntitlements(userId);
  const monthlyLimit = limits.deepScans;

  const now = new Date();
  const isNewMonth =
    now.getMonth() !== user.siteScanMonthlyReset.getMonth() ||
    now.getFullYear() !== user.siteScanMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.siteScanMonthlyCount;

  if (monthlyCount >= monthlyLimit) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  const hourDiffMs = now.getTime() - user.siteScanHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.siteScanHourlyCount;

  if (hourlyCount >= SITE_SCAN_HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil((60 * 60 * 1000 - hourDiffMs) / 60000);
    return { allowed: false, remainingThisMonth: monthlyLimit - monthlyCount, reason: "hourly_exhausted", retryAfterMinutes };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      siteScanMonthlyCount: monthlyCount + 1,
      siteScanMonthlyReset: isNewMonth ? now : user.siteScanMonthlyReset,
      siteScanHourlyCount: hourlyCount + 1,
      siteScanHourlyReset: isNewHour ? now : user.siteScanHourlyReset,
    },
  });

  return { allowed: true, remainingThisMonth: monthlyLimit - (monthlyCount + 1) };
}

/**
 * الاستهلاك الشهري الحالي - للعرض في صفحة الاشتراك لا للتحكّم.
 *
 * يُعيد صفراً بعد بداية شهر جديد حتى قبل أن يستدعي المستخدم شيئاً: العدّاد
 * لا يُصفَّر إلا عند أوّل استهلاك فعلي، فقراءته الخام تعرض رقم الشهر
 * الماضي على من لم يستخدم شيئاً بعد.
 */
export async function getMonthlyAiUsage(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiRefreshMonthlyCount: true, aiRefreshMonthlyReset: true },
  });
  if (!user) return 0;

  const now = new Date();
  const reset = user.aiRefreshMonthlyReset;
  if (reset && (reset.getMonth() !== now.getMonth() || reset.getFullYear() !== now.getFullYear())) {
    return 0;
  }
  return user.aiRefreshMonthlyCount ?? 0;
}
