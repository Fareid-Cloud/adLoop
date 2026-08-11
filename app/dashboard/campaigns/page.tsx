// app/dashboard/campaigns/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignsOverview, type CampaignRow } from "./CampaignsOverview";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { AiAsk } from "@/app/components/AiAsk";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Megaphone } from "lucide-react";


export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = await toDateBoundsForUser(period.range);

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
    <div>
      <PageHeader
        icon={Megaphone}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.title")}
        description={t(locale, "campPages.subtitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.noneTitle")}
          description={t(locale, "campPages.noneBody")}
        />
      ) : (
        <CampaignsOverview rows={rows} currency={workspace.currency} locale={locale} />
      )}

      {/* مربّع السؤال في آخر المحتوى: هو `sticky` فيطفو فوق الصفحة في كلّ
          موضع تمرير، وموضعه هنا هو حيث يرسو - فوق التذييل مباشرةً حين
          يبلغ المستخدم الآخر. */}
      <AiAsk scope="campaigns" locale={locale} currency={workspace.currency} demo={workspace.isDemo} />
    </div>
  );
}
