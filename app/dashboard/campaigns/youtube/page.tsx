// app/dashboard/campaigns/youtube/page.tsx
//
// مقياس نجاح فيديو مختلف عن Search - نسبة مشاهدة كاملة، تفاعل، مش نقرات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

export default async function YoutubePage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى لمحة لإنشاء أول مساحة عمل." />;
  }

  const rows = await prisma.youtubeMetricSnapshot.groupBy({
    by: ["campaignId"],
    where: { workspaceId: workspace.id },
    _sum: { impressions: true, videoViews: true, cost: true, conversions: true },
    _avg: { videoViewRate: true, engagementRate: true },
  });

  const campaignNames = await prisma.campaignLink.findMany({
    where: { workspaceId: workspace.id, platform: "GOOGLE_ADS" },
    select: { externalCampaignId: true, campaignName: true },
  });
  const nameMap = new Map(campaignNames.map((c: any) => [c.externalCampaignId, c.campaignName]));

  const results = rows.map((r: any) => ({
    campaignId: r.campaignId,
    name: nameMap.get(r.campaignId) ?? r.campaignId,
    videoViews: r._sum.videoViews ?? 0,
    cost: r._sum.cost ?? 0,
    viewRate: r._avg.videoViewRate ? Math.round(r._avg.videoViewRate * 1000) / 10 : 0,
    engagementRate: r._avg.engagementRate ? Math.round(r._avg.engagementRate * 1000) / 10 : 0,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">أداء حملات يوتيوب</h1>
      <p className="mb-6 text-xs text-text-faint">
        نسبة المشاهدة الكاملة والتفاعل، مش الكليكات - مقياس النجاح مختلف عن حملات البحث.
        ملاحظة: الأرقام هنا مشاهدات مدفوعة فقط (العضوية غير متاحة عبر الواجهة البرمجية).
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات فيديو بعد"
          description="إما لا توجد حملات يوتيوب نشطة، أو لم تُسحب البيانات بعد."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div key={r.campaignId} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{r.name}</span>
                <span className="font-mono text-sm text-verified">{r.viewRate}% مشاهدة كاملة</span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{r.videoViews.toLocaleString()} مشاهدة</span>
                <span>{r.cost.toLocaleString()} تكلفة</span>
                <span>{r.engagementRate}% تفاعل</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
