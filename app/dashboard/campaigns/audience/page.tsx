// app/dashboard/campaigns/audience/page.tsx
//
// "أرخص شريحة جمهور؟" - محدودة بحملات Display/YouTube/RLSA بس (قيد من
// جوجل نفسها، مش نقص في المزامنة - موضّح في الصفحة نفسها بصراحة).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Users } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function AudiencePage({
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


  const snapshots = await prisma.audienceSegmentSnapshot.findMany({
    where: { workspaceId: workspace.id, date: bounds },
  });

  const byCriterion = new Map<string, { criterionType: string | null; cost: number; conversions: number; clicks: number }>();
  for (const s of snapshots) {
    const existing = byCriterion.get(s.criterionId) ?? { criterionType: s.criterionType, cost: 0, conversions: 0, clicks: 0 };
    existing.cost += s.cost;
    existing.conversions += s.conversions;
    existing.clicks += s.clicks;
    byCriterion.set(s.criterionId, existing);
  }

  const segments = Array.from(byCriterion.entries())
    .map(([criterionId, d]) => ({
      criterionId,
      criterionType: d.criterionType,
      cost: d.cost,
      conversions: d.conversions,
      cpa: d.conversions > 0 ? Math.round((d.cost / d.conversions) * 100) / 100 : null,
    }))
    .filter((s) => s.cpa !== null)
    .sort((a, b) => (a.cpa ?? 0) - (b.cpa ?? 0));

  return (
    <div className="max-w-3xl">
      <PageHeader
        icon={Users}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.audTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />

      <div className="mb-6 rounded-2xl bg-gap/10 p-4 text-xs text-gap">
        {t(locale, "campPages.audIntro")}
      </div>

      {segments.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.audNone")}
          description={t(locale, "campPages.audNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {segments.map((s) => (
            <div key={s.criterionId} className="card flex items-center justify-between p-4">
              <div>
                <div className="text-sm text-text-primary">{s.criterionType ?? t(locale, "campPages.audUnspecified")}</div>
                <div className="text-xs text-text-faint">{t(locale, "campPages.audStat", { conversions: s.conversions, cost: s.cost.toLocaleString() })}</div>
              </div>
              <div className="font-mono text-sm text-verified">{s.cpa}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
