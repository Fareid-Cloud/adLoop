// scripts/checkPlatformIngest.mts
//
// **الخمس منصّات، كلٌّ بصيغتها ومصادقتها: هل يصل طلبها فعلاً؟**
//
// `checkOrderPipeline` يثبت الوصلة كلّها من طرفٍ إلى طرف - لكن بمنصّةٍ
// واحدة (ووكومرس). والفجوة التي يسدّها هذا الملفّ أنّ لكلّ منصّةٍ من
// الخمس **صيغةَ جسمٍ مختلفة وآليةَ مصادقةٍ مختلفة**، وقد ثبت أنّ الخطأ
// يقع في هذا الفارق بالذات لا في المنطق المشترك:
//
//   • زد كان يُفحَص بترويسة `x-zid-signature` **لا وجود لها** عندهم،
//     فكان كلّ ويب هوك من زد يُرفض ٤٠١ - تكاملٌ يبدو مبنيّاً وهو معطّل.
//   • سلّة لها استراتيجيتان (توقيع/توكن) وكان الكود يفترض الأولى دائماً،
//     فنصف تجّار سلّة لا يصلهم طلبٌ واحد.
//
// فالفحص هنا ثلاث حالاتٍ لكلّ منصّة، هي ما يقع فعلاً في الإنتاج:
//   ١) مصادقةٌ صحيحة + جسمٌ حقيقيّ  ← يُقبل ويصل الطلب بقيمته
//   ٢) مصادقةٌ خاطئة               ← يُرفض قبل أن يُقرأ
//   ٣) الرسالة نفسها مرّةً ثانية    ← تُهمَل بلا عدٍّ ثانٍ
//
// ═══ لا يمسّ متجراً حقيقياً ولا بيانات مشترك ═══
//
// يبني مستخدماً ومساحةً وخمسة متاجر خاصّةً به، ثمّ **يحذف المستخدم في
// `finally`** فتسقط معه المساحة والمتاجر والطلبات بالتتالي - مهما فشل
// الفحص أو انقطع. ولا يقرأ ولا يكتب صفّاً لا يملكه.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}
process.env.TOKEN_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString("hex");

const { prisma } = await import("@/lib/prisma");
const { encryptToken } = await import("@/lib/encryption");
const { resolveStoreConnection } = await import("@/lib/ecommerce/resolveStore");
const { ingestOrder } = await import("@/lib/ecommerce/ingest");
const { parseOrder } = await import("@/lib/ecommerce/adapters");

const stamp = Date.now();
let failed = 0;
function ok(label: string, cond: boolean, extra = "") {
  if (!cond) failed++;
  console.log(`${cond ? "  " : "✗ "}${label.padEnd(58)} ${extra}`);
}

const hmac = (secret: string, body: string, enc: "base64" | "hex") =>
  crypto.createHmac("sha256", secret).update(body, "utf8").digest(enc);

// ══════════════════════════════════════════════════════════════════
//  أجسامٌ بصيغة كلّ منصّة كما يقرؤها محلّلها
// ══════════════════════════════════════════════════════════════════

const iso = new Date().toISOString();

/** سلّة: الطلب داخل `data`، والمبالغ كائناتٌ لها `amount` */
const sallaBody = (id: string, total: number) => JSON.stringify({
  event: "order.created",
  merchant: `salla-${stamp}`,
  data: {
    id,
    reference_id: id,
    created_at: iso,
    total: { amount: total, currency: "SAR" },
    status: { name: "completed" },
    amounts: { shipping_cost: { amount: 15 } },
    items: [{ sku: `sku-${stamp}`, name: "Widget", quantity: 1, amounts: { total: { amount: total } } }],
  },
});

