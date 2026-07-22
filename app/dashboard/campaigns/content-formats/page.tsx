// app/dashboard/campaigns/content-formats/page.tsx
//
// "Reels الإعلانية بتحقق نتيجة أحسن من الصور الثابتة؟" و"Stories لسه
// فعّالة؟" - بيانات دي موجودة أصلاً من مزامنة الأماكن التفصيلية، الصفحة
// دي بس بتعرضها بزاوية "شكل المحتوى" بدل "المنصة".

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const FORMAT_LABELS: Record<string, string> = {
  REELS: "ريلز",
  STORY: "ستوري",
  FEED: "الفيد (منشور عادي)",
  SEARCH: "نتائج البحث",
  INSTREAM_VIDEO: "فيديو داخل المحتوى",
  MARKETPLACE: "ماركت بليس",
  RIGHT_HAND_COLUMN: "العمود الجانبي",
};

export default async function ContentFormatsPage() {
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

  const rows = await prisma.metricSnapshot.groupBy({
    by: ["placementDetail"],
    where: {
      workspaceId: workspace.id,
      platform: "META_ADS",
      placementDetail: { not: "ALL" },
      date: { gte: thirtyDaysAgo },
    },
    _sum: { impressions: true, clicks: true, cost: true, rawConversions: true },
  });

  const results = rows
    .map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const raw = r._sum.rawConversions ?? 0;
      return {
        format: r.placementDetail,
        clicks: r._sum.clicks ?? 0,
        cost,
        conversions: raw,
        cpa: raw > 0 ? Math.round((cost / raw) * 100) / 100 : null,
      };
    })
    .sort((a: any, b: any) => b.cost - a.cost);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">أداء شكل المحتوى</h1>
      <p className="mb-6 text-xs text-text-faint">
        ريلز مقابل ستوري مقابل الفيد العادي - أنهي شكل فعلاً بيجيب عملاء أرخص لنفس الميزانية.
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات مُفصّلة حسب شكل المحتوى بعد"
          description="تُسحب تلقائياً مع المزامنة اليومية بعد ربط حملات ميتا."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div key={r.format} className="flex items-center justify-between rounded-2xl bg-surface p-4">
              <span className="text-sm font-medium text-text-primary">
                {FORMAT_LABELS[r.format] ?? r.format}
              </span>
              <div className="flex items-center gap-3 text-xs text-text-faint">
                <span>{r.clicks.toLocaleString()} كليكة</span>
                <span>{r.conversions} تحويل</span>
                <span className="font-mono text-verified">{r.cpa ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
