// lib/ecommerce/costSync.ts
//
// سحب تكلفة البضاعة (COGS) من منصة المتجر.
//
// **الحقيقة التي شكّلت هذا الملف:** ويب هوك الطلب لا يحمل التكلفة في أي
// منصة من الخمس - تأكّدنا من توثيق سلة وشوبيفاي الرسمي مباشرة. التكلفة
// تعيش على *المنتج* لا على *الطلب*:
//
//   • سلة    → حقل `cost_price` على المنتج (Products API)
//   • شوبيفاي → variant.inventory_item_id ثم InventoryItem.cost (نداءان)
//   • زد / ووكومرس / إيزي أوردرز → لا حقل تكلفة أصلاً
//
// لذلك السحب هنا **دوري صريح** لا استماع للطلبات، ويُصرَّح لكل منصة بما
// تدعمه فعلاً. المنصات غير المدعومة تُعيد سبباً مكتوباً - لا فشل صامت
// يترك المستخدم يظنّ أن الرقم سيصل يوماً ما.

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import type { EcommercePlatform } from "./types";

/** المنصات التي تُعرِّض تكلفة المنتج فعلاً - مؤكَّدة من توثيقها الرسمي */
export const COST_CAPABLE_PLATFORMS: EcommercePlatform[] = ["SALLA", "SHOPIFY"];

export interface CostSyncResult {
  ok: boolean;
  platform?: EcommercePlatform;
  /** عدد المنتجات التي تغيّرت تكلفتها فعلاً */
  updated: number;
  /** طُوبقت لكن التكلفة لدى المنصة صفر أو فارغة - لم يدخلها التاجر هناك أصلاً */
  emptyAtSource: number;
  /** لا يوجد لها SKU عندنا فتعذّرت المطابقة */
  unmatched: number;
  reasonKey?: string;
  reasonVars?: Record<string, string | number>;
}

const EMPTY: Omit<CostSyncResult, "ok"> = { updated: 0, emptyAtSource: 0, unmatched: 0 };

export async function syncCostsFromStore(workspaceId: string): Promise<CostSyncResult> {
  // 🔴 **«أوّل متجر» يعمل حتى يصير المتجران اثنين.** كان `findFirst` بلا
  // ترتيبٍ ولا شرطٍ على المنصّة، فمن عنده سلّة وووكومرس قد يقع الاختيار
  // على ووكومرس - وهي لا تُعرِّض التكلفة أصلاً - فيُقال له «منصّتك لا
  // تدعم التكلفة» ومتجرُ سلّة عنده يدعمها. يُختار متجرٌ **قادر** إن وُجد.
  const connections = await prisma.ecommerceConnection.findMany({
    where: { workspaceId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const connection =
    connections.find((c) => COST_CAPABLE_PLATFORMS.includes(c.platform as EcommercePlatform)) ??
    connections[0];

  if (!connection) return { ok: false, ...EMPTY, reasonKey: "csNoStore" };

  const platform = connection.platform as EcommercePlatform;
  if (!COST_CAPABLE_PLATFORMS.includes(platform)) {
    return {
      ok: false, ...EMPTY, platform,
      reasonKey: "csPlatformUnsupported",
      // المنصة تُمرَّر كمفتاح لا كنصّ - الترجمة عند العرض لا عند الحساب
      reasonVars: { platform },
    };
  }

  if (!connection.apiToken) {
    return { ok: false, ...EMPTY, platform, reasonKey: "csNoToken" };
  }

  const token = decryptToken(connection.apiToken);
  if (!token) return { ok: false, ...EMPTY, platform, reasonKey: "csTokenUnreadable" };

  // المطابقة بالـSKU حصراً: الاسم يتغيّر ويتكرّر، والمطابقة به تكتب تكلفة
  // منتج على منتج آخر - خطأ صامت أسوأ من عدم المطابقة.
  const products = await prisma.product.findMany({
    where: { workspaceId, sku: { not: null } },
    select: { id: true, sku: true, cogs: true },
  });
  if (products.length === 0) return { ok: false, ...EMPTY, platform, reasonKey: "csNoSkus" };

  const bySku = new Map(products.map((p) => [normSku(p.sku!), p]));

  let costs: Map<string, number>;
  try {
    costs = platform === "SALLA"
      ? await fetchSallaCosts(token)
      : await fetchShopifyCosts(token, connection.storeIdentifier ?? connection.storeUrl ?? "");
  } catch (err) {
    return {
      ok: false, ...EMPTY, platform,
      reasonKey: "csFetchFailed",
      reasonVars: { error: err instanceof Error ? err.message.slice(0, 120) : "unknown" },
    };
  }

  let updated = 0, emptyAtSource = 0;
  const matchedSkus = new Set<string>();

  for (const [sku, cost] of costs) {
    const product = bySku.get(sku);
    if (!product) continue;
    matchedSkus.add(sku);

    // صفر عند المنصة يعني أن التاجر لم يُدخل التكلفة هناك - ليس تكلفة
    // حقيقية. الكتابة به تمسح رقماً صحيحاً أدخله المستخدم عندنا.
    if (!cost || cost <= 0) { emptyAtSource++; continue; }
    if (Math.abs(product.cogs - cost) < 0.01) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: { cogs: cost, cogsLastUpdatedAt: new Date() },
    });
    updated++;
  }

  return {
    ok: true,
    platform,
    updated,
    emptyAtSource,
    unmatched: products.length - matchedSkus.size,
  };
}

function normSku(s: string): string {
  return s.trim().toLowerCase();
}

// ==================== سلة ====================

/**
 * `cost_price` مؤكَّد من توثيق سلة (نموذج المنتج وحدث product.price.updated).
 * الترقيم مطلوب: متجر بمئات المنتجات لا يعود في صفحة واحدة.
 */
async function fetchSallaCosts(token: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://api.salla.dev/admin/v2/products?per_page=65&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Salla ${res.status}`);
    const body = await res.json();
    const items: unknown[] = body?.data ?? [];
    if (items.length === 0) break;

    for (const raw of items) {
      const it = raw as { sku?: string; cost_price?: number | null; skus?: Array<{ sku?: string; cost_price?: number | null }> };
      if (it.sku) out.set(normSku(it.sku), Number(it.cost_price ?? 0));
      // المنتجات ذات الخيارات تحمل تكلفة لكل متغيّر على حدة
      for (const v of it.skus ?? []) {
        if (v.sku) out.set(normSku(v.sku), Number(v.cost_price ?? 0));
      }
    }
    if (items.length < 65) break;
  }
  return out;
}

