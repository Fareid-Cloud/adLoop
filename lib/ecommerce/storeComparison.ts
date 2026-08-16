// lib/ecommerce/storeComparison.ts
//
// **أيّ متاجرك يكسب؟**
//
// سؤالٌ لم يكن له وجودٌ قبل اليوم: القيد `@@unique([workspaceId, platform])`
// كان يحصر المساحة في متجرٍ واحدٍ لكلّ منصّة، فلا شيء يُقارَن. وبعد سقوطه
// صار للتاجر متجران على سلّة - علامتان، أو تجزئة وجملة - وصار السؤال
// أوّل ما يسأله.
//
// ═══ الطلب بلا متجر: يُعرض ولا يُوزَّع ═══
//
// `Order.connectionId` أُضيف مع تعدّد المتاجر، فالطلبات التي سبقته لا
// متجر لها. والقسمة عليها بالتساوي أو نسبتها إلى الأوّل تُنتج أرقاماً
// **تبدو دقيقة وهي مخترعة** - وهي أسوأ ما يمكن أن يظهر في صفحةٍ يُقارن
// بها التاجر متاجره ليقرّر أين يضع ماله.
//
// فتُعَدّ على حدة وتُعرض باسمها: «غير منسوبة إلى متجر». الرقم الناقص
// المعلوم أصدق من الرقم الكامل المخمَّن.

import { prisma } from "@/lib/prisma";

export interface StoreLine {
  connectionId: string;
  name: string;
  platform: string;
  orders: number;
  revenue: number;
  /** المرتجعات بالقيمة - تُخصم من الإيراد لا تُذكر كنسبةٍ فقط */
  returnedValue: number;
  returnedOrders: number;
  avgOrderValue: number | null;
  /**
   * الربح بعد تكلفة البضاعة، مقروءٌ من `Product.cogs` عبر أسطر البيع.
   * `null` حين لا تكلفة مسجَّلة لأيّ منتجٍ بيع من هذا المتجر - وعرض صفرٍ
   * مكانه يجعل المتجر يبدو خاسراً كلَّ إيراده.
   */
  grossProfit: number | null;
  /** أكثر منتجٍ ربحاً - وإن غابت التكاليف فأكثرُه إيراداً، مع تصريحٍ بذلك */
  topProduct: { name: string; revenue: number; units: number } | null;
}

