// app/dashboard/campaigns/video-performance/page.tsx
//
// أول عرض حقيقي لـ computeVideoMetrics/compareVideoPerformance - كانوا
// معزولين تماماً. صادق عن الواقع: جوجل بس بيملي videoViews/videoViewRate
// فعلياً في MetricSnapshot - ميتا وتيك توك لأ.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { computeVideoMetrics, compareVideoPerformance } from "@/lib/videoMetrics";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل (يوتيوب)",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
};

export default async function VideoPerformancePage() {
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const byPlatform = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo }, videoViews: { gt: 0 } },
    _sum: { impressions: true, cost: true, videoViews: true, videoThruPlays: true },
  });

  if (byPlatform.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="mb-6 text-[26px] font-semibold text-text-primary">أداء الفيديو عبر المنصات</h1>
        <EmptyState
          title="لا توجد بيانات فيديو بعد"
          description="محتاج كامبينز فيديو حقيقية (يوتيوب حالياً) شغالة آخر 30 يوم."
        />
      </div>
    );
  }

  const withMetrics = byPlatform.map((p: any) => {
    const raw = {
      platform: p.platform as any,
      impressions: p._sum.impressions ?? 0,
      cost: p._sum.cost ?? 0,
      videoViews: p._sum.videoViews ?? 0,
      videoThruPlays: p._sum.videoThruPlays ?? undefined,
      totalWatchTimeSec: 0,
    };
    return { ...raw, ...computeVideoMetrics(raw) };
  });

  const { ranked, insight } = compareVideoPerformance(withMetrics, "ar");
  const missingPlatforms = ["META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"].filter(
    (p) => !byPlatform.some((bp: any) => bp.platform === p)
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">أداء الفيديو عبر المنصات</h1>
      <p className="mb-6 text-xs text-text-faint">
        آخر 30 يوم. مقياس "تكلفة المشاهدة الكاملة" أدق من تكلفة المشاهدة العادية.
      </p>

      {ranked.length >= 2 && (
        <div className="mb-4 rounded-2xl bg-surface p-4 text-[13px] text-text-muted">💡 {insight}</div>
      )}

      <div className="flex flex-col gap-2">
        {withMetrics.map((m: any) => (
          <div key={m.platform} className="rounded-2xl bg-surface p-5">
            <div className="mb-3 text-sm font-semibold text-text-primary">
              {PLATFORM_LABELS[m.platform] ?? m.platform}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="font-mono text-lg text-text-primary">{m.viewRate}%</div>
                <div className="text-[11px] text-text-faint">نسبة المشاهدة</div>
              </div>
              <div>
                <div className="font-mono text-lg text-text-primary">{m.cpv || "—"}</div>
                <div className="text-[11px] text-text-faint">تكلفة المشاهدة</div>
              </div>
              <div>
                <div className="font-mono text-lg text-text-primary">
                  {m.costPerThruPlay || "غير متاح"}
                </div>
                <div className="text-[11px] text-text-faint">تكلفة المشاهدة الكاملة</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {missingPlatforms.length > 0 && (
        <p className="mt-4 text-xs text-text-faint">
          ملاحظة صادقة: {missingPlatforms.map((p) => PLATFORM_LABELS[p]).join("، ")} مش بتتزامن بيانات
          فيديو للصفحة دي حالياً - محتاجة بناء إضافي منفصل لكل منصة.
        </p>
      )}
    </div>
  );
}
