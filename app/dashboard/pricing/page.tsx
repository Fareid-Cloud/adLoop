// app/dashboard/pricing/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PricingClient } from "./PricingClient";
import { runPricingHealthCheck, computeEcommerceMetrics, explainRoasGap, runFullPricingSafetyNet } from "@/lib/ecommerceMetrics";

export default async function PricingPage() {
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

  const products = await prisma.product.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  // متوسط نسبة المرتجعات عبر كل المنتجات - بيُستخدم كخط أساس في
  // diagnoseMarginIssue عشان يحدد "المرتجعات دي غير طبيعية" مقارنة بالمتوسط
  const avgRtoRate =
    products.length > 0
      ? products.reduce((sum: number, p: any) => sum + p.rtoRatePct, 0) / products.length
      : 0;

  // بيانات مبيعات حقيقية على مستوى المنتج الفردي - كانت الفجوة اللي
  // منعت runFullPricingSafetyNet من الشغل بدقة. استعلام واحد لكل
  // المنتجات بدل استعلام منفصل لكل واحد جوه الـmap (أداء أفضل)
  const saleEventsThirtyDays = new Date();
  saleEventsThirtyDays.setDate(saleEventsThirtyDays.getDate() - 30);
  const saleEvents = await prisma.productSaleEvent.findMany({
    where: { productId: { in: products.map((p: any) => p.id) }, occurredAt: { gte: saleEventsThirtyDays } },
  });
  const saleEventsByProduct = new Map<string, typeof saleEvents>();
  for (const event of saleEvents) {
    const arr = saleEventsByProduct.get(event.productId) ?? [];
    arr.push(event);
    saleEventsByProduct.set(event.productId, arr);
  }

  const rows = products.map((p: any) => {
    const marginDiagnosisInput = {
      productRtoRate: p.rtoRatePct,
      avgRtoRateAllProducts: avgRtoRate,
      cogsLastUpdatedDaysAgo: Math.floor(
        (Date.now() - new Date(p.cogsLastUpdatedAt).getTime()) / 86400000
      ),
      discountedOrdersPct: 0, // TODO: يحتاج بيانات أكواد خصم فعلية من منصة الإيكومرس المربوطة
      gatewayFeeIncludedInMargin: true,
      productShippingCost: p.outboundShippingCost,
      avgShippingCostAllProducts:
        products.reduce((sum: number, x: any) => sum + x.outboundShippingCost, 0) / products.length,
    };

    const result = runPricingHealthCheck(
      p.name,
      p.currentPrice,
      {
        cogs: p.cogs,
        outboundShippingCost: p.outboundShippingCost,
        returnShippingCost: p.returnShippingCost || p.outboundShippingCost,
        avgAdCostPerOrder: p.avgAdCostPerOrder,
        rtoRatePct: p.rtoRatePct,
        paymentGatewayFeePct: p.paymentGatewayFeePct,
        paymentGatewayFixedFee: p.paymentGatewayFixedFee,
        desiredMarginPct: p.desiredMarginPct,
      },
      marginDiagnosisInput,
      "ar"
    );

    // الطبقة الثانية الحقيقية - هل الخسارة حصلت فعلياً في مبيعات آخر 30
    // يوم، مش بس توقّع نظري؟ لو عندنا مبيعات حقيقية مربوطة بالمنتج ده (SKU)
    const events = saleEventsByProduct.get(p.id) ?? [];
    let actualLossAlert: string | null = null;
    if (events.length > 0) {
      const ordersCount = events.reduce((s: number, e: any) => s + e.quantity, 0);
      const revenue = events.reduce((s: number, e: any) => s + e.revenue, 0);
      const returnedOrdersCount = events.filter((e: any) => e.returned).reduce((s: number, e: any) => s + e.quantity, 0);

      const safetyNet = runFullPricingSafetyNet(
        p.name,
        p.currentPrice,
        {
          cogs: p.cogs,
          outboundShippingCost: p.outboundShippingCost,
          returnShippingCost: p.returnShippingCost || p.outboundShippingCost,
          avgAdCostPerOrder: p.avgAdCostPerOrder,
          rtoRatePct: p.rtoRatePct,
          paymentGatewayFeePct: p.paymentGatewayFeePct,
          paymentGatewayFixedFee: p.paymentGatewayFixedFee,
          desiredMarginPct: p.desiredMarginPct,
        },
        {
          platform: "SALLA",
          cost: p.avgAdCostPerOrder * ordersCount,
          ordersCount,
          revenue,
          cogs: p.cogs * ordersCount,
          shippingCost: p.outboundShippingCost * ordersCount,
          returnedOrdersCount,
        },
        marginDiagnosisInput,
        "ar"
      );

      if (safetyNet.slippedThrough) {
        actualLossAlert = `⚠️ الفحص الاستباقي متوقّعش ده - لكن آخر 30 يوم فعلياً المنتج ده خسران فعلي (${Math.round(safetyNet.after!.grossProfit)} ${workspace.currency}).`;
      }
    }

    return {
      id: p.id,
      name: p.name,
      currentPrice: p.currentPrice,
      suggestedPrice: result.suggestedPrice,
      gapPct: result.gapPct,
      status: result.status,
      message: result.message,
      actualLossAlert,
    };
  });

  // إصلاح فجوة حقيقية: explainRoasGap/computeEcommerceMetrics كانتا
  // مبنيتين بس معزولتين - افترضنا الأول إنهم محتاجين جدول Order جديد،
  // لكن بالفحص لقينا إن ordersCount/revenue/returnedOrdersCount أصلاً
  // بيتجمّعوا في MetricSnapshot من ويب هوك سلة (السطر ده بالذات) -
  // البيانات موجودة فعلاً، بس محدش كان بيقراها من هنا.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [sallaAgg, adSpendAgg] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, platform: "SALLA", date: { gte: thirtyDaysAgo } },
      _sum: { ordersCount: true, revenue: true, returnedOrdersCount: true },
    }),
    prisma.metricSnapshot.aggregate({
      where: {
        workspaceId: workspace.id,
        platform: { in: ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"] },
        date: { gte: thirtyDaysAgo },
      },
      _sum: { cost: true },
    }),
  ]);

  const roasGapInsight = (() => {
    const ordersCount = sallaAgg._sum.ordersCount ?? 0;
    if (ordersCount === 0 || products.length === 0) return null; // مفيش طلبات حقيقية لسه، مفيش حاجة نقولها

    const avgCogs = products.reduce((sum: number, p: any) => sum + p.cogs, 0) / products.length;
    const avgShipping = products.reduce((sum: number, p: any) => sum + p.outboundShippingCost, 0) / products.length;

    const computed = computeEcommerceMetrics({
      platform: "SALLA",
      cost: adSpendAgg._sum.cost ?? 0,
      ordersCount,
      revenue: sallaAgg._sum.revenue ?? 0,
      cogs: avgCogs * ordersCount, // تقريب معقول - متوسط تكلفة المنتج × عدد الطلبات، مش تكلفة كل طلب بالظبط لأن الطلبات مش مربوطة بمنتج بعينه في سلة حالياً
      shippingCost: avgShipping * ordersCount,
      returnedOrdersCount: sallaAgg._sum.returnedOrdersCount ?? 0,
    });

    return explainRoasGap(computed, "ar");
  })();

  // الأخطر أولاً - عشان الميديا باير يشوف أهم حاجة تستاهل انتباهه فوق
  rows.sort((a: { gapPct: number }, b: { gapPct: number }) => a.gapPct - b.gapPct);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-6 text-[26px] font-semibold text-text-primary">التسعير</h1>

      {roasGapInsight && (
        <div className="mb-4 rounded-2xl bg-surface p-4 text-[13px] text-text-muted">
          💡 {roasGapInsight}
        </div>
      )}
      <PricingClient workspaceId={workspace.id} products={rows} />
    </div>
  );
}
