// app/dashboard/campaigns/content-formats/page.tsx
//
// "Reels الإعلانية بتحقق نتيجة أحسن من الصور الثابتة؟" و"Stories لسه
// فعّالة؟" - بيانات دي موجودة أصلاً من مزامنة الأماكن التفصيلية، الصفحة
// دي بس بتعرضها بزاوية "شكل المحتوى" بدل "المنصة".

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds } from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Shapes } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

const FORMAT_KEYS: Record<string, string> = {
  REELS: "plReels",
  STORY: "plStory",
  FEED: "plFeedPost",
  SEARCH: "plSearch",
  INSTREAM_VIDEO: "plInstream",
  MARKETPLACE: "plMarketplace",
  RIGHT_HAND_COLUMN: "plRightColumn",
};

export default async function ContentFormatsPage({
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


  const rows = await prisma.metricSnapshot.groupBy({
    by: ["placementDetail"],
    where: {
      workspaceId: workspace.id,
      platform: "META_ADS",
      placementDetail: { not: "ALL" },
      date: bounds,
    },
    _sum: { impressions: true, clicks: true, cost: true, rawConversions: true },
  });

  const results = rows
    .map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const raw = r._sum.rawConversions ?? 0;
      return {
        format: r.placementDetail,
        clicks: r._sum.clicks ?? 0,
        cost,
        conversions: raw,
        cpa: raw > 0 ? Math.round((cost / raw) * 100) / 100 : null,
      };
    })
    .sort((a: any, b: any) => b.cost - a.cost);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={Shapes}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.cfTitle")}
      />
      <PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.cfIntro")}
      </p>

      {results.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.cfNone")}
          description={t(locale, "campPages.cfNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div key={r.format} className="card flex items-center justify-between p-4">
              <span className="text-sm font-medium text-text-primary">
                {placementName(locale, r.format)}
              </span>
              <div className="flex items-center gap-3 text-xs text-text-faint">
                <span>{r.clicks.toLocaleString()} {t(locale, "campPages.unitClicks")}</span>
                <span>{r.conversions} {t(locale, "campPages.unitConversions")}</span>
                <span className="font-mono text-verified">{r.cpa ?? "—"}</span>
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
  const key = FORMAT_KEYS[value];
  return key ? t(locale, `campPages.${key}`) : value;
}