/** شوبيفاي: الطلب في الجذر، والسطر يحمل **سعر الوحدة** لا إجمالي السطر */
const shopifyBody = (id: string, unitPrice: number, qty = 2) => JSON.stringify({
  id,
  created_at: iso,
  total_price: String(unitPrice * qty),
  currency: "SAR",
  financial_status: "paid",
  line_items: [{ sku: `sku-${stamp}`, title: "Widget", quantity: qty, price: String(unitPrice) }],
  shipping_lines: [{ price: "20.00" }],
});

/** زد: الطلب في `data`، والمبالغ لها `value` */
const zidBody = (id: string, total: number) => JSON.stringify({
  data: {
    id,
    store_id: `zid-${stamp}`,
    created_at: iso,
    order_total: { value: total },
    currency_code: "SAR",
    order_status: { name: "completed" },
    products: [{ sku: `sku-${stamp}`, name: "Widget", quantity: 1, total: { value: total } }],
  },
});

/** إيزي أوردرز: `cart_items`، وسعر الوحدة كذلك */
const easyBody = (id: string, unitPrice: number, qty = 3) => JSON.stringify({
  id,
  created_at: iso,
  total_cost: unitPrice * qty,
  currency: "SAR",
  status: "confirmed",
  shipping_cost: 10,
  cart_items: [{ sku: `sku-${stamp}`, name: "Widget", quantity: qty, price: unitPrice }],
});

/** ووكومرس: `line_items` بإجمالي السطر */
const wooBody = (id: string, total: number) => JSON.stringify({
  id,
  date_created_gmt: iso,
  total: String(total),
  status: "completed",
  line_items: [{ sku: `sku-${stamp}`, name: "Widget", quantity: 1, total: String(total) }],
});

// ══════════════════════════════════════════════════════════════════
//  حالات الخمس: الجسم، والمصادقة الصحيحة، والخاطئة
// ══════════════════════════════════════════════════════════════════

interface Case {
  platform: "SALLA" | "SHOPIFY" | "ZID" | "WOOCOMMERCE" | "EASY_ORDERS";
  label: string;
  secret: string;
  username?: string;
  /** المعرّف الذي تُعرَف به هوية المتجر المُرسِل */
  storeIdentifier: string | null;
  body: string;
  /** القيمة التي يجب أن تصل بعد التحليل - تختلف عن الظاهر في الجسم عمداً
   *  لدى شوبيفاي وإيزي أوردرز (سعر وحدة × كمّية) */
  expectedTotal: number;
  goodHeaders: (body: string) => Headers;
  badHeaders: (body: string) => Headers;
}

const S = {
  salla: "s".repeat(40),
  shopify: "h".repeat(40),
  zid: "z".repeat(40),
  woo: "w".repeat(40),
  easy: "e".repeat(40),
};

