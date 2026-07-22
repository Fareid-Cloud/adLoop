// app/dashboard/page.tsx
//
// "لمحة" - أول صفحة تفتح عليها. Server Component بيقرا من قاعدة البيانات
// الحقيقية مباشرة - لو مفيش Workspace أصلاً، بيوري فورم الإنشاء بدل ما
// يفترض وجود بيانات مش موجودة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DailyTask } from "@prisma/client";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PlatformBreakdown } from "@/app/components/PlatformBreakdown";
import { TrendChart } from "@/app/components/TrendChart";
import { MetricsExplorer } from "@/app/components/MetricsExplorer";
import { computeHealthScore } from "@/lib/healthScore";
import { computeMetrics, comparePlatforms } from "@/lib/metricsEngine";
import { compareMetric } from "@/lib/periodComparison";
import { Megaphone, ShieldCheck } from "lucide-react";
import { TrackingAccuracyGauge } from "@/app/components/ui/TrackingAccuracyGauge";
import { ReportedVsActualBars } from "@/app/components/ui/ReportedVsActualBars";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
  SALLA: "سلة",
  SHOPIFY: "شوبيفاي",
  EASY_ORDERS: "إيزي أوردرز",
  MANUAL_UPLOAD: "رفع يدوي",
};

export default async function GlancePage() {
  const user = await getSessionUserFromCookies();
  // middleware.ts أصلاً بيمنع الوصول من غير جلسة، لكن فحص دفاعي هنا يمنع
  // أي خطأ غامض لو الجلسة كانت موجودة لكن فسدت (توكن منتهي مثلاً)
  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">
        الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.
      </div>
    );
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    const { CreateWorkspaceForm } = await import("./CreateWorkspaceForm");
    return <CreateWorkspaceForm />;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // إصلاح فجوة حقيقية: resolvePeriodComparison/compareMetric كانتا
  // مبنيتين ومعزولتين تماماً - أول استخدام حقيقي هنا لمقارنة "آخر 30
  // يوم" بـ"الـ30 يوم اللي قبلها" (نفس طول الفترة، عادل للمقارنة)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [totalsAgg, byPlatform, dailySnapshots, todaysTasks, urgentActionItems, valueConfig, previousPeriodAgg] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
      _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
    prisma.metricSnapshot.groupBy({
      by: ["platform"],
      where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
      _sum: { clicks: true, verifiedConversions: true, cost: true, rawConversions: true, impressions: true },
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
    // معاينة سريعة لأعلى 3 قرارات معلّقة - "لمحة" مفروض تديك أهم حاجة
    // بس مع رابط للتفاصيل، مش تكرار صفحة القرارات كاملة هنا
    prisma.actionFeedItem.findMany({
      where: { workspaceId: workspace.id, status: "PENDING", type: { in: ["SUGGESTION", "ALERT"] } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
    prisma.conversionValueConfig.findUnique({ where: { workspaceId: workspace.id } }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      _sum: { cost: true, rawConversions: true, verifiedConversions: true },
    }),
  ]);

  const totalClicks = totalsAgg._sum.clicks ?? 0;
  const totalVerified = totalsAgg._sum.verifiedConversions ?? 0;
  const totalRaw = totalsAgg._sum.rawConversions ?? 0;
  const totalCost = totalsAgg._sum.cost ?? 0;

  const cplRaw = totalRaw > 0 ? (totalCost / totalRaw).toFixed(1) : "—";
  const cplVerified = totalVerified > 0 ? (totalCost / totalVerified).toFixed(1) : "—";
  const hasAnyData = totalClicks > 0 || totalVerified > 0;

  // مقارنة فترة بفترة - آخر 30 يوم مقابل الـ30 يوم اللي قبلها
  const prevVerified = previousPeriodAgg._sum.verifiedConversions ?? 0;
  const prevCost = previousPeriodAgg._sum.cost ?? 0;
  const prevCplVerified = prevVerified > 0 ? prevCost / prevVerified : 0;
  const currentCplVerified = totalVerified > 0 ? totalCost / totalVerified : 0;
  const cplVerifiedComparison = prevCplVerified > 0 && currentCplVerified > 0
    ? compareMetric(currentCplVerified, prevCplVerified)
    : null;

  const platforms = byPlatform.map((p: { platform: string; _sum: { clicks: number | null; verifiedConversions: number | null } }) => ({
    platform: p.platform,
    platformLabel: PLATFORM_LABELS[p.platform] ?? p.platform,
    verified: p._sum.verifiedConversions ?? 0,
    reported: p._sum.clicks ?? 0,
  }));

  // إصلاح فجوة حقيقية: computeMetrics/comparePlatforms كانتا مبنيتين
  // بعناية بس معزولتين تماماً - صفر صفحة بتستخدمهم. هنا أول استخدام حقيقي.
  const platformInsight = (() => {
    const withCost = byPlatform.filter((p: any) => (p._sum.cost ?? 0) > 0 && ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"].includes(p.platform));
    if (withCost.length < 2) return null; // مقارنة محتاجة منصتين على الأقل

    const computedPerPlatform = withCost.map((p: any) =>
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

    return comparePlatforms(computedPerPlatform, "ar").insight;
  })();

  // بنجمع الـ snapshots اليومية (ممكن يكون فيه أكتر من منصة في نفس اليوم)
  // في نقطة واحدة لكل تاريخ، عشان الرسم البياني يبقى مقروء
  const trendByDate = new Map<string, { verified: number; reported: number }>();
  for (const snap of dailySnapshots) {
    const key = snap.date.toISOString().slice(5, 10); // MM-DD
    const existing = trendByDate.get(key) ?? { verified: 0, reported: 0 };
    existing.verified += snap.verifiedConversions;
    existing.reported += snap.clicks;
    trendByDate.set(key, existing);
  }
  const trendData = Array.from(trendByDate.entries()).map(([date, v]) => ({ date, ...v }));

  // Health Score - لسه من غير بيانات كافية لحساب مكوناته الفرعية الحقيقية
  // (محتاجة تكامل مع باقي الأنظمة أولاً) - بنوريها "null" بدل ما نخترع أرقام
  const health = computeHealthScore({
    tracking: null,
    landing: null,
    ads: null,
    audience: null,
    creatives: null,
  });

  const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-5 text-[28px] font-semibold tracking-tight text-text-primary">
        أهلاً، {firstName}
      </h1>

      {/* Health Score - صغير وبعد الترحيب مباشرة، زي Optimization Score في
          Google Ads بالظبط - مش شريط عريض بعرض الصفحة */}
      <div className="mb-7 inline-flex items-center gap-2.5 rounded-full bg-surface py-1.5 pe-4 ps-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised font-mono text-[11px] font-semibold text-text-muted">
          {health.overallScore || "—"}
        </div>
        <span className="text-xs text-text-muted">
          درجة الصحة — {health.isComplete ? "مكتملة" : "بانتظار ربط الحسابات"}
        </span>
      </div>

      {!hasAnyData ? (
        <EmptyState
          title="مفيش بيانات لسه في مساحة العمل دي"
          description="اربط حساب Google Ads أو منصة تانية من الإعدادات عشان تبدأ تشوف الأرقام هنا."
        />
      ) : (
        <>
          <div className="mb-3">
            <PlatformBreakdown platforms={platforms} />
            {platformInsight && (
              <p className="mt-2 text-[13px] text-text-muted">💡 {platformInsight}</p>
            )}
          </div>

          {trendData.length > 1 && (
            <div className="mb-3 rounded-2xl bg-surface p-6">
              <div className="mb-3 text-[13px] text-text-muted">اتجاه آخر 14 يوم</div>
              <TrendChart data={trendData} />
            </div>
          )}

          <div className="mb-8 grid grid-cols-2 gap-3">
            <MetricCard
              label="تكلفة العميل المعلنة"
              value={cplRaw}
              color="gap"
              verified={false}
              icon={Megaphone}
              href="/dashboard/campaigns"
            />
            <MetricCard
              label="تكلفة العميل الحقيقية"
              value={cplVerified}
              color="verified"
              verified={true}
              icon={ShieldCheck}
              href="/dashboard/campaigns"
              trend={
                cplVerifiedComparison?.changePct !== null && cplVerifiedComparison !== null ? (
                  <span className={`text-xs ${cplVerifiedComparison.changePct! < 0 ? "text-verified" : "text-critical"}`}>
                    {cplVerifiedComparison.changePct! < 0 ? "▼" : "▲"} {Math.abs(cplVerifiedComparison.changePct!)}% عن الـ30 يوم اللي فاتوا
                  </span>
                ) : undefined
              }
            />
          </div>

          {(totalRaw > 0 || totalVerified > 0) && (
            <div className="mb-8 flex items-center justify-around rounded-2xl bg-surface p-6">
              <TrackingAccuracyGauge verified={totalVerified} raw={totalRaw} />
              <ReportedVsActualBars reported={totalRaw} actual={totalVerified} />
            </div>
          )}
        </>
      )}

      {urgentActionItems.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] text-text-muted">أهم القرارات المعلّقة</span>
            <a href="/dashboard/actions" className="text-xs text-accent no-underline">
              عرض الكل ←
            </a>
          </div>
          <div className="flex flex-col gap-1">
            {urgentActionItems.map((item: any) => (
              <a
                key={item.id}
                href="/dashboard/actions"
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] text-text-primary no-underline transition-colors hover:bg-surface"
              >
                <PriorityDot priority={item.severity} />
                <span>{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 text-[13px] text-text-muted">مهام اليوم</div>
      {todaysTasks.length === 0 ? (
        <div className="py-3 text-sm text-text-faint">لا توجد مهام لليوم بعد.</div>
      ) : (
        <div className="flex flex-col gap-1">
          {todaysTasks.map((task: DailyTask) => (
            <a
              key={task.id}
              href="/dashboard/diagnostics"
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] text-text-primary no-underline transition-colors hover:bg-surface"
            >
              <PriorityDot priority={task.priority} />
              <span>{task.title}</span>
            </a>
          ))}
        </div>
      )}

      {hasAnyData && (
        <div className="mt-6">
          <MetricsExplorer workspaceId={workspace.id} />
        </div>
      )}
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colorClass =
    priority === "URGENT"
      ? "bg-critical"
      : priority === "HIGH"
      ? "bg-gap"
      : "bg-text-faint";

  return <span className={`h-2 w-2 shrink-0 rounded-full ${colorClass}`} />;
}
