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
    customer: {
      externalId: pick(order, "customer.id") ? String(pick(order, "customer.id")) : null,
      email: pick(order, "customer.email") ?? null,
      phone: pick(order, "customer.mobile", "customer.phone") ?? null,
      firstName: pick(order, "customer.first_name", "customer.name") ?? null,
      city: pick(order, "shipping.address.city", "customer.city") ?? null,
      country: pick(order, "shipping.address.country", "customer.country") ?? null,
    },
    paymentMethod: pick(order, "payment.method", "payment_method") ?? null,
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
    customer: {
      externalId: body.customer?.id ? String(body.customer.id) : null,
      email: pick(body, "customer.email", "email") ?? null,
      phone: pick(body, "customer.phone", "phone", "shipping_address.phone") ?? null,
      firstName: pick(body, "customer.first_name", "shipping_address.first_name") ?? null,
      city: pick(body, "shipping_address.city") ?? null,
      country: pick(body, "shipping_address.country") ?? null,
    },
    // شوبيفاي ترسل مصفوفة أسماء بوابات الدفع
    paymentMethod: Array.isArray(body.payment_gateway_names)
      ? body.payment_gateway_names.join(", ")
      : (body.gateway ?? null),
    fulfilledAt: body.closed_at ? new Date(body.closed_at) : null,
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
    customer: {
      externalId: body.customer_id ? String(body.customer_id) : null,
      email: pick(body, "billing.email") ?? null,
      phone: pick(body, "billing.phone") ?? null,
      firstName: pick(body, "billing.first_name") ?? null,
      city: pick(body, "shipping.city", "billing.city") ?? null,
      country: pick(body, "shipping.country", "billing.country") ?? null,
    },
    paymentMethod: pick(body, "payment_method_title", "payment_method") ?? null,
    fulfilledAt: body.date_completed ? new Date(body.date_completed) : null,
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
    customer: {
      externalId: pick(order, "customer.id") ? String(pick(order, "customer.id")) : null,
      email: pick(order, "customer.email", "email") ?? null,
      phone: pick(order, "customer.phone", "phone") ?? null,
      firstName: pick(order, "customer.full_name", "full_name", "name") ?? null,
      city: pick(order, "government", "city") ?? null,
      country: pick(order, "country") ?? null,
    },
    // إيزي أوردرز سوق مصري في الأساس، والدفع عند الاستلام هو الغالب فيه
    paymentMethod: pick(order, "payment_method", "payment.method") ?? null,
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
    customer: {
      externalId: pick(order, "customer.id") ? String(pick(order, "customer.id")) : null,
      email: pick(order, "customer.email", "email") ?? null,
      phone: pick(order, "customer.mobile", "customer.phone") ?? null,
      firstName: pick(order, "customer.name", "customer.first_name") ?? null,
      city: pick(order, "shipping.address.city", "customer.city") ?? null,
      country: pick(order, "shipping.address.country", "customer.country") ?? null,
    },
    paymentMethod: pick(order, "payment_method", "payment.method") ?? null,
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
  secret: string | undefined,
  /** زد وحدها تحتاجه: مصادقةٌ أساسية لا توقيع، فلها حقلان لا حقل */
  username?: string | null
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
      // 🔴 لسلّة **استراتيجيتان** لا واحدة، وترويسة
      // `X-Salla-Security-Strategy` تقول أيّهما. وكان الكود يفترض التوقيع
      // دائماً، فتاجرٌ تطبيقُه على «التوكن» يُرفض كلّ ويب هوك له بـ`401`
      // ولا يصله طلبٌ واحد - وهو نصف الاحتمالات لا حالةٌ نادرة.
      // (docs.salla.dev/doc-421119)
      const strategy = (headers.get("x-salla-security-strategy") ?? "").trim().toLowerCase();
      if (strategy === "token") {
        // التوكن يصل في `Authorization` كما هو، وقد تسبقه `Bearer`.
        const sent = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        return safeEqual(sent, secret);
      }
      // الافتراضيّ توقيعاً: هو ما تُسنده سلّة لكلّ تطبيقٍ جديد.
      const sent = headers.get("x-salla-signature") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      return safeEqual(sent, expected);
    }
    case "ZID": {
      // 🔴 **زد لا توقّع الويب هوك إطلاقاً.** كان هنا فحصُ HMAC على ترويسة
      // `x-zid-signature` - ترويسةٍ لا وجود لها في توثيق زد، فكان كلّ ويب
      // هوك من زد يُرفض `401` بلا استثناء: تكاملٌ يبدو مبنيّاً وهو معطّل
      // بالكامل. الموجود عندها مصادقةٌ أساسية بـ`username`/`password`
      // يضعهما المطوّر عند إنشاء الويب هوك. (docs.zid.sa/create-a-webhook)
      //
      // وهي **اختياريةٌ عندهم وإجباريةٌ عندنا**: ويب هوكٌ بلا مصادقة يعني
      // أنّ كلّ من عرف الرابط يحقن مبيعاتٍ وهمية في حساب تاجر.
      if (!username) return false;
      const sent = headers.get("authorization") ?? "";
      const expected =
        "Basic " + Buffer.from(`${username}:${secret}`, "utf8").toString("base64");
      return safeEqual(sent.trim(), expected);
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

// ==================== هويّة المتجر المُرسِل ====================
//
// 🔴 **السؤال الذي لم يكن أحدٌ يسأله: مِن أيّ متجرٍ جاء هذا الويب هوك؟**
//
// كان الجواب `findFirst({ platform })` - أي «أوّل متجرٍ على هذه المنصّة في
// قاعدة البيانات كلّها». فأوّل مشترك على شوبيفاي يبتلع ويب هوكات كلّ
// مشتركي شوبيفاي، والثاني يُفحص توقيعه بمفتاح الأوّل فيُرفض ٤٠١ ولا يصله
// طلبٌ واحد. عيبٌ لا يظهر أبداً بمشترك واحد، ويظهر يوم يأتي الثاني.
//
// وهذه الدالة تستخرج هويّة المتجر من الويب هوك نفسه. **والهويّة هنا
// مفتاح بحثٍ لا إثبات:** أيّ أحدٍ يستطيع ادّعاءها في ترويسة، ولا يستطيع
// أحدٌ تزوير التوقيع بدون سرّ ذلك المتجر - فالبحث بها، والإثبات بالتوقيع.
//
// درجات التأكّد صريحة، لأنّ الحقل الخطأ يعني عودةً صامتة إلى المسح:
//   شوبيفاي  - **مؤكّد رسمياً**: `X-Shopify-Shop-Domain`، وهو نطاق
//              `myshopify.com` غير القابل للتغيير لا واجهة المتجر.
//   ووكومرس  - **مؤكّد رسمياً**: `X-WC-Webhook-Source` = `home_url('/')`،
//              موجود منذ WooCommerce 2.6.
//   سلّة     - ثقة متوسطة: `merchant` في جسم الطلب.
//   زد       - ثقة منخفضة (مخطّطهم لم نستطع قراءته - راجع أعلى الملفّ).
//   إيزي أوردرز - لا معرّف معروف، فيرجع `null` عمداً.
//
// و`null` ليس فشلاً: المسار البديل في `resolveConnection` يحسم المتجر
// بالسرّ نفسه، فتعمل المنصّات الخمس كلّها ولو جهلنا معرّف بعضها.
export function extractStoreIdentifier(
  platform: EcommercePlatform,
  headers: Headers,
  body: any
): string | null {
  const clean = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    // التطبيع يمنع فشلاً صامتاً: `Store.myshopify.com` و`https://x.com/`
    // و`https://x.com` كلّها المتجر نفسه، واختلاف حرفٍ يجعلها متاجر ثلاثة.
    const s = String(v).trim().toLowerCase().replace(/\/+$/, "");
    return s.length > 0 ? s : null;
  };

  switch (platform) {
    case "SHOPIFY":
      return clean(headers.get("x-shopify-shop-domain"));
    case "WOOCOMMERCE":
      return clean(headers.get("x-wc-webhook-source"));
    case "SALLA":
      return clean(pick(body, "merchant", "data.merchant", "merchant.id", "data.store.id"));
    case "ZID":
      return clean(pick(body, "store_id", "store.id", "data.store_id", "data.store.id"));
    case "EASY_ORDERS":
      return null;
  }
}