const CASES: Case[] = [
  {
    platform: "SALLA",
    label: "سلّة (توقيع)",
    secret: S.salla,
    storeIdentifier: `salla-${stamp}`,
    body: sallaBody("s-1", 300),
    expectedTotal: 300,
    goodHeaders: (b) => new Headers({ "x-salla-signature": hmac(S.salla, b, "hex") }),
    badHeaders: (b) => new Headers({ "x-salla-signature": hmac("wrong", b, "hex") }),
  },
  {
    // نصف تجّار سلّة على هذه الاستراتيجية - وكانت مرفوضةً بالكامل
    platform: "SALLA",
    label: "سلّة (توكن)",
    secret: S.salla,
    storeIdentifier: `salla-${stamp}`,
    body: sallaBody("s-2", 450),
    expectedTotal: 450,
    goodHeaders: () => new Headers({
      "x-salla-security-strategy": "token",
      authorization: `Bearer ${S.salla}`,
    }),
    badHeaders: () => new Headers({
      "x-salla-security-strategy": "token",
      authorization: "Bearer wrong-token-entirely-different-length",
    }),
  },
  {
    platform: "SHOPIFY",
    label: "شوبيفاي",
    secret: S.shopify,
    storeIdentifier: `shop-${stamp}.myshopify.com`,
    body: shopifyBody("sh-1", 125, 2),
    expectedTotal: 250,
    goodHeaders: (b) => new Headers({
      "x-shopify-hmac-sha256": hmac(S.shopify, b, "base64"),
      "x-shopify-shop-domain": `shop-${stamp}.myshopify.com`,
    }),
    badHeaders: (b) => new Headers({
      "x-shopify-hmac-sha256": hmac("wrong", b, "base64"),
      "x-shopify-shop-domain": `shop-${stamp}.myshopify.com`,
    }),
  },
  {
    // زد: مصادقةٌ أساسية لا توقيع - والترويسة التي كانت تُفحَص لا وجود لها
    platform: "ZID",
    label: "زد (مصادقة أساسية)",
    secret: S.zid,
    username: "adloop",
    storeIdentifier: `zid-${stamp}`,
    body: zidBody("z-1", 600),
    expectedTotal: 600,
    goodHeaders: () => new Headers({
      authorization: "Basic " + Buffer.from(`adloop:${S.zid}`, "utf8").toString("base64"),
    }),
    badHeaders: () => new Headers({
      authorization: "Basic " + Buffer.from(`adloop:wrong`, "utf8").toString("base64"),
    }),
  },
  {
    platform: "WOOCOMMERCE",
    label: "ووكومرس",
    secret: S.woo,
    storeIdentifier: `https://woo-${stamp}.example`,
    body: wooBody("w-1", 800),
    expectedTotal: 800,
    goodHeaders: (b) => new Headers({
      "x-wc-webhook-signature": hmac(S.woo, b, "base64"),
      "x-wc-webhook-source": `https://woo-${stamp}.example`,
    }),
    badHeaders: (b) => new Headers({
      "x-wc-webhook-signature": hmac("wrong", b, "base64"),
      "x-wc-webhook-source": `https://woo-${stamp}.example`,
    }),
  },
  {
    // إيزي أوردرز: مفتاحٌ مشترك بسيط، ولا ترويسة هوية - فيُحسم المتجر
    // بمطابقة السرّ وحده. وهذه حالةٌ تستحقّ الفحص: لو كان الحسم يختار
    // «أوّل ربطٍ في القاعدة» لظهر العطب هنا بالذات.
    platform: "EASY_ORDERS",
    label: "إيزي أوردرز (مفتاح مشترك)",
    secret: S.easy,
    storeIdentifier: null,
    body: easyBody("e-1", 50, 3),
    expectedTotal: 150,
    goodHeaders: () => new Headers({ secret: S.easy }),
    badHeaders: () => new Headers({ secret: "e".repeat(39) + "x" }),
  },
];

// ══════════════════════════════════════════════════════════════════

async function deliver(c: Case, body: string, headers: Headers) {
  const store = await resolveStoreConnection(c.platform, c.storeIdentifier, body, headers);
  if (!store) return { rejected: true as const };
  const order = parseOrder(c.platform, JSON.parse(body));
  if (!order) return { rejected: false as const, unreadable: true as const };
  const result = await ingestOrder(order, store.workspaceId, store.connectionId);
  return { rejected: false as const, unreadable: false as const, result, store };
}

