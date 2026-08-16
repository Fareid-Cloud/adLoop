// lib/ecommerce/productSync.ts
//
// **سحب المنتجات والأسعار والمخزون من متجر التاجر.**
//
// الفجوة التي سدّها هذا الملفّ: كان المنتج يُضاف **يدوياً** فقط. فمن يربط
// متجره ثمّ يفتح «المنتجات» يجد صفحةً فارغة ومتجراً فيه مئة صنف - ويُقال
// له «أضف منتجاً» كأنّ الربط لم يحدث. وكلّ ما بُني فوق المنتج (الربحية،
// المخزون، الأسعار، المنتج الخاسر) كان ينتظر إدخالاً يدوياً لن يقع.
//
// **الاتّجاه هنا سحبٌ لا استماع**، بعكس الطلبات:
//   الطلب حدثٌ يقع مرّة، فالويب هوك يناسبه.
//   المنتج حالةٌ تتغيّر بلا حدثٍ يُرسَل (السعر يُعدَّل في لوحة المتجر،
//   والمخزون ينقص مع كلّ بيع)، ولا تُرسل المنصّات ويب هوك لكلّ تغيّر.
//   فالسحب الدوريّ هو ما يُبقي الرقم صادقاً.
//
// **ما لا يُلمَس عند التحديث:** كلّ ما أدخله التاجر عندنا ولا تعرفه
// المنصّة - تكلفة البضاعة، الشحن، رسوم الدفع، هامشه المستهدف. السحب
// يحمل ما تملكه المنصّة وحده: الاسم والسعر والمخزون والمعرّفات. ولولا
// ذلك لمحا كلُّ سحبٍ عملَ التاجر في صفحة التسعير.
//
// ── ثقة كلّ منصّة، مصرَّحاً بها ─────────────────────────────────────
//   شوبيفاي   **مؤكَّد** - GraphQL Admin `products(first, after)` مع
//              `pageInfo.hasNextPage`، والمتغيّر يحمل السعر والـSKU
//              والكمّية. مقروءٌ من توثيق شوبيفاي الرسميّ ٢٠٢٦-٠١.
//   ووكومرس   **مؤكَّد** - `GET /wp-json/wc/v3/products?page&per_page`
//              بحقول `sku`/`regular_price`/`manage_stock`/`stock_quantity`.
//              مقروءٌ من توثيق ووكومرس الرسميّ.
//   سلّة      **ثقة متوسّطة** - المسار `/admin/v2/products` مؤكَّدٌ من
//              نقطة تعديل السعر المستعملة في `priceSync`، وشكل الصفحات
//              (`pagination.totalPages`) هو المتّبع في واجهتها ولم نقرأه
//              من مخطّطها مباشرةً.
//   زد        **ثقة متوسّطة** - `/v1/products` مبنيٌّ على نقطة التعديل
//              نفسها المستعملة في `priceSync`، وأسماء الحقول تُقرأ بمرونة.
//   إيزي أوردرز **ثقة متوسّطة** - المسار من `priceSync` نفسه.
//
// والمتوسّطة تُعامَل معاملتها: القارئ يقرأ الحقول بأسماءٍ بديلة، وأيّ
// حقلٍ لم يُفهَم يُترك فارغاً بدل أن يُخترَع له رقم.

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import type { EcommercePlatform } from "./types";

/** منتجٌ كما وصل من المنصّة، بعد توحيد شكله */
export interface PulledProduct {
  externalProductId: string;
  /** شوبيفاي تحفظ السعر على المتغيّر لا المنتج */
  externalVariantId?: string | null;
  sku: string | null;
  name: string;
  price: number;
  /** `null` = المتجر لا يتتبّع مخزون هذا الصنف - وهي حالةٌ غير الصفر */
  stockQuantity: number | null;
}

export interface ProductSyncResult {
  ok: boolean;
  platform?: EcommercePlatform;
  storeName?: string | null;
  created: number;
  updated: number;
  /** وصل بلا معرّفٍ أو بلا اسم فتُعذَّر حفظه - يُعَدّ ولا يُخترَع له بديل */
  skipped: number;
  reasonKey?: string;
  reasonVars?: Record<string, string | number>;
}

const EMPTY = { created: 0, updated: 0, skipped: 0 };

/** سقفٌ يمنع دورةً لا تنتهي لو أخطأت المنصّة في إشارة «صفحة تالية» */
const MAX_PAGES = 25;
const PAGE_SIZE = 100;

// ══════════════════════════════════════════════════════════════════
//  المدخل: متجرٌ واحد، أو كلّ متاجر المساحة
// ══════════════════════════════════════════════════════════════════

export async function syncProductsForWorkspace(
  workspaceId: string
): Promise<ProductSyncResult[]> {
  // 🔴 **كلّ متجرٍ على حدة لا «أوّل متجر».** الفخّ نفسه الذي أوقع ويب هوك
  // الطلبات: `findFirst` يعمل ما دام المتجر واحداً، وحين يصيران اثنين
  // يبقى الثاني بلا منتجات إلى الأبد بلا رسالة خطأ واحدة.
  const connections = await prisma.ecommerceConnection.findMany({
    where: { workspaceId, active: true },
    select: { id: true },
  });
  const out: ProductSyncResult[] = [];
  for (const c of connections) out.push(await syncProductsFromStore(c.id));
  return out;
}

