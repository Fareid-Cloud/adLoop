// app/dashboard/campaigns/shopping/page.tsx
//
// "منتجات كتالوجي كلها بتظهر فعلاً، ولا فيه منتجات مرفوضة بصمت؟" -
// عبر shopping_product (المورد الحالي، مش Content API القديم اللي بيتقفل
// 18 أغسطس 2026).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getRelativeSpendThreshold } from "@/lib/relativeSpendThreshold";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function ShoppingProductsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
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
      <PageHeader
        icon={ShoppingBag}
        tone="gap"
        eyebrow={workspace.name}
        title={t(locale, "campPages.shopTitle")}
        description={t(locale, "campPages.shopIntro")}
      />

      {!hasAnyData ? (
        <EmptyState
          title={t(locale, "campPages.shopNone")}
          description={t(locale, "campPages.shopNoneBody")}
        />
      ) : (
        <>
          {rejectedProducts.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-sm font-semibold text-critical">{t(locale, "campPages.shopRejected")}</div>
              <div className="flex flex-col gap-2">
                {rejectedProducts.map((p: any) => (
                  <div key={p.id} className="btn btn-danger bg-critical/10 p-4">
                    <div className="mb-1 text-sm text-text-primary">{p.title ?? p.itemId}</div>
                    <div className="text-xs text-text-faint">{p.issuesDetail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {wastefulProducts.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-gap">{t(locale, "campPages.shopNoConv")}</div>
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
