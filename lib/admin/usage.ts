// lib/admin/usage.ts
//
// مراقبة الاستهلاك والتكلفة - **قراءة على عدّادات موجودة، مش قياس جديد.**
//
// كل رقم هنا بيتكتب أصلاً من `lib/aiRateLimit.ts` و`lib/usageCaps.ts` مع
// كل نداء حقيقي. الملف ده بيجمّعهم ويقارنهم بالمخصّص، وبيضيف حاجتين
// مالهمش وجود قبل كده: **الترند** (من `AdminUsageSnapshot` اليومية) و
// **الشذوذ** (حساب استهلاكه اليوم مقابل متوسّطه هو).
//
// ⚠️ **قيد معماريّ مذكور صراحة:** الاستهلاك مقيس **على مستوى الحساب لا
// مساحة العمل** - وده قرار قديم مقصود (الحدّ على المساحة معناه إن أي حد
// يعمل عشر مساحات فاضية وياخد عشرة أضعاف الرصيد). يعني "الاستهلاك لكل
// مساحة عمل" **غير متاح للذكاء الاصطناعي**، ومتاح للإنفاق الإعلاني بس
// (`MetricSnapshot` فعلاً لكل مساحة). مانعرضش تقدير مكانه.

import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";
import { MONTHLY_LIMIT } from "@/lib/aiRateLimit";
import { dayKey } from "./shared";

/**
 * أقصى عدد توكنات لكل نوع نداء - **من `max_tokens` المكتوبة في الكود
 * نفسه**، موثّقة في `docs/claude-api-usage-map.md`.
 *
 * دي حدّ أعلى مش استهلاك فعليّ: النداء بيرجّع أقلّ من السقف عادةً. اسمها
 * `CEILING` عشان مايتقريش كأنّه قياس.
 */
export const TOKEN_CEILING = {
  /** aiInsights.generateInsights + مربّع السؤال */
  aiRefresh: 1_000,
  /** imageQualityAudit - Vision، فالمدخل أكبر من السقف ده بكتير */
  imageQuality: 800,
  /** الفحص العميق: حتى 3 نداءات × 3000 + تلخيص 2500 */
  siteScan: 14_500,
} as const;

/**
 * سعر المليون توكن بالدولار - **من متغيّر بيئة، مش رقم مكتوب هنا.**
 *
 * أسعار النماذج بتتغيّر، ورقم قديم مدفون في الكود بيدّي تكلفة غلط بثقة
 * كاملة. لو المتغيّر مش مضبوط، اللوحة بتعرض حجم التوكنات وبتقول إنّ
 * التكلفة محتاجة ضبط - مش بتخمّن.
 */
export function costPerMTokUsd(): number | null {
  const raw = process.env.CLAUDE_COST_PER_MTOK_USD;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface AccountUsage {
  userId: string;
  email: string;
  plan: string;
  aiRefreshMonthly: number;
  imageQualityMonthly: number;
  siteScanMonthly: number;
  creditsPurchased: number;
  /** مخصّص الباقة من الكريدت - المقام في "س من ص" */
  creditAllowance: number;
  deepScanAllowance: number;
  spendUsd: number;
  verifiedConv: number;
  warnedAt: Date | null;
  blockedAt: Date | null;
  estimatedTokens: number;
  estimatedCostUsd: number | null;
}

function estimateTokens(u: { aiRefreshMonthlyCount: number; imageQualityMonthlyCount: number; siteScanMonthlyCount: number }): number {
  return (
    u.aiRefreshMonthlyCount * TOKEN_CEILING.aiRefresh +
    u.imageQualityMonthlyCount * TOKEN_CEILING.imageQuality +
    u.siteScanMonthlyCount * TOKEN_CEILING.siteScan
  );
}

function tokensToUsd(tokens: number): number | null {
  const price = costPerMTokUsd();
  return price === null ? null : (tokens / 1_000_000) * price;
}

/** استهلاك حساب واحد مقابل مخصّصه - قلب تبويب "Usage & Limits" */
export async function getAccountUsage(userId: string): Promise<AccountUsage | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, subscriptionPlan: true,
      aiRefreshMonthlyCount: true, imageQualityMonthlyCount: true, siteScanMonthlyCount: true,
      aiCreditsPurchased: true, usageSpendUsd: true, usageVerifiedConv: true,
      usageWarnedAt: true, usageBlockedAt: true,
    },
  });
  if (!u) return null;

  const ent = await getEntitlements(userId);
  const tokens = estimateTokens(u);

  return {
    userId: u.id,
    email: u.email,
    plan: u.subscriptionPlan ?? "free",
    aiRefreshMonthly: u.aiRefreshMonthlyCount,
    imageQualityMonthly: u.imageQualityMonthlyCount,
    siteScanMonthly: u.siteScanMonthlyCount,
    creditsPurchased: u.aiCreditsPurchased,
    creditAllowance: ent.limits.aiCredits,
    deepScanAllowance: ent.limits.deepScans,
    spendUsd: u.usageSpendUsd,
    verifiedConv: u.usageVerifiedConv,
    warnedAt: u.usageWarnedAt,
    blockedAt: u.usageBlockedAt,
    estimatedTokens: tokens,
    estimatedCostUsd: tokensToUsd(tokens),
  };
}

