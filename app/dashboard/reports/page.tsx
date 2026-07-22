// app/dashboard/reports/page.tsx
//
// تقرير مكتوب فعلي (مش داشبورد تفاعلي) - نص تنفيذي + جداول تفصيلية،
// جاهز للطباعة أو الحفظ كـ PDF عن طريق طباعة المتصفح نفسه (window.print
// في PrintButton.tsx) - بدون أي خدمة أو مكتبة PDF خارجية.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PrintButton } from "./PrintButton";
import { ReportActions } from "./ReportActions";
import { runPricingHealthCheck } from "@/lib/ecommerceMetrics";
import { applyModeledAttribution } from "@/lib/metricsEngine";
import { getAttributionSummaryForWorkspace } from "@/lib/attributionSummary";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل", META_ADS: "ميتا", TIKTOK_ADS: "تيك توك", SNAPCHAT_ADS: "سناب شات",
};

const CATEGORY_LABELS: Record<string, string> = {
  PRICING_RISK: "خطر التسعير", SEARCH_TERMS: "مصطلحات البحث", NEGATIVE_KEYWORDS: "الكلمات السلبية",
  TRACKING_HEALTH: "صحة التتبع", TAG_HEALTH: "صحة الوسم", CTR_DROP: "انخفاض CTR",
  PAGE_SPEED: "سرعة الصفحة", BUDGET_PACING: "وتيرة الميزانية", AD_FATIGUE: "تعب الإعلان",
  QUALITY_SCORE: "درجة الجودة", DISAPPROVED_ADS: "إعلانات مرفوضة",
  COMPETITOR_ACTIVITY: "نشاط المنافسين", ANOMALY: "شذوذ في البيانات",
};

