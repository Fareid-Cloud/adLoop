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
import { applyModeledAttribution, type RawMetrics } from "@/lib/metricsEngine";
import { GitMerge } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";


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

  // 🔴 `applyModeledAttribution` كانت مبنيّة بالكامل، والمفتاح المتحكّم بها
  // موجوداً في الإعدادات ومحفوظاً في قاعدة البيانات - ولا سطر واحد في
  // المشروع يستدعيها. أي أنّ المفتاح كان يحفظ قيمة ولا يفعل شيئاً.
  // هنا موضعه الطبيعي: الصفحة التي تعرض المتحقَّق مقابل المُنسَّب احتمالياً.
  const useModeled = workspace.useModeledAttribution;
  const combined = platforms.map(([platform, weight]) => {
    const applied = applyModeledAttribution(
      { platform: platform as RawMetrics["platform"], impressions: 0, clicks: 0, cost: 0, rawConversions: 0, verifiedConversions: 0 },
      weight,
      useModeled
    );
    return { platform, weight, modeled: applied.modeledConversions };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={GitMerge}
        tone="verified"
        eyebrow={workspace.name}
        title={t(locale, "campPages.attrTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
      <p className="mb-6 text-xs text-text-faint">{t(locale, "campPages.attrIntro")}</p>

      {total === 0 ? (
        <EmptyState
          title={t(locale, "campPages.attrNoneTitle")}
          description={t(locale, "campPages.attrNoneBody")}
        />
      ) : (
        <>
          <div className="card mb-4 flex items-center justify-center p-6">
            <TrackingAccuracyGauge verified={summary.verifiedCount} raw={total} locale={locale} />
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

          <div className="card p-4">
            <div className="mb-1 text-sm font-semibold text-text-primary">{t(locale, "campPages.attrByPlatform")}</div>
            <div className="mb-2.5 text-[11.5px] text-text-faint">
              {t(locale, useModeled ? "campPages.attrModeledOn" : "campPages.attrModeledOff")}
              {" · "}
              {t(locale, "campPages.attrToggleHint")}
            </div>
            {combined.map(({ platform, weight, modeled }) => (
              <div key={platform} className="flex items-center justify-between py-1 text-xs text-text-faint">
                <span>{platformLabel(locale, platform)}</span>
                <span className="num text-verified">
                  {useModeled ? Math.round(modeled * 10) / 10 : Math.round(weight * 10) / 10}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
