// lib/ecommerce/inventoryIntelligence.ts
//
// تحليل المخزون لا إدارته. لا نضيف كميات ولا ننشئ أوامر شراء - المتجر
// يفعل ذلك. ما لا يفعله المتجر هو ربط المخزون بالمال: كم ريالاً نائماً في
// بضاعة لا تتحرّك، وأي منتج سينفد بينما إعلانه ما زال يصرف.
//
// كل دلو هنا له إجراء مقابل. الدلو الذي لا إجراء له لا يستحق العرض.

import { prisma } from "@/lib/prisma";

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  unitsSoldInWindow: number;
  /** وحدات في اليوم */
  velocity: number;
  /** أيام حتى النفاد بمعدّل البيع الحالي - null إن كان لا يُباع إطلاقاً */
  daysLeft: number | null;
  /** رأس المال النائم في هذا المنتج (التكلفة لا سعر البيع) */
  capitalTied: number;
  lastSaleAt: Date | null;
  daysSinceLastSale: number | null;
}

export interface InventoryBucket {
  key: string;
  labelAr: string;
  descriptionAr: string;
  actionAr: string;
  tone: "critical" | "warning" | "positive" | "neutral";
  items: InventoryItem[];
  /** الأثر المالي المرتبط بهذا الدلو */
  capitalImpact: number;
}

export interface InventoryAnalysis {
  buckets: InventoryBucket[];
  trackedProducts: number;
  untrackedProducts: number;
  totalCapitalTied: number;
  deadCapitalPct: number;
  hasData: boolean;
  currency: string;
  windowDays: number;
}

/** لا حركة خلال هذه المدة = مخزون راكد */
const SLOW_MOVING_DAYS = 45;
/** لا حركة إطلاقاً خلال هذه المدة = مخزون ميّت، رأس مال مجمّد */
const DEAD_STOCK_DAYS = 90;
/** سينفد خلال هذه المدة = تحرّك الآن قبل أن يتوقّف البيع */
const RUNNING_OUT_DAYS = 14;

