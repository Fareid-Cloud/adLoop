// app/dashboard/campaigns/learning-phase/page.tsx
//
// "لو زودت الميزانية، هخرج بره فترة التعلّم قد إيه؟" - عبر قاعدة ميتا
// الموثّقة علناً (~50 تحويل خلال 7 أيام)، محسوبة من بيانات يومية حقيقية
// جمعناها احنا - مش تقريب من رقم 28 يوم، ومش حقل API معطّل.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateLearningPhase } from "@/lib/syncMetaAds";
import { EmptyState } from "@/app/components/ui/EmptyState";

const STATUS_CONFIG = {
  LIKELY_STABLE: { color: "text-verified", label: "على الأرجح مستقرة" },
  LEARNING: { color: "text-gap", label: "في فترة التعلّم" },
  LEARNING_LIMITED: { color: "text-critical", label: "على الأرجح Learning Limited" },
};

export default async function LearningPhasePage() {
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailyRows = await prisma.adSetDailyConversions.groupBy({
    by: ["adSetId"],
    where: { workspaceId: workspace.id, date: { gte: sevenDaysAgo } },
    _sum: { conversions: true },
  });

  const adSetNames = await prisma.metaAdSetSnapshot.findMany({
    where: { workspaceId: workspace.id },
    select: { adSetId: true, adSetName: true },
  });
  const nameMap = new Map<string, string | null>(
    adSetNames.map((a: any) => [a.adSetId, a.adSetName])
  );

  const estimates = dailyRows.map((r: any) =>
    estimateLearningPhase(r.adSetId, nameMap.get(r.adSetId) ?? null, r._sum.conversions ?? 0)
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">فترة التعلّم</h1>
      <p className="mb-6 text-xs text-text-faint">
        قاعدة ميتا الموثّقة علناً: محتاجة ~50 تحويل خلال 7 أيام عشان تخرج من فترة التعلّم بثبات.
        محسوبة من بياناتك الفعلية، مش تخمين.
      </p>

      {estimates.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات كافية بعد"
          description="محتاجة يوم أو اتنين من المزامنة اليومية بعد ربط حملات ميتا."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {estimates.map((e: any) => (
            <div key={e.adSetId} className="rounded-2xl bg-surface p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{e.adSetName ?? e.adSetId}</span>
                <span className={`text-xs font-medium ${STATUS_CONFIG[e.status as keyof typeof STATUS_CONFIG].color}`}>
                  {STATUS_CONFIG[e.status as keyof typeof STATUS_CONFIG].label}
                </span>
              </div>
              <p className="text-xs text-text-faint">{e.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
