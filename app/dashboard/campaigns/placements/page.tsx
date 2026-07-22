// app/dashboard/campaigns/placements/page.tsx
//
// "فيسبوك مقابل إنستجرام" + الأماكن التفصيلية (Feed/Stories/Reels) -
// أول اتنين أولوية من meta-instagram-gap-analysis.md، مبنيين مع بعض هنا.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const PLACEMENT_LABELS: Record<string, string> = {
  FACEBOOK: "فيسبوك",
  INSTAGRAM: "إنستجرام",
  AUDIENCE_NETWORK: "الشبكة الإعلانية",
  MESSENGER: "ماسنجر",
  ALL: "غير مقسّم (بيانات قديمة قبل هذه الميزة)",
};

const DETAIL_LABELS: Record<string, string> = {
  FEED: "الفيد",
  STORY: "ستوري",
  REELS: "ريلز",
  INSTREAM_VIDEO: "فيديو داخل المحتوى",
  SEARCH: "نتائج البحث",
  MARKETPLACE: "ماركت بليس",
  RIGHT_HAND_COLUMN: "العمود الجانبي",
  ALL: "غير مقسّم",
};

interface Row {
  placementBreakdown: string;
  placementDetail: string;
  impressions: number;
  clicks: number;
  cost: number;
  rawConversions: number;
  cpl: number | null;
}

export default async function PlacementsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لسه معملتش مساحة عمل" description="ارجع لـ لمحة عشان تنشئ أول مساحة عمل." />;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rawRows = await prisma.metricSnapshot.groupBy({
    by: ["placementBreakdown", "placementDetail"],
    where: { workspaceId: workspace.id, platform: "META_ADS", date: { gte: thirtyDaysAgo } },
    _sum: { impressions: true, clicks: true, cost: true, rawConversions: true },
  });

  const rows: Row[] = rawRows.map((r: any) => {
    const cost = r._sum.cost ?? 0;
    const raw = r._sum.rawConversions ?? 0;
    return {
      placementBreakdown: r.placementBreakdown,
      placementDetail: r.placementDetail,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
      cost,
      rawConversions: raw,
      cpl: raw > 0 ? Math.round((cost / raw) * 100) / 100 : null,
    };
  });

  // تجميع حسب المنصة الأساسية، وجوه كل منصة نفصّل حسب المكان التفصيلي
  const byPlatform = new Map<string, Row[]>();
  for (const row of rows) {
    const arr = byPlatform.get(row.placementBreakdown) ?? [];
    arr.push(row);
    byPlatform.set(row.placementBreakdown, arr);
  }

  const platformGroups = Array.from(byPlatform.entries())
    .map(([platform, details]) => ({
      platform,
      totalCost: details.reduce((s, d) => s + d.cost, 0),
      details: details.sort((a, b) => b.cost - a.cost),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">فيسبوك مقابل إنستجرام والأماكن التفصيلية</h1>
      <p className="mb-6 text-xs text-text-faint">
        نفس الحملة، مقسّمة حسب المنصة والمكان الفعلي (فيد/ستوري/ريلز) - عشان تعرف بالظبط فين بتيجي أرخص عميل.
      </p>

      {platformGroups.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات مقسّمة بعد"
          description="بتتحدث تلقائياً مع المزامنة اليومية بعد ربط حملات ميتا."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {platformGroups.map((group) => (
            <div key={group.platform} className="rounded-2xl bg-surface p-4">
              <div className="mb-3 text-sm font-semibold text-text-primary">
                {PLACEMENT_LABELS[group.platform] ?? group.platform}
              </div>
              <div className="flex flex-col gap-2">
                {group.details.map((d) => (
                  <div
                    key={`${d.placementBreakdown}-${d.placementDetail}`}
                    className="flex items-center justify-between rounded-xl bg-surface-raised px-3 py-2"
                  >
                    <span className="text-xs text-text-muted">
                      {DETAIL_LABELS[d.placementDetail] ?? d.placementDetail}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-text-faint">
                      <span>{d.clicks.toLocaleString()} كليكة</span>
                      <span>{d.cost.toLocaleString()} تكلفة</span>
                      <span className="font-mono text-verified">{d.cpl ?? "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
