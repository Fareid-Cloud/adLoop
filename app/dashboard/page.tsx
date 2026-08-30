// app/dashboard/page.tsx
//
// "لمحة" - الصفحة الرئيسية. Server Component بيقرا من قاعدة البيانات مباشرة.
// اللغة البصرية المحورية: "الحقيقة مقابل ما تقوله المنصات" (طبقة الحقيقة) -
// الرقم المعلن جنب الرقم المتحقّق منه فعلاً، والفجوة بينهم تقود كل قرار.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { metricRollupRows, sumRollup, groupRollup } from "@/lib/metricRollup";
import { redirect } from "next/navigation";
import type { DailyTask } from "@prisma/client";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { SourcePerformanceTable, type SourceRow } from "@/app/components/SourcePerformanceTable";
import { PlatformDonut } from "@/app/components/PlatformDonut";
import { RevenueByPlatform, type RevenuePlatformRow } from "@/app/components/RevenueByPlatform";
import { TrendChart } from "@/app/components/TrendChart";
import { MetricsExplorer } from "@/app/components/MetricsExplorer";
import { computeHealthScore } from "@/lib/healthScore";
import { getConnectStates, getConnectedPlatforms } from "@/lib/connectionState";
import { ConnectPlatforms } from "@/app/components/ConnectPlatforms";
import { SetupProgressPanel, RecentActivityPanel, ConnectedPlatformsPanel, AfterActivationPanel, SupportPanel } from "./HomePanels";
import { getRecentActivity, getPlatformCards } from "@/lib/homeActivity";
import { getSetupProgress } from "@/lib/setupProgress";
import { PostConnectCampaignPrompt } from "@/app/components/PostConnectCampaignPrompt";
import { ValueMomentGate } from "@/app/components/ValueMomentGate";
import { Suspense } from "react";
import { PlatformSwitcher } from "@/app/components/PlatformSwitcher";
import { KpiSection } from "@/app/components/KpiSection";
import { computeKpis, KPI_DEFS } from "@/lib/kpiEngine";
import { computeMetrics, comparePlatforms } from "@/lib/metricsEngine";
import { compareMetric } from "@/lib/periodComparison";
import { House, Megaphone, ShieldCheck, Wallet, Target, Activity } from "lucide-react";
import { TrackingAccuracyGauge } from "@/app/components/ui/TrackingAccuracyGauge";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { ReportedVsActualBars } from "@/app/components/ui/ReportedVsActualBars";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { AiAsk } from "@/app/components/AiAsk";
import { periodFromParams, daysBetween, resolveCompare, toDateBounds } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { HealthGauge } from "@/app/components/ui/HealthGauge";
import Link from "next/link";
import { buildTodaySummary } from "@/lib/todaySummary";
import { TodaySummaryCard } from "@/app/components/TodaySummaryCard";
import { taskTitle } from "@/lib/taskTitle";
import { itemTitle } from "@/lib/localizedRecord";
import { costPerVerified } from "@/lib/kpiEngine";
import { PageHeader } from "@/app/components/ui/PageHeader";

const AD_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** التحيّة بحسب ساعة المستخدم - **لا ساعة الخادم.**
 *
 *  الخادم في منطقةٍ زمنيّةٍ أخرى غالباً، فتحيّةُ الصباح تصل مساءً. والمنطقة
 *  محفوظةٌ على المستخدم أصلاً (`User.timezone`)، فلا حاجة إلى تخمينٍ من
 *  عنوان الشبكة - وهو أدقُّ من التخمين وأصدق: هذا ما اختاره هو.
 *
 *  `Intl` لا حسابٌ يدويّ بالإزاحة: التوقيت الصيفيّ يُزيح الساعة في نصف
 *  دول العالم، وحسابُه بالطرح خطأٌ نصفَ السنة. */