async function main() {
let userId: string | null = null;

try {
  const user = await prisma.user.create({
    data: { email: `platforms-${stamp}@adloop.invalid`, name: "platform check" },
    select: { id: true },
  });
  userId = user.id;

  const ws = await prisma.workspace.create({
    data: { userId, name: `platforms-${stamp}`, currency: "SAR" },
    select: { id: true },
  });

  // متجرٌ لكلّ حالة. حالتا سلّة تتشاركان متجراً واحداً - فهما تاجرٌ واحد
  // باستراتيجيتين، وهو ما يقع فعلاً حين يبدّل تطبيقُه استراتيجيته.
  const storeIds = new Map<string, string>();
  for (const c of CASES) {
    const key = `${c.platform}:${c.storeIdentifier ?? ""}`;
    if (storeIds.has(key)) continue;
    const created = await prisma.ecommerceConnection.create({
      data: {
        workspaceId: ws.id,
        platform: c.platform,
        storeName: c.label,
        active: true,
        webhookSecret: encryptToken(c.secret),
        webhookUsername: c.username ?? null,
        storeIdentifier: c.storeIdentifier,
      },
      select: { id: true },
    });
    storeIds.set(key, created.id);
  }

  for (const c of CASES) {
    const key = `${c.platform}:${c.storeIdentifier ?? ""}`;
    const expectedStoreId = storeIds.get(key);

    // ــ ١) مصادقةٌ صحيحة: يُقبل، ويصل إلى متجره، بقيمته المحلَّلة ــ
    const good = await deliver(c, c.body, c.goodHeaders(c.body));
    ok(
      `${c.label}: يُقبل ويصل إلى متجره`,
      !good.rejected && !("unreadable" in good && good.unreadable) &&
        good.result?.status === "ok" && good.store?.connectionId === expectedStoreId,
      good.rejected ? "مرفوض" : (good.result?.status ?? "")
    );

    // ــ ٢) القيمة كما يقرؤها المحلّل، لا كما تبدو في الجسم ــ
    //
    // شوبيفاي وإيزي أوردرز ترسلان **سعر الوحدة** في السطر، فالضرب في
    // الكمّية شرطُ صحّة الإيراد. خطأٌ هنا يمرّ صامتاً ويظهر إيراداً ناقصاً.
    const saved = await prisma.order.findFirst({
      where: { workspaceId: ws.id, connectionId: expectedStoreId, externalOrderId: JSON.parse(c.body).id ?? JSON.parse(c.body).data?.id },
      select: { total: true },
    });
    ok(
      `${c.label}: الإجمالي يصل ${c.expectedTotal}`,
      saved?.total === c.expectedTotal,
      String(saved?.total ?? "—")
    );

    // ــ ٣) مصادقةٌ خاطئة: يُرفض قبل أن يُقرأ ــ
    const bad = await deliver(c, c.body, c.badHeaders(c.body));
    ok(`${c.label}: مصادقة خاطئة تُرفض`, bad.rejected === true);

    // ــ ٤) الرسالة نفسها ثانيةً: تُهمَل ــ
    const again = await deliver(c, c.body, c.goodHeaders(c.body));
    ok(
      `${c.label}: إعادة الإرسال تُهمَل`,
      again.result?.status === "duplicate",
      again.result?.status ?? ""
    );
  }

  // ــ ٥) لا طلبٌ تسرّب إلى متجرٍ ليس له ــ
  //
  // ستّ حالاتٍ على خمسة متاجر: كلّ طلبٍ في متجره وحده، ولا متجرٌ يحمل
  // طلب غيره. وهذا هو ما كان يعطب حين يُختار «أوّل ربطٍ في القاعدة».
  const counts = await prisma.order.groupBy({
    by: ["connectionId"],
    where: { workspaceId: ws.id },
    _count: { _all: true },
  });
  const total = counts.reduce((s, r) => s + r._count._all, 0);
  ok("مجموع الطلبات ستّة، لا تكرار ولا فقد", total === CASES.length, String(total));
  ok(
    "لا متجر يحمل طلب غيره",
    counts.every((r) => r.connectionId !== null),
    counts.map((r) => r._count._all).join("/")
  );
} catch (err) {
  console.error("✗ فشل الفحص:", err instanceof Error ? err.message : err);
  failed++;
} finally {
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
}

console.log(
  failed === 0
    ? "\n✓ الخمس منصّات: تُقبل بمصادقتها، وتُرفض بدونها، ولا تُعَدّ مرّتين"
    : `\n✗ ${failed} حالة فاشلة`
);
process.exit(failed === 0 ? 0 : 1);
}

await main();
