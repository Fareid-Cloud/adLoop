// app/dashboard/page.tsx
//
// "لمحة" - الصفحة الرئيسية. Server Component بيقرا من قاعدة البيانات مباشرة.
// اللغة البصرية المحورية: "الحقيقة مقابل ما تقوله المنصات" (طبقة الحقيقة) -
// الرقم المعلن جنب الرقم المتحقّق منه فعلاً، والفجوة بينهم تقود كل قرار.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DailyTask } from "@prisma/client";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { SourcePerformanceTable, type SourceRow } from "@/app/components/SourcePerformanceTable";
import { PlatformDonut } from "@/app/components/PlatformDonut";
import { TrendChart } from "@/app/components/TrendChart";
import { MetricsExplorer } from "@/app/components/MetricsExplorer";
import { computeHealthScore } from "@/lib/healthScore";
import { computeMetrics, comparePlatforms } from "@/lib/metricsEngine";
import { compareMetric } from "@/lib/periodComparison";
import { Megaphone, ShieldCheck, Wallet, Target, Activity } from "lucide-react";
import { TrackingAccuracyGauge } from "@/app/components/ui/TrackingAccuracyGauge";
import { ReportedVsActualBars } from "@/app/components/ui/ReportedVsActualBars";

const AD_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export default async function GlancePage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">
        انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.
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
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [totalsAgg, byPlatform, byPlatformPrev, dailySnapshots, todaysTasks, urgentActionItems, valueConfig, previousPeriodAgg] =
    await Promise.all([
      prisma.metricSnapshot.aggregate({
        where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
        _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
      }),
      prisma.metricSnapshot.groupBy({
        by: ["platform"],
        where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
        _sum: { clicks: true, verifiedConversions: true, cost: true, rawConversions: true, impressions: true },
      }),
      prisma.metricSnapshot.groupBy({
        by: ["platform"],
        where: { workspaceId: workspace.id, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { verifiedConversions: true, cost: true },
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
        where: { workspaceId: workspace.id, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
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

  const health = computeHealthScore({ tracking: null, landing: null, ads: null, audience: null, creatives: null });
  const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">أهلاً، {firstName}</h1>
        <div className="inline-flex items-center gap-2.5 rounded-full card-shadow border border-border bg-surface py-1.5 pe-4 ps-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised font-mono text-[11px] font-semibold text-text-muted">
            {health.overallScore || "—"}
          </div>
          <span className="text-xs text-text-muted">
            درجة الصحة — {health.isComplete ? "مكتملة" : "بانتظار ربط الحسابات"}
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          title="لا توجد بيانات بعد في مساحة العمل هذه"
          description="اربط حساب Google Ads أو منصة أخرى من الإعدادات لتبدأ رؤية الأرقام هنا."
        />
      ) : (
        <>
          {/* هيرو طبقة الحقيقة - المعلن مقابل المتحقّق منه فعلاً */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl card-shadow border border-border bg-surface p-6">
              <div className="mb-4 text-[13px] font-medium text-text-muted">الحقيقة مقابل ما تقوله المنصات</div>
              <div className="flex flex-wrap items-end gap-8">
                <div>
                  <div className="mb-1 text-xs text-text-faint">تحويلات معلنة (حسب المنصات)</div>
                  <div className="border-b border-dashed border-text-faint pb-1 font-mono text-[38px] font-medium leading-none text-text-muted">
                    {fmt(totalRaw)}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-text-faint">متحقّق منها فعلياً</div>
                  <div className="flex items-baseline gap-2 font-mono text-[38px] font-medium leading-none text-verified">
                    {fmt(totalVerified)}
                    <span className="text-lg text-verified" title="رقم متحقق منه">✓</span>
                  </div>
                </div>
              </div>
              {inflationPct > 0 && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gap/10 px-3 py-2 text-[13px] text-gap">
                  <Megaphone size={15} />
                  المنصات تبالغ في التحويلات بنسبة {inflationPct}% مقارنةً بالمتحقّق منه فعلياً.
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
            <MetricCard label="الإنفاق (آخر 30 يوم)" value={fmt(totalCost)} icon={Wallet} href="/dashboard/campaigns" />
            <MetricCard label="تحويلات محقّقة" value={fmt(totalVerified)} color="verified" verified icon={ShieldCheck} href="/dashboard/campaigns" />
            <MetricCard
              label="تكلفة العميل الحقيقية"
              value={cplVerified}
              color="verified"
              verified
              icon={Target}
              href="/dashboard/campaigns"
              trend={
                cplVerifiedComparison?.changePct != null ? (
                  <span className={`text-xs ${cplVerifiedComparison.changePct < 0 ? "text-verified" : "text-critical"}`}>
                    {cplVerifiedComparison.changePct < 0 ? "▼" : "▲"} {Math.abs(cplVerifiedComparison.changePct)}% عن الفترة السابقة
                  </span>
                ) : undefined
              }
            />
            <MetricCard label="دقة التتبع" value={`${trackingAccuracy}%`} color="accent" icon={Activity} href="/dashboard/diagnostics" />
          </div>

          {/* جدول الأداء حسب المصدر */}
          {sourceRows.length > 0 && (
            <div className="mb-4">
              <SourcePerformanceTable rows={sourceRows} />
              {platformInsight && <p className="mt-2 px-1 text-[13px] text-text-muted">💡 {platformInsight}</p>}
            </div>
          )}

          {/* توزيع دائري (دواير) + كيرف الاتجاه */}
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <PlatformDonut data={sourceRows.map((r) => ({ platform: r.platform, value: r.verifiedConversions }))} />
            {trendData.length > 1 && (
              <div className="rounded-2xl card-shadow border border-border bg-surface p-6">
                <div className="mb-3 text-[13px] text-text-muted">اتجاه آخر 14 يوماً</div>
                <TrendChart data={trendData} />
              </div>
            )}
          </div>
        </>
      )}

      {urgentActionItems.length > 0 && (
        <div className="mb-6 mt-6">
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
                className="flex items-center gap-2.5 rounded-xl card-shadow border border-border bg-surface px-3.5 py-3 text-[13.5px] text-text-primary no-underline transition-colors hover:bg-surface-raised"
              >
                <PriorityDot priority={item.severity} />
                <span>{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 mt-6 text-[13px] text-text-muted">مهام اليوم</div>
      {todaysTasks.length === 0 ? (
        <div className="py-3 text-sm text-text-faint">لا توجد مهام لليوم بعد.</div>
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
          <MetricsExplorer workspaceId={workspace.id} />
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
