// app/dashboard/page.tsx
//
// "لمحة" - الصفحة الرئيسية. Server Component بيقرا من قاعدة البيانات مباشرة.
// اللغة البصرية المحورية: "الحقيقة مقابل ما تقوله المنصات" (طبقة الحقيقة) -
// الرقم المعلن جنب الرقم المتحقّق منه فعلاً، والفجوة بينهم تقود كل قرار.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
import { getConnectStates } from "@/lib/connectionState";
import { ConnectPlatforms } from "@/app/components/ConnectPlatforms";
import { SetupProgressPanel, RecentActivityPanel, ConnectedPlatformsPanel } from "./HomePanels";
import { getRecentActivity, getPlatformCards } from "@/lib/homeActivity";
import { getSetupProgress } from "@/lib/setupProgress";
import { PostConnectCampaignPrompt } from "@/app/components/PostConnectCampaignPrompt";
import { Suspense } from "react";
import { PlatformSwitcher } from "@/app/components/PlatformSwitcher";
import { KpiSection } from "@/app/components/KpiSection";
import { computeKpis, KPI_DEFS } from "@/lib/kpiEngine";
import { computeMetrics, comparePlatforms } from "@/lib/metricsEngine";
import { compareMetric } from "@/lib/periodComparison";
import { Megaphone, ShieldCheck, Wallet, Target, Activity } from "lucide-react";
import { TrackingAccuracyGauge } from "@/app/components/ui/TrackingAccuracyGauge";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { ReportedVsActualBars } from "@/app/components/ui/ReportedVsActualBars";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds, daysBetween } from "@/lib/dateRange";

