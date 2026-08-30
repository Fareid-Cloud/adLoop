// app/dashboard/campaigns/display-placements/page.tsx
//
// "إعلاناتي ظاهرة فين بالظبط في الشبكة الإعلانية؟" - يوضح أماكن الظهور
// اللي بتصرف فلوس من غير أي تحويل، عشان تستبعدها.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getRelativeSpendThreshold } from "@/lib/relativeSpendThreshold";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function DisplayPlacementsPage({
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

  // إصلاح باگ: الرقم كان ثابت (5) من غير وعي بالعملة - بقى نسبي
  const wastefulThreshold = await getRelativeSpendThreshold(workspace.id);

  // 🔴 كان `findMany` بلا فلتر تاريخ على جدولٍ يضيف صفّاً لكلّ يوم
  // (`@@unique … date`): فالموضع المهدِر عبر أسبوعين كان يظهر أربعة عشر
  // مرّة، وشرط `conversions: 0` كان يُطبَّق على اليوم الواحد لا على الفترة
  // (موضعٌ حوّل يوماً واحداً ثم لا شيء يبقى «مهدِراً» أبداً). فيُجمَع لكلّ
  // موضعٍ داخل الفترة، ثمّ يُصفَّى صفرُ التحويل وتجاوزُ العتبة على المجموع.
  const grouped = await prisma.displayPlacementSnapshot.groupBy({
    by: ["placement", "displayName", "placementType"],
    where: { workspaceId: workspace.id, date: bounds },
    _sum: { cost: true, conversions: true },
    having: {
      conversions: { _sum: { equals: 0 } },
      cost: { _sum: { gt: wastefulThreshold } },
    },
    orderBy: { _sum: { cost: "desc" } },
    take: 20,
  });

  const wastefulPlacements = grouped.map((g: any) => ({
    placement: g.placement,
    displayName: g.displayName,
    placementType: g.placementType,
    cost: g._sum.cost ?? 0,
  }));

  return (
    <div>
      <PageHeader
        icon={LayoutTemplate}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.dpTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.dpIntro")}{" "}{t(locale, "campPages.dpNote")}
      </p>

      {wastefulPlacements.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.dpNone")}
          description={t(locale, "campPages.dpNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {wastefulPlacements.map((p: any) => (
            <div key={p.placement} className="flex items-center justify-between rounded-2xl bg-gap/10 p-4">
              <div>
                <div className="text-sm text-text-primary">{p.displayName}</div>
                <div className="text-xs text-text-faint">{p.placementType}</div>
              </div>
              <span className="font-mono text-sm text-gap">{p.cost.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