export interface UsageOverview {
  totalAiCalls: number;
  totalEstimatedTokens: number;
  totalEstimatedCostUsd: number | null;
  costConfigured: boolean;
  /** السقف الصلب لكل مستخدم على زرّ التحديث - مرجع الشريط */
  monthlyLimitPerUser: number;
  topConsumers: Array<{
    userId: string; email: string; plan: string;
    calls: number; tokens: number; costUsd: number | null;
  }>;
  /** حسابات لمست تنبيه الاقتراب أو التوقّف في آخر 30 يوم */
  nearOrOverCap: Array<{ userId: string; email: string; warnedAt: Date | null; blockedAt: Date | null }>;
  anomalies: UsageAnomaly[];
  trend: Array<{ date: string; aiRefresh: number; imageQuality: number; siteScan: number }>;
  /** الملاحظة اللي لازم تظهر جنب أي رقم "لكل مساحة عمل" */
  perWorkspaceNote: string;
}

export interface UsageAnomaly {
  userId: string;
  email: string;
  /** استهلاك اليوم مقابل متوسّطه هو - مش مقابل متوسّط الكل */
  todayCalls: number;
  averageCalls: number;
  multiple: number;
}

/**
 * الشذوذ = استهلاك حساب اليوم مقابل **متوسّطه هو** لا متوسّط الجميع.
 *
 * المقارنة بمتوسّط الجميع بتوسم كل عميل كبير كشاذّ كل يوم، فالتنبيه
 * بيتحوّل لضوضاء بيتعوّد المالك على تجاهلها - وده بالظبط اليوم اللي
 * بيحصل فيه استهلاك حقيقي غير طبيعي.
 */
const ANOMALY_MULTIPLE = 3;
const ANOMALY_MIN_CALLS = 5;

