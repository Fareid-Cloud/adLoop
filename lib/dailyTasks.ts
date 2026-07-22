// lib/dailyTasks.ts
//
// بيولّد قائمة يومية ذكية لكل Workspace - مش تذكير سطحي، لكن حاجات فعلاً
// بتتنسى وسط الزحمة وبتكلف فلوس لو اتأجلت. طبقتين:
// 1) قواعد ثابتة (Rule-Based) - أساسيات PPC كل ميديا باير المفروض يراجعها بدورية معينة
// 2) اكتشاف تلقائي (AI-Detected) - انحرافات في البيانات مش متوقعة

import { prisma } from "@/lib/prisma";
import { t, Locale } from "@/lib/i18n/dictionary";
import { detectAnomaly } from "@/lib/anomalyDetection";
import { CampaignSummary } from "@/lib/aiInsights";
import { shouldSendEmail, sendUrgentNotificationEmail } from "@/lib/notifications";
import { countDisapprovedGoogleAds } from "@/lib/syncGoogleAds";
import { checkAndConsumeAIRefreshQuota } from "@/lib/aiRateLimit";
import { getFrequencyByPlatform } from "@/lib/frequencyCheck";
interface RuleCheckContext {
  workspaceId: string;
  lastSearchTermsReview: Date | null;
  lastNegativeKeywordsUpdate: Date | null;
  daysIntoMonth: number;
  budgetSpentPct: number; // % من ميزانية الشهر المصروفة لحد دلوقتي
  monthProgressPct: number; // % من الشهر اللي عدى (يوم 15 من 30 = 50%)
  frequencyByPlatform: Record<string, number>; // متوسط Frequency لآخر 7 أيام
  disapprovedAdsCount: number;
  verifiedConversionsYesterday: number;
  verifiedConversionsAvgLast7Days: number;
  // ==== AI Conversion Doctor - فحوصات إضافية ====
  ctrToday: number | null;
  // آخر 30 يوم من CTR اليومي (بدون اليوم النهاردة) - بيُستخدم كخط أساس
  // إحصائي خاص بالحساب ده تحديداً، بدل نسبة انخفاض ثابتة لكل الحسابات
  ctrHistory: number[];
  clicksButZeroTagFires: boolean; // كليكات مسجلة عند المنصة، لكن صفر إشارات وصلت لنظام التتبع بتاعنا - مؤشر تاج بايظ
  landingPageLoadTimeSeconds: number | null;
}

// ==================== المُنسّق اليومي - الحلقة المفقودة ====================
// اكتشاف حرج من المراجعة الشاملة: كل الدوال فوق كانت موجودة ومكتوبة صح،
// لكن محدش كان بينده عليها بأي بيانات حقيقية - يعني DailyTask ماكانتش
// هتتعمل تلقائياً أبداً في نشر حقيقي. الدالة دي هي "الغراء" الناقص.
//
// أمانة صريحة: بعض الحقول في RuleCheckContext (تردد الظهور Frequency،
// عدد الإعلانات المرفوضة، سرعة تحميل الصفحة، تاريخ آخر مراجعة search
// terms) معندناش مصدر بيانات فعلي ليها لسه - مش موجودة في أي مزامنة.
// بنمررها بقيم افتراضية آمنة (null/فاضية) بدل ما نخترعها، والفحوصات
// المرتبطة بيها ببساطة مش هتتفعّل لحد ما نبني مصدر البيانات ده - أوضح
// من إننا نظهر بيانات وهمية.

