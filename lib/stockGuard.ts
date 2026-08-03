// lib/stockGuard.ts
//
// حارس المخزون: يربط رصيد المنتج بالإعلانات التي تروّج له. الإنفاق على
// منتج نفد رصيده خسارة كاملة - النقرة تُدفع ولا يمكن إتمام البيع.
//
// المصدر: يُحدَّث المخزون من منصة الإيكومرس المربوطة (سلة/شوبيفاي) عند
// توفّرها، أو يدوياً. المنتجات التي لا يُتتبَّع مخزونها (null) تُستثنى
// تماماً - لا نخمّن ولا نوقف إعلاناً بناءً على بيانات غير موجودة.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t, type Locale } from "@/lib/i18n/dictionary";

const COOLDOWN_DAYS = 3;
const SALES_WINDOW_DAYS = 14;

export interface StockStatus {
  productId: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  dailySalesRate: number;
  daysLeft: number | null; // null = لا مبيعات حديثة، لا يمكن التقدير
  state: "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY";
}

/** يحسب حالة المخزون لكل منتج متتبَّع، مع معدل البيع الفعلي آخر أسبوعين. */
export async function getStockStatuses(workspaceId: string): Promise<StockStatus[]> {
  const products = await prisma.product.findMany({
    where: { workspaceId, stockQuantity: { not: null } },
  });
  if (products.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - SALES_WINDOW_DAYS);

  const sales = await prisma.productSaleEvent.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p: any) => p.id) }, occurredAt: { gte: since } },
    _sum: { quantity: true },
  });
  const soldByProduct = new Map(sales.map((s: any) => [s.productId, s._sum.quantity ?? 0]));

  return products.map((p: any) => {
    const sold = soldByProduct.get(p.id) ?? 0;
    const dailySalesRate = sold / SALES_WINDOW_DAYS;
    const stock = p.stockQuantity as number;
    const daysLeft = dailySalesRate > 0 ? Math.floor(stock / dailySalesRate) : null;

    let state: StockStatus["state"] = "HEALTHY";
    if (stock <= 0) state = "OUT_OF_STOCK";
    else if (daysLeft !== null && daysLeft <= 3) state = "CRITICAL";
    else if (stock <= p.lowStockThreshold) state = "LOW";

    return {
      productId: p.id, name: p.name, sku: p.sku,
      stockQuantity: stock, lowStockThreshold: p.lowStockThreshold,
      dailySalesRate: Math.round(dailySalesRate * 100) / 100,
      daysLeft, state,
    };
  });
}

/**
 * الفحص اليومي: يدفع تنبيهاً/اقتراحاً قابلاً للتنفيذ عند نفاد المخزون أو
 * اقترابه. الاقتراح يحمل actionType حقيقي، فالموافقة تُوقف الحملة فعلياً
 * على المنصة - لا مجرد نص.
 */
export async function checkStockGuardForWorkspace(workspaceId: string) {
  const statuses = await getStockStatuses(workspaceId);
  const atRisk = statuses.filter((s) => s.state !== "HEALTHY");
  if (atRisk.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { pauseAdsOnOutOfStock: true },
  });

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);

  // الحملات المرشّحة للإيقاف. الربط الدقيق بين المنتج والحملة يحتاج وسم
  // المنتج في اسم الحملة أو كتالوجاً مربوطاً؛ نعتمد هنا مطابقة الاسم/SKU
  // وهي إشارة صريحة لا تخمين - ولا نقترح إيقافاً بدونها.
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId },
    select: { externalCampaignId: true, campaignName: true, platform: true },
  });

  for (const s of atRisk) {
    const recent = await prisma.actionFeedItem.findFirst({
      where: {
        workspaceId,
        titleVars: { path: ["name"], equals: s.name },
        createdAt: { gte: cooldownStart },
      },
    });
    if (recent) continue;

    const needle = (s.sku ?? s.name).toLowerCase();
    const matched = links.filter((l: any) => l.campaignName?.toLowerCase().includes(needle));

    const severity = s.state === "OUT_OF_STOCK" ? "URGENT" : s.state === "CRITICAL" ? "HIGH" : "MEDIUM";
    const reasonKey =
      s.state === "OUT_OF_STOCK"
        ? "alerts.stockReasonOut"
        : s.state === "CRITICAL"
        ? "alerts.stockReasonCritical"
        : "alerts.stockReasonLow";
    const reasonVars = {
      name: s.name,
      days: s.daysLeft ?? 0,
      rate: s.dailySalesRate ?? 0,
      qty: s.stockQuantity ?? 0,
      threshold: s.lowStockThreshold ?? 0,
    };
    const reason = t("ar", reasonKey, reasonVars);

    if (matched.length === 0) {
      // لا حملة مرتبطة يمكن التصرّف فيها بثقة - تنبيه فقط
      await pushToActionFeed({
        workspaceId,
        source: "STOCK",
        type: "ALERT",
        severity,
        title: t("ar", "alerts.stockTitle", { name: s.name }),
        titleKey: "alerts.stockTitle",
        titleVars: { name: s.name },
        description: t("ar", "alerts.stockNoCampaign", { reason }),
        descKey: "alerts.stockNoCampaign",
        descVars: { reason, reasonKey, ...reasonVars },
        linkUrl: "/dashboard/pricing",
      });
      continue;
    }

    for (const link of matched) {
      // الإيقاف التلقائي مفعّل + نفاد كامل ⇒ اقتراح تنفيذي حقيقي
      const executable = workspace?.pauseAdsOnOutOfStock && s.state === "OUT_OF_STOCK";

      await pushToActionFeed({
        workspaceId,
        source: "STOCK",
        type: executable ? "SUGGESTION" : "ALERT",
        severity,
        title: t("ar", "alerts.stockTitleWithAction", {
          name: s.name,
          action: t("ar", executable ? "alerts.stockActionPause" : "alerts.stockActionWatch"),
        }),
        titleKey: "alerts.stockTitleWithAction",
        titleVars: {
          name: s.name,
          actionKey: executable ? "alerts.stockActionPause" : "alerts.stockActionWatch",
        },
        description: t("ar", "alerts.stockWithCampaign", { reason, campaign: link.campaignName }),
        descKey: "alerts.stockWithCampaign",
        descVars: { reason, reasonKey, campaign: link.campaignName, ...reasonVars },
        linkUrl: "/dashboard/pricing",
        ...(executable
          ? {
              actionType: "PAUSE_CAMPAIGN",
              actionPayload: { platform: link.platform, campaignId: link.externalCampaignId },
            }
          : {}),
      });
    }
  }
}
