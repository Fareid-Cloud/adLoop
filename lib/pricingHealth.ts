// lib/pricingHealth.ts
//
// نقطة حقيقة واحدة لفحص صحة تسعير كتالوج الـWorkspace - بتُستخدم من صفحة
// التسعير (عرض) ومن الكرون اليومي (تنبيه استباقي). قبل كده كان الحساب
// موجود في صفحة التسعير بس، فالتنبيه "قبل الخسارة" ما كانش بيشتغل تلقائياً
// أبداً - المستخدم كان لازم يفتح الصفحة بإيده عشان يعرف. دي الحلقة المفقودة.

import { prisma } from "@/lib/prisma";
import { ownerLocaleFor } from "@/lib/workspaceLocale";
import {
  runPricingHealthCheck,
  runFullPricingSafetyNet,
  computeEcommerceMetrics,
  explainRoasGap,
} from "@/lib/ecommerceMetrics";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface PricingRow {
  id: string;
  name: string;
  currentPrice: number;
  suggestedPrice: number;
  gapPct: number;
  status: "SAFE" | "WARNING" | "CRITICAL";
  /** الجملة مبنيّةً للعرض في الصفحة - لا تُخزَّن */
  message: string;
  actualLossAlert: string | null;
  /** ما يُخزَّن: المفتاح ومتغيّراته الرقمية - راجع `checkPricingHealthAlertsForWorkspace` */
  messageKey: string;
  messageVars: Record<string, string | number>;
  /** خسارةٌ فعلية بالرقم لا بالجملة - `null` إن لم تقع */
  actualLossValue: number | null;
}

export async function getWorkspacePricing(
  workspaceId: string,
  currency: string,
  // العرض يتبع لغة القارئ. كانت مثبّتة على العربية، فكان مستخدم الواجهة
  // الإنجليزية يرى رسائل التسعير عربيةً مهما فعل.
  locale: Locale
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

    const result = runPricingHealthCheck(p.name, p.currentPrice, pricingInputsOf(p), locale, marginDiagnosisInput);

    const events = byProduct.get(p.id) ?? [];
    let actualLossValue: number | null = null;
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
        marginDiagnosisInput, locale
      );
      if (safetyNet.slippedThrough) {
        // رقمٌ لا جملة: النصّ يُبنى عند العرض بلغة قارئه.
        actualLossValue = Math.round(safetyNet.after!.grossProfit);
      }
    }

    return {
      id: p.id, name: p.name, currentPrice: p.currentPrice, suggestedPrice: result.suggestedPrice,
      gapPct: result.gapPct, status: result.status, message: result.message,
      messageKey: result.messageKey, messageVars: result.messageVars,
      actualLossValue,
      actualLossAlert: actualLossValue !== null
        ? t(locale, "alerts.pricingBodyActualLoss", {
            loss: actualLossValue, currency,
            suggestedPrice: Math.round(result.suggestedPrice),
          })
        : null,
    };
  });

  rows.sort((a, b) => a.gapPct - b.gapPct);

  // فجوة العائد الظاهر مقابل الحقيقي (طبقة الحقيقة للإيكومرس)
  const [sallaAgg, adSpendAgg] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, platform: "SALLA", date: { gte: thirtyDaysAgo } },
      _sum: { ordersCount: true, storeRevenue: true, returnedOrdersCount: true },
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
      revenue: sallaAgg._sum.storeRevenue ?? 0, cogs: avgCogs * ordersCount,
      shippingCost: avgShippingAll * ordersCount, returnedOrdersCount: sallaAgg._sum.returnedOrdersCount ?? 0,
    });
    roasGapInsight = explainRoasGap(computed, locale);
  }

  return { rows, roasGapInsight };
}

// ==================== التنبيه الاستباقي اليومي (الحلقة المفقودة) ====================
const COOLDOWN_DAYS = 7;

export async function checkPricingHealthAlertsForWorkspace(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return;

  const currency = ws.currency;
  // لغةُ المالك تُقرأ مرّةً وتُستعمل للنصّ الاحتياطيّ وحده - المفاتيح
  // المخزَّنة لا تعرف لغةً أصلاً.
  const locale = await ownerLocaleFor(workspaceId);
  const { rows } = await getWorkspacePricing(workspaceId, currency, locale);

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);

  for (const r of rows) {
    // بس المنتجات اللي فعلاً خطر: خسارة فعلية مؤكدة أو حالة حرجة
    if (r.status !== "CRITICAL" && !r.actualLossAlert) continue;

    const recent = await prisma.actionFeedItem.findFirst({
      where: {
        workspaceId,
        titleKey: "alerts.pricingTitle",
        titleVars: { path: ["name"], equals: r.name },
        createdAt: { gte: cooldownStart },
      },
    });
    if (recent) continue;

    // 🔴 **المفتاح ومتغيّراته الرقمية - لا جملةٌ مبنيّة.**
    //
    // كان `message` جملةً كاملة تُبنى بلغة لحظة الكتابة وتُحقَن في قالبٍ
    // مُترجَم، فتخرج البطاقة بعنوانٍ عربيّ ووصفٍ إنجليزيّ. صار الصفُّ
    // يحمل مفتاحه كاملاً وأرقامَه، فيُترجَم عند القراءة بلغة قارئه.
    const descKey =
      r.actualLossValue !== null
        ? "alerts.pricingBodyActualLoss"
        : r.status === "CRITICAL"
          ? "alerts.pricingBodyCritical"
          : "alerts.pricingBodyWarning";
    const pricingDescVars: Record<string, string | number> = {
      ...(r.actualLossValue !== null ? { loss: r.actualLossValue } : r.messageVars),
      suggestedPrice: Math.round(r.suggestedPrice),
      currency,
    };

    // اقتراح قابل للتنفيذ لا مجرد تنبيه: الموافقة تُحدّث السعر في المتجر
    // نفسه عبر واجهة المنصة، لا في قاعدتنا وحدها.
    await pushToActionFeed({
      workspaceId,
      source: "PRICING",
      type: r.suggestedPrice > r.currentPrice ? "SUGGESTION" : "ALERT",
      severity: r.actualLossAlert ? "URGENT" : "HIGH",
      // النصّ المبنيّ احتياطٌ لواجهةٍ قديمة لا تقرأ المفاتيح - ويُبنى
      // بلغة **مالك المساحة** لا بـ"ar" مثبَّتة كما كان.
      title: t(locale, "alerts.pricingTitle", { name: r.name }),
      titleKey: "alerts.pricingTitle",
      titleVars: { name: r.name },
      description: t(locale, descKey, pricingDescVars),
      descKey,
      descVars: pricingDescVars,
      linkUrl: "/dashboard/pricing",
      ...(r.suggestedPrice > r.currentPrice
        ? {
            actionType: "APPLY_PRODUCT_PRICE",
            actionPayload: { productId: r.id, newPrice: r.suggestedPrice, productName: r.name },
          }
        : {}),
    });
  }
}
