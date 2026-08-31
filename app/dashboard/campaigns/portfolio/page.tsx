// app/dashboard/campaigns/portfolio/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { metricRollupRows, groupRollup } from "@/lib/metricRollup";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { computeOptimalAllocation } from "@/lib/portfolioAllocation";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, daysBetween } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = await toDateBoundsForUser(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }


  const [campaignLinks, rollup] = await Promise.all([
    prisma.campaignLink.findMany({ where: { workspaceId: workspace.id } }),
    // مسوّىً: صرف ميتا المعدود مرّتين كان ينفخ الميزانية الحالية لكلّ حملة،
    // فتُقترَح إعادةُ توزيعٍ مبنيّة على رقمٍ مضخَّم. راجع `lib/metricRollup.ts`.
    metricRollupRows({ workspaceId: workspace.id, date: bounds }),
  ]);

  if (campaignLinks.length === 0) {
    return (
      <div>
        {/* الرأس نفسه في فرع الفراغ: صفحة بلا حملات لا تفقد هويّتها -
            بدونه تبدو صفحةً أخرى، وهي القاعدة التي وُجد لها هذا المكوّن. */}
        <PageHeader
          icon={LayoutGrid}
          tone="accent"
          eyebrow={workspace.name}
          title={t(locale, "campPages.pfTitle")}
          description={t(locale, "campPages.pfIntro")}
          actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
        />
        <EmptyState title={t(locale, "common.noCampaigns")} description={t(locale, "common.noCampaignsHint")} />
      </div>
    );
  }

  const aggMap = groupRollup(rollup, (r) => `${r.platform}::${r.campaignId}`);

  // ملاحظة صريحة: "الميزانية الحالية" هنا بتفترض إن الإنفاق آخر 7 أيام
  // موزّع بالتساوي كتقدير للميزانية اليومية الفعلية - النظام لسه مش بيسحب
  // "الميزانية المضبوطة" الحقيقية من إعدادات الحملة في جوجل نفسها (فجوة
  // معروفة، محتاجة حقل ميزانية إضافي في المزامنة لاحقاً)
  const input = campaignLinks.map((link: any) => {
    const data = aggMap.get(`${link.platform}::${link.externalCampaignId}`);
    const cost = data?.cost ?? 0;
    return {
      campaignId: link.externalCampaignId,
      campaignName: link.campaignName,
      currentBudget: round2(cost / 7),
      verifiedConversions: data?.verifiedConversions ?? 0,
      cost,
    };
  });

  const result = computeOptimalAllocation(input);

  return (
    <div>
      <PageHeader
        icon={LayoutGrid}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.pfTitle")}
        description={t(locale, "campPages.pfIntro")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />

      <div className="flex flex-col gap-2">
        {result.allocations.map((a) => (
          <div key={a.campaignId} className="card p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-text-primary">{a.campaignName}</span>
              <span
                className={`font-mono text-sm ${
                  a.changePct > 0 ? "text-verified" : a.changePct < 0 ? "text-critical" : "text-text-faint"
                }`}
              >
                {a.changePct > 0 ? "+" : ""}
                {a.changePct}%
              </span>
            </div>
            <p className="text-xs text-text-faint">{a.reasoning}</p>
            {/* الميزانية مالٌ، وكانت تُعرض رقماً عارياً بلا عملة - ورقمٌ
                يُقترَح نقلُه بين حملتين يجب أن يقول بأيّ عملة. */}
            <div className="mt-2 flex gap-4 font-mono text-xs text-text-muted">
              <span>{t(locale, "campPages.pfCurrent")} {a.currentBudget} {workspace.currency}</span>
              <span>{t(locale, "campPages.pfSuggested")} {a.suggestedBudget} {workspace.currency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
