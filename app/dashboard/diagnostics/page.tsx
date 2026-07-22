// app/dashboard/diagnostics/page.tsx
//
// "التشخيص" - لوحة حالة لكل نوع فحص (مش قائمة نصية بس)، وسجل بالمشاكل
// اللي اتحلت مؤخراً عشان تعرف الحساب بيتحسن ولا بيتدهور بمرور الوقت.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getExchangeRateImpact, detectMarketWideMove, computeCampaignCplChanges } from "@/lib/marketContext";
import { detectSuspiciousIPs } from "@/lib/qualitySignals";
import { auditBidStrategySanity } from "@/lib/bidStrategyAudit";
import { auditMetaBidStrategy } from "@/lib/metaBidStrategyAudit";
import { DataConsistencyCheck } from "./DataConsistencyCheck";
import {
  Search, Ban, Tag, TrendingDown, Gauge, DollarSign, Zap,
  Star, ThumbsDown, Radar, AlertTriangle,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; Icon: any }> = {
  PRICING_RISK: { label: "خطر التسعير", Icon: DollarSign },
  SEARCH_TERMS: { label: "مصطلحات البحث", Icon: Search },
  NEGATIVE_KEYWORDS: { label: "الكلمات السلبية", Icon: Ban },
  TRACKING_HEALTH: { label: "صحة التتبع", Icon: Gauge },
  TAG_HEALTH: { label: "صحة الوسم", Icon: Tag },
  CTR_DROP: { label: "انخفاض CTR", Icon: TrendingDown },
  PAGE_SPEED: { label: "سرعة الصفحة", Icon: Zap },
  BUDGET_PACING: { label: "وتيرة الميزانية", Icon: DollarSign },
  AD_FATIGUE: { label: "تعب الإعلان", Icon: TrendingDown },
  QUALITY_SCORE: { label: "درجة الجودة", Icon: Star },
  DISAPPROVED_ADS: { label: "إعلانات مرفوضة", Icon: ThumbsDown },
  COMPETITOR_ACTIVITY: { label: "نشاط المنافسين", Icon: Radar },
  ANOMALY: { label: "شذوذ في البيانات", Icon: AlertTriangle },
};

const CATEGORY_ORDER = Object.keys(CATEGORY_META);

