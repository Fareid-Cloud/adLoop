// lib/pricingHealth.ts
//
// نقطة حقيقة واحدة لفحص صحة تسعير كتالوج الـWorkspace - بتُستخدم من صفحة
// التسعير (عرض) ومن الكرون اليومي (تنبيه استباقي). قبل كده كان الحساب
// موجود في صفحة التسعير بس، فالتنبيه "قبل الخسارة" ما كانش بيشتغل تلقائياً
// أبداً - المستخدم كان لازم يفتح الصفحة بإيده عشان يعرف. دي الحلقة المفقودة.

import { prisma } from "@/lib/prisma";
import {
  runPricingHealthCheck,
  runFullPricingSafetyNet,
  computeEcommerceMetrics,
  explainRoasGap,
} from "@/lib/ecommerceMetrics";
import { pushToActionFeed } from "@/lib/actionFeed";

export interface PricingRow {
  id: string;
  name: string;
  currentPrice: number;
  suggestedPrice: number;
  gapPct: number;
  status: "SAFE" | "WARNING" | "CRITICAL";
  message: string;
  actualLossAlert: string | null;
}

export async function getWorkspacePricing(
  workspaceId: string,
  currency: string
): Promise<{ rows: PricingRow[]; roasGapInsight: string | null }> {
  const products = await prisma.product.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  if (products.length === 0) return { rows: [], roasGapInsight: null };

  const avgRtoRate = products.reduce((s: number, p: any) => s + p.rtoRatePct, 0) / products.length;
  const avgShippingAll = products.reduce((s: number, p: any) => s + p.outboundShippingCost, 0) / products.length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const saleEvents = await prisma.productSaleEvent.findMany({
    where: { productId: { in: products.map((p: any) => p.id) }, occurredAt: { gte: thirtyDaysAgo } },
  });
  const byProduct = new Map<string, typeof saleEvents>();
  for (const e of saleEvents) {
    const arr = byProduct.get(e.productId) ?? [];
    arr.push(e);
    byProduct.set(e.productId, arr);
  }

  const pricingInputsOf = (p: any) => ({
    cogs: p.cogs,
    outboundShippingCost: p.outboundShippingCost,
    returnShippingCost: p.returnShippingCost || p.outboundShippingCost,
    avgAdCostPerOrder: p.avgAdCostPerOrder,
    rtoRatePct: p.rtoRatePct,
    paymentGatewayFeePct: p.paymentGatewayFeePct,
    paymentGatewayFixedFee: p.paymentGatewayFixedFee,
    desiredMarginPct: p.desiredMarginPct,
  });

  const rows: PricingRow[] = products.map((p: any) => {
    const marginDiagnosisInput = {
      productRtoRate: p.rtoRatePct,
      avgRtoRateAllProducts: avgRtoRate,
      cogsLastUpdatedDaysAgo: Math.floor((Date.now() - new Date(p.cogsLastUpdatedAt).getTime()) / 86400000),
      discountedOrdersPct: 0, // يحتاج بيانات أكواد خصم فعلية من منصة الإيكومرس المربوطة
      gatewayFeeIncludedInMargin: true,
      productShippingCost: p.outboundShippingCost,
      avgShippingCostAllProducts: avgShippingAll,
    };

    const result = runPricingHealthCheck(p.name, p.currentPrice, pricingInputsOf(p), marginDiagnosisInput, "ar");

    const events = byProduct.get(p.id) ?? [];
    let actualLossAlert: string | null = null;
    if (events.length > 0) {
      const ordersCount = events.reduce((s: number, e: any) => s + e.quantity, 0);
      const revenue = events.reduce((s: number, e: any) => s + e.revenue, 0);
      const returnedOrdersCount = events.filter((e: any) => e.returned).reduce((s: number, e: any) => s + e.quantity, 0);

      const safetyNet = runFullPricingSafetyNet(
        p.name, p.currentPrice, pricingInputsOf(p),
        {
          platform: "SALLA", cost: p.avgAdCostPerOrder * ordersCount, ordersCount, revenue,
          cogs: p.cogs * ordersCount, shippingCost: p.outboundShippingCost * ordersCount, returnedOrdersCount,
        },
        marginDiagnosisInput, "ar"
      );
      if (safetyNet.slippedThrough) {
        actualLossAlert = `الفحص الاستباقي لم يتوقّع ذلك، لكن خلال آخر 30 يوماً هذا المنتج يحقّق خسارة فعلية (${Math.round(safetyNet.after!.grossProfit)} ${currency}).`;
      }
    }

    return {
      id: p.id, name: p.name, currentPrice: p.currentPrice, suggestedPrice: result.suggestedPrice,
      gapPct: result.gapPct, status: result.status, message: result.message, actualLossAlert,
    };
  });

  rows.sort((a, b) => a.gapPct - b.gapPct);

  // فجوة العائد الظاهر مقابل الحقيقي (طبقة الحقيقة للإيكومرس)
  const [sallaAgg, adSpendAgg] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, platform: "SALLA", date: { gte: thirtyDaysAgo } },
      _sum: { ordersCount: true, revenue: true, returnedOrdersCount: true },
    }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, platform: { in: ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"] }, date: { gte: thirtyDaysAgo } },
      _sum: { cost: true },
    }),
  ]);

  let roasGapInsight: string | null = null;
  const ordersCount = sallaAgg._sum.ordersCount ?? 0;
  if (ordersCount > 0) {
    const avgCogs = products.reduce((s: number, p: any) => s + p.cogs, 0) / products.length;
    const computed = computeEcommerceMetrics({
      platform: "SALLA", cost: adSpendAgg._sum.cost ?? 0, ordersCount,
      revenue: sallaAgg._sum.revenue ?? 0, cogs: avgCogs * ordersCount,
      shippingCost: avgShippingAll * ordersCount, returnedOrdersCount: sallaAgg._sum.returnedOrdersCount ?? 0,
    });
    roasGapInsight = explainRoasGap(computed, "ar");
  }

  return { rows, roasGapInsight };
}

// ==================== التنبيه الاستباقي اليومي (الحلقة المفقودة) ====================
const COOLDOWN_DAYS = 7;

export async function checkPricingHealthAlertsForWorkspace(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return;

  const { rows } = await getWorkspacePricing(workspaceId, ws.currency);

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);

  for (const r of rows) {
    // بس المنتجات اللي فعلاً خطر: خسارة فعلية مؤكدة أو حالة حرجة
    if (r.status !== "CRITICAL" && !r.actualLossAlert) continue;

    const recent = await prisma.actionFeedItem.findFirst({
      where: { workspaceId, title: { contains: "تسعير" }, description: { contains: r.name }, createdAt: { gte: cooldownStart } },
    });
    if (recent) continue;

    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: r.actualLossAlert ? "URGENT" : "HIGH",
      title: `خطر تسعير — ${r.name}`,
      description: r.actualLossAlert ?? r.message,
      linkUrl: "/dashboard/pricing",
    });
  }
}
