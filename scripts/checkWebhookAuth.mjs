// scripts/checkWebhookAuth.mjs
//
// **يشغّل التحقّق من الويب هوك فعلاً على الخمس، لا يقرأه.**
//
// 🔴 هذا الفحص وُلد من عطبين حقيقيين لم يكن شيءٌ ليمسكهما:
//   • زد: كان الكود يتحقّق من ترويسة توقيعٍ **لا وجود لها في زد أصلاً**،
//     فكلّ ويب هوك منها يُرفض `401` - تكاملٌ يبدو مبنيّاً وهو معطّل تماماً.
//   • سلّة: لها استراتيجيتان (توقيع/توكن) وكان يدعم واحدة، فنصف التجّار
//     يُرفضون دائماً.
// كلاهما يمرّ من فحص الأنواع ومن البناء سالماً، ولا يظهر إلّا عند تاجرٍ
// حقيقيّ يشتكي أنّ طلباته لا تصل.
//
// ولا يلمس قاعدة بيانات ولا متجراً حقيقياً: حمولات مُلفَّقة وتوقيعات
// تُحسب هنا، فيصحّ تشغيله في كلّ بناء.

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

// تُقتطع الدالّتان المعنيّتان وحدهما من الملفّ: باقيه يستورد `./types`
// وهو مسارٌ نسبيّ لا يُحلّ من وحدةٍ محمَّلة بـ`data:`. والاقتطاع من الملفّ
// نفسه لا نسخُه، فما يُختبر هو ما يعمل في الإنتاج حرفاً بحرف.
const src = readFileSync("lib/ecommerce/adapters.ts", "utf8");
const start = src.indexOf("export function verifySignature");
const endMarker = "\n// ==================== هويّة المتجر المُرسِل";
const end = src.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  console.error("✗ تعذّر اقتطاع verifySignature من adapters.ts - تغيّر شكل الملفّ.");
  process.exit(1);
}
const slice = 'import crypto from "crypto";\n' + src.slice(start, end);
const js = ts.transpileModule(slice, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { verifySignature } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

const BODY = JSON.stringify({ id: 1001, total: { amount: 250 } });
const SECRET = "s".repeat(32);
const OTHER = "x".repeat(32);
const h = (o) => new Headers(o);

const hmacHex = (secret) => crypto.createHmac("sha256", secret).update(BODY, "utf8").digest("hex");
const hmacB64 = (secret) => crypto.createHmac("sha256", secret).update(BODY, "utf8").digest("base64");
const basic = (u, p) => "Basic " + Buffer.from(`${u}:${p}`, "utf8").toString("base64");

/** [الوصف, المنصّة, الترويسات, السرّ, الاسم, المتوقَّع] */
const CASES = [
  // ── شوبيفاي: HMAC base64 ──
  ["شوبيفاي - توقيع صحيح", "SHOPIFY", { "x-shopify-hmac-sha256": hmacB64(SECRET) }, SECRET, null, true],
  ["شوبيفاي - سرّ غيره", "SHOPIFY", { "x-shopify-hmac-sha256": hmacB64(OTHER) }, SECRET, null, false],
  ["شوبيفاي - بلا ترويسة", "SHOPIFY", {}, SECRET, null, false],

  // ── ووكومرس: HMAC base64 ──
  ["ووكومرس - توقيع صحيح", "WOOCOMMERCE", { "x-wc-webhook-signature": hmacB64(SECRET) }, SECRET, null, true],
  ["ووكومرس - سرّ غيره", "WOOCOMMERCE", { "x-wc-webhook-signature": hmacB64(OTHER) }, SECRET, null, false],

  // ── سلّة: استراتيجيتان، وكلتاهما لازمة ──
  ["سلّة - توقيع (الافتراضيّ)", "SALLA", { "x-salla-signature": hmacHex(SECRET) }, SECRET, null, true],
  ["سلّة - توقيع بسرّ غيره", "SALLA", { "x-salla-signature": hmacHex(OTHER) }, SECRET, null, false],
  ["سلّة - توكن مُعلَن", "SALLA", { "x-salla-security-strategy": "Token", authorization: SECRET }, SECRET, null, true],
  ["سلّة - توكن بـBearer", "SALLA", { "x-salla-security-strategy": "token", authorization: "Bearer " + SECRET }, SECRET, null, true],
  ["سلّة - توكن خاطئ", "SALLA", { "x-salla-security-strategy": "Token", authorization: OTHER }, SECRET, null, false],
  // العطب الذي جاء منه هذا الفحص: استراتيجية التوكن مع توقيعٍ فقط.
  ["سلّة - توكن مُعلَن بلا Authorization", "SALLA", { "x-salla-security-strategy": "Token", "x-salla-signature": hmacHex(SECRET) }, SECRET, null, false],

  // ── إيزي أوردرز: سرّ مشترك نصّاً ──
  ["إيزي أوردرز - سرّ صحيح", "EASY_ORDERS", { secret: SECRET }, SECRET, null, true],
  ["إيزي أوردرز - سرّ غيره", "EASY_ORDERS", { secret: OTHER }, SECRET, null, false],

  // ── زد: مصادقة أساسية لا توقيع ──
  ["زد - مصادقة صحيحة", "ZID", { authorization: basic("u1", SECRET) }, SECRET, "u1", true],
  ["زد - كلمة مرور خاطئة", "ZID", { authorization: basic("u1", OTHER) }, SECRET, "u1", false],
  ["زد - اسم مستخدم آخر", "ZID", { authorization: basic("u2", SECRET) }, SECRET, "u1", false],
  ["زد - بلا اسم مستخدم محفوظ", "ZID", { authorization: basic("u1", SECRET) }, SECRET, null, false],
  ["زد - بلا مصادقة إطلاقاً", "ZID", {}, SECRET, "u1", false],
  // العطب الأصليّ: ترويسة توقيعٍ لا وجود لها في زد.
  ["زد - ترويسة توقيع مُختلَقة تُرفض", "ZID", { "x-zid-signature": hmacHex(SECRET) }, SECRET, "u1", false],
];

let failed = 0;
console.log("الحالة".padEnd(42), "النتيجة");
console.log("-".repeat(60));
for (const [name, platform, headers, secret, username, expected] of CASES) {
  const got = verifySignature(platform, BODY, h(headers), secret, username);
  const ok = got === expected;
  if (!ok) failed++;
  console.log((ok ? "  " : "✗ ") + name.padEnd(40), got ? "يمرّ" : "يُرفض");
}

// سرٌّ غائب يُرفض في الخمس جميعاً - الفشل الافتراضيّ رفضٌ لا قبول.
for (const platform of ["SHOPIFY", "WOOCOMMERCE", "SALLA", "ZID", "EASY_ORDERS"]) {
  if (verifySignature(platform, BODY, h({}), undefined, "u1") !== false) {
    console.log(`✗ ${platform}: سرٌّ غائب مرّ`);
    failed++;
  }
}

console.log(
  failed === 0
    ? "\n✓ مصادقة الويب هوك صحيحة على المنصّات الخمس"
    : `\n✗ ${failed} حالة فاشلة`
);
process.exit(failed === 0 ? 0 : 1);
