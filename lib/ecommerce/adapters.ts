// lib/ecommerce/adapters.ts
//
// محوّلات الصيغ: من صيغة كل منصة إلى الشكل الموحّد. **هذا هو الملف الوحيد
// الذي يعرف تفاصيل كل منصة** - أي منصة جديدة تُضاف هنا فقط.
//
// درجة التأكد من الحقول (صراحةً، لا ادّعاء):
// - سلة: مؤكدة (مستخدمة فعلياً منذ فترة في المنتج)
// - إيزي أوردرز: مؤكدة من توثيقهم الرسمي (cart_items / total_cost / shipping_cost)
// - شوبيفاي وووكومرس: صيغ مستقرة وموثّقة منذ سنوات
// - زد: **ثقة متوسطة** - صفحة المخطط لديهم تُحمّل بجافاسكريبت ولم نتمكن من
//   قراءة أسماء الحقول الرسمية. المحوّل يقبل عدة تسميات شائعة، ويجب
//   التأكد منه عند أول ربط حقيقي بمتجر زد.

import crypto from "crypto";
import {
  type NormalizedOrder, type NormalizedOrderItem, type EcommercePlatform,
  isReturnedStatus, toNumber,
} from "./types";

/** يقرأ أول قيمة موجودة من عدة أسماء محتملة للحقل. */
function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    const parts = k.split(".");
    let cur = obj;
    for (const p of parts) cur = cur?.[p];
    if (cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

// ==================== سلة ====================
function parseSalla(body: any): NormalizedOrder | null {
  const order = body?.data;
  if (!order) return null;
  const id = String(pick(order, "id", "reference_id") ?? "");
  if (!id) return null;

  const items: NormalizedOrderItem[] = Array.isArray(order.items)
    ? order.items.map((it: any) => ({
        sku: it.sku ? String(it.sku) : null,
        name: it.name ?? null,
        quantity: toNumber(it.quantity) || 1,
        lineTotal: toNumber(pick(it, "amounts.total.amount", "amounts.total", "total.amount", "price.amount")),
      }))
    : [];

  return {
    platform: "SALLA",
    externalOrderId: id,
    createdAt: new Date(order.created_at ?? Date.now()),
    total: toNumber(pick(order, "total.amount", "amounts.total.amount", "total")),
    currency: pick(order, "total.currency", "currency") ?? null,
    shippingCost: toNumber(pick(order, "amounts.shipping_cost.amount", "shipping_cost.amount")) || null,
    status: pick(order, "status.name", "status") ?? null,
    isReturned: isReturnedStatus(pick(order, "status.name", "status")),
    items,
  };
}

// ==================== شوبيفاي ====================
function parseShopify(body: any): NormalizedOrder | null {
  const id = String(body?.id ?? "");
  if (!id) return null;

  const items: NormalizedOrderItem[] = Array.isArray(body.line_items)
    ? body.line_items.map((it: any) => ({
        sku: it.sku ? String(it.sku) : null,
        name: it.title ?? it.name ?? null,
        quantity: toNumber(it.quantity) || 1,
        // شوبيفاي ترسل سعر الوحدة، لا إجمالي السطر
        lineTotal: toNumber(it.price) * (toNumber(it.quantity) || 1),
      }))
    : [];

  const shipping = Array.isArray(body.shipping_lines)
    ? body.shipping_lines.reduce((s: number, l: any) => s + toNumber(l.price), 0)
    : 0;

  const cancelled = !!body.cancelled_at;
  const refunded = String(body.financial_status ?? "").includes("refund");

  return {
    platform: "SHOPIFY",
    externalOrderId: id,
    createdAt: new Date(body.created_at ?? Date.now()),
    total: toNumber(pick(body, "total_price", "current_total_price")),
    currency: body.currency ?? null,
    shippingCost: shipping || null,
    status: body.financial_status ?? null,
    isReturned: cancelled || refunded,
    items,
  };
}

// ==================== ووكومرس ====================
function parseWooCommerce(body: any): NormalizedOrder | null {
  const id = String(body?.id ?? "");
  if (!id) return null;

  const items: NormalizedOrderItem[] = Array.isArray(body.line_items)
    ? body.line_items.map((it: any) => ({
        sku: it.sku ? String(it.sku) : null,
        name: it.name ?? null,
        quantity: toNumber(it.quantity) || 1,
        // ووكومرس ترسل إجمالي السطر مباشرة في total
        lineTotal: toNumber(it.total) || toNumber(it.subtotal),
      }))
    : [];

  return {
    platform: "WOOCOMMERCE",
    externalOrderId: id,
    createdAt: new Date(body.date_created_gmt ?? body.date_created ?? Date.now()),
    total: toNumber(body.total),
    currency: body.currency ?? null,
    shippingCost: toNumber(body.shipping_total) || null,
    status: body.status ?? null,
    isReturned: isReturnedStatus(body.status),
    items,
  };
}

// ==================== إيزي أوردرز ====================
// مؤكد من التوثيق الرسمي: cart_items[].product.sku، total_cost، shipping_cost
function parseEasyOrders(body: any): NormalizedOrder | null {
  const order = body?.data ?? body;
  const id = String(order?.id ?? "");
  if (!id) return null;

  const items: NormalizedOrderItem[] = Array.isArray(order.cart_items)
    ? order.cart_items.map((it: any) => ({
        sku: pick(it, "product.sku", "sku") ? String(pick(it, "product.sku", "sku")) : null,
        name: pick(it, "product.name", "name") ?? null,
        quantity: toNumber(it.quantity) || 1,
        lineTotal: toNumber(it.price) * (toNumber(it.quantity) || 1),
      }))
    : [];

  return {
    platform: "EASY_ORDERS",
    externalOrderId: id,
    createdAt: new Date(order.created_at ?? Date.now()),
    total: toNumber(pick(order, "total_cost", "total")),
    currency: order.currency ?? null,
    shippingCost: toNumber(order.shipping_cost) || null,
    status: order.status ?? null,
    isReturned: isReturnedStatus(order.status),
    items,
  };
}

// ==================== زد ====================
// ⚠️ ثقة متوسطة - أسماء الحقول لم تُؤكَّد من مخطط زد الرسمي (يُحمَّل
// بجافاسكريبت). نقبل عدة تسميات شائعة حتى يُتحقّق منها بأول ربط حقيقي.
function parseZid(body: any): NormalizedOrder | null {
  const order = body?.data ?? body;
  const id = String(pick(order, "id", "order_id", "code") ?? "");
  if (!id) return null;

  const rawItems = pick(order, "products", "items", "order_products") ?? [];
  const items: NormalizedOrderItem[] = Array.isArray(rawItems)
    ? rawItems.map((it: any) => ({
        sku: pick(it, "sku", "product.sku") ? String(pick(it, "sku", "product.sku")) : null,
        name: pick(it, "name", "product.name") ?? null,
        quantity: toNumber(it.quantity) || 1,
        lineTotal: toNumber(pick(it, "total.value", "total", "price.value", "price")) *
          (pick(it, "total.value", "total") ? 1 : toNumber(it.quantity) || 1),
      }))
    : [];

  return {
    platform: "ZID",
    externalOrderId: id,
    createdAt: new Date(pick(order, "created_at", "order_date") ?? Date.now()),
    total: toNumber(pick(order, "order_total.value", "order_total", "total.value", "total")),
    currency: pick(order, "currency_code", "currency") ?? null,
    shippingCost: toNumber(pick(order, "shipping_cost.value", "shipping_cost", "delivery_cost")) || null,
    status: pick(order, "order_status.name", "status.name", "status") ?? null,
    isReturned: isReturnedStatus(pick(order, "order_status.name", "status.name", "status")),
    items,
  };
}

const PARSERS: Record<EcommercePlatform, (body: any) => NormalizedOrder | null> = {
  SALLA: parseSalla,
  SHOPIFY: parseShopify,
  ZID: parseZid,
  WOOCOMMERCE: parseWooCommerce,
  EASY_ORDERS: parseEasyOrders,
};

export function parseOrder(platform: EcommercePlatform, body: any): NormalizedOrder | null {
  return PARSERS[platform](body);
}

// ==================== التحقق من التوقيع ====================
//
// لكل منصة آلية مختلفة. الفشل الافتراضي هو الرفض: مفتاح غير مضبوط يعني
// أننا لا نستطيع التحقق، فلا نقبل بيانات مالية بلا تحقق.

export function verifySignature(
  platform: EcommercePlatform,
  rawBody: string,
  headers: Headers,
  secret: string | undefined
): boolean {
  if (!secret) return false;

  switch (platform) {
    case "SHOPIFY": {
      // شوبيفاي: HMAC-SHA256 بترميز base64 في X-Shopify-Hmac-Sha256
      const sent = headers.get("x-shopify-hmac-sha256") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
      return safeEqual(sent, expected);
    }
    case "WOOCOMMERCE": {
      // ووكومرس: HMAC-SHA256 بترميز base64 في X-WC-Webhook-Signature
      const sent = headers.get("x-wc-webhook-signature") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
      return safeEqual(sent, expected);
    }
    case "SALLA": {
      const sent = headers.get("x-salla-signature") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      return safeEqual(sent, expected);
    }
    case "ZID": {
      const sent = headers.get("x-zid-signature") ?? headers.get("signature") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      return safeEqual(sent, expected);
    }
    case "EASY_ORDERS": {
      // مؤكد من التوثيق: مفتاح مشترك بسيط في ترويسة باسم secret
      const sent = headers.get("secret") ?? "";
      return safeEqual(sent, secret);
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
