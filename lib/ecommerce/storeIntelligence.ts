// lib/ecommerce/storeIntelligence.ts
//
// محرّك قسم التجارة الإلكترونية. المبدأ الحاكم: **ذكاء قرار لا عرض بيانات**.
//
// لا يُحسب هنا أي رقم يستطيع المستخدم رؤيته كما هو في لوحة سلة أو شوبيفاي.
// كل دالة هنا تجيب سؤالاً لا تجيبه تلك اللوحات: أين يذهب المال فعلاً بعد
// كل التكاليف، وأي منتج يخسر رغم أن مبيعاته تبدو جيدة، وأي عميل على وشك
// أن يختفي. الرقم الذي لا يقود إلى قرار لا مكان له في هذا الملف.
//
// قاعدة صدق صارمة: كل بنية تُعيد ما يكفي لمعرفة **درجة اليقين**. حين تنقص
// البيانات نقول ذلك بدل إخراج صفر يبدو نتيجةً.

import { prisma } from "@/lib/prisma";
import type { LocalizedText } from "./opportunities";

const AD_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"] as const;

// ==================== النظرة التنفيذية ====================

export interface StoreOverview {
  revenue: number;
  netProfit: number;
  grossMarginPct: number | null;
  orders: number;
  avgOrderValue: number | null;
  returningCustomersPct: number | null;
  refundRatePct: number;
  /** عدد المنتجات المهدَّدة بالنفاد خلال ١٤ يوماً بمعدّل بيعها الحالي */
  inventoryRiskCount: number;
  /** مقارنة بالفترة السابقة بنفس الطول */
  revenueChangePct: number | null;
  profitChangePct: number | null;
  /** هل لدينا طلبات حقيقية أم مجاميع يومية فقط */
  hasOrderLevelData: boolean;
  hasStoreConnection: boolean;
  currency: string;
  windowDays: number;
}

// ==================== رحلة الربح ====================

export interface ProfitStage {
  key: string;
  label: LocalizedText;
  /** موجب للإيراد، سالب لكل تكلفة - الإشارة تحمل المعنى */
  amount: number;
  /** نسبة هذه المرحلة من الإيراد */
  pctOfRevenue: number;
  /** ما تبقّى بعد هذه المرحلة */
  runningTotal: number;
  /** من أين جاء الرقم - الشفافية تسبق الثقة */
  source: LocalizedText;
  /** هل الرقم مقدَّر لا مقروء */
  isEstimate: boolean;
}

export interface ProfitJourney {
  stages: ProfitStage[];
  revenue: number;
  netProfit: number;
  netMarginPct: number | null;
  /** أكبر بند تكلفة - نقطة التدخّل الأولى */
  biggestLeak: { label: LocalizedText; amount: number; pctOfRevenue: number } | null;
  /** تكاليف لم نستطع قراءتها، تُذكر صراحةً لأن غيابها يضخّم الربح */
  missingCosts: Array<{ key: string; vars?: Record<string, string | number> }>;
  currency: string;
}

