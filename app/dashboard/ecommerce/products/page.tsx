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

export const dynamic = "force-dynamic";

export default async function EcommerceProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const windowDays = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
  }

  const overview = await getEcommerceOverview(workspace.id, windowDays);

  if (overview.products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="لم تُضف أي منتج بعد"
          description="أضف منتجاتك من صفحة التسعير لتبدأ مقارنة ربحيتها الفعلية وتحديد المنتج الرابح."
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
    />
  );
}
