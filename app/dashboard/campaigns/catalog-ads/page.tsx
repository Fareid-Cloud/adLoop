// app/dashboard/campaigns/catalog-ads/page.tsx
//
// "أداء الإعلانات الديناميكية المرتبطة بالكتالوج؟" - أداء الحملة ككل.
// ملاحظة أمانة: أداء منتج بعينه جوه الحملة مش متاح كرؤية أصلية عند ميتا
// خالص، محتاج نظام بيانات منفصل كامل - موضّح صراحة هنا، مش مخفي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export default async function CatalogAdsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const campaigns = await prisma.catalogCampaignSnapshot.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { cost: "desc" },
  });

  const campaignNames = await prisma.campaignLink.findMany({
    where: { workspaceId: workspace.id, platform: "META_ADS" },
    select: { externalCampaignId: true, campaignName: true },
  });
  const nameMap = new Map<string, string>(
    campaignNames.map((c: any) => [c.externalCampaignId, c.campaignName])
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">{t(locale, "campPages.catalogTitle")}</h1>
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.catalogIntro")}
      </p>

      {campaigns.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.catalogNone")}
          description={t(locale, "campPages.catalogNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {campaigns.map((c: any) => (
            <div key={c.campaignId} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {nameMap.get(c.campaignId) ?? c.campaignId}
                </span>
                <span className="font-mono text-sm text-verified">{c.purchases} {t(locale, "campPages.catalogPurchases")}</span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{c.clicks.toLocaleString()} {t(locale, "campPages.unitClicks")}</span>
                <span>{c.cost.toLocaleString()} {t(locale, "campPages.unitCost")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