export async function getProfitJourney(workspaceId: string, windowDays = 30): Promise<ProfitJourney> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });
  const currency = workspace?.currency ?? "SAR";

  const [orders, saleEvents, adSpend, products] = await Promise.all([
    prisma.order.findMany({
      where: { workspaceId, orderedAt: { gte: since } },
      select: { total: true, shippingCost: true, isReturned: true, state: true, isCod: true },
    }),
    prisma.productSaleEvent.findMany({
      where: { occurredAt: { gte: since }, product: { workspaceId } },
      select: { quantity: true, revenue: true, returned: true, product: true },
    }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: since }, platform: { in: AD_PLATFORMS as never } },
      _sum: { cost: true },
    }),
    prisma.product.findMany({ where: { workspaceId } }),
  ]);

  // مفاتيح لا نصّاً: هذه القائمة تُعرَض في صفحة الربح، فيلزم أن تتبع لغة
  // القارئ لا لغة لحظة الحساب.
  const missingCosts: Array<{ key: string; vars?: Record<string, string | number> }> = [];

  // الإيراد: الطلبات الحقيقية أولاً، وإلّا المجاميع اليومية
  let revenue = orders.filter((o) => o.state !== "CANCELLED").reduce((s, o) => s + o.total, 0);
  let usedSnapshots = false;
  if (orders.length === 0) {
    const snap = await prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: since } },
      _sum: { revenue: true },
    });
    revenue = snap._sum.revenue ?? 0;
    usedSnapshots = true;
  }

  // تكلفة البضاعة - من أسطر البيع المرتبطة بمنتجات معروفة تكلفتها
  const cogs = saleEvents.reduce((s, e) => s + e.product.cogs * e.quantity, 0);
  const matchedRevenue = saleEvents.reduce((s, e) => s + e.revenue, 0);
  // لو جزء كبير من الإيراد بلا منتج مطابق، تكلفة البضاعة ناقصة حتماً
  const cogsCoveragePct = revenue > 0 ? (matchedRevenue / revenue) * 100 : 0;
  if (revenue > 0 && cogsCoveragePct < 80) {
    missingCosts.push({
      key: "missingCost.partialCogs",
      vars: { pct: Math.round(cogsCoveragePct) },
    });
  }
  if (products.length > 0 && products.every((p) => p.cogs === 0)) {
    missingCosts.push({ key: "missingCost.allZeroCogs" });
  }

  // الشحن: من الطلبات إن وُجد، وإلّا تقدير من إعدادات المنتجات
  let shipping = orders.reduce((s, o) => s + o.shippingCost, 0);
  let shippingIsEstimate = false;
  if (shipping === 0 && saleEvents.length > 0) {
    shipping = saleEvents.reduce((s, e) => s + e.product.outboundShippingCost * e.quantity, 0);
    shippingIsEstimate = true;
  }

  const advertising = adSpend._sum.cost ?? 0;

  // الرسوم: بوابة الدفع + الدفع عند الاستلام + التغليف والمناولة
  const fees = saleEvents.reduce((s, e) => {
    const p = e.product;
    const gateway = (e.revenue * p.paymentGatewayFeePct) / 100 + p.paymentGatewayFixedFee * e.quantity;
    const cod = (e.revenue * p.codFeePct) / 100;
    const handling = (p.packagingCost + p.handlingCost) * e.quantity;
    return s + gateway + cod + handling;
  }, 0);

  // المرتجعات: قيمة الطلب المرتجع + شحن الإرجاع + ما لا يعود قابلاً للبيع
  const returnedOrdersValue = orders.filter((o) => o.isReturned).reduce((s, o) => s + o.total, 0);
  const returnExtra = saleEvents
    .filter((e) => e.returned)
    .reduce(
      (s, e) =>
        s +
        e.product.returnShippingCost * e.quantity +
        (e.product.cogs * e.quantity * e.product.restockingLossPct) / 100,
      0
    );
  const returns = returnedOrdersValue + returnExtra;

  if (advertising === 0) {
    missingCosts.push({ key: "missingCost.noAdSpend" });
  }

  const costStages: Array<Omit<ProfitStage, "runningTotal" | "pctOfRevenue">> = [
    {
      key: "cogs",
      label: { key: "cogs.label" },
      amount: -cogs,
      source: { key: "cogs.source" },
      isEstimate: false,
    },
    {
      key: "shipping",
      label: { key: "shipping.label" },
      amount: -shipping,
      source: { key: shippingIsEstimate ? "shipping.sourceEstimate" : "shipping.sourceReal" },
      isEstimate: shippingIsEstimate,
    },
    {
      key: "advertising",
      label: { key: "advertising.label" },
      amount: -advertising,
      source: { key: "advertising.source" },
      isEstimate: false,
    },
    {
      key: "fees",
      label: { key: "fees.label" },
      amount: -fees,
      source: { key: "fees.source" },
      isEstimate: false,
    },
    {
      key: "returns",
      label: { key: "returns.label" },
      amount: -returns,
      source: { key: "returns.source" },
      isEstimate: false,
    },
  ];

  const stages: ProfitStage[] = [];
  let running = revenue;
  stages.push({
    key: "revenue",
    label: { key: "revenue.label" },
    amount: revenue,
    pctOfRevenue: 100,
    runningTotal: revenue,
    source: { key: usedSnapshots ? "revenue.sourceSnapshots" : "revenue.sourceOrders" },
    isEstimate: usedSnapshots,
  });

  for (const stage of costStages) {
    running += stage.amount;
    stages.push({
      ...stage,
      pctOfRevenue: revenue > 0 ? round1((Math.abs(stage.amount) / revenue) * 100) : 0,
      runningTotal: Math.round(running),
    });
  }

  const netProfit = running;
  const costsOnly = costStages.filter((s) => s.amount < 0);
  const biggest = costsOnly.sort((a, b) => a.amount - b.amount)[0];

  return {
    stages,
    revenue: Math.round(revenue),
    netProfit: Math.round(netProfit),
    netMarginPct: revenue > 0 ? round1((netProfit / revenue) * 100) : null,
    biggestLeak:
      biggest && biggest.amount < 0
        ? {
            label: biggest.label,
            amount: Math.round(Math.abs(biggest.amount)),
            pctOfRevenue: revenue > 0 ? round1((Math.abs(biggest.amount) / revenue) * 100) : 0,
          }
        : null,
    missingCosts: missingCosts,
    currency,
  };
}

