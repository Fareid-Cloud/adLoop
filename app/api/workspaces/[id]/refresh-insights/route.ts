// app/api/workspaces/[id]/refresh-insights/route.ts
//
// الزرار اللي المستخدم بيدوس عليه لو عايز رأي فوري من الـ AI، بدل ما يستنى
// الـ cron اليومي. محمي بحد أقصى يومي (aiRateLimit.ts) عشان محدش يقدر
// يستهلك فلوس بلا حدود.

import { NextRequest, NextResponse } from "next/server";
import { toUserFacingAiError, quotaExhaustedError } from "@/lib/aiErrors";
import { checkAndConsumeAIRefreshQuota } from "@/lib/aiRateLimit";
import { generateInsights, buildCampaignSummaries } from "@/lib/aiInsights";
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
    if (quota.reason === "monthly_exhausted") {
      // حصة المستخدم الشهرية - حالة مشروعة يُعرض معها خيار الترقية
      const e = quotaExhaustedError();
      return NextResponse.json(
        { error: locale === "ar" ? e.messageAr : e.messageEn, kind: e.kind, showUpgrade: true },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: t(locale, "aiQuota.hourlyExhausted", { minutes: quota.retryAfterMinutes ?? 0 }), showUpgrade: false },
      { status: 429 }
    );
  }

  // إصلاح باگ حقيقي: الزرار ده كان بيستهلك رصيد المستخدم المحدود يومياً
  // ويولّد رأي من مصفوفة فاضية تماماً - كل دوسة كانت بتضيّع رصيد وترجع
  // نتيجة بلا معنى. بقى بيجيب بيانات حقيقية، نفس نمط نسخة الكرون اليومي
  // في dailyTasks.ts (تجميع حسب المنصة آخر 7 أيام).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const campaigns = await buildCampaignSummaries(workspace.id, sevenDaysAgo);

  if (campaigns.length === 0) {
    // مفيش بيانات كافية لسه - رجوع رأي حقيقي فاضي أحسن من استدعاء AI
    // على بيانات فاضية (نفس حماية generateAITask في النسخة اليومية)
    return NextResponse.json({
      whatsWorking: [],
      whatsLeaking: [],
      nextAction: locale === "ar" ? "لا توجد بيانات كافية خلال آخر ٧ أيام — اربط حملاتك ودع البيانات تتراكم." : "Not enough data in the last 7 days yet - link your campaigns and let data accumulate.",
    });
  }

  // بلا هذا الالتفاف كانت استجابة المزوّد الخام تصل إلى المشترك كما هي،
  // بما فيها رسائل الفوترة الخاصة بحسابنا ومعرّف الطلب الداخلي.
  try {
    const insights = await generateInsights(campaigns, locale);
    return NextResponse.json({
      insights,
      remainingThisMonth: quota.remainingThisMonth,
    });
  } catch (err) {
    const e = toUserFacingAiError(err, "refresh-insights");
    return NextResponse.json(
      { error: locale === "ar" ? e.messageAr : e.messageEn, kind: e.kind, showUpgrade: e.showUpgrade },
      { status: 503 }
    );
  }
}
