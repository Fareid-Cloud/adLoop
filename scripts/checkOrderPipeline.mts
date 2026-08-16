// scripts/checkOrderPipeline.ts
//
// **هل السلسلة موصولة، أم أنّ كلّ حلقةٍ منها صحيحةٌ وحدها؟**
//
// `checkWebhookAuth` يختبر الحلقات: التوقيع يصحّ لكلّ منصّة. ولا يجيب
// السؤال الذي يهمّ: **ويب هوكٌ من متجرٍ بعينه، هل يصل طلبُه إلى ذلك
// المتجر بالذات في صفحة المقارنة؟**
//
// وهذا موضع العطب الذي لا تمسكه الحلقات: كلٌّ منها سليم والوصلة بينها
// مقطوعة. وهو ما حدث حرفياً في بذرة الديمو - أُنشئ المتجر وأُنشئت
// الطلبات ولم يربطهما شيء، فقالت شاشتان رقمين متناقضين عن المتجر نفسه.
//
// فيمرّ هنا على **الدوالّ الحقيقية** بترتيبها الحقيقيّ:
//   `resolveStoreConnection` → `ingestOrder` → `getStoreComparison`
//
// ═══ لا يمسّ متجراً حقيقياً ولا بيانات مشترك ═══
//
// يبني مستخدماً ومساحةً ومتجرين خاصّين به، ثمّ **يحذف المستخدم في
// `finally`** فتسقط معه المساحة والمتاجر والطلبات بالتتالي - مهما فشل
// الفحص أو انقطع. ولا يقرأ ولا يكتب صفّاً لا يملكه.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";

// ملفّ البيئة يُقرأ يدوياً: tsx لا يحمّله، ومنه يأتي DATABASE_URL.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

// مفتاح تشفيرٍ مؤقّت لهذه التشغيلة وحدها إن لم يكن مضبوطاً. الفحص يشفّر
// أسراره ويفكّها في العملية نفسها، فأيّ مفتاحٍ صالحٍ يفي - ولا يُقرأ به
// سرٌّ محفوظ من قبل، فلا يمسّ بيانات أحد.
process.env.TOKEN_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString("hex");

// الاستيراد بعد ضبط البيئة: الوحدات تُقيَّم عند استيرادها، ووحدة
// التشفير تقرأ المفتاح لحظتَها.
const { prisma } = await import("@/lib/prisma");
const { encryptToken } = await import("@/lib/encryption");
const { resolveStoreConnection } = await import("@/lib/ecommerce/resolveStore");
const { ingestOrder } = await import("@/lib/ecommerce/ingest");
const { parseOrder } = await import("@/lib/ecommerce/adapters");
const { getStoreComparison } = await import("@/lib/ecommerce/storeComparison");

const SECRET_A = "a".repeat(40);
const SECRET_B = "b".repeat(40);
const stamp = Date.now();

let failed = 0;
function ok(label: string, cond: boolean, extra = "") {
  if (!cond) failed++;
  console.log(`${cond ? "  " : "✗ "}${label.padEnd(54)} ${extra}`);
}

/** ووكومرس: السرّ يضعه صاحب المتجر، والتوقيع HMAC-SHA256 بترميز base64. */
function wooBody(id: string, total: number) {
  return JSON.stringify({
    id,
    date_created_gmt: new Date().toISOString(),
    total: String(total),
    status: "completed",
    line_items: [{ sku: `sku-${stamp}`, name: "Widget", quantity: 1, total: String(total) }],
  });
}
function wooHeaders(secret: string, body: string, source: string) {
  return new Headers({
    "x-wc-webhook-signature": crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64"),
    "x-wc-webhook-source": source,
  });
}

/** يعيد ما يفعله مسار الويب هوك بالضبط، بالدوالّ نفسها وبترتيبها. */
async function deliver(body: string, headers: Headers, source: string | null) {
  const store = await resolveStoreConnection("WOOCOMMERCE", source, body, headers);
  if (!store) return { rejected: true as const };
  const order = parseOrder("WOOCOMMERCE", JSON.parse(body));
  if (!order) return { rejected: false as const, ignored: true as const };
  const result = await ingestOrder(order, store.workspaceId, store.connectionId);
  return { rejected: false as const, ignored: false as const, result, store };
}

