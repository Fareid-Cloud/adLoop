// app/dashboard/campaigns/video-performance/page.tsx
//
// أول عرض حقيقي لـ computeVideoMetrics/compareVideoPerformance - كانوا
// معزولين تماماً. صادق عن الواقع: جوجل بس بيملي videoViews/videoViewRate
// فعلياً في MetricSnapshot - ميتا وتيك توك لأ.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { computeVideoMetrics, compareVideoPerformance } from "@/lib/videoMetrics";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Video } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "vidGoogleYt",
};

export default async function VideoPerformancePage({
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
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }


  const byPlatform = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId: workspace.id, date: bounds, videoViews: { gt: 0 } },
    _sum: { impressions: true, cost: true, videoViews: true, videoThruPlays: true },
  });

  if (byPlatform.length === 0) {
    return (
      <div className="max-w-4xl">
        <PageHeader
          icon={Video}
          tone="accent"
          eyebrow={workspace.name}
          title={t(locale, "campPages.vidTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
        <EmptyState
          title={t(locale, "campPages.vidNone")}
          description={t(locale, "campPages.vidNoneBody")}
        />
      </div>
    );
  }

  const withMetrics = byPlatform.map((p: any) => {
    const raw = {
      platform: p.platform as any,
      impressions: p._sum.impressions ?? 0,
      cost: p._sum.cost ?? 0,
      videoViews: p._sum.videoViews ?? 0,
      videoThruPlays: p._sum.videoThruPlays ?? undefined,
      totalWatchTimeSec: 0,
    };
    return { ...raw, ...computeVideoMetrics(raw) };
  });

  const { ranked, insight } = compareVideoPerformance(withMetrics, locale);
  const missingPlatforms = ["META_ADS", "TIKTOK_ADS"].filter(
    (p) => !byPlatform.some((bp: any) => bp.platform === p)
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={Video}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.vidTitle")}
        description={t(locale, "campPages.vidIntro")}
      />

      {ranked.length >= 2 && (
        <div className="card mb-4 p-4 text-[13px] text-text-muted">💡 {insight}</div>
      )}

      <div className="flex flex-col gap-2">
        {withMetrics.map((m: any) => (
          <div key={m.platform} className="card p-5">
            <div className="mb-3 text-sm font-semibold text-text-primary">
              {platformName(locale, m.platform)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-center">
              <div>
                <div className="font-mono text-lg text-text-primary">{m.viewRate}%</div>
                <div className="text-[11px] text-text-faint">{t(locale, "campPages.vidViewRate")}</div>
              </div>
              <div>
                <div className="font-mono text-lg text-text-primary">{m.cpv || "—"}</div>
                <div className="text-[11px] text-text-faint">{t(locale, "campPages.vidCostPerView")}</div>
              </div>
              <div>
                <div className="font-mono text-lg text-text-primary">
                  {m.costPerThruPlay || t(locale, "common.notAvailable")}
                </div>
                <div className="text-[11px] text-text-faint">{t(locale, "campPages.vidCostPerThruPlay")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {missingPlatforms.length > 0 && (
        <p className="mt-4 text-xs text-text-faint">
          {t(locale, "campPages.vidMissing", {
            platforms: missingPlatforms.map((p) => platformLabel(locale, p)).join(t(locale, "ui.listSep")),
          })}
        </p>
      )}
    </div>
  );
}

/** يوتيوب هو ما يظهر فعلاً تحت جوجل هنا، فيُسمّى باسمه لا باسم المنصّة */
function platformName(locale: Locale, platform: string): string {
  if (platform === "GOOGLE_ADS") return t(locale, "campPages.vidGoogleYt");
  return platformLabel(locale, platform);
}