export default async function DiagnosticsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [activeTasks, resolvedTasks] = await Promise.all([
    prisma.dailyTask.findMany({
      where: { workspaceId: workspace.id, completed: false },
      orderBy: { priority: "desc" },
    }),
    prisma.dailyTask.findMany({
      where: { workspaceId: workspace.id, completed: true, completedAt: { gte: sevenDaysAgo } },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
  ]);

  // لكل فئة، بنحدد الحالة الحالية من أخطر مهمة نشطة فيها (لو موجودة)
  const statusByCategory = new Map<string, { priority: string; count: number }>();
  for (const task of activeTasks) {
    const existing = statusByCategory.get(task.category);
    if (!existing || priorityRank(task.priority) > priorityRank(existing.priority)) {
      statusByCategory.set(task.category, {
        priority: task.priority,
        count: (existing?.count ?? 0) + 1,
      });
    } else {
      statusByCategory.set(task.category, { ...existing, count: existing.count + 1 });
    }
  }

  const healthyCount = CATEGORY_ORDER.length - statusByCategory.size;
  const overallScore = Math.round((healthyCount / CATEGORY_ORDER.length) * 100);

  // ==== فحوصات النظام الإضافية - بيانات حقيقية، مش دوال معلّقة من غير استخدام ====

  const exchangeImpact = await getExchangeRateImpact("USD", workspace.currency);

  // ضغط السوق العام - دالة مشتركة (lib/marketContext.ts) عشان نفس الحساب
  // يتكرر في محرك الأتمتة أيضاً بدل ما يتكتب مرتين ويختلفوا
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const cplChanges = await computeCampaignCplChanges(workspace.id);
  const marketWide = detectMarketWideMove(cplChanges);

  // كشف البوتات - من بيانات الضغطات الفعلية المسجّلة
  // CtaClickEvent مالوش IP (ده في UnmatchedClick) - بنمرّر ipAddress: null
  // عشان كشف توقيع البوت بالـ userAgent يشتغل، وكشف IP يتخطاها تلقائياً
  const recentClicks = await prisma.ctaClickEvent.findMany({
    where: { workspaceId: workspace.id, clickedAt: { gte: sevenDaysAgo } },
    select: { clickedAt: true, userAgent: true },
  });
  const botFlags = detectSuspiciousIPs(
    recentClicks.map((c) => ({ ...c, ipAddress: null }))
  ).filter((f) => f.isSuspicious);

  // منطقية استراتيجية المزايدة - من بيانات مخزّنة (Google Ads بس، بتتحدث
  // يومياً بالـ cron) + تكلفة العميل الحقيقية/العائد الفعلي المحسوبين
  // من MetricSnapshot آخر 30 يوم
  const campaignLinksWithBidding = await prisma.campaignLink.findMany({
    where: { workspaceId: workspace.id, platform: "GOOGLE_ADS", biddingStrategyType: { not: null } },
  });

  const bidSanityResults = await Promise.all(
    campaignLinksWithBidding.map(async (link: any) => {
      const agg = await prisma.metricSnapshot.aggregate({
        where: { workspaceId: workspace.id, campaignId: link.externalCampaignId, date: { gte: thirtyDaysAgo } },
        _sum: { cost: true, verifiedConversions: true },
      });
      const verified = agg._sum.verifiedConversions ?? 0;
      const cost = agg._sum.cost ?? 0;

      return auditBidStrategySanity(
        {
          campaignId: link.externalCampaignId,
          campaignName: link.campaignName,
          biddingStrategyType: link.biddingStrategyType,
          targetCpa: link.targetCpa,
          targetRoas: link.targetRoas,
          verifiedCpa: verified > 0 ? cost / verified : null,
          verifiedRoas: null, // العائد الحقيقي الكامل محتاج بيانات إيرادات إيكومرس - مش متاحة لكل الحسابات
        },
        verified
      );
    })
  );
  const divergentBidStrategies = bidSanityResults.filter((r) => r.status === "DIVERGENT");

  // منطقية استراتيجية المزايدة في ميتا - على مستوى المجموعة الإعلانية
  // (مش الحملة)، لأن bid_amount عند ميتا مضبوط هناك تحديداً
  const metaAdSets = await prisma.metaAdSetSnapshot.findMany({
    where: { workspaceId: workspace.id, bidStrategyType: { not: null } },
  });
  const metaBidSanityResults = metaAdSets.map((adSet: any) =>
    auditMetaBidStrategy(
      {
        adSetId: adSet.adSetId,
        adSetName: adSet.adSetName,
        bidStrategyType: adSet.bidStrategyType,
        bidAmount: adSet.bidAmount,
        verifiedCpa: adSet.conversions > 0 ? adSet.cost / adSet.conversions : null,
      },
      adSet.conversions
    )
  );
  const divergentMetaBidStrategies = metaBidSanityResults.filter((r: any) => r.status === "DIVERGENT");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[26px] font-semibold text-text-primary">التشخيص</h1>
        <a
          href="/dashboard/diagnostics/tracking-coverage"
          className="rounded-full bg-surface px-4 py-1.5 text-xs text-text-muted no-underline hover:text-text-primary"
        >
          تغطية التتبع →
        </a>
      </div>

      {/* درجة التشخيص الإجمالية */}
      <div className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-surface py-1.5 pe-4 ps-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised font-mono text-[11px] font-semibold text-text-muted">
          {overallScore}
        </div>
        <span className="text-xs text-text-muted">
          {healthyCount} من {CATEGORY_ORDER.length} فحص سليم
        </span>
      </div>

      {/* لوحة الحالة - كارت لكل فحص */}
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_META[category];
          const status = statusByCategory.get(category);
          const statusColor = !status
            ? "text-verified"
            : status.priority === "URGENT"
            ? "text-critical"
            : status.priority === "HIGH"
            ? "text-gap"
            : "text-text-muted";

          return (
            <div key={category} className="rounded-2xl bg-surface p-4">
              <meta.Icon size={16} className={`mb-2 ${statusColor}`} />
              <div className="text-xs text-text-muted">{meta.label}</div>
              <div className={`mt-1 text-xs font-medium ${statusColor}`}>
                {status ? `${status.count} مشكلة` : "سليم"}
              </div>
            </div>
          );
        })}
      </div>

      {/* المشاكل النشطة */}
      <div className="mb-2 text-[13px] text-text-muted">المشاكل النشطة</div>
      {activeTasks.length === 0 ? (
        <EmptyState title="لا توجد مشاكل نشطة حالياً" description="كل الفحوصات سليمة." />
      ) : (
        <div className="mb-8 flex flex-col gap-1">
          {activeTasks.map((task: any) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-[13.5px] text-text-primary"
            >
              <PriorityDot priority={task.priority} />
              <span className="flex-1">{task.title}</span>
              <span className="text-xs text-text-faint">{CATEGORY_META[task.category]?.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* السجل - آخر 7 أيام */}
      {resolvedTasks.length > 0 && (
        <>
          <div className="mb-2 text-[13px] text-text-muted">اتحل مؤخراً</div>
          <div className="flex flex-col gap-1">
            {resolvedTasks.map((task: any) => (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] text-text-faint line-through"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-verified" />
                <span className="flex-1">{task.title}</span>
                <span className="text-xs no-underline">
                  {task.completedAt && new Date(task.completedAt).toLocaleDateString("ar")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* فحوصات النظام - سعر الصرف، ضغط السوق، البوتات، تطابق البيانات */}
      <div className="mb-2 mt-6 text-[13px] text-text-muted">فحوصات النظام</div>
      <div className="flex flex-col gap-2">
        {exchangeImpact.hasEnoughHistory && Math.abs(exchangeImpact.rateChangePct) >= 1 && (
          <div className="rounded-2xl bg-surface p-4 text-xs text-text-muted">
            {exchangeImpact.impactExplanation}
          </div>
        )}

        {marketWide.isMarketWide && (
          <div className="rounded-2xl bg-gap/10 p-4 text-xs text-gap">{marketWide.explanation}</div>
        )}

        {botFlags.length > 0 && (
          <div className="rounded-2xl bg-critical/10 p-4">
            <div className="mb-1 text-sm text-critical">نشاط مشبوه في الكليكات</div>
            {botFlags.map((f) => (
              <p key={f.ipAddress} className="text-xs text-text-muted">
                {f.ipAddress}: {f.signals.join("، ")} (ثقة {f.suspicionScore}%)
              </p>
            ))}
          </div>
        )}

        {divergentBidStrategies.length > 0 && (
          <div className="rounded-2xl bg-gap/10 p-4">
            <div className="mb-1 text-sm text-gap">أهداف مزايدة غير منطقية (جوجل)</div>
            {divergentBidStrategies.map((r) => (
              <p key={r.campaignId} className="text-xs text-text-muted">
                <strong className="text-text-primary">{r.campaignName}:</strong> {r.message}
              </p>
            ))}
          </div>
        )}

        {divergentMetaBidStrategies.length > 0 && (
          <div className="rounded-2xl bg-gap/10 p-4">
            <div className="mb-1 text-sm text-gap">أهداف مزايدة غير منطقية (ميتا)</div>
            {divergentMetaBidStrategies.map((r: any) => (
              <p key={r.adSetId} className="text-xs text-text-muted">
                <strong className="text-text-primary">{r.adSetName ?? r.adSetId}:</strong> {r.message}
              </p>
            ))}
          </div>
        )}

        <DataConsistencyCheck workspaceId={workspace.id} />
      </div>
    </div>
  );
}

function priorityRank(p: string): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 }[p] ?? 0;
}

function PriorityDot({ priority }: { priority: string }) {
  const colorClass =
    priority === "URGENT" ? "bg-critical" : priority === "HIGH" ? "bg-gap" : "bg-text-faint";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colorClass}`} />;
}
