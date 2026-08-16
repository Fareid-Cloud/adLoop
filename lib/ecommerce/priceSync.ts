// lib/ecommerce/priceSync.ts
//
// تحديث سعر المنتج **فعلياً على منصة الإيكومرس** لا في قاعدتنا فقط.
//
// كان اعتماد السعر المقترح يكتب الرقم عندنا وحدنا، فيظل المتجر يبيع
// بالسعر الخاسر - أي أن القرار لا يُنفَّذ حيث يهم. هذه عملية **كتابة**
// على متجر حقيقي، لذلك:
//   • لا تُنفَّذ إلا بتوكن كتابة صريح خزّنه المستخدم بنفسه
//   • عند غياب التوكن أو المعرّف نُرجع سبباً واضحاً بدل الفشل الصامت
//   • لا نخمّن معرّف المنتج: SKU أو معرّف المنصة، وإلا نتوقف

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { PLATFORM_LABEL, type EcommercePlatform } from "./types";
import { assertNotDemo } from "@/lib/demo";

export interface PriceSyncResult {
  ok: boolean;
  platform?: EcommercePlatform;
  /** اسم المنصّة بلغة القارئ - يُحسَب عند العرض لا هنا */
  platformKey?: EcommercePlatform;
  /** 🔴 **سبب عدم التنفيذ مفتاحٌ لا جملة.**
   *
   *  كانت سبع جملٍ عربية تُعاد من هنا وتُعرَض للمستخدم كما هي
   *  (`storeNotice` في صفحة التسعير)، فيقرؤها الإنجليزيّ بالعربية.
   *  والقاعدة في هذا المنتج أنّ كلّ نصٍّ يمرّ بطبقةٍ غير الواجهة
   *  يُحمَل مفتاحاً ومتغيّراته، ويُترجَم عند العرض. */
  reasonKey?: string;
  reasonVars?: Record<string, string | number>;
  needsSetup?: boolean;
}

export async function syncPriceToStore(
  workspaceId: string,
  productId: string,
  newPrice: number
): Promise<PriceSyncResult> {
  // مساحة تجريبية لا تلمس متجراً حقيقياً: ما بعد هذا السطر يكتب سعراً
  // فعلياً في سلة أو شوبيفاي أو زد - أثره على متجر العميل ومبيعاته.
  await assertNotDemo(workspaceId);

  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId } });
  if (!product) return { ok: false, reasonKey: "noProduct" };

  // 🔴 **إلى أيّ متجرٍ يُكتب هذا السعر؟** كان الجواب «أوّل متجرٍ له صلاحية
  // كتابة في المساحة»، وهو صحيحٌ ما دام المتجر واحداً. فإذا صارا اثنين،
  // صار تعديلُ سعر منتجٍ من متجر «أ» **يكتبه في متجر «ب»** - مالٌ حقيقيّ
  // في المكان الخطأ، لا يظهر إلّا حين يسأل التاجر عن سعرٍ تغيّر بلا سبب.
  //
  // فالمنتج يقول متجره. وإن لم يكن له متجر (أُضيف يدوياً) ولدى المساحة
  // أكثر من متجرٍ قابلٍ للكتابة، **لا نخمّن**: الكتابة الخاطئة أسوأ من
  // الامتناع، والامتناع هنا يحمل معه ما يلزم لحلّه.
  const writable = await prisma.ecommerceConnection.findMany({
    where: { workspaceId, active: true, canWritePrices: true },
  });
  const connection = product.connectionId
    ? writable.find((c) => c.id === product.connectionId) ?? null
    : writable.length === 1
      ? writable[0]
      : null;

  if (!connection && product.connectionId && writable.length > 0) {
    return {
      ok: false,
      needsSetup: true,
      reasonKey: "storeNotWritable",
    };
  }
  if (!connection && writable.length > 1) {
    return {
      ok: false,
      needsSetup: true,
      reasonKey: "productHasNoStore",
    };
  }

  if (!connection) {
    return {
      ok: false,
      needsSetup: true,
      reasonKey: "noWritableStore",
    };
  }

  const platform = connection.platform as EcommercePlatform;

  if (!connection.apiToken) {
    return { ok: false, needsSetup: true, platform, platformKey: platform,
      reasonKey: "noWriteToken" };
  }

  const token = decryptToken(connection.apiToken);

  try {
    switch (platform) {
      case "SALLA": return await updateSalla(product, newPrice, token);
      case "SHOPIFY": return await updateShopify(product, newPrice, token, connection.storeIdentifier);
      case "ZID": return await updateZid(product, newPrice, token, connection.storeIdentifier);
      case "WOOCOMMERCE": return await updateWoo(product, newPrice, token, connection);
      case "EASY_ORDERS": return await updateEasyOrders(product, newPrice, token);
      default:
        return { ok: false, platform, platformKey: platform, reasonKey: "platformUnsupported" };
    }
  } catch (err) {
    console.error(`فشل تحديث السعر على ${platform}:`, err);
    return {
      ok: false, platform, platformKey: platform,
      // رسالة المنصّة تُنقَل كما جاءت - نصٌّ أجنبيّ ننقله لا نؤلّفه.
      reasonKey: err instanceof Error ? "writeFailedWithReason" : "writeFailed",
      reasonVars: err instanceof Error ? { reason: err.message } : undefined,
    };
  }
}

