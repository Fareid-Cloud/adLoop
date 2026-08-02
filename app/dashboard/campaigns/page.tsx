// app/dashboard/campaigns/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignsOverview, type CampaignRow } from "./CampaignsOverview";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { CampaignsNav } from "./CampaignsNav";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds } from "@/lib/dateRange";
import { getActiveWorkspace } from "@/lib/activeWorkspace";


export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = toDateBounds(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <EmptyState
        title={t(locale, "common.noWorkspace")}
        description={t(locale, "common.noWorkspaceHint")}
      />
    );
  }


  const [campaignLinks, aggregates] = await Promise.all([
    prisma.campaignLink.findMany({ where: { workspaceId: workspace.id } }),
    prisma.metricSnapshot.groupBy({
      by: ["platform", "campaignId"],
      where: { workspaceId: workspace.id, date: bounds },
      _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
  ]);

  interface AggValue {
    clicks: number;
    cost: number;
    rawConversions: number;
    verifiedConversions: number;
  }

  const aggByKey = new Map<string, AggValue>(
    aggregates.map((a: any) => [
      `${a.platform}::${a.campaignId}`,
      {
        clicks: a._sum.clicks ?? 0,
        cost: a._sum.cost ?? 0,
        rawConversions: a._sum.rawConversions ?? 0,
        verifiedConversions: a._sum.verifiedConversions ?? 0,
      },
    ])
  );

  const rows: CampaignRow[] = campaignLinks.map((link: any) => {
    const agg: AggValue = aggByKey.get(`${link.platform}::${link.externalCampaignId}`) ?? {
      clicks: 0, cost: 0, rawConversions: 0, verifiedConversions: 0,
    };

    const cplRaw = agg.rawConversions > 0 ? agg.cost / agg.rawConversions : 0;
    const cplVerified = agg.verifiedConversions > 0 ? agg.cost / agg.verifiedConversions : 0;
    const inflationRatePct =
      agg.rawConversions > 0
        ? ((agg.rawConversions - agg.verifiedConversions) / agg.rawConversions) * 100
        : 0;

    return {
      campaignId: link.externalCampaignId,
      campaignName: link.campaignName,
      platform: link.platform,
      clicks: agg.clicks,
      cost: agg.cost,
      rawConversions: agg.rawConversions,
      verifiedConversions: agg.verifiedConversions,
      cplRaw: Math.round(cplRaw * 100) / 100,
      cplVerified: Math.round(cplVerified * 100) / 100,
      inflationRatePct: Math.round(inflationRatePct),
    };
  });

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="reveal mb-6">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{t(locale, "campPages.title")}</h1>
        <PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />
        <p className="mt-1 text-[13px] text-text-muted">
          {t(locale, "campPages.subtitle")}
        </p>
      </div>

      <CampaignsNav locale={locale} />

      {rows.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.noneTitle")}
          description={t(locale, "campPages.noneBody")}
        />
      ) : (
        <CampaignsOverview rows={rows} currency={workspace.currency} locale={locale} />
      )}
    </div>
  );
}