export async function getInventoryAnalysis(
  workspaceId: string,
  windowDays = 30
): Promise<InventoryAnalysis> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });
  const currency = workspace?.currency ?? "SAR";

  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const longSince = new Date();
  longSince.setDate(longSince.getDate() - DEAD_STOCK_DAYS);

  const products = await prisma.product.findMany({ where: { workspaceId } });
  const tracked = products.filter((p) => p.stockQuantity !== null);

  if (tracked.length === 0) {
    return {
      buckets: [],
      trackedProducts: 0,
      untrackedProducts: products.length,
      totalCapitalTied: 0,
      deadCapitalPct: 0,
      hasData: false,
      currency,
      windowDays,
    };
  }

  const ids = tracked.map((p) => p.id);

  const [windowSales, lastSales] = await Promise.all([
    prisma.productSaleEvent.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, occurredAt: { gte: since }, returned: false },
      _sum: { quantity: true },
    }),
    prisma.productSaleEvent.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, returned: false },
      _max: { occurredAt: true },
    }),
  ]);

  const soldById = new Map(windowSales.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const lastSaleById = new Map(lastSales.map((s) => [s.productId, s._max.occurredAt]));

  const now = Date.now();
  const items: InventoryItem[] = tracked.map((p) => {
    const sold = soldById.get(p.id) ?? 0;
    const velocity = sold / windowDays;
    const stock = p.stockQuantity ?? 0;
    const lastSaleAt = lastSaleById.get(p.id) ?? null;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      stockQuantity: stock,
      unitsSoldInWindow: sold,
      velocity: Math.round(velocity * 100) / 100,
      daysLeft: velocity > 0 ? Math.round(stock / velocity) : null,
      // رأس المال النائم يُقاس بالتكلفة لا بسعر البيع - سعر البيع ربح
      // لم يتحقّق بعد، والتكلفة مال خرج من جيبك فعلاً
      capitalTied: Math.round(stock * p.cogs),
      lastSaleAt,
      daysSinceLastSale: lastSaleAt
        ? Math.floor((now - lastSaleAt.getTime()) / (24 * 60 * 60 * 1000))
        : null,
    };
  });

  const runningOut = items.filter(
    (i) => i.daysLeft !== null && i.daysLeft <= RUNNING_OUT_DAYS && i.stockQuantity > 0
  );
  const dead = items.filter(
    (i) => i.stockQuantity > 0 && (i.daysSinceLastSale === null || i.daysSinceLastSale >= DEAD_STOCK_DAYS)
  );
  const slow = items.filter(
    (i) =>
      i.stockQuantity > 0 &&
      i.daysSinceLastSale !== null &&
      i.daysSinceLastSale >= SLOW_MOVING_DAYS &&
      i.daysSinceLastSale < DEAD_STOCK_DAYS
  );
  const best = [...items].filter((i) => i.unitsSoldInWindow > 0).sort((a, b) => b.velocity - a.velocity).slice(0, 10);
  const outOfStock = items.filter((i) => i.stockQuantity === 0);

  const cap = (list: InventoryItem[]) => list.reduce((s, i) => s + i.capitalTied, 0);
  const totalCapital = cap(items);

  const allBuckets: InventoryBucket[] = [
    {
      key: "runningOut",
      labelAr: "على وشك النفاد",
      descriptionAr: `سينفد خلال ${RUNNING_OUT_DAYS} يوماً أو أقلّ بمعدّل البيع الحالي.`,
      actionAr: "أعد الطلب الآن، أو أوقف إعلانه قبل أن تدفع على منتج لا تستطيع تسليمه.",
      tone: "critical",
      items: runningOut.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
      capitalImpact: cap(runningOut),
    },
    {
      key: "outOfStock",
      labelAr: "نفد بالفعل",
      descriptionAr: "رصيده صفر — أي إعلان يعمل عليه الآن ينفق بلا مقابل ممكن.",
      actionAr: "أوقف إعلاناته فوراً حتى يعود الرصيد.",
      tone: "critical",
      items: outOfStock,
      capitalImpact: 0,
    },
    {
      key: "dead",
      labelAr: "مخزون ميّت",
      descriptionAr: `لم يُبَع منه شيء منذ ${DEAD_STOCK_DAYS} يوماً أو أكثر — رأس مال مجمّد.`,
      actionAr: "تخفيض أو باقة مع منتج رائج. استرداد جزء من المال أفضل من تجميده كاملاً.",
      tone: "warning",
      items: dead.sort((a, b) => b.capitalTied - a.capitalTied),
      capitalImpact: cap(dead),
    },
    {
      key: "slow",
      labelAr: "بطيء الحركة",
      descriptionAr: `آخر بيع منذ ${SLOW_MOVING_DAYS} يوماً أو أكثر — في طريقه ليصبح مخزوناً ميّتاً.`,
      actionAr: "تدخّل الآن بينما الطلب عليه ما زال موجوداً: راجع السعر أو الصور أو وصف المنتج.",
      tone: "warning",
      items: slow.sort((a, b) => b.capitalTied - a.capitalTied),
      capitalImpact: cap(slow),
    },
    {
      key: "best",
      labelAr: "الأسرع بيعاً",
      descriptionAr: "أعلى معدّل بيع يومي في متجرك.",
      actionAr: "تأكّد أن رصيدها يكفي قبل زيادة ميزانية إعلاناتها — النفاد وسط حملة يهدر الإنفاق كلّه.",
      tone: "positive",
      items: best,
      capitalImpact: cap(best),
    },
  ];
  const buckets = allBuckets.filter((b) => b.items.length > 0);

  return {
    buckets,
    trackedProducts: tracked.length,
    untrackedProducts: products.length - tracked.length,
    totalCapitalTied: totalCapital,
    deadCapitalPct: totalCapital > 0 ? Math.round((cap(dead) / totalCapital) * 1000) / 10 : 0,
    hasData: true,
    currency,
    windowDays,
  };
}
