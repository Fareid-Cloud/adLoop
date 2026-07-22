// app/dashboard/campaigns/match-types/page.tsx
//
// "المطابقة الواسعة بتاكل ميزانيتي من غير عملاء حقيقيين؟" - مقارنة
// مباشرة بين Broad/Phrase/Exact على نفس الحملة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const MATCH_TYPE_LABELS: Record<string, string> = {
  BROAD: "المطابقة الواسعة",
  PHRASE: "مطابقة العبارة",
  EXACT: "المطابقة التامة",
  UNKNOWN: "غير معروف",
};

export default async function MatchTypesPage() {
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

  const rows = await prisma.matchTypeSnapshot.groupBy({
    by: ["matchType"],
    where: { workspaceId: workspace.id },
    _sum: { impressions: true, clicks: true, cost: true, conversions: true },
  });

  const results = rows
    .map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const conv = r._sum.conversions ?? 0;
      return {
        matchType: r.matchType,
        clicks: r._sum.clicks ?? 0,
        cost,
        conversions: conv,
        cpa: conv > 0 ? Math.round((cost / conv) * 100) / 100 : null,
        wasteRisk: conv === 0 && cost > 5,
      };
    })
    .sort((a: any, b: any) => b.cost - a.cost);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">أنواع المطابقة</h1>
      <p className="mb-6 text-xs text-text-faint">
        مقارنة مباشرة بين المطابقة الواسعة والعبارة والتامة - أنهي نوع فعلاً بيجيب عملاء أرخص.
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات بعد"
          description="تُسحب تلقائياً مع المزامنة اليومية بعد ربط حملات جوجل."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div
              key={r.matchType}
              className={`rounded-2xl p-4 ${r.wasteRisk ? "bg-critical/10" : "bg-surface"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {MATCH_TYPE_LABELS[r.matchType] ?? r.matchType}
                </span>
                <span className={`font-mono text-lg ${r.wasteRisk ? "text-critical" : "text-verified"}`}>
                  {r.cpa ?? "—"}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{r.clicks.toLocaleString()} كليكة</span>
                <span>{r.cost.toLocaleString()} تكلفة</span>
                <span>{r.conversions} تحويل</span>
              </div>
              {r.wasteRisk && (
                <div className="mt-2 text-xs text-critical">
                  صرف حقيقي بدون أي تحويل - يستاهل مراجعة الكلمات المفتاحية لهذا النوع.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