export interface StoreComparison {
  windowDays: number;
  stores: StoreLine[];
  /** المتجر الأعلى ربحاً، وإلّا الأعلى إيراداً. `null` مع متجرٍ واحدٍ أو صفر */
  winnerId: string | null;
  /** بأيّ مقياسٍ حُسم الفائز - يُعرض صراحةً فلا يُظنّ الإيراد ربحاً */
  winnerBasis: "PROFIT" | "REVENUE" | null;
  /** الطلبات التي لا متجر لها - تُذكر ولا تُوزَّع */
  unattributedOrders: number;
  unattributedRevenue: number;
  /** المجاميع عبر المتاجر كلّها، بما فيها غير المنسوبة */
  totalOrders: number;
  totalRevenue: number;
  currency: string | null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getStoreComparison(
  workspaceId: string,
  windowDays = 30
): Promise<StoreComparison> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const [stores, orders] = await Promise.all([
    prisma.ecommerceConnection.findMany({
      where: { workspaceId },
      select: { id: true, platform: true, storeName: true, storeUrl: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { workspaceId, orderedAt: { gte: since } },
      select: {
        connectionId: true,
        total: true,
        isReturned: true,
        currency: true,
      },
    }),
  ]);

  // أسطر البيع تحمل المنتج والطلب معاً، فمنها يُعرف منتج كلّ متجر وربحه.
  const saleEvents = await prisma.productSaleEvent.findMany({
    where: { occurredAt: { gte: since }, order: { workspaceId } },
    select: {
      quantity: true,
      revenue: true,
      returned: true,
      order: { select: { connectionId: true } },
      product: { select: { name: true, cogs: true } },
    },
  });

  const byStore = new Map<string, StoreLine>();
  for (const s of stores) {
    byStore.set(s.id, {
      connectionId: s.id,
      name: s.storeName ?? s.storeUrl ?? s.platform,
      platform: s.platform,
      orders: 0,
      revenue: 0,
      returnedValue: 0,
      returnedOrders: 0,
      avgOrderValue: null,
      grossProfit: null,
      topProduct: null,
    });
  }

  let unattributedOrders = 0;
  let unattributedRevenue = 0;
  let currency: string | null = null;

  for (const o of orders) {
    currency ??= o.currency ?? null;
    const line = o.connectionId ? byStore.get(o.connectionId) : undefined;
    if (!line) {
      // إمّا طلبٌ سبق وسم المتاجر، وإمّا متجرٌ فُصل وبقيت طلباته. كلاهما
      // يُعَدّ ولا يُنسب.
      unattributedOrders++;
      if (!o.isReturned) unattributedRevenue += o.total;
      continue;
    }
    line.orders++;
    if (o.isReturned) {
      line.returnedOrders++;
      line.returnedValue += o.total;
    } else {
      line.revenue += o.total;
    }
  }

  // ==== الربح وأفضل منتج، لكلّ متجرٍ من أسطر بيعه هو ====
  const productAgg = new Map<string, Map<string, { revenue: number; units: number }>>();
  const profitByStore = new Map<string, { profit: number; sawCost: boolean }>();

  for (const e of saleEvents) {
    const cid = e.order?.connectionId;
    if (!cid || !byStore.has(cid) || e.returned) continue;

    const agg = productAgg.get(cid) ?? new Map();
    const name = e.product?.name ?? "";
    if (name) {
      const cur = agg.get(name) ?? { revenue: 0, units: 0 };
      cur.revenue += e.revenue;
      cur.units += e.quantity;
      agg.set(name, cur);
      productAgg.set(cid, agg);
    }

    const cogs = e.product?.cogs ?? 0;
    const acc = profitByStore.get(cid) ?? { profit: 0, sawCost: false };
    acc.profit += e.revenue - cogs * e.quantity;
    // تكلفةٌ صفرية قد تكون حقيقية وقد تكون غير مُدخَلة، فلا تُعَدّ دليلاً
    // على أنّنا نعرف التكاليف. نعرفها حين نرى تكلفةً واحدةً موجبة.
    if (cogs > 0) acc.sawCost = true;
    profitByStore.set(cid, acc);
  }

  for (const [cid, line] of byStore) {
    line.revenue = round(line.revenue);
    line.returnedValue = round(line.returnedValue);
    line.avgOrderValue =
      line.orders - line.returnedOrders > 0
        ? round(line.revenue / (line.orders - line.returnedOrders))
        : null;

    const acc = profitByStore.get(cid);
    line.grossProfit = acc?.sawCost ? round(acc.profit) : null;

    const agg = productAgg.get(cid);
    if (agg && agg.size > 0) {
      const [name, v] = [...agg.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
      line.topProduct = { name, revenue: round(v.revenue), units: v.units };
    }
  }

  const lines = [...byStore.values()];

  // ==== الفائز ====
  //
  // الربح أوّلاً، ولا يُقارَن إلّا حين تُعرف تكاليف **كلّ** المتاجر: متجرٌ
  // أُدخلت تكاليفه ومتجرٌ لم تُدخل يجعل الثاني يبدو الأربح دائماً - حكمٌ
  // مقلوبٌ سببه نقصُ إدخال لا أداءٌ فعليّ.
  const comparable = lines.filter((l) => l.orders > 0);
  const allHaveProfit = comparable.length > 0 && comparable.every((l) => l.grossProfit !== null);
  let winnerId: string | null = null;
  let winnerBasis: StoreComparison["winnerBasis"] = null;

  if (comparable.length > 1) {
    if (allHaveProfit) {
      winnerId = [...comparable].sort((a, b) => (b.grossProfit ?? 0) - (a.grossProfit ?? 0))[0].connectionId;
      winnerBasis = "PROFIT";
    } else {
      winnerId = [...comparable].sort((a, b) => b.revenue - a.revenue)[0].connectionId;
      winnerBasis = "REVENUE";
    }
  }

  return {
    windowDays,
    stores: lines,
    winnerId,
    winnerBasis,
    unattributedOrders,
    unattributedRevenue: round(unattributedRevenue),
    totalOrders: orders.length,
    totalRevenue: round(lines.reduce((n, l) => n + l.revenue, 0) + unattributedRevenue),
    currency,
  };
}