export async function runDailyDiagnosticsForWorkspace(workspaceId: string, locale: Locale = "ar") {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.enableDailyDiagnostics) return;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [yesterdaySnap, last7DaysAgg, last30DaysSnaps, yesterdayClicksAgg, yesterdayTagFires] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { equals: new Date(yesterday.toISOString().slice(0, 10)) } },
      _sum: { verifiedConversions: true },
    }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: sevenDaysAgo } },
      _sum: { verifiedConversions: true },
    }),
    prisma.metricSnapshot.findMany({
      where: { workspaceId, date: { gte: thirtyDaysAgo } },
      select: { date: true, clicks: true, impressions: true, cost: true },
    }),
    // مقارنة كليكات المنصة بإشارات التتبع الواردة فعلاً - لو المنصة
    // بتقول فيه كليكات كتير وصفر إشارة وصلتنا، ده مؤشر تاج بايظ حقيقي
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { equals: new Date(yesterday.toISOString().slice(0, 10)) } },
      _sum: { clicks: true },
    }),
    prisma.ctaClickEvent.count({
      where: { workspaceId, clickedAt: { gte: yesterday, lt: today } },
    }),
  ]);

  // تجميع CTR اليومي من بيانات فعلية موجودة عندنا فعلاً (clicks/impressions)
  const ctrByDate = new Map<string, { clicks: number; impressions: number }>();
  for (const s of last30DaysSnaps) {
    const key = s.date.toISOString().slice(0, 10);
    const existing = ctrByDate.get(key) ?? { clicks: 0, impressions: 0 };
    existing.clicks += s.clicks;
    existing.impressions += s.impressions;
    ctrByDate.set(key, existing);
  }
  const ctrHistory = Array.from(ctrByDate.values())
    .filter((d) => d.impressions > 0)
    .map((d) => (d.clicks / d.impressions) * 100);
  const todayKey = today.toISOString().slice(0, 10);
  const todayData = ctrByDate.get(todayKey);
  const ctrToday = todayData && todayData.impressions > 0 ? (todayData.clicks / todayData.impressions) * 100 : null;

  // وتيرة الميزانية - بس لو المستخدم حدد هدف ميزانية شهري فعلي في الإعدادات
  const daysIntoMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgressPct = (daysIntoMonth / daysInMonth) * 100;

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthCostAgg = workspace.monthlyBudgetTarget
    ? await prisma.metricSnapshot.aggregate({
        where: { workspaceId, date: { gte: monthStart } },
        _sum: { cost: true },
      })
    : null;
  const budgetSpentPct =
    workspace.monthlyBudgetTarget && monthCostAgg
      ? ((monthCostAgg._sum.cost ?? 0) / workspace.monthlyBudgetTarget) * 100
      : monthProgressPct; // من غير هدف محدد، منقدرش نحكم - بنخلي الفحص محايد بدل ما يطلّع تنبيه غلط

  // إصلاح TODO حقيقي: كانت 0 ثابت دايماً. جوجل بس دلوقتي (مؤكدة رسمياً)
  // - ميتا وتيك توك عندهم مفهوم رفض إعلانات مختلف، محتاج بحث منفصل
  const disapprovedAdsCount = await countDisapprovedGoogleAds(workspaceId);
  const frequencyByPlatform = await getFrequencyByPlatform(workspaceId);

  // عتبة 20 كليك - عينة كافية تستبعد الصدفة (يوم هادئ جداً)، مش رقم
  // عشوائي، نفس فلسفة "حد أدنى للعينة" المستخدمة في أماكن تانية بالمشروع
  const yesterdayClicks = yesterdayClicksAgg._sum.clicks ?? 0;
  const clicksButZeroTagFires = yesterdayClicks >= 20 && yesterdayTagFires === 0;

  const ctx: RuleCheckContext = {
    workspaceId,
    lastSearchTermsReview: workspace?.lastSearchTermsReviewAt ?? null,
    lastNegativeKeywordsUpdate: null, // TODO: يحتاج ميزة إضافة كلمات سلبية فعلية (لسه مش مبنية) قبل ما يبقى له معنى
    daysIntoMonth,
    budgetSpentPct,
    monthProgressPct,
    frequencyByPlatform,
    disapprovedAdsCount,
    verifiedConversionsYesterday: yesterdaySnap._sum.verifiedConversions ?? 0,
    verifiedConversionsAvgLast7Days: (last7DaysAgg._sum.verifiedConversions ?? 0) / 7,
    ctrToday,
    ctrHistory,
    clicksButZeroTagFires,
    landingPageLoadTimeSeconds: null, // TODO: يحتاج تكامل مع خدمة قياس سرعة الصفحة
  };

  const ruleTasks = generateRuleBasedTasks(ctx, locale);

  let aiTasks: Array<{ title: string; category: string; priority: string }> = [];
  if (workspace.enableAIInsights) {
    const campaignAgg = await prisma.metricSnapshot.groupBy({
      by: ["platform"],
      where: { workspaceId, date: { gte: sevenDaysAgo } },
      _sum: { cost: true, verifiedConversions: true, rawConversions: true },
    });
    const summaries: CampaignSummary[] = campaignAgg.map((c: any) => ({
      platform: c.platform,
      campaignName: c.platform,
      cost: c._sum.cost ?? 0,
      cplVerified: c._sum.verifiedConversions > 0 ? (c._sum.cost ?? 0) / c._sum.verifiedConversions : undefined,
    }));
    // 🔴 إصلاح ثغرة مالية حقيقية: الاستدعاء التلقائي ده كان بيتنفّذ من غير
    // أي حد أقصى خالص - لو المستخدم عنده كذا Workspace، كل واحد كان بيستهلك
    // Claude يومياً بلا سقف. بقى بياخد من نفس رصيد المستخدم المشترك (زرار
    // التحديث اليدوي) - سقف واحد حقيقي، مش اتنين منفصلين
    const quota = await checkAndConsumeAIRefreshQuota(workspace.userId);
    if (quota.allowed) {
      const aiTask = await generateAITask(summaries);
      if (aiTask) aiTasks = [aiTask];
    }
  }

  await generateAndStoreDailyTasks(workspaceId, ruleTasks, aiTasks);

  // إرسال إيميل للمهام العاجلة بس، ولو المستخدم مفعّل الخيار ده - القرار
  // بيتاخد من دالة موحّدة (shouldSendEmail) مش منطق متكرر في كل نقطة استدعاء
  const urgentTasks = [...ruleTasks, ...aiTasks].filter((task) => task.priority === "URGENT");
  if (urgentTasks.length > 0) {
    const owner = await prisma.user.findUnique({ where: { id: workspace.userId } });
    const prefs = {
      notifyUrgentByEmail: workspace.notifyUrgentByEmail,
      notifyHighByEmail: workspace.notifyHighByEmail,
      notificationEmail: workspace.notificationEmail,
    };

    if (owner && shouldSendEmail("URGENT", prefs)) {
      await sendUrgentNotificationEmail({
        toEmail: workspace.notificationEmail || owner.email,
        workspaceName: workspace.name,
        title: t(locale, "notifications.urgentTasksTitle", { count: urgentTasks.length }),
        description: urgentTasks.map((task) => task.title).join(" • "),
        locale,
      });
    }
  }
}