function greetingKey(timezone: string): string {
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone })
        .format(new Date()),
    );
  } catch {
    // منطقةٌ غير صالحة (بياناتٌ قديمة مثلاً): تحيّةٌ محايدة خيرٌ من انهيار.
    return "greeting";
  }
  if (hour >= 5 && hour < 12) return "greetMorning";
  if (hour >= 12 && hour < 17) return "greetAfternoon";
  if (hour >= 17 && hour < 23) return "greetEvening";
  return "greetNight";
}

export default async function GlancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const platformParam = Array.isArray(sp.platform) ? sp.platform[0] : sp.platform;
  const platformFilter = platformParam && AD_PLATFORMS.includes(platformParam) ? platformParam : "";
  // الفترة صارت اختياراً حراً بدل ثلاثة أزرار ثابتة (٧/٣٠/٩٠)
  const period = periodFromParams(sp);
  const bounds = await toDateBoundsForUser(period.range);
  const days = daysBetween(period.range.from, period.range.to);
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `home.${k}`, v);

  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">
        {t("ar", "common.sessionExpired")}
      </div>
    );
  }

  // بوابة الإعداد الإجبارية - كانت في الـlayout، ونقلها إلى هنا يمنع أي
  // فشل فيها من إسقاط كل صفحات اللوحة دفعة واحدة.
  const workspace = await getActiveWorkspace(user.id);

  let needsOnboarding = false;
  if (!user.onboardingDismissed) {
    try {
      // المساحة النشطة أولاً: المستخدم الذي دخل العرض التجريبي كان يُرمى
      // إلى صفحة الإعداد لأن حسابه بلا ربط حقيقي - فلا يرى الديمو أصلاً.
      const connected = await getConnectedPlatforms(workspace?.id ?? null, user.id);
      needsOnboarding = connected.size === 0;
    } catch (err) {
      console.error("[glance] تعذّر فحص المنصات المرتبطة:", err);
    }
  }
  if (needsOnboarding) redirect("/onboarding");

  if (!workspace) {
    const { CreateWorkspaceForm } = await import("./CreateWorkspaceForm");
    return <CreateWorkspaceForm locale={locale} />;
  }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // 🔴 **فترة المقارنة كانت ثابتةً عند ستّين يوماً مهما اخترتَ.**
  //
  // كان الاستعلام `gte: sixtyDaysAgo, lt: bounds.gte` - أي أنّ من يختار
  // «آخر ٧ أيام» تُقارَن أيّامه السبعة بـ**ثلاثةٍ وخمسين يوماً** قبلها.
  // فالرقم لم يكن مفصولاً عن المنتقي فحسب، بل **خاطئاً**: طرفان بمدّتين
  // مختلفتين لا تصحّ بينهما نسبة.
  //
  // والآن: ما اختاره المستخدم في المنتقي إن اختار، وإلّا فترةٌ سابقة
  // **بالطول نفسه** تماماً - وهي القراءة التي يتوقّعها من لم يختر شيئاً.
  const comparisonRange = period.compare ?? resolveCompare(period.range, "previous");
  const comparisonBounds = comparisonRange ? toDateBounds(comparisonRange) : null;
  // الحارس يمنع استعلاماً بحدودٍ فارغة لو تعذّر حساب الفترة السابقة
  const prevWhere = comparisonBounds
    ? { gte: comparisonBounds.gte, lte: comparisonBounds.lte }
    : { gte: new Date(0), lt: bounds.gte };

  // 🔴 **الصفحة الأولى التي يفتحها كلّ مشترك كانت تجمع `MetricSnapshot` خاماً.**
  //
  // أربعةُ استعلاماتٍ بلا فلتر مكان ظهورٍ ولا فلتر منصّة: فصرفُ ميتا يُعَدّ
  // مرّتين حين يجتمع الصفّ المجمَّع والمقسَّم، وصفوفُ ويب هوك المتجر
  // (`cost: 0`) تُخلَط بأداء الإعلان فتخفض تكلفة العميل بالصمت، والتحويلُ
  // المتحقَّق يُقرأ من العمود القديم لا من `ConversionVerification`.
  // نفس عطب الصفحات التسع (PG-1→9) - وهذه أظهرُها جميعاً ولم تكن في قائمتها.
  const [rollupNow, rollupPrev, rollupDaily] = await Promise.all([
    metricRollupRows({ workspaceId: workspace.id, date: bounds }),
    metricRollupRows({ workspaceId: workspace.id, date: prevWhere }),
    metricRollupRows({ workspaceId: workspace.id, date: { gte: fourteenDaysAgo } }),
  ]);

  // شكل `_sum` محفوظ عمداً: القرّاء أدناه مكتوبون عليه، وتغييرُ الأرقام
  // وحدها أقلّ خطراً من إعادة كتابة الصفحة معها.
  const totalsAgg = { _sum: sumRollup(rollupNow) };
  const byPlatform = [...groupRollup(rollupNow, (r) => r.platform).entries()].map(
    ([platform, m]) => ({ platform, _sum: m })
  );
  const byPlatformPrev = [...groupRollup(rollupPrev, (r) => r.platform).entries()].map(
    ([platform, m]) => ({ platform, _sum: m })
  );
  const dailySnapshots = [...rollupDaily].sort((a, b) => a.date.getTime() - b.date.getTime());

  const [todaysTasks, urgentActionItems, valueConfig, previousPeriodAgg] =
    await Promise.all([
      prisma.dailyTask.findMany({
        where: {
          workspaceId: workspace.id,
          date: new Date(new Date().toISOString().slice(0, 10)),
          completed: false,
        },
        orderBy: { priority: "desc" },
        take: 5,
      }),
      prisma.actionFeedItem.findMany({
        where: { workspaceId: workspace.id, status: "PENDING", type: { in: ["SUGGESTION", "ALERT"] } },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
      prisma.conversionValueConfig.findUnique({ where: { workspaceId: workspace.id } }),
      prisma.metricSnapshot.aggregate({
        where: { workspaceId: workspace.id, date: prevWhere },
        _sum: { cost: true, rawConversions: true, verifiedConversions: true },
      }),
    ]);

  const totalClicks = totalsAgg._sum.clicks ?? 0;
  const totalVerified = totalsAgg._sum.verifiedConversions ?? 0;
  const totalRaw = totalsAgg._sum.rawConversions ?? 0;
  const totalCost = totalsAgg._sum.cost ?? 0;

  const cplVerified = totalVerified > 0 ? (totalCost / totalVerified).toFixed(1) : "—";
  const hasAnyData = totalClicks > 0 || totalVerified > 0 || totalCost > 0;

  // طبقة الحقيقة: نسبة تضخّم المنصات ودقة التتبع
  const inflationPct = totalRaw > 0 ? Math.round(((totalRaw - totalVerified) / totalRaw) * 100) : 0;
  const trackingAccuracy = totalRaw > 0 ? Math.round((totalVerified / totalRaw) * 100) : 0;

  // مقارنة فترة بفترة (آخر 30 يوم مقابل الـ30 قبلها)
  const prevVerified = previousPeriodAgg._sum.verifiedConversions ?? 0;
  const prevCost = previousPeriodAgg._sum.cost ?? 0;
  const prevCplVerified = prevVerified > 0 ? prevCost / prevVerified : 0;
  const currentCplVerified = totalVerified > 0 ? totalCost / totalVerified : 0;
  const cplVerifiedComparison =
    prevCplVerified > 0 && currentCplVerified > 0 ? compareMetric(currentCplVerified, prevCplVerified) : null;

  // صفوف جدول "الأداء حسب المصدر" + اتجاه كل مصدر مقابل الفترة السابقة
  const prevByPlatform = new Map(byPlatformPrev.map((p: any) => [p.platform, p._sum]));
  const pct = (cur: number, prv: number) => (prv > 0 ? Math.round(((cur - prv) / prv) * 100) : null);
  const sourceRows: SourceRow[] = byPlatform.map((p: any) => {
    const cost = p._sum.cost ?? 0;
    const verified = p._sum.verifiedConversions ?? 0;
    const raw = p._sum.rawConversions ?? 0;
    const cplV = costPerVerified(cost, verified);
    const prev: any = prevByPlatform.get(p.platform);
    const prevV = prev?.verifiedConversions ?? 0;
    const prevCplV = prevV > 0 ? (prev?.cost ?? 0) / prevV : 0;
    return {
      platform: p.platform,
      clicks: p._sum.clicks ?? 0,
      rawConversions: raw,
      verifiedConversions: verified,
      cost,
      cplVerified: cplV,
      trend: {
        verified: pct(verified, prevV),
        cplVerified: cplV !== null && prevCplV > 0 ? pct(cplV, prevCplV) : null,
      },
    };
  });

  // خلاصة اليوم - تُبنى من الأرقام المحسوبة أعلاه، بقواعد ثابتة صفر AI
  const todaySummary = buildTodaySummary({
    locale,
    cpaNow: currentCplVerified,
    cpaPrev: prevCplVerified,
    trackingAccuracy,
    inflationPct,
    totalVerified,
    totalCost,
    currency: workspace.currency,
    platforms: sourceRows.map((r) => ({
      platform: r.platform,
      verified: r.verifiedConversions,
      cost: r.cost,
      cpa: r.cplVerified,
    })),
    topPending: urgentActionItems[0]
      ? {
          id: urgentActionItems[0].id,
          title: itemTitle(locale, urgentActionItems[0]),
          severity: String(urgentActionItems[0].severity ?? ""),
        }
      : null,
  });

  // الإيراد لكل منصة - الإيراد وحده مضلِّل، فيُعرض مع إنفاقه وعائده
  const revenueRows: RevenuePlatformRow[] = byPlatform
    .filter((p: any) => AD_PLATFORMS.includes(p.platform))
    .map((p: any) => {
      const prev: any = prevByPlatform.get(p.platform);
      const prevRevenue = prev?.revenue ?? 0;
      const revenue = p._sum.revenue ?? 0;
      return {
        platform: p.platform,
        revenue,
        cost: p._sum.cost ?? 0,
        verifiedConversions: p._sum.verifiedConversions ?? 0,
        revenueChangePct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
      };
    });

  // نقطة التعادل الحقيقية = ١ ÷ هامش الربح. بدونها نقارن نسبياً فقط
  const breakEvenRoas =
    workspace.profitMarginPct && workspace.profitMarginPct > 0
      ? Math.round((1 / (workspace.profitMarginPct / 100)) * 100) / 100
      : null;

  // مقارنة المنصات (insight تلقائي) - محتاجة منصتين على الأقل بإنفاق
  const platformInsight = (() => {
    const withCost = byPlatform.filter((p: any) => (p._sum.cost ?? 0) > 0 && AD_PLATFORMS.includes(p.platform));
    if (withCost.length < 2) return null;
    const computed = withCost.map((p: any) =>
      computeMetrics(
        {
          platform: p.platform,
          impressions: p._sum.impressions ?? 0,
          clicks: p._sum.clicks ?? 0,
          cost: p._sum.cost ?? 0,
          rawConversions: p._sum.rawConversions ?? 0,
          verifiedConversions: p._sum.verifiedConversions ?? 0,
        },
        { avgLeadToClientRate: valueConfig?.avgLeadToClientRate ?? 0, avgClientValue: valueConfig?.avgClientValue ?? 0 }
      )
    );
    // 🔴 كانت `"ar"` مثبّتة، فتصل جملة مقارنة المنصّات عربيةً إلى قارئ
    // الواجهة الإنجليزية - في الصفحة الأولى التي يفتحها.
    return comparePlatforms(computed, locale).insight;
  })();

  // السلسلة «المُعلنة» تحويلات مُعلنة لا نقرات. جمعُ النقرات هنا كان يرسم
  // مقياسين مختلفين على محور واحد - النقرات أكبر بمرتبة كاملة، فينسحق خطّ
  // المتحقَّق إلى القاع ويبدو صفراً، ويضيع المعنى الوحيد للرسم: الفارق بين
  // ما تقوله المنصّة وما ثبت فعلاً.
  const trendByDate = new Map<string, { verified: number; reported: number }>();
  for (const snap of dailySnapshots) {
    const key = snap.date.toISOString().slice(5, 10);
    const existing = trendByDate.get(key) ?? { verified: 0, reported: 0 };
    existing.verified += snap.verifiedConversions;
    existing.reported += snap.rawConversions;
    trendByDate.set(key, existing);
  }
  const trendData = Array.from(trendByDate.entries()).map(([date, v]) => ({ date, ...v }));

  // كروت الربط - تظهر في الداشبورد مباشرة (بدل "روح للإعدادات")
  const connectStates = await getConnectStates(workspace.id, user.id);

  // تقدّم الإعداد الحقيقي - كل خطوة تكتمل بالإنجاز الفعلي لا بالضغط
  const setup = await getSetupProgress(workspace.id, user.id);
  const [activityRows, platformCards] = await Promise.all([
    getRecentActivity(workspace.id, locale),
    getPlatformCards(workspace.id, user.id),
  ]);

  // كل المؤشرات تُحسب مرة واحدة (استعلام واحد) - العميل يعرض ما اختاره فقط،
  // فتغيير الاختيار فوري بلا طلب جديد. تتبع فلتر المنصة والمدة المختارين.
  const allKpis = await computeKpis(workspace.id, KPI_DEFS.map((d) => d.key), days, platformFilter || null);

  // كانت المكوّنات الخمسة `null` ثابتة في الكود، فعرضت الشارة «—» و«بانتظار
  // ربط الحسابات» لكل مستخدم إلى الأبد مهما اكتملت بياناته. يُمرَّر هنا ما
  // نملكه فعلاً؛ والباقي يبقى `null` عمداً - الدالة تُعيد الترجيح على
  // المتاح وحده، فالمكوّن الغائب لا يخفض الدرجة ولا يُختلق له رقم.
  const health = computeHealthScore({
    tracking: hasAnyData ? trackingAccuracy : null,
    landing: null,
    ads: null,
    audience: null,
    creatives: null,
  });
  const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-5xl">
      {/* 🔴 اسم مساحة العمل يُخفى حين يطابق اسم المستخدم: المساحة الافتراضية
          تُسمّى باسم صاحبها عند التسجيل، فيظهر «عبد الرحمن محمد فريد» سطراً
          فوق «أهلاً عبد الرحمن» - تكرارٌ يُقرأ كخلل لا كسياق. السطر مفيدٌ
          فقط حين يميّز: مَن يملك أكثر من مساحة يحتاج أن يعرف في أيّها هو. */}
      <PageHeader
        icon={House}
        tone="accent"
        eyebrow={workspace.name !== user.name ? workspace.name : undefined}
        title={tr(greetingKey(user.timezone), { name: firstName })}
        actions={<>
        <PeriodBar
          locale={locale}
          preset={period.preset}
          range={period.range}
          compare={period.compare}
          // النمط المختار يعود إلى المنتقي: كان يُطبَّق على الأرقام ويفتح
          // المنتقي فارغاً، فيظنّ القارئ أنّ اختياره ضاع.
          compareMode={period.compareMode}
          // الصفحة تقرأ فترة المقارنة فعلاً في استعلامَي «السابقة» و«حسب
          // المصدر»، فيحقّ لها عرض الخيار - راجع `PeriodBar`.
          allowCompare
          // في صفٍّ بجانب شارة صحة الحساب: الهامش السفليّ هنا يزيح
          // محتواه ثمانية بكسلات لأعلى عن جاره - قِيس ذلك على الصفحة الحيّة.
          flush
        />
        {/* نفس عدّاد صفحة صحة الحساب بحجم الرأس - كان سطراً رمادياً طويلاً
            بلا وزن بصري ("درجة الصحة — التتبّع وحده مُقاساً حتى الآن")، فلا
            يُقرأ ولا يُربط بالعدّاد نفسه في مكان آخر. */}
        {/* 🔴 **كان سطرين بينما جارُه سطرٌ واحد، فاختلف الارتفاعان.**
            الحاوية تُوسّطهما رأسياً، فيتطابق مركزاهما وتتباعد حوافُّهما -
            وهو ما يُقرأ عدمَ محاذاة. سطرٌ واحد لكليهما: الاسمُ ثمّ الحالةُ
            شارةً بجانبه، فيستوي الارتفاعان بلا ضبطٍ يدويّ لأيّهما. */}
        <Link
          href="/dashboard/diagnostics"
          className="inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-full card-shadow border border-border bg-surface pe-3.5 ps-1.5 no-underline transition-colors hover:border-accent"
        >
          <HealthGauge score={health.overallScore} size="sm" showDenominator={false} />
          <span className="text-[12.5px] font-medium text-text-primary">{tr("healthScoreShort")}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              health.isComplete
                ? "bg-verified/12 text-verified"
                : health.overallScore > 0
                  ? "bg-accent/12 text-accent"
                  : "bg-surface-raised text-text-muted"
            }`}
          >
            {health.isComplete
              ? tr("healthComplete")
              : health.overallScore > 0
                ? tr("healthPartial")
                : tr("healthPending")}
          </span>
        </Link>
        </>}
      />

      {/* اللحظة الأولى: المستخدم يرى الفجوة بين ما تقوله المنصة والحقيقة */}
      {hasAnyData && (
        <ValueMomentGate
          reportedConversions={totalRaw}
          verifiedConversions={totalVerified}
          currency={workspace.currency}
          locale={locale}
        />
      )}

      {/* اختيار الحملات يفتح تلقائياً فور العودة من ربط المنصة */}
      <Suspense fallback={null}>
        <PostConnectCampaignPrompt workspaceId={workspace.id} locale={locale} />
      </Suspense>

      {/* الإعداد والنشاط جنباً إلى جنب: القائمة الطويلة السابقة كانت تدفع
          كل نتيجة أسفل الطيّة، فيقف من أدّى ثلاث خطوات أمام صفحة تبدو
          فارغة رغم أن بياناته وصلت فعلاً. */}
      {!setup.allDone && (
        <>
          <div className="mb-4 grid gap-3 lg:grid-cols-[2fr_1fr]">
            <SetupProgressPanel
              progress={setup}
              locale={locale}
              ctaHref={setup.nextStep?.ctaHref ?? "/dashboard/integrations"}
            />
            <RecentActivityPanel rows={activityRows} locale={locale} />
          </div>

          {/* ما ينتظره بعد التفعيل - يظهر قبل وصول أي أرقام فقط، ثم
              تتكلّم الأرقام عن نفسها فيختفي وحده */}
          {!hasAnyData && (
            <div className="mb-4 grid gap-3 lg:grid-cols-[2fr_1fr]">
              <AfterActivationPanel locale={locale} />
              <SupportPanel locale={locale} whatsappNumber={process.env.SUPPORT_WHATSAPP_NUMBER ?? null} />
            </div>
          )}
        </>
      )}

      <div className="mb-4">
        <ConnectedPlatformsPanel cards={platformCards} locale={locale} />
      </div>

      {/* ربط ما لم يُربط بعد - يظهر فقط حين ينقص شيء فعلاً */}
      <ConnectPlatforms states={connectStates} workspaceId={workspace.id} locale={locale} onlyUnconnected />

      {hasAnyData && <PlatformSwitcher platform={platformFilter} locale={locale} />}

      {/* الطبقة الأولى: الحكم والإشارة والإجراء - قبل أي جدول أو رسم */}
      {hasAnyData && <TodaySummaryCard summary={todaySummary} locale={locale} />}

      {!hasAnyData ? null : (
        <>
          {/* مؤشرات الأداء القابلة للاختيار - رسم صغير تحت كل مؤشر */}
          <KpiSection all={allKpis} currency={workspace.currency} locale={locale} />

          {/* هيرو طبقة الحقيقة - المعلن مقابل المتحقّق منه فعلاً */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="card pad-lg">
              <div className="mb-4 text-[13px] font-medium text-text-muted">{tr("truthHero")}</div>
              <div className="flex flex-wrap items-end gap-8">
                <div>
                  <div className="mb-1 text-xs text-text-faint">{tr("reportedByPlatforms")}</div>
                  <div className="border-b border-dashed border-text-faint pb-1 font-mono text-[38px] font-medium leading-none text-text-muted">
                    {fmt(totalRaw)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-text-faint">{tr("actuallyVerified")}</div>
                  <div className="flex items-baseline gap-2 font-mono text-[38px] font-medium leading-none text-verified">
                    {fmt(totalVerified)}
                    <span className="text-lg text-verified" title={tr("verifiedTooltip")}>✓</span>
                  </div>
                </div>
              </div>
              {inflationPct > 0 && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gap/10 px-3 py-2 text-[13px] text-gap">
                  <Megaphone size={15} />
                  {tr("inflationLine", { pct: inflationPct })}
                </div>
              )}
            </div>
            {/* العدّاد نسبة، والشريط أرقام مطلقة - متكاملان لا مكرّران.
                `min-w-0` على الشريط ضروري: بدونه يرفض عنصر flex أن يضيق
                عن محتواه فيدفع العدّاد خارج البطاقة على الشاشات الضيّقة. */}
            <div className="flex items-center gap-5 card pad-lg">
              <TrackingAccuracyGauge verified={totalVerified} raw={totalRaw} locale={locale} />
              <div className="min-w-0 flex-1">
                <ReportedVsActualBars reported={totalRaw} actual={totalVerified} locale={locale} />
              </div>
            </div>
          </div>

          {/* اتجاه الفارق عبر الزمن - مباشرةً تحت لقطة الفارق لأنه هو نفسه
              مقروءاً على محور الزمن: اللقطة تقول «كم الفارق الآن»، والمنحنى
              يقول «يتّسع أم يضيق». كان أسفل الصفحة كلها حيث لا يراه أحد. */}
          {trendData.length > 1 && (
            <div className="mb-4 card pad-lg">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] text-text-muted">{tr("trend14")}</span>
                {/* مفتاح الألوان: منحنيان بلا تسمية يتركان القارئ يخمّن
                    أيّهما أيّ - وهو جوهر ما يعرضه الرسم أصلاً */}
                <span className="flex items-center gap-4 text-[12px]">
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <span className="h-2 w-2 rounded-full bg-gap" />
                    {tr("reportedByPlatforms")}
                  </span>
                  <span className="flex items-center gap-1.5 text-verified">
                    <span className="h-2 w-2 rounded-full bg-verified" />
                    {tr("actuallyVerified")}
                  </span>
                </span>
              </div>
              <TrendChart
                data={trendData}
                labels={{ verified: tr("actuallyVerified"), reported: tr("reportedByPlatforms") }}
              />
            </div>
          )}

          {/* حُذف صفّ المؤشّرات الذي كان هنا: كان يعيد الإنفاق والتحويلات
              المتحقّقة وتكلفة العميل ودقّة التتبّع - وكلّها معروضة أعلى
              الصفحة في شريط المؤشّرات القابل للاختيار. أربع بطاقات تكرّر
              أربعاً أخرى على الشاشة نفسها تجعل القارئ يشكّ في أيّهما الصحيح،
              وكانت كلّها تقود إلى «الحملات» بلا علاقة بما تعرضه. */}


          {setup.allDone && (
            <div className="mb-4">
              <RecentActivityPanel rows={activityRows} locale={locale} />
            </div>
          )}

          {/* جدول الأداء حسب المصدر */}
          {sourceRows.length > 0 && (
            <div className="mb-4">
              <SourcePerformanceTable rows={sourceRows} locale={locale} />
              {platformInsight && <p className="mt-2 px-1 text-[13px] text-text-muted">{platformInsight}</p>}
            </div>
          )}

          {/* الإيراد لكل منصة - مقارنة الإيراد بإنفاقه وعائده */}
          {revenueRows.length > 0 && (
            <div className="mb-4">
              <RevenueByPlatform
                locale={locale}
                rows={revenueRows}
                currency={workspace.currency}
                breakEvenRoas={breakEvenRoas}
              />
            </div>
          )}

          {/* 🔴 **كلُّ بطاقةٍ كانت تأخذ صفّاً بعرض الصفحة كاملاً** - فرسمٌ
              دائريٌّ صغير يجلس وحده في فراغٍ عريض، وتحته قائمةُ قرارات في
              فراغٍ مثله، ويصير التمرير طويلاً بلا أن تزيد المعلومة.
              الاثنان جنباً إلى جنب: الرسم يقول «من أين يأتي المتحقَّق»،
              والقائمة تقول «ما ينتظر قرارك» - وقراءتهما معاً هي الغرض. */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <PlatformDonut locale={locale} data={sourceRows.map((r) => ({ platform: r.platform, value: r.verifiedConversions }))} />

            {urgentActionItems.length > 0 && (
              <div className="card pad-md flex flex-col">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-text-primary">{tr("pendingDecisions")}</span>
                  <a href="/dashboard/actions" className="text-xs text-accent no-underline">
                    {tr("viewAllArrow")}
                  </a>
                </div>
                <div className="flex flex-col gap-1.5">
                  {urgentActionItems.map((item: any) => (
                    <a
                      key={item.id}
                      href="/dashboard/actions"
                      className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[12.5px] text-text-primary no-underline transition-colors hover:border-accent"
                    >
                      <PriorityDot priority={item.severity} />
                      <span className="min-w-0 flex-1">{itemTitle(locale, item)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* مهامُّ اليوم بطاقةٌ كبقيّتها، لا سطرٌ عارٍ فوق قائمةٍ عارية:
          الصفحة كلّها بطاقات، وقسمٌ واحدٌ بلا سطحٍ يُقرأ ذيلاً منسيّاً. */}
      <div className="card pad-md mt-6">
        <div className="mb-3 text-[13px] font-medium text-text-primary">{tr("todayTasks")}</div>
        {todaysTasks.length === 0 ? (
          <div className="py-2 text-[12.5px] text-text-faint">{tr("noTasks")}</div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {todaysTasks.map((task: DailyTask) => (
              <a
                key={task.id}
                href="/dashboard/diagnostics"
                className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[12.5px] text-text-primary no-underline transition-colors hover:border-accent"
              >
                <PriorityDot priority={task.priority} />
                <span className="min-w-0 flex-1">{taskTitle(locale, task)}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {hasAnyData && (
        <div className="mt-6">
          <MetricsExplorer workspaceId={workspace.id} locale={locale} />
        </div>
      )}

      {/* مربّع السؤال في آخر المحتوى: هو `sticky` فيطفو فوق الصفحة في كلّ
          موضع تمرير، وموضعه هنا هو حيث يرسو - فوق التذييل مباشرةً حين
          يبلغ المستخدم الآخر. */}
      {hasAnyData && <AiAsk scope="home" locale={locale} currency={workspace.currency} demo={workspace.isDemo} />}
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colorClass =
    priority === "URGENT" ? "bg-critical" : priority === "HIGH" ? "bg-gap" : "bg-text-faint";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colorClass}`} />;
}
