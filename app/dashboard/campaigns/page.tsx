// app/dashboard/campaigns/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DataTable, Column } from "@/app/components/ui/DataTable";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { CampaignsNav } from "./CampaignsNav";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
};

interface CampaignRow {
  campaignId: string;
  campaignName: string;
  platform: string;
  clicks: number;
  cost: number;
  rawConversions: number;
  verifiedConversions: number;
  cplRaw: number;
  cplVerified: number;
  inflationRatePct: number;
}

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
        title="لسه معملتش مساحة عمل"
        description="ارجع لـ لمحة عشان تنشئ أول مساحة عمل."
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

  const columns: Column<CampaignRow>[] = [
    {
      key: "campaignName",
      label: "الحملة",
      render: (r) => (
        <div>
          <div className="font-medium">{r.campaignName}</div>
          <div className="text-xs text-text-faint">{PLATFORM_LABELS[r.platform] ?? r.platform}</div>
        </div>
      ),
      sortValue: (r) => r.campaignName,
    },
    {
      key: "clicks",
      label: "الكليكات",
      align: "end",
      render: (r) => <span className="font-mono">{r.clicks.toLocaleString()}</span>,
      sortValue: (r) => r.clicks,
    },
    {
      key: "cost",
      label: "التكلفة",
      align: "end",
      render: (r) => <span className="font-mono">{r.cost.toLocaleString()}</span>,
      sortValue: (r) => r.cost,
    },
    {
      key: "cplRaw",
      label: "تكلفة العميل المعلنة",
      align: "end",
      render: (r) => <span className="font-mono text-gap">{r.cplRaw || "—"}</span>,
      sortValue: (r) => r.cplRaw,
    },
    {
      key: "cplVerified",
      label: "تكلفة العميل الحقيقية",
      align: "end",
      render: (r) => <span className="font-mono text-verified">{r.cplVerified || "—"}</span>,
      sortValue: (r) => r.cplVerified,
    },
    {
      key: "inflationRatePct",
      label: "نسبة التضخيم",
      align: "end",
      render: (r) => (
        <span className={`font-mono ${r.inflationRatePct > 40 ? "text-critical" : "text-text-muted"}`}>
          {r.inflationRatePct}%
        </span>
      ),
      sortValue: (r) => r.inflationRatePct,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-1 text-[26px] font-semibold text-text-primary">الحملات</h1>
      <p className="mb-6 text-xs text-text-faint">اختر منصة أو نظرة شاملة عشان تشوف التحليل التفصيلي.</p>

      <CampaignsNav />


      {rows.length === 0 ? (
        <EmptyState
          title="مفيش حملات مربوطة لسه"
          description="اربط حملاتك من الإعدادات → مساحة العمل."
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.platform}-${r.campaignId}`} />
      )}
    </div>
  );
}
