// lib/aiRateLimit.ts
//
// رصيد شهري (150 مرة، تقريباً 5/يوم بالمتوسط)، بس موزّع بحد أقصى ساعي
// (مرتين في الساعة) عشان محدش يستهلك الرصيد كله دفعة واحدة في نص ساعة
// ويفضل من غير أي رصيد لباقي الشهر. لو حد محتاجها فعلاً أكتر، بيقدر
// يستنى شوية بدل ما نمنعه نهائياً.

import { prisma } from "@/lib/prisma";

// إعادة معايرة عشان نضمن سقف $4/شهر إجمالي لكل مشترك عبر التلاتة ميزات
// اللي بتستخدم Claude (راجع docs/claude-api-usage-map.md للحساب الكامل)
// الحد اليدوي = 80 مرة شهرياً + استدعاء تلقائي واحد يومياً (Cron) = 20-30/شهر تقريباً
const MONTHLY_LIMIT = 80;
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

  const now = new Date();

  // ==== إعادة ضبط العداد الشهري لو دخلنا شهر جديد ====
  const isNewMonth =
    now.getMonth() !== user.aiRefreshMonthlyReset.getMonth() ||
    now.getFullYear() !== user.aiRefreshMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.aiRefreshMonthlyCount;

  if (monthlyCount >= MONTHLY_LIMIT) {
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
      remainingThisMonth: MONTHLY_LIMIT - monthlyCount,
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

  return {
    allowed: true,
    remainingThisMonth: MONTHLY_LIMIT - (monthlyCount + 1),
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
const SITE_SCAN_MONTHLY_LIMIT = 5;
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

  const now = new Date();
  const isNewMonth =
    now.getMonth() !== user.siteScanMonthlyReset.getMonth() ||
    now.getFullYear() !== user.siteScanMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.siteScanMonthlyCount;

  if (monthlyCount >= SITE_SCAN_MONTHLY_LIMIT) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  const hourDiffMs = now.getTime() - user.siteScanHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.siteScanHourlyCount;

  if (hourlyCount >= SITE_SCAN_HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil((60 * 60 * 1000 - hourDiffMs) / 60000);
    return { allowed: false, remainingThisMonth: SITE_SCAN_MONTHLY_LIMIT - monthlyCount, reason: "hourly_exhausted", retryAfterMinutes };
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

  return { allowed: true, remainingThisMonth: SITE_SCAN_MONTHLY_LIMIT - (monthlyCount + 1) };
}
