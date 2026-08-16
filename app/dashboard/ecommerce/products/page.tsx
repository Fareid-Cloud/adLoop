// app/dashboard/ecommerce/products/page.tsx
//
// المنتجات كصفحة قرار لا ككتالوج: كل منتج مصنَّف بربحه الفعلي بعد كل
// التكاليف، لا بإيراده الذي يخفي الخسارة. كانت هذه هي صفحة القسم الرئيسية
// قبل إعادة الهيكلة، ونُقلت هنا لتصبح الرئيسية نظرةً تنفيذية.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getEcommerceOverview } from "@/lib/ecommerce/productPerformance";
import { EcommerceView, type ProductRow } from "../EcommerceView";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { resolveStoreScope } from "@/lib/ecommerce/storeScope";
import { StorePicker } from "@/app/components/ui/StorePicker";
import { PullProductsButton } from "@/app/components/PullProductsButton";

export const dynamic = "force-dynamic";

export default async function EcommerceProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; store?: string }>;
}) {
  const sp = await searchParams;
  const windowDays = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  // المتجر المختار من الرابط، مُتحقَّقاً من انتمائه لهذه المساحة.
  const scope = await resolveStoreScope(workspace.id, sp.store);

  const overview = await getEcommerceOverview(workspace.id, windowDays, scope.selectedId);

  if (overview.products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title={t(locale, "store.noProducts")}
          description={t(locale, "store.noProductsHint")}
          // 🔴 الحالة الفارغة تحمل حلّها: مَن ربط متجره للتوّ يرى هنا
          // زرّاً يجلب منتجاته، لا دعوةً لإدخال مئة صنفٍ بيده.
          action={
            workspace.isDemo ? undefined : (
              <PullProductsButton workspaceId={workspace.id} locale={locale} variant="primary" />
            )
          }
        />
      </div>
    );
  }

  return (
    <EcommerceView
      workspaceName={workspace.name}
      products={overview.products as ProductRow[]}
      winner={(overview.winner as ProductRow) ?? null}
      runnerUp={(overview.runnerUp as ProductRow) ?? null}
      losing={overview.losing as ProductRow[]}
      totals={overview.totals}
      windowDays={overview.windowDays}
      hasStoreConnection={overview.hasStoreConnection}
      storePlatform={overview.storePlatform}
      currency={overview.currency}
      adSpendAvailability={overview.adSpendAvailability}
      locale={(user.preferredLocale as "ar" | "en") ?? "ar"}
      storePicker={
        <>
          <StorePicker options={scope.options} selectedId={scope.selectedId} locale={locale} />
          {!workspace.isDemo && overview.hasStoreConnection && (
            <PullProductsButton workspaceId={workspace.id} locale={locale} />
          )}
        </>
      }
    />
  );
}