export async function getUsageOverview(days = 30): Promise<UsageOverview> {
  const since = new Date(Date.now() - days * 86_400_000);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { aiRefreshMonthlyCount: { gt: 0 } },
        { imageQualityMonthlyCount: { gt: 0 } },
        { siteScanMonthlyCount: { gt: 0 } },
      ],
    },
    select: {
      id: true, email: true, subscriptionPlan: true,
      aiRefreshMonthlyCount: true, imageQualityMonthlyCount: true, siteScanMonthlyCount: true,
    },
  });

  let totalAiCalls = 0;
  let totalEstimatedTokens = 0;
  const consumers = users.map((u) => {
    const calls = u.aiRefreshMonthlyCount + u.imageQualityMonthlyCount + u.siteScanMonthlyCount;
    const tokens = estimateTokens(u);
    totalAiCalls += calls;
    totalEstimatedTokens += tokens;
    return {
      userId: u.id, email: u.email, plan: u.subscriptionPlan ?? "free",
      calls, tokens, costUsd: tokensToUsd(tokens),
    };
  });
  consumers.sort((a, z) => z.tokens - a.tokens);

  const nearOrOver = await prisma.user.findMany({
    where: { OR: [{ usageWarnedAt: { gte: since } }, { usageBlockedAt: { gte: since } }] },
    select: { id: true, email: true, usageWarnedAt: true, usageBlockedAt: true },
    orderBy: { usageBlockedAt: "desc" },
    take: 25,
  });

  const snapshots = await prisma.adminUsageSnapshot.findMany({
    where: { date: { gte: since } },
    select: {
      date: true, userId: true,
      aiRefreshCount: true, imageQualityCount: true, siteScanCount: true,
    },
    orderBy: { date: "asc" },
  });

  const trendMap = new Map<string, { aiRefresh: number; imageQuality: number; siteScan: number }>();
  const perUser = new Map<string, number[]>();
  for (const s of snapshots) {
    const k = dayKey(s.date);
    const t = trendMap.get(k) ?? { aiRefresh: 0, imageQuality: 0, siteScan: 0 };
    t.aiRefresh += s.aiRefreshCount;
    t.imageQuality += s.imageQualityCount;
    t.siteScan += s.siteScanCount;
    trendMap.set(k, t);

    const arr = perUser.get(s.userId) ?? [];
    arr.push(s.aiRefreshCount + s.imageQualityCount + s.siteScanCount);
    perUser.set(s.userId, arr);
  }

  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const anomalies: UsageAnomaly[] = [];
  for (const [userId, series] of perUser) {
    if (series.length < 4) continue; // تاريخ أقصر من كده مايبنيش متوسّط
    const today = series[series.length - 1];
    const past = series.slice(0, -1);
    const avg = past.reduce((s, v) => s + v, 0) / past.length;
    if (today < ANOMALY_MIN_CALLS || avg <= 0) continue;
    const multiple = today / avg;
    if (multiple >= ANOMALY_MULTIPLE) {
      anomalies.push({
        userId,
        email: emailById.get(userId) ?? userId,
        todayCalls: today,
        averageCalls: Math.round(avg * 10) / 10,
        multiple: Math.round(multiple * 10) / 10,
      });
    }
  }
  anomalies.sort((a, z) => z.multiple - a.multiple);

  return {
    totalAiCalls,
    totalEstimatedTokens,
    totalEstimatedCostUsd: tokensToUsd(totalEstimatedTokens),
    costConfigured: costPerMTokUsd() !== null,
    monthlyLimitPerUser: MONTHLY_LIMIT,
    topConsumers: consumers.slice(0, 15),
    nearOrOverCap: nearOrOver.map((u) => ({
      userId: u.id, email: u.email, warnedAt: u.usageWarnedAt, blockedAt: u.usageBlockedAt,
    })),
    anomalies: anomalies.slice(0, 15),
    trend: [...trendMap.entries()].map(([date, t]) => ({ date, ...t })),
    perWorkspaceNote:
      "AI and credit consumption is metered per account, not per workspace — by design, so empty workspaces can't multiply an allowance. Ad spend is genuinely per-workspace and is shown that way.",
  };
}

/**
 * لقطة استهلاك اليوم - يناديها الكرون اليوميّ.
 *
 * **بتتكتب قبل أي تصفير، وبـ`upsert` مش `create`:** الكرون ممكن يتشغّل
 * مرّتين في نفس اليوم (إعادة محاولة يدوية مثلاً)، والـ`create` كان هيكسر
 * على قيد التفرّد ويوقّف باقي الحلقة.
 */
export async function captureUsageSnapshots(): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { aiRefreshMonthlyCount: { gt: 0 } },
        { imageQualityMonthlyCount: { gt: 0 } },
        { siteScanMonthlyCount: { gt: 0 } },
        { usageSpendUsd: { gt: 0 } },
      ],
    },
    select: {
      id: true, aiRefreshMonthlyCount: true, imageQualityMonthlyCount: true,
      siteScanMonthlyCount: true, aiCreditsPurchased: true,
      usageSpendUsd: true, usageVerifiedConv: true,
    },
  });

  let written = 0;
  for (const u of users) {
    const data = {
      aiRefreshCount: u.aiRefreshMonthlyCount,
      imageQualityCount: u.imageQualityMonthlyCount,
      siteScanCount: u.siteScanMonthlyCount,
      aiCreditsLeft: u.aiCreditsPurchased,
      spendUsd: u.usageSpendUsd,
      verifiedConv: u.usageVerifiedConv,
    };
    try {
      await prisma.adminUsageSnapshot.upsert({
        where: { userId_date: { userId: u.id, date: today } },
        create: { userId: u.id, date: today, ...data },
        update: data,
      });
      written += 1;
    } catch (err) {
      console.error(`[adminUsage] فشل تسجيل لقطة استهلاك للمستخدم ${u.id}`, err);
    }
  }
  return written;
}
