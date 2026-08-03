// app/dashboard/campaigns/attribution-engine/page.tsx
//
// شفافية كاملة على محرّك الإسناد - كم محادثة تأكّدت برمز مباشر (VERIFIED)،
// وكم احتاجت توزيعاً احتمالياً (MODELED)، وكيف توزّعت على المنصات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttributionSummaryForWorkspace } from "@/lib/attributionSummary";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TrackingAccuracyGauge } from "@/app/components/ui/TrackingAccuracyGauge";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { ShieldCheck, GitBranch } from "lucide-react";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds } from "@/lib/dateRange";
import { getActiveWorkspace } from "@/lib/activeWorkspace";


export default async function AttributionEnginePage({
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


  const summary = await getAttributionSummaryForWorkspace(workspace.id, bounds.gte, new Date());
  const total = summary.verifiedCount + summary.modeledCount;
  const modeledPct = total > 0 ? Math.round((summary.modeledCount / total) * 100) : 0;

  const platforms = Object.entries(summary.byPlatform).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">{t(locale, "campPages.attrTitle")}</h1>
      <PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />
      <p className="mb-6 text-xs text-text-faint">{t(locale, "campPages.attrIntro")}</p>

      {total === 0 ? (
        <EmptyState
          title={t(locale, "campPages.attrNoneTitle")}
          description={t(locale, "campPages.attrNoneBody")}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-center rounded-2xl bg-surface p-6">
            <TrackingAccuracyGauge verified={summary.verifiedCount} raw={total} />
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label={t(locale, "campPages.attrVerified")}
              explainKey="verifiedConversions"
              locale={locale}
              value={summary.verifiedCount}
              icon={ShieldCheck}
              tone="verified"
              verified
              caption={{ text: t(locale, "campPages.attrVerifiedCaption"), tone: "positive" }}
            />
            <MetricCard
              label={t(locale, "campPages.attrModeled")}
              value={summary.modeledCount}
              icon={GitBranch}
              tone="gap"
              verified={false}
              bar={{ pct: modeledPct, caption: t(locale, "campPages.attrModeledBar", { pct: modeledPct }) }}
              explainKey="modeledAttribution"
              locale={locale}
            />
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">{t(locale, "campPages.attrByPlatform")}</div>
            {platforms.map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between py-1 text-xs text-text-faint">
                <span>{platformLabel(locale, platform)}</span>
                <span className="font-mono text-verified">{Math.round(count * 10) / 10}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