export async function getStoreOverview(workspaceId: string, windowDays = 30): Promise<StoreOverview> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const prevSince = new Date();
  prevSince.setDate(prevSince.getDate() - windowDays * 2);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });

  const [journey, prevJourney, orders, customers, connection, products] = await Promise.all([
    getProfitJourney(workspaceId, windowDays),
    getProfitJourney(workspaceId, windowDays * 2),
    prisma.order.findMany({
      where: { workspaceId, orderedAt: { gte: since } },
      select: { total: true, isReturned: true, state: true, customerId: true },
    }),
    prisma.customer.findMany({
      where: { workspaceId, lastOrderAt: { gte: since } },
      select: { ordersCount: true },
    }),
    prisma.ecommerceConnection.findFirst({ where: { workspaceId, active: true } }),
    prisma.product.findMany({
      where: { workspaceId, stockQuantity: { not: null } },
      select: { id: true, stockQuantity: true },
    }),
  ]);

  const live = orders.filter((o) => o.state !== "CANCELLED");
  const ordersCount = live.length;
  const returned = orders.filter((o) => o.isReturned).length;

  // خطر المخزون: نحسب سرعة البيع الفعلية لكل منتج متتبَّع
  let inventoryRiskCount = 0;
  if (products.length > 0) {
    const sales = await prisma.productSaleEvent.groupBy({
      by: ["productId"],
      where: { occurredAt: { gte: since }, productId: { in: products.map((p) => p.id) }, returned: false },
      _sum: { quantity: true },
    });
    const soldById = new Map(sales.map((s) => [s.productId, s._sum.quantity ?? 0]));
    for (const p of products) {
      const sold = soldById.get(p.id) ?? 0;
      if (sold <= 0 || p.stockQuantity === null) continue;
      const perDay = sold / windowDays;
      if (perDay > 0 && p.stockQuantity / perDay <= 14) inventoryRiskCount++;
    }
  }

  // "عميل عائد" = طلب أكثر من مرة. بلا جدول عملاء كان هذا المؤشّر مستحيلاً
  const returning = customers.filter((c) => c.ordersCount > 1).length;

  // الفترة السابقة = نافذة مضاعفة ناقص الحالية (getProfitJourney تعمل بنافذة واحدة)
  const prevRevenue = prevJourney.revenue - journey.revenue;
  const prevProfit = prevJourney.netProfit - journey.netProfit;

  return {
    revenue: journey.revenue,
    netProfit: journey.netProfit,
    grossMarginPct: journey.netMarginPct,
    orders: ordersCount,
    avgOrderValue: ordersCount > 0 ? Math.round(journey.revenue / ordersCount) : null,
    returningCustomersPct: customers.length > 0 ? round1((returning / customers.length) * 100) : null,
    refundRatePct: orders.length > 0 ? round1((returned / orders.length) * 100) : 0,
    inventoryRiskCount,
    revenueChangePct: prevRevenue > 0 ? round1(((journey.revenue - prevRevenue) / prevRevenue) * 100) : null,
    profitChangePct: prevProfit !== 0 ? round1(((journey.netProfit - prevProfit) / Math.abs(prevProfit)) * 100) : null,
    hasOrderLevelData: orders.length > 0,
    hasStoreConnection: !!connection,
    currency: workspace?.currency ?? "SAR",
    windowDays,
  };
}

// ==================== جودة الطلبات ====================

export interface OrderQualityBucket {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  count: number;
  value: number;
  /** الأثر المالي - ما يكلّفه هذا الدلو فعلاً */
  costImpact: number;
  tone: "critical" | "warning" | "neutral" | "positive";
}

export interface OrderQuality {
  buckets: OrderQualityBucket[];
  totalOrders: number;
  recent: Array<{
    id: string;
    externalOrderId: string;
    orderedAt: Date;
    total: number;
    state: string;
    isCod: boolean;
    fraudRiskScore: number | null;
    fraudRiskReasons: string[];
    customerName: string | null;
  }>;
  hasData: boolean;
  currency: string;
}

