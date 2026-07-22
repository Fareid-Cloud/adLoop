// app/dashboard/campaigns/audience/page.tsx
//
// "أرخص شريحة جمهور؟" - محدودة بحملات Display/YouTube/RLSA بس (قيد من
// جوجل نفسها، مش نقص في المزامنة - موضّح في الصفحة نفسها بصراحة).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

export default async function AudiencePage() {
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

  const snapshots = await prisma.audienceSegmentSnapshot.findMany({
    where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
  });

  const byCriterion = new Map<string, { criterionType: string | null; cost: number; conversions: number; clicks: number }>();
  for (const s of snapshots) {
    const existing = byCriterion.get(s.criterionId) ?? { criterionType: s.criterionType, cost: 0, conversions: 0, clicks: 0 };
    existing.cost += s.cost;
    existing.conversions += s.conversions;
    existing.clicks += s.clicks;
    byCriterion.set(s.criterionId, existing);
  }

  const segments = Array.from(byCriterion.entries())
    .map(([criterionId, d]) => ({
      criterionId,
      criterionType: d.criterionType,
      cost: d.cost,
      conversions: d.conversions,
      cpa: d.conversions > 0 ? Math.round((d.cost / d.conversions) * 100) / 100 : null,
    }))
    .filter((s) => s.cpa !== null)
    .sort((a, b) => (a.cpa ?? 0) - (b.cpa ?? 0));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">أداء شرائح الجمهور</h1>

      <div className="mb-6 rounded-2xl bg-gap/10 p-4 text-xs text-gap">
        بيانات الجمهور متاحة بس لحملات Display/YouTube/RLSA — حملات Search
        العادية جمهورها "مراقبة" مش استهداف مقيّد، فجوجل نفسها مبترجعش
        لها بيانات جمهور تفصيلية. لو مش شايف بيانات هنا، ده قيد من
        المنصة، مش خطأ في المزامنة.
      </div>

      {segments.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات جمهور متاحة"
          description="إما لا توجد حملات Display/YouTube/RLSA مربوطة، أو لم تتم المزامنة بعد."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {segments.map((s) => (
            <div key={s.criterionId} className="flex items-center justify-between rounded-2xl bg-surface p-4">
              <div>
                <div className="text-sm text-text-primary">{s.criterionType ?? "غير محدد"}</div>
                <div className="text-xs text-text-faint">{s.conversions} تحويل، {s.cost.toLocaleString()} تكلفة</div>
              </div>
              <div className="font-mono text-sm text-verified">{s.cpa}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
