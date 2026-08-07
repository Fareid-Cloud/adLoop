// app/dashboard/campaigns/youtube/page.tsx
//
// مقياس نجاح فيديو مختلف عن Search - نسبة مشاهدة كاملة، تفاعل، مش نقرات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { MonitorPlay } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function YoutubePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const rows = await prisma.youtubeMetricSnapshot.groupBy({
    by: ["campaignId"],
    where: { workspaceId: workspace.id },
    _sum: { impressions: true, videoViews: true, cost: true, conversions: true },
    _avg: { videoViewRate: true, engagementRate: true },
  });

  const campaignNames = await prisma.campaignLink.findMany({
    where: { workspaceId: workspace.id, platform: "GOOGLE_ADS" },
    select: { externalCampaignId: true, campaignName: true },
  });
  const nameMap = new Map(campaignNames.map((c: any) => [c.externalCampaignId, c.campaignName]));

  const results = rows.map((r: any) => ({
    campaignId: r.campaignId,
    name: nameMap.get(r.campaignId) ?? r.campaignId,
    videoViews: r._sum.videoViews ?? 0,
    cost: r._sum.cost ?? 0,
    viewRate: r._avg.videoViewRate ? Math.round(r._avg.videoViewRate * 1000) / 10 : 0,
    engagementRate: r._avg.engagementRate ? Math.round(r._avg.engagementRate * 1000) / 10 : 0,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={MonitorPlay}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.ytTitle")}
        description={t(locale, "campPages.ytIntro")}
      />

      {results.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.ytNone")}
          description={t(locale, "campPages.ytNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div key={r.campaignId} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{r.name}</span>
                <span className="font-mono text-sm text-verified">{t(locale, "campPages.ytViewRate", { n: r.viewRate })}</span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{r.videoViews.toLocaleString()} {t(locale, "campPages.unitViews")}</span>
                <span>{r.cost.toLocaleString()} {t(locale, "campPages.unitCost")}</span>
                <span>{r.engagementRate}% {t(locale, "campPages.unitEngagement")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
