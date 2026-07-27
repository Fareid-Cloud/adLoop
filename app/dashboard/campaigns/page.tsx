// app/dashboard/campaigns/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignsOverview, type CampaignRow } from "./CampaignsOverview";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { CampaignsNav } from "./CampaignsNav";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
};

export default async function CampaignsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return (
      <EmptyState
        title="لا توجد مساحة عمل بعد"
        description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل."
      />
    );
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [campaignLinks, aggregates] = await Promise.all([
    prisma.campaignLink.findMany({ where: { workspaceId: workspace.id } }),
    prisma.metricSnapshot.groupBy({
      by: ["platform", "campaignId"],
      where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
      _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
  ]);

  interface AggValue {
    clicks: number;
    cost: number;
    rawConversions: number;
    verifiedConversions: number;
  }

  const aggByKey = new Map<string, AggValue>(
    aggregates.map((a: any) => [
      `${a.platform}::${a.campaignId}`,
      {
        clicks: a._sum.clicks ?? 0,
        cost: a._sum.cost ?? 0,
        rawConversions: a._sum.rawConversions ?? 0,
        verifiedConversions: a._sum.verifiedConversions ?? 0,
      },
    ])
  );

  const rows: CampaignRow[] = campaignLinks.map((link: any) => {
    const agg: AggValue = aggByKey.get(`${link.platform}::${link.externalCampaignId}`) ?? {
      clicks: 0, cost: 0, rawConversions: 0, verifiedConversions: 0,
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
    <div className="mx-auto max-w-6xl pb-10">
      <div className="reveal mb-6">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">الحملات</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          كل حملة بالرقم الذي تعلنه المنصة وبالرقم الذي تأكّد فعلاً — والفارق بينهما.
        </p>
      </div>

      <CampaignsNav />

      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد حملات مربوطة بعد"
          description="اربط حملاتك من الرئيسية — نافذة اختيار الحملات تفتح في مكانها."
        />
      ) : (
        <CampaignsOverview rows={rows} currency={workspace.currency} />
      )}
    </div>
  );
}