// يُغلَّف في دالّة لأنّ المخرَج CommonJS لا يقبل await في المستوى الأعلى.
async function main() {
let userId: string | null = null;

try {
  const user = await prisma.user.create({
    data: { email: `pipeline-${stamp}@adloop.invalid`, name: "pipeline check" },
    select: { id: true },
  });
  userId = user.id;

  const ws = await prisma.workspace.create({
    data: { userId, name: `pipeline-${stamp}`, currency: "SAR" },
    select: { id: true },
  });

  const storeA = await prisma.ecommerceConnection.create({
    data: {
      workspaceId: ws.id, platform: "WOOCOMMERCE", storeName: "Retail",
      active: true, webhookSecret: encryptToken(SECRET_A),
      storeIdentifier: `https://retail-${stamp}.example`,
    },
    select: { id: true },
  });
  const storeB = await prisma.ecommerceConnection.create({
    data: {
      workspaceId: ws.id, platform: "WOOCOMMERCE", storeName: "Wholesale",
      active: true, webhookSecret: encryptToken(SECRET_B),
      storeIdentifier: `https://wholesale-${stamp}.example`,
    },
    select: { id: true },
  });

  const srcA = `https://retail-${stamp}.example`;
  const srcB = `https://wholesale-${stamp}.example`;

  // ــ ١) طلبٌ من متجر «أ» يصل متجر «أ» ــ
  const b1 = wooBody("1001", 300);
  const d1 = await deliver(b1, wooHeaders(SECRET_A, b1, srcA), srcA);
  ok("طلب متجر أ يُقبل ويُنسب إلى متجر أ",
    !d1.rejected && !("ignored" in d1 && d1.ignored) && d1.store?.connectionId === storeA.id);

  // ــ ٢) **رقم الطلب نفسه** من متجر «ب»: ليس تكراراً ــ
  //
  // هذه هي الحالة التي كانت تُسقط الطلب بصمت: ووكومرس تُنصَّب على خادم كلّ
  // تاجر وتبدأ الترقيم من واحد، فرقم «1001» يتكرّر بين متجرين بالضرورة.
  const b2 = wooBody("1001", 700);
  const d2 = await deliver(b2, wooHeaders(SECRET_B, b2, srcB), srcB);
  ok("الرقم نفسه من متجر ب يُقبل ولا يُقرأ مكرَّراً",
    !d2.rejected && !("ignored" in d2 && d2.ignored) && d2.result?.status === "ok",
    d2.result?.status ?? "");

  // ــ ٣) إعادة إرسال الرسالة نفسها: تُهمَل ــ
  const d3 = await deliver(b1, wooHeaders(SECRET_A, b1, srcA), srcA);
  ok("إعادة إرسال الطلب نفسه تُهمَل", d3.result?.status === "duplicate", d3.result?.status ?? "");

  // ــ ٤) توقيعٌ بسرّ متجرٍ آخر يُرفض ــ
  const b4 = wooBody("1002", 100);
  const d4 = await deliver(b4, wooHeaders(SECRET_B, b4, srcA), srcA);
  ok("توقيع بسرّ متجرٍ آخر يُرفض", d4.rejected === true);

  // ــ ٥) بلا توقيع أصلاً يُرفض ــ
  const d5 = await deliver(b4, new Headers({ "x-wc-webhook-source": srcA }), srcA);
  ok("بلا توقيع يُرفض", d5.rejected === true);

  // ــ ٦) وصولاً إلى ما يراه المشترك: صفحة المقارنة ــ
  const cmp = await getStoreComparison(ws.id, 30);
  const lineA = cmp.stores.find((s) => s.connectionId === storeA.id);
  const lineB = cmp.stores.find((s) => s.connectionId === storeB.id);

  ok("المقارنة تعرض متجرين", cmp.stores.length === 2, String(cmp.stores.length));
  ok("متجر أ: طلبٌ واحد بقيمة 300", lineA?.orders === 1 && lineA?.revenue === 300,
    `${lineA?.orders} · ${lineA?.revenue}`);
  ok("متجر ب: طلبٌ واحد بقيمة 700", lineB?.orders === 1 && lineB?.revenue === 700,
    `${lineB?.orders} · ${lineB?.revenue}`);
  ok("لا طلب بلا متجر", cmp.unattributedOrders === 0, String(cmp.unattributedOrders));
  ok("الفائز بالإيراد هو متجر ب", cmp.winnerId === storeB.id);
} catch (err) {
  console.error("✗ فشل الفحص:", err instanceof Error ? err.message : err);
  failed++;
} finally {
  // حذف المستخدم يُسقط المساحة والمتاجر والطلبات بالتتالي. يجري مهما حدث.
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
}

console.log(
  failed === 0
    ? "\n✓ السلسلة موصولة: ويب هوك ← حسم المتجر ← الطلب ← صفحة المقارنة"
    : `\n✗ ${failed} حالة فاشلة`
);
process.exit(failed === 0 ? 0 : 1);

}

await main();