/** بعد هذه المدة يُعدّ الطلب متأخّراً إن لم يُنفَّذ - مبني على توقّع السوق المحلي */
const DELAYED_AFTER_DAYS = 5;
/** درجة مخاطرة تستدعي مراجعة بشرية */
const FRAUD_REVIEW_THRESHOLD = 50;

export async function getOrderQuality(workspaceId: string, windowDays = 30): Promise<OrderQuality> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });

  const orders = await prisma.order.findMany({
    where: { workspaceId, orderedAt: { gte: since } },
    include: { customer: { select: { displayName: true } } },
    orderBy: { orderedAt: "desc" },
  });

  if (orders.length === 0) {
    return { buckets: [], totalOrders: 0, recent: [], hasData: false, currency: workspace?.currency ?? "SAR" };
  }

  const avg = orders.reduce((s, o) => s + o.total, 0) / orders.length;
  const delayedCutoff = new Date();
  delayedCutoff.setDate(delayedCutoff.getDate() - DELAYED_AFTER_DAYS);

  const cancelled = orders.filter((o) => o.state === "CANCELLED");
  const returnedOrders = orders.filter((o) => o.isReturned);
  const delayed = orders.filter((o) => o.state === "PLACED" && o.orderedAt < delayedCutoff);
  const highValue = orders.filter((o) => o.total >= avg * 2 && o.state !== "CANCELLED");
  const risky = orders.filter((o) => (o.fraudRiskScore ?? 0) >= FRAUD_REVIEW_THRESHOLD && o.state === "PLACED");

  const sum = (arr: typeof orders) => arr.reduce((s, o) => s + o.total, 0);

  const buckets: OrderQualityBucket[] = [
    {
      key: "cancelled",
      label: { key: "cancelled.label" },
      description: { key: "cancelled.description" },
      count: cancelled.length,
      value: Math.round(sum(cancelled)),
      costImpact: Math.round(sum(cancelled)),
      tone: "warning",
    },
    {
      key: "returned",
      label: { key: "returned.label" },
      description: { key: "returned.description" },
      count: returnedOrders.length,
      value: Math.round(sum(returnedOrders)),
      costImpact: Math.round(sum(returnedOrders)),
      tone: "critical",
    },
    {
      key: "delayed",
      label: { key: "delayed.label" },
      description: { key: "delayed.description", vars: { days: DELAYED_AFTER_DAYS } },
      count: delayed.length,
      value: Math.round(sum(delayed)),
      costImpact: Math.round(sum(delayed)),
      tone: delayed.length > 0 ? "critical" : "neutral",
    },
    {
      key: "highValue",
      label: { key: "highValue.label" },
      description: { key: "highValue.description" },
      count: highValue.length,
      value: Math.round(sum(highValue)),
      costImpact: 0,
      tone: "positive",
    },
    {
      key: "risky",
      label: { key: "risky.label" },
      description: { key: "risky.description" },
      count: risky.length,
      value: Math.round(sum(risky)),
      costImpact: Math.round(sum(risky)),
      tone: risky.length > 0 ? "warning" : "neutral",
    },
  ];

  return {
    buckets,
    totalOrders: orders.length,
    recent: orders.slice(0, 40).map((o) => ({
      id: o.id,
      externalOrderId: o.externalOrderId,
      orderedAt: o.orderedAt,
      total: Math.round(o.total),
      state: o.state,
      isCod: o.isCod,
      fraudRiskScore: o.fraudRiskScore,
      fraudRiskReasons: o.fraudRiskReasons,
      customerName: o.customer?.displayName ?? null,
    })),
    hasData: true,
    currency: workspace?.currency ?? "SAR",
  };
}

// ==================== تحليل العملاء ====================

export interface CustomerSegment {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  count: number;
  revenue: number;
  avgLtv: number;
  tone: "positive" | "warning" | "critical" | "neutral";
  action: LocalizedText;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  repeatPurchaseRatePct: number | null;
  avgLtv: number | null;
  /** ما ينفقه العميل العائد مقابل العميل لمرة واحدة - أقوى حجّة للاستثمار في الاحتفاظ */
  repeatCustomerValueMultiple: number | null;
  segments: CustomerSegment[];
  topCustomers: Array<{
    id: string;
    displayName: string | null;
    city: string | null;
    ordersCount: number;
    totalSpent: number;
    lastOrderAt: Date | null;
    returnRatePct: number;
  }>;
  hasData: boolean;
  currency: string;
}

/** بعد هذه المدة بلا طلب يُعدّ العميل معرَّضاً للفقد - مبنية على متوسط
 *  دورة الشراء في التجزئة الإلكترونية، وتُقارن بسلوك المتجر نفسه أدناه */