export async function syncProductsFromStore(connectionId: string): Promise<ProductSyncResult> {
  const connection = await prisma.ecommerceConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return { ok: false, ...EMPTY, reasonKey: "psNoStore" };

  const platform = connection.platform as EcommercePlatform;
  const base = { platform, storeName: connection.storeName };

  if (!connection.apiToken) {
    return { ok: false, ...EMPTY, ...base, reasonKey: "psNoToken" };
  }

  const token = decryptToken(connection.apiToken);

  let pulled: PulledProduct[];
  try {
    switch (platform) {
      case "SALLA":       pulled = await pullSalla(token); break;
      case "SHOPIFY":     pulled = await pullShopify(token, connection.storeIdentifier); break;
      case "ZID":         pulled = await pullZid(token, connection.storeIdentifier); break;
      case "WOOCOMMERCE": pulled = await pullWoo(token, connection); break;
      case "EASY_ORDERS": pulled = await pullEasyOrders(token); break;
      default:
        return { ok: false, ...EMPTY, ...base, reasonKey: "psPlatformUnsupported" };
    }
  } catch (err) {
    return {
      ok: false, ...EMPTY, ...base,
      // رمز الحالة أو رسالة المنصّة - بيانات تُنقَل لا عبارةٌ نؤلّفها
      reasonKey: err instanceof Error ? "psPullFailedWithReason" : "psPullFailed",
      reasonVars: err instanceof Error ? { reason: err.message.slice(0, 160) } : undefined,
    };
  }

  return await writeProducts(connection.workspaceId, connectionId, platform, pulled, base);
}

// ══════════════════════════════════════════════════════════════════
//  الكتابة - وما لا يُلمَس منها
// ══════════════════════════════════════════════════════════════════

async function writeProducts(
  workspaceId: string,
  connectionId: string,
  platform: EcommercePlatform,
  pulled: PulledProduct[],
  base: { platform: EcommercePlatform; storeName: string | null }
): Promise<ProductSyncResult> {
  const existing = await prisma.product.findMany({
    where: { workspaceId },
    select: { id: true, sku: true, externalProductId: true, connectionId: true },
  });

  // مفتاحان للمطابقة: المعرّف لدى المنصّة أوّلاً، ثمّ الـSKU. والثاني
  // يلتقط ما أدخله التاجر يدوياً قبل الربط، فلا يُنشأ له نظيرٌ مكرّر
  // ويظهر المنتج نفسه مرّتين في صفحته.
  const byExternal = new Map(
    existing.filter((p) => p.externalProductId).map((p) => [`${p.connectionId ?? ""}:${p.externalProductId}`, p])
  );
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku as string, p]));

  const now = new Date();
  let created = 0, updated = 0, skipped = 0;

  for (const item of pulled) {
    if (!item.externalProductId || !item.name.trim()) { skipped++; continue; }

    const match =
      byExternal.get(`${connectionId}:${item.externalProductId}`) ??
      (item.sku ? bySku.get(item.sku) : undefined);

    // ما تملكه المنصّة وحده. تكلفة البضاعة والشحن والرسوم والهامش
    // المستهدف يدخلها التاجر عندنا ولا تعرفها المنصّة، فلا تُمَسّ.
    const fromStore = {
      name: item.name.trim().slice(0, 200),
      currentPrice: item.price,
      sku: item.sku,
      externalProductId: item.externalProductId,
      externalVariantId: item.externalVariantId ?? null,
      connectionId,
      stockQuantity: item.stockQuantity,
      stockUpdatedAt: item.stockQuantity === null ? null : now,
      stockSource: item.stockQuantity === null ? null : platform,
    };

    if (match) {
      await prisma.product.update({ where: { id: match.id }, data: fromStore });
      updated++;
    } else {
      await prisma.product.create({ data: { workspaceId, ...fromStore } });
      created++;
    }
  }

  return { ok: true, ...base, created, updated, skipped };
}

// ══════════════════════════════════════════════════════════════════
//  سلّة
// ══════════════════════════════════════════════════════════════════

