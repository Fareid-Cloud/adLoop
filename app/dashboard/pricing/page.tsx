// app/dashboard/pricing/page.tsx
//
// عرض صحة تسعير الكتالوج. الحساب كله في lib/pricingHealth.ts (نقطة حقيقة
// واحدة) - نفس الدالة اللي بيستخدمها الكرون اليومي للتنبيه الاستباقي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PricingClient } from "./PricingClient";
import { ProductCostsPanel } from "./ProductCostsPanel";
import { getWorkspacePricing } from "@/lib/pricingHealth";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds } from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Tag } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = toDateBounds(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const { rows, roasGapInsight } = await getWorkspacePricing(workspace.id, workspace.currency, locale);

  // السجلات الكاملة للمنتجات - العرض المركّز يعيد حساب التسعير لحظياً في
  // المتصفح، فيحتاج كل المدخلات لا الملخّص فقط
  const productRecords = await prisma.product.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, sku: true, currentPrice: true, cogs: true,
      outboundShippingCost: true, returnShippingCost: true, packagingCost: true,
      handlingCost: true, avgAdCostPerOrder: true, rtoRatePct: true,
      restockingLossPct: true, paymentGatewayFeePct: true,
      paymentGatewayFixedFee: true, codFeePct: true, desiredMarginPct: true,
      stockQuantity: true,
    },
  });

  // إحصاءات المبيعات الفعلية - تُعرض فقط عند وجود أرقام حقيقية، لا صناديق
  // صفرية توحي بأن الميزة معطّلة
  const thirty = new Date(); thirty.setDate(thirty.getDate() - 30);
  const saleAgg = await prisma.productSaleEvent.groupBy({
    by: ["productId"],
    where: { productId: { in: productRecords.map((p: any) => p.id) }, occurredAt: { gte: thirty } },
    _sum: { quantity: true, revenue: true },
    _count: { _all: true },
  });
  const returnedAgg = await prisma.productSaleEvent.groupBy({
    by: ["productId"],
    where: { productId: { in: productRecords.map((p: any) => p.id) }, occurredAt: { gte: thirty }, returned: true },
    _sum: { quantity: true },
  });
  const returnedByProduct = new Map(returnedAgg.map((r: any) => [r.productId, r._sum.quantity ?? 0]));

  const salesStats: Record<string, { orders: number; revenue: number; aov: number; successRate: number }> = {};
  for (const a of saleAgg) {
    const orders = a._sum.quantity ?? 0;
    const revenue = a._sum.revenue ?? 0;
    const returned = returnedByProduct.get(a.productId) ?? 0;
    if (orders === 0) continue;
    salesStats[a.productId] = {
      orders,
      revenue: Math.round(revenue),
      aov: Math.round((revenue / orders) * 100) / 100,
      successRate: Math.round(((orders - returned) / orders) * 100),
    };
  }

  // "بلا تكلفة" = صفر أو غير مضبوط. الربح عندها يُحسب كأن السعر كلّه ربح.
  const missingCogsCount = productRecords.filter((p: { cogs: number }) => !p.cogs || p.cogs <= 0).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Tag}
        tone="critical"
        eyebrow={workspace.name}
        title={t(locale, "campPages.pricingTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />

      {roasGapInsight && (
        <div className="mb-4 card pad-md text-[13px] text-text-muted">
          💡 {roasGapInsight}
        </div>
      )}
      <ProductCostsPanel workspaceId={workspace.id} missingCount={missingCogsCount} locale={locale} />

      <PricingClient locale={locale} workspaceId={workspace.id} products={rows} records={productRecords} currency={workspace.currency} salesStats={salesStats} />
    </div>
  );
}
