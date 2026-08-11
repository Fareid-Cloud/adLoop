// app/dashboard/campaigns/search-terms/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { findWastefulSearchTerms } from "@/lib/searchTermAnalysis";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Search } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function SearchTermsPage({
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

  // تسجيل "آخر مراجعة" - كان TODO قبل كده، بيغذّي تذكير المهام اليومية
  // لو عدّى وقت طويل من غير ما حد يراجع الصفحة دي
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { lastSearchTermsReviewAt: new Date() },
  });


  const snapshots = await prisma.searchTermSnapshot.findMany({
    where: { workspaceId: workspace.id, date: bounds },
  });

  if (snapshots.length === 0) {
    return (
      <div>
      <PageHeader
        icon={Search}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.stTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
        <EmptyState title={t(locale, "campPages.stNone")} description={t(locale, "campPages.stNoneBody")} />
      </div>
    );
  }

  // بنجمّع كل مصطلح بحث عبر كل الأيام في صف واحد
  const byTerm = new Map<string, { matchedKeyword: string | null; cost: number; clicks: number; conversions: number }>();
  for (const s of snapshots) {
    const existing = byTerm.get(s.searchTerm) ?? { matchedKeyword: s.matchedKeyword, cost: 0, clicks: 0, conversions: 0 };
    existing.cost += s.cost;
    existing.clicks += s.clicks;
    existing.conversions += s.conversions;
    byTerm.set(s.searchTerm, existing);
  }

  const terms = Array.from(byTerm.entries()).map(([searchTerm, data]) => ({ searchTerm, ...data }));
  const { wasteful, totalWastedCost } = findWastefulSearchTerms(terms);

  return (
    <div>
      <PageHeader
        icon={Search}
        tone="gap"
        eyebrow={workspace.name}
        title={t(locale, "campPages.stTitle")}
      />
      <p className="-mt-3 mb-6 text-xs text-text-faint">
        {t(locale, "campPages.stWasted", { days: "30" })}{" "}
        <span className="font-mono text-critical">{totalWastedCost}</span> {workspace.currency}
      </p>

      {wasteful.length === 0 ? (
        <EmptyState title={t(locale, "campPages.stNoWaste")} description={t(locale, "campPages.stNoWasteBody")} />
      ) : (
        <div className="flex flex-col gap-1">
          {wasteful.map((term) => (
            <div key={term.searchTerm} className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-text-primary">"{term.searchTerm}"</span>
                <span className="font-mono text-sm text-critical">{Math.round(term.cost * 100) / 100}</span>
              </div>
              <p className="text-xs text-text-faint">
                {term.clicks} {t(locale, "campPages.stClicksNoConv")}
                {term.matchedKeyword && t(locale, "campPages.stMatched", { keyword: term.matchedKeyword })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
