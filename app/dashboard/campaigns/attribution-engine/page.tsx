// app/dashboard/campaigns/attribution-engine/page.tsx
//
// شفافية كاملة على محرك الإسناد - كام محادثة اتأكدت بكود مباشر (VERIFIED)،
// وكام احتاجت توزيع احتمالي ذكي (MODELED)، وكيف اتوزعوا على المنصات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttributionSummaryForWorkspace } from "@/lib/attributionSummary";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TrackingAccuracyGauge } from "@/app/components/ui/TrackingAccuracyGauge";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
  SNAPCHAT_ADS: "سناب شات",
};

export default async function AttributionEnginePage() {
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

  const summary = await getAttributionSummaryForWorkspace(workspace.id, thirtyDaysAgo, new Date());
  const total = summary.verifiedCount + summary.modeledCount;
  const modeledPct = total > 0 ? Math.round((summary.modeledCount / total) * 100) : 0;

  const platforms = Object.entries(summary.byPlatform).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">محرك الإسناد الذكي</h1>
      <p className="mb-6 text-xs text-text-faint">
        لما رسالة واتساب توصل من غير كود تتبع واضح، النظام بيحاول ينسبها لأقرب منصة بناءً على
        التوقيت وتطابق رقم الهاتف - مش تخمين عشوائي، توزيع احتمالي مبني على إشارات حقيقية.
      </p>

      {total === 0 ? (
        <EmptyState
          title="لا توجد بيانات إسناد بعد"
          description="تُبنى تلقائياً مع كل محادثة واتساب جديدة بعد ربط الحملات."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-center rounded-2xl bg-surface p-6">
            <TrackingAccuracyGauge verified={summary.verifiedCount} raw={total} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface p-4 text-center">
              <div className="font-mono text-2xl text-verified">{summary.verifiedCount}</div>
              <div className="text-xs text-text-faint">مؤكدة بكود مباشر</div>
            </div>
            <div className="rounded-2xl bg-surface p-4 text-center">
              <div className="font-mono text-2xl text-gap">{summary.modeledCount}</div>
              <div className="text-xs text-text-faint">مُنسّبة احتمالياً ({modeledPct}%)</div>
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">التوزيع الإجمالي على المنصات</div>
            {platforms.map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between py-1 text-xs text-text-faint">
                <span>{PLATFORM_LABELS[platform] ?? platform}</span>
                <span className="font-mono text-verified">{Math.round(count * 10) / 10}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
