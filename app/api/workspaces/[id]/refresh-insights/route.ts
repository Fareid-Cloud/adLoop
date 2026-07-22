// app/api/workspaces/[id]/refresh-insights/route.ts
//
// الزرار اللي المستخدم بيدوس عليه لو عايز رأي فوري من الـ AI، بدل ما يستنى
// الـ cron اليومي. محمي بحد أقصى يومي (aiRateLimit.ts) عشان محدش يقدر
// يستهلك فلوس بلا حدود.

import { NextRequest, NextResponse } from "next/server";
import { checkAndConsumeAIRefreshQuota } from "@/lib/aiRateLimit";
import { generateInsights } from "@/lib/aiInsights";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { t, Locale } from "@/lib/i18n/dictionary";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // إصلاح أمني: كان الـ endpoint بيستهلك رصيد المستخدم من غير ما يتأكد
  // إن الـ Workspace ده فعلاً بتاعه - نمط خطر، خصوصاً وقت ما البيانات
  // الحقيقية تتوصل (الـ TODO تحت) بدل المصفوفة الفاضية الآن
  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const locale = (user.preferredLocale as Locale) ?? "ar";

  // الحد بيتحسب على مستوى الحساب (User) ككل، مش على الـ Workspace -
  // عشان محدش يقدر يعمل عشرات الـ Workspaces الفاضية ويضاعف رصيده
  const quota = await checkAndConsumeAIRefreshQuota(user.id);

  if (!quota.allowed) {
    const message =
      quota.reason === "monthly_exhausted"
        ? t(locale, "aiQuota.monthlyExhausted")
        : t(locale, "aiQuota.hourlyExhausted", { minutes: quota.retryAfterMinutes ?? 0 });

    return NextResponse.json({ error: message }, { status: 429 });
  }

  // إصلاح باگ حقيقي: الزرار ده كان بيستهلك رصيد المستخدم المحدود يومياً
  // ويولّد رأي من مصفوفة فاضية تماماً - كل دوسة كانت بتضيّع رصيد وترجع
  // نتيجة بلا معنى. بقى بيجيب بيانات حقيقية، نفس نمط نسخة الكرون اليومي
  // في dailyTasks.ts (تجميع حسب المنصة آخر 7 أيام).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const campaignAgg = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId: workspace.id, date: { gte: sevenDaysAgo } },
    _sum: { cost: true, verifiedConversions: true, rawConversions: true },
  });

  const campaigns = campaignAgg.map((c: any) => ({
    platform: c.platform,
    campaignName: c.platform,
    cost: c._sum.cost ?? 0,
    cplVerified: c._sum.verifiedConversions > 0 ? (c._sum.cost ?? 0) / c._sum.verifiedConversions : undefined,
  }));

  if (campaigns.length === 0) {
    // مفيش بيانات كافية لسه - رجوع رأي حقيقي فاضي أحسن من استدعاء AI
    // على بيانات فاضية (نفس حماية generateAITask في النسخة اليومية)
    return NextResponse.json({
      whatsWorking: [],
      whatsLeaking: [],
      nextAction: locale === "ar" ? "لسه مفيش بيانات كافية آخر 7 أيام - اربط حملاتك وسيب البيانات تتراكم." : "Not enough data in the last 7 days yet - link your campaigns and let data accumulate.",
    });
  }

  const insights = await generateInsights(campaigns, locale);

  return NextResponse.json({
    insights,
    remainingThisMonth: quota.remainingThisMonth,
  });
}
