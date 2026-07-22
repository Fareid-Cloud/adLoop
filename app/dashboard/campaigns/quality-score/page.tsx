// app/dashboard/campaigns/quality-score/page.tsx
//
// "درجة الجودة منخفضة" مش إجابة كافية - الصفحة دي بتوضح السبب الفعلي:
// صلة الإعلان؟ صفحة الهبوط؟ نسبة النقر المتوقعة؟ كل كلمة على حدة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const COMPONENT_LABELS: Record<string, string> = {
  BELOW_AVERAGE: "أقل من المتوسط",
  AVERAGE: "متوسط",
  ABOVE_AVERAGE: "أعلى من المتوسط",
};

export default async function QualityScorePage() {
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

  // الأولوية للكلمات منخفضة الجودة (تحت 5 من 10) - دي اللي فعلاً بتستاهل انتباه
  const rows = await prisma.qualityScoreSnapshot.findMany({
    where: { workspaceId: workspace.id, qualityScore: { lte: 5 } },
    orderBy: { qualityScore: "asc" },
    take: 30,
  });

  function diagnoseIssue(row: (typeof rows)[number]): string {
    const issues: string[] = [];
    if (row.landingPageExperience === "BELOW_AVERAGE") issues.push("تجربة صفحة الهبوط");
    if (row.adRelevance === "BELOW_AVERAGE") issues.push("صلة الإعلان بالكلمة");
    if (row.expectedCtr === "BELOW_AVERAGE") issues.push("نسبة النقر المتوقعة");
    return issues.length > 0 ? issues.join(" + ") : "غير محدد بدقة";
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">تفصيل درجة الجودة</h1>
      <p className="mb-6 text-xs text-text-faint">
        بدلاً من "الجودة منخفضة"، هذا يوضح السبب بالتحديد لكل كلمة مفتاحية.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد كلمات منخفضة الجودة حالياً"
          description="كل الكلمات المفتاحية النشطة بدرجة جودة معقولة، أو لم تُسحب البيانات بعد."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row: any) => (
            <div key={row.id} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {row.keywordText ?? row.criterionId}
                </span>
                <span className="font-mono text-lg text-critical">{row.qualityScore}/10</span>
              </div>
              <div className="mb-2 text-xs text-gap">السبب الأساسي: {diagnoseIssue(row)}</div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>صلة الإعلان: {COMPONENT_LABELS[row.adRelevance ?? ""] ?? "—"}</span>
                <span>صفحة الهبوط: {COMPONENT_LABELS[row.landingPageExperience ?? ""] ?? "—"}</span>
                <span>نسبة النقر المتوقعة: {COMPONENT_LABELS[row.expectedCtr ?? ""] ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
