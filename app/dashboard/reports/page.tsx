// app/dashboard/reports/page.tsx
//
// التقارير الديناميكية. الإعدادات كلّها تُقرأ من الـURL: الفترة والمصدر
// والمؤشّرات والتفصيل والتصفية - حتى يبقى كل تقرير رابطاً قابلاً للمشاركة
// والحفظ، ولا يضيع الاختيار عند إعادة التحميل.
//
// لا يُحسب شيء حتى يطلب المستخدم صراحةً (`run=1`) أو يفتح عرضاً محفوظاً:
// تجميع فترة طويلة على كل الحملات ليس مجّانياً، ولا معنى لتشغيله لمن فتح
// الصفحة ليضغط "تقرير جاهز".

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ReportsClient, type SavedView } from "./ReportsClient";
import { runReport, METRICS, type DataSource, type Dimension, type MetricKey } from "@/lib/reports/reportEngine";
import { periodFromParams, type CompareMode } from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

const VALID_METRICS = new Set(METRICS.map((m) => m.key));
const VALID_DIMENSIONS: Dimension[] = ["none", "platform", "campaign", "creative", "day", "week", "month", "placement"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const one = (k: string): string | undefined => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const period = periodFromParams(params);
  const compareMode = (one("cmp") as CompareMode) ?? "none";

  // لا نثق بالـURL: كل قيمة تُصفّى مقابل قائمة معروفة قبل أن تصل للاستعلام
  const source = (["REPORTED", "VERIFIED", "BOTH"].includes(one("src") ?? "") ? one("src") : "VERIFIED") as DataSource;
  const dimension = (VALID_DIMENSIONS.includes((one("dim") ?? "") as Dimension) ? one("dim") : "platform") as Dimension;
  const metrics = (one("m")?.split(",").filter((m) => VALID_METRICS.has(m as MetricKey)) as MetricKey[] | undefined) ?? [
    "cost", "clicks", "conversions", "cpa", "ctr",
  ];
  const selectedPlatforms = one("pf")?.split(",").filter(Boolean) ?? [];
  const selectedCampaigns = one("cg")?.split(",").filter(Boolean) ?? [];
  const shouldRun = one("run") === "1";

  const [campaignLinks, views] = await Promise.all([
    prisma.campaignLink.findMany({
      where: { workspaceId: workspace.id },
      select: { externalCampaignId: true, campaignName: true, platform: true },
    }),
    prisma.savedReportView.findMany({
      where: { workspaceId: workspace.id, userId: user.id },
      orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
      take: 30,
    }),
  ]);

  const platforms = [...new Set(campaignLinks.map((c: { platform: string }) => c.platform))];
  const campaigns = campaignLinks.map((c: { externalCampaignId: string; campaignName: string; platform: string }) => ({
    id: c.externalCampaignId,
    name: c.campaignName,
    platform: c.platform,
  }));
  const campaignNames = new Map(
    campaignLinks.map((c: { externalCampaignId: string; campaignName: string }) => [c.externalCampaignId, c.campaignName])
  );

  const result = shouldRun
    ? await runReport(
        workspace.id,
        {
          source,
          dimension,
          metrics,
          filters: {
            platforms: selectedPlatforms.length ? selectedPlatforms : undefined,
            campaignIds: selectedCampaigns.length ? selectedCampaigns : undefined,
          },
          range: period.range,
          compare: period.compare,
        },
        { currency: workspace.currency, campaignNames }
      )
    : null;

  const savedViews: SavedView[] = views.map((v: { id: string; name: string; isFavorite: boolean; config: unknown }) => ({
    id: v.id,
    name: v.name,
    isFavorite: v.isFavorite,
    config: v.config as SavedView["config"],
  }));

  return (
    <ReportsClient
      locale={locale}
      workspaceId={workspace.id}
      currency={workspace.currency}
      platforms={platforms}
      campaigns={campaigns}
      savedViews={savedViews}
      initial={{
        source,
        dimension,
        metrics,
        preset: period.preset,
        range: period.range,
        compare: period.compare,
        compareMode,
        selectedPlatforms,
        selectedCampaigns,
      }}
      result={result}
    />
  );
}