export function generateRuleBasedTasks(
  ctx: RuleCheckContext,
  locale: Locale = "ar"
): Array<{
  title: string;
  category: string;
  priority: string;
}> {
  const tasks: Array<{ title: string; category: string; priority: string }> = [];

  // Search Terms Report - أهم عنصر يُهمَل غالباً ويستنزف الميزانية بصمت
  const daysSinceSearchTerms = daysSince(ctx.lastSearchTermsReview);
  if (daysSinceSearchTerms === null || daysSinceSearchTerms >= 7) {
    tasks.push({
      title:
        daysSinceSearchTerms === null
          ? t(locale, "tasks.searchTermsNever")
          : t(locale, "tasks.searchTermsSince", { days: daysSinceSearchTerms }),
      category: "SEARCH_TERMS",
      priority: daysSinceSearchTerms && daysSinceSearchTerms >= 14 ? "HIGH" : "MEDIUM",
    });
  }

  // Negative Keywords - امتداد طبيعي لمراجعة مصطلحات البحث
  const daysSinceNegatives = daysSince(ctx.lastNegativeKeywordsUpdate);
  if (daysSinceNegatives === null || daysSinceNegatives >= 14) {
    tasks.push({
      title: t(locale, "tasks.negativeKeywords"),
      category: "NEGATIVE_KEYWORDS",
      priority: "MEDIUM",
    });
  }

  // Budget Pacing - هل معدّل الإنفاق متوافق مع تقدّم الشهر؟
  const pacingGap = ctx.budgetSpentPct - ctx.monthProgressPct;
  if (Math.abs(pacingGap) > 15) {
    tasks.push({
      title:
        pacingGap > 0
          ? t(locale, "tasks.pacingFast", { pct: Math.round(pacingGap) })
          : t(locale, "tasks.pacingSlow", { pct: Math.round(Math.abs(pacingGap)) }),
      category: "BUDGET_PACING",
      priority: Math.abs(pacingGap) > 25 ? "URGENT" : "HIGH",
    });
  }

  // Ad Fatigue - ارتفاع معدل التكرار (خاص بميتا وتيك توك وسناب شات غالباً)
  for (const [platform, frequency] of Object.entries(ctx.frequencyByPlatform)) {
    if (frequency > 3.5) {
      tasks.push({
        title: t(locale, "tasks.adFatigue", { platform, freq: frequency.toFixed(1) }),
        category: "AD_FATIGUE",
        priority: frequency > 5 ? "HIGH" : "MEDIUM",
      });
    }
  }

  // Disapproved Ads - إعلانات مرفوضة تُنفق صفراً دون أن يلاحظها أحد
  if (ctx.disapprovedAdsCount > 0) {
    tasks.push({
      title: t(locale, "tasks.disapprovedAds", { count: ctx.disapprovedAdsCount }),
      category: "DISAPPROVED_ADS",
      priority: "HIGH",
    });
  }

  // Tracking Health - أهم فحص على الإطلاق: توقف التحويلات الموثّقة فجأة
  if (
    ctx.verifiedConversionsAvgLast7Days > 2 &&
    ctx.verifiedConversionsYesterday === 0
  ) {
    tasks.push({
      title: t(locale, "tasks.trackingHealth"),
      category: "TRACKING_HEALTH",
      priority: "URGENT",
    });
  }

  // Tag Health - مختلف عن Tracking Health: هنا فيه كليكات مسجلة عند المنصة
  // فعلاً، لكن صفر إشارة وصلت لنظام التتبع بتاعنا - ده مؤشر إن وسم التتبع
  // (tracking tag) نفسه معطّل أو اتشال بالغلط من الصفحة، مش مشكلة بيانات عادية
  if (ctx.clicksButZeroTagFires) {
    tasks.push({
      title: t(locale, "tasks.tagHealth"),
      category: "TAG_HEALTH",
      priority: "URGENT",
    });
  }

  // CTR Drop - مش نسبة انخفاض ثابتة لكل الحسابات (30% كانت ساذجة)، لكن
  // شذوذ إحصائي حقيقي مقارنة بخط الأساس الخاص بالحساب ده بالذات - حساب
  // متقلب طبيعياً مش هيدّي تنبيهات كاذبة، وحساب مستقر جداً هيمسك مشكلة
  // حقيقية حتى لو الانخفاض بالنسبة المئوية صغير نسبياً
  if (ctx.ctrToday !== null && ctx.ctrHistory.length > 0) {
    const anomaly = detectAnomaly(ctx.ctrToday, ctx.ctrHistory);

    if (anomaly.isAnomaly && anomaly.direction === "below") {
      const dropPct =
        anomaly.baseline.mean > 0
          ? Math.round(((anomaly.baseline.mean - ctx.ctrToday) / anomaly.baseline.mean) * 100)
          : 0;

      tasks.push({
        title: t(locale, "tasks.ctrDrop", { pct: dropPct }),
        category: "CTR_DROP",
        // انحراف أكبر من 3 = شذوذ قوي جداً إحصائياً، مش مجرد تقلب عادي
        priority: Math.abs(anomaly.zScore) > 3 ? "HIGH" : "MEDIUM",
      });
    }
  }

  // Page Speed - بطء تحميل صفحة الهبوط بشكل يؤثر فعلياً على معدل التحويل
  if (ctx.landingPageLoadTimeSeconds !== null && ctx.landingPageLoadTimeSeconds > 3) {
    tasks.push({
      title: t(locale, "tasks.pageSpeed", {
        seconds: ctx.landingPageLoadTimeSeconds.toFixed(1),
      }),
      category: "PAGE_SPEED",
      priority: ctx.landingPageLoadTimeSeconds > 5 ? "HIGH" : "MEDIUM",
    });
  }

  return tasks;
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

// ==================== الطبقة 2: اكتشاف تلقائي (AI) ====================
// بتحول أهم اقتراح من generateInsights() (lib/aiInsights.ts) لمهمة فعلية
// في القائمة اليومية، بدل ما يفضل مجرد جملة في تقرير محدش بيرجعله.

import { generateInsights } from "@/lib/aiInsights";

export async function generateAITask(
  campaigns: CampaignSummary[]
): Promise<{ title: string; category: string; priority: string } | null> {
  if (campaigns.length === 0) return null;

  const insights = await generateInsights(campaigns);
  if (!insights.nextAction) return null;

  return {
    title: insights.nextAction,
    category: "ANOMALY",
    priority: "HIGH",
  };
}

export async function generateAndStoreDailyTasks(
  workspaceId: string,
  ruleTasks: Array<{ title: string; category: string; priority: string }>,
  aiTasks: Array<{ title: string; category: string; priority: string }>
) {
  const today = new Date(new Date().toISOString().slice(0, 10));

  const allTasks = [
    ...ruleTasks.map((task) => ({ ...task, source: "RULE_BASED" as const })),
    ...aiTasks.map((task) => ({ ...task, source: "AI_DETECTED" as const })),
  ];

  for (const task of allTasks) {
    await prisma.dailyTask.create({
      data: {
        workspaceId,
        date: today,
        title: task.title,
        category: task.category as any,
        priority: task.priority as any,
        source: task.source,
      },
    });
  }
}