// ==================== شوبيفاي ====================

/**
 * التكلفة عند شوبيفاي ليست على المنتج ولا على الطلب - هي على
 * InventoryItem. لذلك نداءان: المتغيّرات أولاً لأخذ inventory_item_id،
 * ثم عناصر المخزون دفعةً واحدة. الحقل يتطلّب صلاحية "View product costs".
 */
async function fetchShopifyCosts(token: string, shopDomain: string): Promise<Map<string, number>> {
  const shop = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!shop) throw new Error("missing shop domain");

  const api = (path: string) =>
    fetch(`https://${shop}/admin/api/2025-07/${path}`, {
      headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
    });

  const skuByInventoryItem = new Map<string, string>();
  let sinceId = 0;

  for (let page = 0; page < 20; page++) {
    const res = await api(`products.json?limit=250&since_id=${sinceId}&fields=id,variants`);
    if (!res.ok) throw new Error(`Shopify ${res.status}`);
    const body = await res.json();
    const products: Array<{ id: number; variants?: Array<{ sku?: string; inventory_item_id?: number }> }> =
      body?.products ?? [];
    if (products.length === 0) break;

    for (const p of products) {
      for (const v of p.variants ?? []) {
        if (v.sku && v.inventory_item_id) skuByInventoryItem.set(String(v.inventory_item_id), normSku(v.sku));
      }
      sinceId = Math.max(sinceId, p.id);
    }
    if (products.length < 250) break;
  }

  const out = new Map<string, number>();
  const ids = [...skuByInventoryItem.keys()];
  // شوبيفاي تقبل حتى ١٠٠ معرّف في النداء الواحد
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const res = await api(`inventory_items.json?ids=${batch.join(",")}`);
    if (!res.ok) throw new Error(`Shopify inventory ${res.status}`);
    const body = await res.json();
    for (const item of (body?.inventory_items ?? []) as Array<{ id: number; cost?: string | null }>) {
      const sku = skuByInventoryItem.get(String(item.id));
      if (sku) out.set(sku, Number(item.cost ?? 0));
    }
  }
  return out;
}
