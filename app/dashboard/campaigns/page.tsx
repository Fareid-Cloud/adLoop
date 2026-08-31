// app/dashboard/campaigns/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { metricRollupRows, groupRollup } from "@/lib/metricRollup";
import { CampaignsOverview, type CampaignRow } from "./CampaignsOverview";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { CampaignsEmpty } from "@/app/components/ui/PageEmptyStates";
import { AiAsk } from "@/app/components/AiAsk";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Megaphone } from "lucide-react";


export default async function CampaignsPage({
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
    return (
      <EmptyState
        title={t(locale, "common.noWorkspace")}
        description={t(locale, "common.noWorkspaceHint")}
      />
    );
  }


  const [campaignLinks, rollup] = await Promise.all([
    prisma.campaignLink.findMany({ where: { workspaceId: workspace.id } }),
    // مسوّىً: الجدول الرئيسيّ يقرأ كلفةً و CPL وتضخّماً لكلّ حملة - وصرف
    // ميتا المعدود مرّتين كان ينفخها جميعاً. راجع `lib/metricRollup.ts`.
    metricRollupRows({ workspaceId: workspace.id, date: bounds }),
  ]);

  const aggByKey = groupRollup(rollup, (r) => `${r.platform}::${r.campaignId}`);

  const rows: CampaignRow[] = campaignLinks.map((link: any) => {
    const m = aggByKey.get(`${link.platform}::${link.externalCampaignId}`);
    const agg = {
      clicks: m?.clicks ?? 0,
      cost: m?.cost ?? 0,
      rawConversions: m?.rawConversions ?? 0,
      verifiedConversions: m?.verifiedConversions ?? 0,
    };

    const cplRaw = agg.rawConversions > 0 ? agg.cost / agg.rawConversions : 0;
    const cplVerified = agg.verifiedConversions > 0 ? agg.cost / agg.verifiedConversions : 0;
    const inflationRatePct =
      agg.rawConversions > 0
        ? ((agg.rawConversions - agg.verifiedConversions) / agg.rawConversions) * 100
        : 0;

    return {
      campaignId: link.externalCampaignId,
      campaignName: link.campaignName,
      platform: link.platform,
      clicks: agg.clicks,
      cost: agg.cost,
      rawConversions: agg.rawConversions,
      verifiedConversions: agg.verifiedConversions,
      cplRaw: Math.round(cplRaw * 100) / 100,
      cplVerified: Math.round(cplVerified * 100) / 100,
      inflationRatePct: Math.round(inflationRatePct),
    };
  });

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.title")}
        description={t(locale, "campPages.subtitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />

      {rows.length === 0 ? (
        <CampaignsEmpty locale={locale} />
      ) : (
        <CampaignsOverview rows={rows} currency={workspace.currency} locale={locale} />
      )}

      {/* مربّع السؤال في آخر المحتوى: هو `sticky` فيطفو فوق الصفحة في كلّ
          موضع تمرير، وموضعه هنا هو حيث يرسو - فوق التذييل مباشرةً حين
          يبلغ المستخدم الآخر. */}
      <AiAsk scope="campaigns" locale={locale} currency={workspace.currency} demo={workspace.isDemo} />
    </div>
  );
}