const CHURN_RISK_DAYS = 90;
const VIP_TOP_PERCENT = 0.1;

export async function getCustomerAnalytics(workspaceId: string): Promise<CustomerAnalytics> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });
  const currency = workspace?.currency ?? "SAR";

  const customers = await prisma.customer.findMany({ where: { workspaceId } });

  if (customers.length === 0) {
    return {
      totalCustomers: 0,
      repeatPurchaseRatePct: null,
      avgLtv: null,
      repeatCustomerValueMultiple: null,
      segments: [],
      topCustomers: [],
      hasData: false,
      currency,
    };
  }

  const repeat = customers.filter((c) => c.ordersCount > 1);
  const single = customers.filter((c) => c.ordersCount === 1);
  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);

  const avgRepeatSpend = repeat.length > 0 ? repeat.reduce((s, c) => s + c.totalSpent, 0) / repeat.length : 0;
  const avgSingleSpend = single.length > 0 ? single.reduce((s, c) => s + c.totalSpent, 0) / single.length : 0;

  const churnCutoff = new Date();
  churnCutoff.setDate(churnCutoff.getDate() - CHURN_RISK_DAYS);

  // VIP: أعلى ١٠٪ إنفاقاً، وليس رقماً ثابتاً - "كبير" نسبيّ لكل متجر
  const sortedBySpend = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
  const vipCount = Math.max(1, Math.floor(customers.length * VIP_TOP_PERCENT));
  const vips = sortedBySpend.slice(0, vipCount);
  const vipIds = new Set(vips.map((c) => c.id));

  const atRisk = customers.filter(
    (c) => !vipIds.has(c.id) && c.ordersCount > 1 && c.lastOrderAt && c.lastOrderAt < churnCutoff
  );
  const vipAtRisk = vips.filter((c) => c.lastOrderAt && c.lastOrderAt < churnCutoff);
  const highReturners = customers.filter(
    (c) => c.ordersCount >= 3 && c.returnedOrdersCount / c.ordersCount >= 0.4
  );

  const seg = (
    key: string,
    label: LocalizedText,
    description: LocalizedText,
    list: typeof customers,
    tone: CustomerSegment["tone"],
    action: LocalizedText
  ): CustomerSegment => ({
    key,
    label,
    description,
    count: list.length,
    revenue: Math.round(list.reduce((s, c) => s + c.totalSpent, 0)),
    avgLtv: list.length > 0 ? Math.round(list.reduce((s, c) => s + c.totalSpent, 0) / list.length) : 0,
    tone,
    action,
  });

  const segments: CustomerSegment[] = [
    seg("vip", { key: "vip.label" }, { key: "vip.description", vars: { pct: Math.round(VIP_TOP_PERCENT * 100) } },
      vips, "positive", { key: "vip.action" }),
    seg("vipAtRisk", { key: "vipAtRisk.label" }, { key: "vipAtRisk.description", vars: { days: CHURN_RISK_DAYS } },
      vipAtRisk, "critical", { key: "vipAtRisk.action" }),
    seg("atRisk", { key: "atRisk.label" }, { key: "atRisk.description", vars: { days: CHURN_RISK_DAYS } },
      atRisk, "warning", { key: "atRisk.action" }),
    seg("repeat", { key: "repeat.label" }, { key: "repeat.description" }, repeat, "positive", { key: "repeat.action" }),
    seg("single", { key: "single.label" }, { key: "single.description" }, single, "neutral", { key: "single.action" }),
    seg("highReturners", { key: "highReturners.label" }, { key: "highReturners.description" },
      highReturners, "critical", { key: "highReturners.action" }),
  ].filter((s) => s.count > 0);

  return {
    totalCustomers: customers.length,
    repeatPurchaseRatePct: round1((repeat.length / customers.length) * 100),
    avgLtv: Math.round(totalSpent / customers.length),
    repeatCustomerValueMultiple:
      avgSingleSpend > 0 ? Math.round((avgRepeatSpend / avgSingleSpend) * 10) / 10 : null,
    segments,
    topCustomers: sortedBySpend.slice(0, 20).map((c) => ({
      id: c.id,
      displayName: c.displayName,
      city: c.city,
      ordersCount: c.ordersCount,
      totalSpent: Math.round(c.totalSpent),
      lastOrderAt: c.lastOrderAt,
      returnRatePct: c.ordersCount > 0 ? round1((c.returnedOrdersCount / c.ordersCount) * 100) : 0,
    })),
    hasData: true,
    currency,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