export default async function ReportsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لسه معملتش مساحة عمل" description="ارجع لـ لمحة عشان تنشئ أول مساحة عمل." />;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalsAgg, byPlatform, campaignLinks, campaignAgg, products, activeIssues] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
      _sum: { impressions: true, clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
    prisma.metricSnapshot.groupBy({
      by: ["platform"],
      where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
      _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
    prisma.campaignLink.findMany({ where: { workspaceId: workspace.id } }),
    prisma.metricSnapshot.groupBy({
      by: ["platform", "campaignId"],
      where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
      _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
    prisma.product.findMany({ where: { workspaceId: workspace.id } }),
    prisma.dailyTask.groupBy({
      by: ["category"],
      where: { workspaceId: workspace.id, completed: false },
      _count: true,
    }),
  ]);

  const totals = {
    impressions: totalsAgg._sum.impressions ?? 0,
    clicks: totalsAgg._sum.clicks ?? 0,
    cost: totalsAgg._sum.cost ?? 0,
    raw: totalsAgg._sum.rawConversions ?? 0,
    verified: totalsAgg._sum.verifiedConversions ?? 0,
  };

  // إصلاح فجوة حقيقية: الـtoggle "useModeledAttribution" كان موجود في
  // الإعدادات، والدالة اللي تنفّذه (applyModeledAttribution) كانت مبنية
  // من زمان، لكن مفيش خيط واحد بيوصل بينهم - التقرير كان بيحسب
  // verified الخام بس دايماً بغض النظر عن اختيار المستخدم.
  let modeledConversions = 0;
  if (workspace.useModeledAttribution) {
    const attribution = await getAttributionSummaryForWorkspace(workspace.id, thirtyDaysAgo, new Date());
    const totalModeledContribution = Object.values(attribution.byPlatform).reduce((s, v) => s + v, 0);
    // platform هنا قيمة شكلية بس - النوع RawMetrics مصمم لبيانات منصة
    // واحدة، لكن إحنا بنجمع كل المنصات مع بعض هنا (والحقل مش مستخدم فعلياً
    // جوه applyModeledAttribution). اكتشفنا كمان إن النوع نفسه قديم -
    // مافيهوش TIKTOK_ADS خالص، فجوة تصميم منفصلة تستاهل مراجعة لاحقاً
    const applied = applyModeledAttribution(
      { platform: "MANUAL_UPLOAD", impressions: totals.impressions, clicks: totals.clicks, cost: totals.cost, rawConversions: totals.raw, verifiedConversions: totals.verified },
      totalModeledContribution,
      true
    );
    modeledConversions = applied.modeledConversions;
  }
  const verifiedPlusModeled = totals.verified + modeledConversions;

  const cplRaw = totals.raw > 0 ? round2(totals.cost / totals.raw) : 0;
  const cplVerified = totals.verified > 0 ? round2(totals.cost / totals.verified) : 0;
  const cplVerifiedPlusModeled = verifiedPlusModeled > 0 ? round2(totals.cost / verifiedPlusModeled) : 0;
  const inflationPct = totals.raw > 0 ? round2(((totals.raw - totals.verified) / totals.raw) * 100) : 0;

  interface CampaignAgg { clicks: number; cost: number; raw: number; verified: number; }

  const campaignAggMap = new Map<string, CampaignAgg>(
    campaignAgg.map((a: any) => [
      `${a.platform}::${a.campaignId}`,
      { clicks: a._sum.clicks ?? 0, cost: a._sum.cost ?? 0, raw: a._sum.rawConversions ?? 0, verified: a._sum.verifiedConversions ?? 0 },
    ])
  );

  const avgRto = products.length > 0 ? products.reduce((s: number, p: any) => s + p.rtoRatePct, 0) / products.length : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
          <h1 className="text-[26px] font-semibold text-text-primary">التقرير الشهري</h1>
        </div>
        <div className="flex gap-2">
          <ReportActions workspaceId={workspace.id} />
          <PrintButton />
        </div>
      </div>

      <div className="print-area">
        <p className="mb-6 text-sm leading-7 text-text-muted">
          تقرير أداء آخر 30 يوماً لمساحة عمل <strong className="text-text-primary">{workspace.name}</strong>.
          إجمالي الإنفاق <strong className="text-text-primary">{totals.cost.toLocaleString()}</strong> {workspace.currency}،
          حقق <strong className="text-verified">{totals.verified}</strong> محادثة موثّقة فعلياً من أصل{" "}
          <strong className="text-gap">{totals.raw}</strong> تحويل معلن من المنصات — بفارق تضخيم قدره{" "}
          <strong className={inflationPct > 30 ? "text-critical" : "text-text-primary"}>{inflationPct}%</strong>.
        </p>

        <SectionTitle>الملخص العام</SectionTitle>
        <Table
          headers={["المقياس", "القيمة"]}
          rows={[
            ["الظهور", totals.impressions.toLocaleString()],
            ["الكليكات", totals.clicks.toLocaleString()],
            ["التكلفة الإجمالية", `${totals.cost.toLocaleString()} ${workspace.currency}`],
            ["تكلفة العميل المعلنة", String(cplRaw)],
            ["تكلفة العميل الحقيقية", String(cplVerified)],
            ...(workspace.useModeledAttribution
              ? [["تكلفة العميل (متحقق + منسّب احتمالياً)", String(cplVerifiedPlusModeled)]]
              : []),
            ["نسبة التضخيم", `${inflationPct}%`],
          ]}
        />

        <SectionTitle>الأداء حسب المنصة</SectionTitle>
        <Table
          headers={["المنصة", "الكليكات", "التكلفة", "تكلفة العميل الحقيقية"]}
          rows={byPlatform.map((p: any) => {
            const verified = p._sum.verifiedConversions ?? 0;
            const cost = p._sum.cost ?? 0;
            return [
              PLATFORM_LABELS[p.platform] ?? p.platform,
              (p._sum.clicks ?? 0).toLocaleString(),
              cost.toLocaleString(),
              verified > 0 ? String(round2(cost / verified)) : "—",
            ];
          })}
        />

        <SectionTitle>تفصيل الحملات</SectionTitle>
        <Table
          headers={["الحملة", "المنصة", "الكليكات", "التكلفة", "تحويلات حقيقية"]}
          rows={campaignLinks.map((link: any) => {
            const agg: CampaignAgg = campaignAggMap.get(`${link.platform}::${link.externalCampaignId}`) ?? {
              clicks: 0, cost: 0, raw: 0, verified: 0,
            };
            return [
              link.campaignName,
              PLATFORM_LABELS[link.platform] ?? link.platform,
              agg.clicks.toLocaleString(),
              agg.cost.toLocaleString(),
              String(agg.verified),
            ];
          })}
        />

        {products.length > 0 && (
          <>
            <SectionTitle>صحة التسعير</SectionTitle>
            <Table
              headers={["المنتج", "السعر الحالي", "السعر المقترح", "الحالة"]}
              rows={products.map((p: any) => {
                const result = runPricingHealthCheck(
                  p.name, p.currentPrice,
                  {
                    cogs: p.cogs, outboundShippingCost: p.outboundShippingCost,
                    returnShippingCost: p.returnShippingCost || p.outboundShippingCost,
                    avgAdCostPerOrder: p.avgAdCostPerOrder, rtoRatePct: p.rtoRatePct,
                    paymentGatewayFeePct: p.paymentGatewayFeePct, paymentGatewayFixedFee: p.paymentGatewayFixedFee,
                    desiredMarginPct: p.desiredMarginPct,
                  },
                  {
                    productRtoRate: p.rtoRatePct, avgRtoRateAllProducts: avgRto,
                    cogsLastUpdatedDaysAgo: Math.floor((Date.now() - new Date(p.cogsLastUpdatedAt).getTime()) / 86400000),
                    discountedOrdersPct: 0, gatewayFeeIncludedInMargin: true,
                    productShippingCost: p.outboundShippingCost, avgShippingCostAllProducts: p.outboundShippingCost,
                  },
                  "ar"
                );
                return [p.name, String(p.currentPrice), String(result.suggestedPrice), statusLabel(result.status)];
              })}
            />
          </>
        )}

        <SectionTitle>ملخص التشخيص</SectionTitle>
        {activeIssues.length === 0 ? (
          <p className="mb-6 text-sm text-verified">مفيش مشاكل نشطة دلوقتي - كل الفحوصات سليمة.</p>
        ) : (
          <Table
            headers={["الفئة", "عدد المشاكل النشطة"]}
            rows={activeIssues.map((i: any) => [CATEGORY_LABELS[i.category] ?? i.category, String(i._count)])}
          />
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold text-text-primary">{children}</h2>;
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-2xl bg-surface print:bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-start text-xs font-medium text-text-faint">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-4 py-6 text-center text-xs text-text-faint">لا توجد بيانات</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 text-text-primary">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function statusLabel(status: string): string {
  return { SAFE: "آمن", WARNING: "تحذير", CRITICAL: "خطر" }[status] ?? status;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