const AD_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
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
  const bounds = toDateBounds(period.range);
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
  let needsOnboarding = false;
  if (!user.onboardingDismissed) {
    try {
      const connectionCount = await prisma.connectedPlatform.count({ where: { userId: user.id } });
      needsOnboarding = connectionCount === 0;
    } catch (err) {
      console.error("[glance] تعذّر فحص المنصات المرتبطة:", err);
    }
  }
  if (needsOnboarding) redirect("/onboarding");

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    const { CreateWorkspaceForm } = await import("./CreateWorkspaceForm");
    return <CreateWorkspaceForm locale={locale} />;
  }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [totalsAgg, byPlatform, byPlatformPrev, dailySnapshots, todaysTasks, urgentActionItems, valueConfig, previousPeriodAgg] =
    await Promise.all([
      prisma.metricSnapshot.aggregate({
        where: { workspaceId: workspace.id, date: bounds },
        _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
      }),
      prisma.metricSnapshot.groupBy({
        by: ["platform"],
        where: { workspaceId: workspace.id, date: bounds },
        _sum: { clicks: true, verifiedConversions: true, cost: true, rawConversions: true, impressions: true, revenue: true },
      }),
      prisma.metricSnapshot.groupBy({
        by: ["platform"],
        where: { workspaceId: workspace.id, date: { gte: sixtyDaysAgo, lt: bounds.gte } },
        _sum: { verifiedConversions: true, cost: true, revenue: true },
      }),
      prisma.metricSnapshot.findMany({
        where: { workspaceId: workspace.id, date: { gte: fourteenDaysAgo } },
        select: { date: true, clicks: true, verifiedConversions: true },
        orderBy: { date: "asc" },
      }),
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
        where: { workspaceId: workspace.id, date: { gte: sixtyDaysAgo, lt: bounds.gte } },
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
    const cplV = verified > 0 ? Math.round((cost / verified) * 10) / 10 : null;
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
    return comparePlatforms(computed, "ar").insight;
  })();

  const trendByDate = new Map<string, { verified: number; reported: number }>();
  for (const snap of dailySnapshots) {
    const key = snap.date.toISOString().slice(5, 10);
    const existing = trendByDate.get(key) ?? { verified: 0, reported: 0 };
    existing.verified += snap.verifiedConversions;
    existing.reported += snap.clicks;
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

  const health = computeHealthScore({ tracking: null, landing: null, ads: null, audience: null, creatives: null });
  const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{tr("greeting", { name: firstName })}</h1>
        <PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />
        <div className="inline-flex items-center gap-2.5 rounded-full card-shadow border border-border bg-surface py-1.5 pe-4 ps-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised font-mono text-[11px] font-semibold text-text-muted">
            {health.overallScore || "—"}
          </div>
          <span className="text-xs text-text-muted">
            {tr("healthScore", { state: health.isComplete ? tr("healthComplete") : tr("healthPending") })}
          </span>
        </div>
      </div>

      {/* اختيار الحملات يفتح تلقائياً فور العودة من ربط المنصة */}
      <Suspense fallback={null}>
        <PostConnectCampaignPrompt workspaceId={workspace.id} locale="ar" />
      </Suspense>

      {/* الإعداد والنشاط جنباً إلى جنب: القائمة الطويلة السابقة كانت تدفع
          كل نتيجة أسفل الطيّة، فيقف من أدّى ثلاث خطوات أمام صفحة تبدو
          فارغة رغم أن بياناته وصلت فعلاً. */}
      {!setup.allDone && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <SetupProgressPanel
            progress={setup}
            locale={locale}
            ctaHref={setup.nextStep?.ctaHref ?? "/dashboard/integrations"}
          />
          <RecentActivityPanel rows={activityRows} locale={locale} />
        </div>
      )}

      <div className="mb-4">
        <ConnectedPlatformsPanel cards={platformCards} locale={locale} />
      </div>

      {/* ربط ما لم يُربط بعد - يظهر فقط حين ينقص شيء فعلاً */}
      <ConnectPlatforms states={connectStates} workspaceId={workspace.id} locale={locale} onlyUnconnected />

      {hasAnyData && <PlatformSwitcher platform={platformFilter} days={days} locale={locale} />}

      {!hasAnyData ? null : (
        <>
          {/* مؤشرات الأداء القابلة للاختيار - رسم صغير تحت كل مؤشر */}
          <KpiSection all={allKpis} currency={workspace.currency} locale="ar" />

          {/* هيرو طبقة الحقيقة - المعلن مقابل المتحقّق منه فعلاً */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl card-shadow border border-border bg-surface p-6">
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
                  {tr("inflationLine", { pct: inflationPct })}ً.
                </div>
              )}
            </div>
            <div className="flex items-center justify-around rounded-2xl card-shadow border border-border bg-surface p-6">
              <TrackingAccuracyGauge verified={totalVerified} raw={totalRaw} />
              <ReportedVsActualBars reported={totalRaw} actual={totalVerified} />
            </div>
          </div>

          {/* صف مؤشرات الأداء الرئيسية */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label={tr("spendLast30")} value={fmt(totalCost)} icon={Wallet} href="/dashboard/campaigns" />
            <MetricCard label={tr("verifiedConversions")} value={fmt(totalVerified)} color="verified" verified icon={ShieldCheck} href="/dashboard/campaigns" />
            <MetricCard
              label={tr("realCpa")}
              value={cplVerified}
              color="verified"
              verified
              icon={Target}
              href="/dashboard/campaigns"
              trend={
                cplVerifiedComparison?.changePct != null ? (
                  <span className={`text-xs ${cplVerifiedComparison.changePct < 0 ? "text-verified" : "text-critical"}`}>
                    {cplVerifiedComparison.changePct < 0 ? "▼" : "▲"} {Math.abs(cplVerifiedComparison.changePct)}% {tr("vsPrevPeriod")}
                  </span>
                ) : undefined
              }
            />
            <MetricCard label={tr("trackingAccuracy")} value={`${trackingAccuracy}%`} color="accent" icon={Activity} href="/dashboard/diagnostics" />
          </div>

          {setup.allDone && (
            <div className="mb-4">
              <RecentActivityPanel rows={activityRows} locale={locale} />
            </div>
          )}

          {/* جدول الأداء حسب المصدر */}
          {sourceRows.length > 0 && (
            <div className="mb-4">
              <SourcePerformanceTable rows={sourceRows} />
              {platformInsight && <p className="mt-2 px-1 text-[13px] text-text-muted">💡 {platformInsight}</p>}
            </div>
          )}

          {/* الإيراد لكل منصة - مقارنة الإيراد بإنفاقه وعائده */}
          {revenueRows.length > 0 && (
            <div className="mb-4">
              <RevenueByPlatform
                rows={revenueRows}
                currency={workspace.currency}
                breakEvenRoas={breakEvenRoas}
              />
            </div>
          )}

          {/* توزيع دائري (دواير) + كيرف الاتجاه */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <PlatformDonut data={sourceRows.map((r) => ({ platform: r.platform, value: r.verifiedConversions }))} />
            {trendData.length > 1 && (
              <div className="rounded-2xl card-shadow border border-border bg-surface p-6">
                <div className="mb-3 text-[13px] text-text-muted">{tr("trend14")}</div>
                <TrendChart data={trendData} />
              </div>
            )}
          </div>
        </>
      )}

      {urgentActionItems.length > 0 && (
        <div className="mb-6 mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] text-text-muted">{tr("pendingDecisions")}</span>
            <a href="/dashboard/actions" className="text-xs text-accent no-underline">
              {tr("viewAllArrow")}
            </a>
          </div>
          <div className="flex flex-col gap-1">
            {urgentActionItems.map((item: any) => (
              <a
                key={item.id}
                href="/dashboard/actions"
                className="flex items-center gap-2.5 rounded-xl card-shadow border border-border bg-surface px-3.5 py-3 text-[13.5px] text-text-primary no-underline transition-colors hover:bg-surface-raised"
              >
                <PriorityDot priority={item.severity} />
                <span>{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 mt-6 text-[13px] text-text-muted">{tr("todayTasks")}</div>
      {todaysTasks.length === 0 ? (
        <div className="py-3 text-sm text-text-faint">{tr("noTasks")}</div>
      ) : (
        <div className="flex flex-col gap-1">
          {todaysTasks.map((task: DailyTask) => (
            <a
              key={task.id}
              href="/dashboard/diagnostics"
              className="flex items-center gap-2.5 rounded-xl card-shadow border border-border bg-surface px-3.5 py-3 text-[13.5px] text-text-primary no-underline transition-colors hover:bg-surface-raised"
            >
              <PriorityDot priority={task.priority} />
              <span>{task.title}</span>
            </a>
          ))}
        </div>
      )}

      {hasAnyData && (
        <div className="mt-6">
          <MetricsExplorer workspaceId={workspace.id} locale={locale} />
        </div>
      )}
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colorClass =
    priority === "URGENT" ? "bg-critical" : priority === "HIGH" ? "bg-gap" : "bg-text-faint";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colorClass}`} />;
}
