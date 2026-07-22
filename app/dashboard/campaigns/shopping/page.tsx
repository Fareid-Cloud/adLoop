// app/dashboard/campaigns/shopping/page.tsx
//
// "منتجات كتالوجي كلها بتظهر فعلاً، ولا فيه منتجات مرفوضة بصمت؟" -
// عبر shopping_product (المورد الحالي، مش Content API القديم اللي بيتقفل
// 18 أغسطس 2026).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getRelativeSpendThreshold } from "@/lib/relativeSpendThreshold";

export default async function ShoppingProductsPage() {
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

  // إصلاح باگ: الرقم كان ثابت (10) من غير وعي بالعملة - بقى نسبي لصرف
  // الحساب نفسه، نفس العملة تلقائياً
  const wastefulThreshold = await getRelativeSpendThreshold(workspace.id);

  const [rejectedProducts, wastefulProducts] = await Promise.all([
    prisma.shoppingProductSnapshot.findMany({
      where: { workspaceId: workspace.id, hasIssues: true },
      orderBy: { cost: "desc" },
      take: 20,
    }),
    prisma.shoppingProductSnapshot.findMany({
      where: { workspaceId: workspace.id, hasIssues: false, conversions: 0, cost: { gt: wastefulThreshold } },
      orderBy: { cost: "desc" },
      take: 20,
    }),
  ]);

  const hasAnyData = rejectedProducts.length > 0 || wastefulProducts.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">منتجات التسوق (Merchant Center)</h1>
      <p className="mb-6 text-xs text-text-faint">
        منتجات مرفوضة أو مقيّدة بصمت، ومنتجات بتصرف عليها من غير أي تحويل حقيقي.
      </p>

      {!hasAnyData ? (
        <EmptyState
          title="لا توجد بيانات تسوق بعد"
          description="إما لا يوجد حساب Merchant Center مربوط، أو لم تُسحب البيانات بعد."
        />
      ) : (
        <>
          {rejectedProducts.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-sm font-semibold text-critical">منتجات مرفوضة أو مقيّدة</div>
              <div className="flex flex-col gap-2">
                {rejectedProducts.map((p: any) => (
                  <div key={p.id} className="rounded-2xl bg-critical/10 p-4">
                    <div className="mb-1 text-sm text-text-primary">{p.title ?? p.itemId}</div>
                    <div className="text-xs text-text-faint">{p.issuesDetail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {wastefulProducts.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-gap">صرف بدون تحويلات</div>
              <div className="flex flex-col gap-2">
                {wastefulProducts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl bg-gap/10 p-4">
                    <span className="text-sm text-text-primary">{p.title ?? p.itemId}</span>
                    <span className="font-mono text-sm text-gap">{p.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
