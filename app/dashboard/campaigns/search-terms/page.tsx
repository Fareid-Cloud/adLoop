// app/dashboard/campaigns/search-terms/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { findWastefulSearchTerms } from "@/lib/searchTermAnalysis";

export default async function SearchTermsPage() {
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

  // تسجيل "آخر مراجعة" - كان TODO قبل كده، بيغذّي تذكير المهام اليومية
  // لو عدّى وقت طويل من غير ما حد يراجع الصفحة دي
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { lastSearchTermsReviewAt: new Date() },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const snapshots = await prisma.searchTermSnapshot.findMany({
    where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
  });

  if (snapshots.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="mb-6 text-[26px] font-semibold text-text-primary">مصطلحات البحث المهدرة</h1>
        <EmptyState title="مفيش بيانات مصطلحات بحث لسه" description="بتتحدث تلقائياً مع المزامنة اليومية." />
      </div>
    );
  }

  // بنجمّع كل مصطلح بحث عبر كل الأيام في صف واحد
  const byTerm = new Map<string, { matchedKeyword: string | null; cost: number; clicks: number; conversions: number }>();
  for (const s of snapshots) {
    const existing = byTerm.get(s.searchTerm) ?? { matchedKeyword: s.matchedKeyword, cost: 0, clicks: 0, conversions: 0 };
    existing.cost += s.cost;
    existing.clicks += s.clicks;
    existing.conversions += s.conversions;
    byTerm.set(s.searchTerm, existing);
  }

  const terms = Array.from(byTerm.entries()).map(([searchTerm, data]) => ({ searchTerm, ...data }));
  const { wasteful, totalWastedCost } = findWastefulSearchTerms(terms);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">مصطلحات البحث المهدرة</h1>
      <p className="mb-6 text-xs text-text-faint">
        إجمالي مهدور آخر 30 يوم:{" "}
        <span className="font-mono text-critical">{totalWastedCost}</span> {workspace.currency}
      </p>

      {wasteful.length === 0 ? (
        <EmptyState title="لا يوجد هدر واضح حالياً" description="كل مصطلحات البحث اللي صرفت عليها جابت نتيجة." />
      ) : (
        <div className="flex flex-col gap-1">
          {wasteful.map((t) => (
            <div key={t.searchTerm} className="rounded-2xl bg-surface p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-text-primary">"{t.searchTerm}"</span>
                <span className="font-mono text-sm text-critical">{Math.round(t.cost * 100) / 100}</span>
              </div>
              <p className="text-xs text-text-faint">
                {t.clicks} كليكة، صفر تحويل
                {t.matchedKeyword && ` — طابقت الكلمة المفتاحية "${t.matchedKeyword}"`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
