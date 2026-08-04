// app/dashboard/campaigns/placements/page.tsx
//
// "فيسبوك مقابل إنستجرام" + الأماكن التفصيلية (Feed/Stories/Reels) -
// أول اتنين أولوية من meta-instagram-gap-analysis.md، مبنيين مع بعض هنا.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds } from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

const PLACEMENT_KEYS: Record<string, string> = {
  FACEBOOK: "plFacebook",
  INSTAGRAM: "plInstagram",
  AUDIENCE_NETWORK: "plAudienceNetwork",
  MESSENGER: "plMessenger",
  ALL: "plAll",
};

const FORMAT_KEYS: Record<string, string> = {
  FEED: "plFeed",
  STORY: "plStory",
  REELS: "plReels",
  INSTREAM_VIDEO: "plInstream",
  SEARCH: "plSearch",
  MARKETPLACE: "plMarketplace",
  RIGHT_HAND_COLUMN: "plRightColumn",
  ALL: "placeUnsplit",
};

interface Row {
  placementBreakdown: string;
  placementDetail: string;
  impressions: number;
  clicks: number;
  cost: number;
  rawConversions: number;
  cpl: number | null;
}

export default async function PlacementsPage({
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
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }


  const rawRows = await prisma.metricSnapshot.groupBy({
    by: ["placementBreakdown", "placementDetail"],
    where: { workspaceId: workspace.id, platform: "META_ADS", date: bounds },
    _sum: { impressions: true, clicks: true, cost: true, rawConversions: true },
  });

  const rows: Row[] = rawRows.map((r: any) => {
    const cost = r._sum.cost ?? 0;
    const raw = r._sum.rawConversions ?? 0;
    return {
      placementBreakdown: r.placementBreakdown,
      placementDetail: r.placementDetail,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
      cost,
      rawConversions: raw,
      cpl: raw > 0 ? Math.round((cost / raw) * 100) / 100 : null,
    };
  });

  // تجميع حسب المنصة الأساسية، وجوه كل منصة نفصّل حسب المكان التفصيلي
  const byPlatform = new Map<string, Row[]>();
  for (const row of rows) {
    const arr = byPlatform.get(row.placementBreakdown) ?? [];
    arr.push(row);
    byPlatform.set(row.placementBreakdown, arr);
  }

  const platformGroups = Array.from(byPlatform.entries())
    .map(([platform, details]) => ({
      platform,
      totalCost: details.reduce((s, d) => s + d.cost, 0),
      details: details.sort((a, b) => b.cost - a.cost),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 page-title">{t(locale, "campPages.placeTitle")}</h1>
      <PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.placeIntro")}
      </p>

      {platformGroups.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.placeNone")}
          description={t(locale, "campPages.placeNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {platformGroups.map((group) => (
            <div key={group.platform} className="rounded-2xl bg-surface p-4">
              <div className="mb-3 text-sm font-semibold text-text-primary">
                {placementName(locale, group.platform)}
              </div>
              <div className="flex flex-col gap-2">
                {group.details.map((d) => (
                  <div
                    key={`${d.placementBreakdown}-${d.placementDetail}`}
                    className="flex items-center justify-between rounded-xl bg-surface-raised px-3 py-2"
                  >
                    <span className="text-xs text-text-muted">
                      {placementName(locale, d.placementDetail)}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-text-faint">
                      <span>{d.clicks.toLocaleString()} {t(locale, "campPages.unitClicks")}</span>
                      <span>{d.cost.toLocaleString()} {t(locale, "campPages.unitCost")}</span>
                      <span className="font-mono text-verified">{d.cpl ?? "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** قيمة غير معروفة تُعرض كما وردت من المنصّة لا كفراغ */
function placementName(locale: Locale, value: string): string {
  const key = PLACEMENT_KEYS[value] ?? FORMAT_KEYS[value];
  return key ? t(locale, `campPages.${key}`) : value;
}
