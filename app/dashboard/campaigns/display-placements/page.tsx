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

export default async function DisplayPlacementsPage() {
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

  const wastefulPlacements = await prisma.displayPlacementSnapshot.findMany({
    where: { workspaceId: workspace.id, conversions: 0, cost: { gt: wastefulThreshold } },
    orderBy: { cost: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 page-title">{t(locale, "campPages.dpTitle")}</h1>
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
            <div key={p.id} className="flex items-center justify-between rounded-2xl bg-gap/10 p-4">
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