async function pullSalla(token: string): Promise<PulledProduct[]> {
  const out: PulledProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.salla.dev/admin/v2/products?per_page=${PAGE_SIZE}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    const rows: any[] = body?.data ?? [];
    for (const r of rows) {
      out.push({
        externalProductId: String(r?.id ?? ""),
        sku: r?.sku ?? null,
        name: String(r?.name ?? ""),
        price: num(r?.price?.amount ?? r?.price ?? r?.sale_price?.amount),
        // سلّة تفرّق بين «غير محدود» و«كمّية» - وغير المحدود ليس صفراً
        stockQuantity: r?.quantity === null || r?.quantity === undefined ? null : Number(r.quantity),
      });
    }
    const totalPages = Number(body?.pagination?.totalPages ?? body?.pagination?.total_pages ?? 1);
    if (rows.length === 0 || page >= totalPages) break;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  شوبيفاي - GraphQL، والسعر على المتغيّر
// ══════════════════════════════════════════════════════════════════

const SHOPIFY_QUERY = `
  query($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          variants(first: 1) {
            edges { node { id sku price inventoryQuantity } }
          }
        }
      }
    }
  }`;

async function pullShopify(token: string, storeDomain: string | null): Promise<PulledProduct[]> {
  if (!storeDomain) throw new Error("no-domain");
  const out: PulledProduct[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res: Response = await fetch(`https://${storeDomain}/admin/api/2026-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ query: SHOPIFY_QUERY, variables: { cursor } }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    // GraphQL تُعيد ٢٠٠ مع أخطاء في الجسم - النجاح ليس رمز الحالة وحده
    if (body?.errors?.length) throw new Error(String(body.errors[0]?.message ?? "graphql"));

    const conn = body?.data?.products;
    for (const edge of conn?.edges ?? []) {
      const node = edge?.node;
      const variant = node?.variants?.edges?.[0]?.node;
      out.push({
        externalProductId: gid(node?.id),
        externalVariantId: gid(variant?.id),
        sku: variant?.sku || null,
        name: String(node?.title ?? ""),
        price: num(variant?.price),
        stockQuantity:
          variant?.inventoryQuantity === null || variant?.inventoryQuantity === undefined
            ? null
            : Number(variant.inventoryQuantity),
      });
    }
    if (!conn?.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return out;
}

/** شوبيفاي تُعيد `gid://shopify/Product/123` - والمخزَّن هو الرقم وحده،
 *  لأنّ نقطة تعديل السعر في `priceSync` تنتظره رقماً. */
function gid(v: unknown): string {
  const s = String(v ?? "");
  const last = s.split("/").pop();
  return last ?? s;
}

// ══════════════════════════════════════════════════════════════════
//  زد
// ══════════════════════════════════════════════════════════════════

async function pullZid(token: string, storeId: string | null): Promise<PulledProduct[]> {
  const out: PulledProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`https://api.zid.sa/v1/products?page=${page}&page_size=${PAGE_SIZE}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(storeId ? { "Store-Id": storeId } : {}),
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    // الاسم المستعمل للمصفوفة يختلف بين نسخ توثيقها، فتُقرأ بمرونة بدل
    // أن يفشل السحب كلّه على اسمِ حقل.
    const rows: any[] = body?.results ?? body?.data ?? body?.products ?? [];
    for (const r of rows) {
      out.push({
        externalProductId: String(r?.id ?? ""),
        sku: r?.sku ?? null,
        name: String(r?.name?.ar ?? r?.name?.en ?? r?.name ?? ""),
        price: num(r?.price ?? r?.sale_price),
        stockQuantity: r?.quantity === null || r?.quantity === undefined ? null : Number(r.quantity),
      });
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  ووكومرس
// ══════════════════════════════════════════════════════════════════

async function pullWoo(key: string, connection: any): Promise<PulledProduct[]> {
  if (!connection.storeUrl || !connection.apiSecret) throw new Error("no-credentials");
  const secret = decryptToken(connection.apiSecret);
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const base = String(connection.storeUrl).replace(/\/+$/, "");

  const out: PulledProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${base}/wp-json/wc/v3/products?per_page=${PAGE_SIZE}&page=${page}&status=publish`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const rows: any[] = await res.json();
    for (const r of rows) {
      out.push({
        externalProductId: String(r?.id ?? ""),
        sku: r?.sku || null,
        name: String(r?.name ?? ""),
        price: num(r?.regular_price || r?.price),
        // `manage_stock: false` تعني «لا يُتتبَّع» صراحةً - وهي غير الصفر
        stockQuantity: r?.manage_stock && r?.stock_quantity !== null
          ? Number(r.stock_quantity)
          : null,
      });
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  إيزي أوردرز
// ══════════════════════════════════════════════════════════════════

async function pullEasyOrders(token: string): Promise<PulledProduct[]> {
  const out: PulledProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.easy-orders.net/api/v1/external-apps/products?page=${page}&limit=${PAGE_SIZE}`,
      { headers: { "Api-Key": token } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const body: any = await res.json();
    const rows: any[] = Array.isArray(body) ? body : (body?.data ?? body?.items ?? []);
    for (const r of rows) {
      out.push({
        externalProductId: String(r?.id ?? ""),
        sku: r?.sku ?? null,
        name: String(r?.name ?? ""),
        price: num(r?.price ?? r?.sale_price),
        stockQuantity: r?.quantity === null || r?.quantity === undefined ? null : Number(r.quantity),
      });
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** رقمٌ من نصٍّ أو رقم - وما لا يُقرأ رقماً يصير صفراً لا NaN، فالـNaN
 *  يعبر إلى قاعدة البيانات ويُفسد كلّ حسابٍ بعده بلا رسالة خطأ. */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