// ==================== سلة ====================
// مؤكد من التوثيق الرسمي: POST /products/sku/{sku}/price بصلاحية products.read_write
async function updateSalla(product: any, price: number, token: string): Promise<PriceSyncResult> {
  if (!product.sku) {
    return { ok: false, platform: "SALLA", platformKey: "SALLA",
      reasonKey: "sallaNeedsSku" };
  }

  const res = await fetch(
    `https://api.salla.dev/admin/v2/products/sku/${encodeURIComponent(product.sku)}/price`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`سلة أعادت ${res.status} ${body.slice(0, 160)}`);
  }
  return { ok: true, platform: "SALLA", platformKey: "SALLA" };
}

// ==================== شوبيفاي ====================
// السعر يُحفظ على المتغيّر (variant) لا المنتج نفسه
async function updateShopify(
  product: any, price: number, token: string, storeDomain: string | null
): Promise<PriceSyncResult> {
  if (!storeDomain) {
    return { ok: false, platform: "SHOPIFY", platformKey: "SHOPIFY", needsSetup: true,
      reasonKey: "shopifyNeedsDomain" };
  }
  if (!product.externalVariantId) {
    return { ok: false, platform: "SHOPIFY", platformKey: "SHOPIFY",
      reasonKey: "shopifyNeedsVariant" };
  }

  const res = await fetch(
    `https://${storeDomain}/admin/api/2025-07/variants/${product.externalVariantId}.json`,
    {
      method: "PUT",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ variant: { id: product.externalVariantId, price: price.toFixed(2) } }),
    }
  );

  if (!res.ok) throw new Error(`شوبيفاي أعادت ${res.status}`);
  return { ok: true, platform: "SHOPIFY", platformKey: "SHOPIFY" };
}

// ==================== زد ====================
// ⚠️ ثقة متوسطة: التوثيق يؤكد وجود endpoint لتعديل المنتج وحقل السعر،
// لكن أسماء الحقول الدقيقة لم نتمكن من قراءتها من مخططهم (يُحمَّل
// بجافاسكريبت). يجب التأكد عند أول ربط حقيقي بمتجر زد.
async function updateZid(
  product: any, price: number, token: string, storeId: string | null
): Promise<PriceSyncResult> {
  if (!product.externalProductId) {
    return { ok: false, platform: "ZID", platformKey: "ZID",
      reasonKey: "zidNeedsProductId" };
  }

  const res = await fetch(`https://api.zid.sa/v1/products/${product.externalProductId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(storeId ? { "Store-Id": storeId } : {}),
    },
    body: JSON.stringify({ price }),
  });

  if (!res.ok) throw new Error(`زد أعادت ${res.status}`);
  return { ok: true, platform: "ZID", platformKey: "ZID" };
}

// ==================== ووكومرس ====================
// مصادقة أساسية بمفتاح وسرّ (consumer key/secret) - المعيار الموثّق
async function updateWoo(
  product: any, price: number, key: string, connection: any
): Promise<PriceSyncResult> {
  if (!connection.storeUrl || !connection.apiSecret) {
    return { ok: false, platform: "WOOCOMMERCE", platformKey: "WOOCOMMERCE", needsSetup: true,
      reasonKey: "wooNeedsCredentials" };
  }
  if (!product.externalProductId) {
    return { ok: false, platform: "WOOCOMMERCE", platformKey: "WOOCOMMERCE",
      reasonKey: "wooNeedsProductId" };
  }

  const secret = decryptToken(connection.apiSecret);
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const base = connection.storeUrl.replace(/\/+$/, "");

  const res = await fetch(`${base}/wp-json/wc/v3/products/${product.externalProductId}`, {
    method: "PUT",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ regular_price: String(price) }),
  });

  if (!res.ok) throw new Error(`ووكومرس أعادت ${res.status}`);
  return { ok: true, platform: "WOOCOMMERCE", platformKey: "WOOCOMMERCE" };
}

// ==================== إيزي أوردرز ====================
async function updateEasyOrders(
  product: any, price: number, token: string
): Promise<PriceSyncResult> {
  if (!product.externalProductId) {
    return { ok: false, platform: "EASY_ORDERS", platformKey: "EASY_ORDERS",
      reasonKey: "easyOrdersNeedsProductId" };
  }

  const res = await fetch(`https://api.easy-orders.net/api/v1/external-apps/products/${product.externalProductId}`, {
    method: "PATCH",
    headers: { "Api-Key": token, "Content-Type": "application/json" },
    body: JSON.stringify({ price }),
  });

  if (!res.ok) throw new Error(`إيزي أوردرز أعادت ${res.status}`);
  return { ok: true, platform: "EASY_ORDERS", platformKey: "EASY_ORDERS" };
}
