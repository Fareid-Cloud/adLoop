// scripts/generateSectionIndex.mjs
//
// يولّد فهرس عناوين الأقسام داخل الصفحات من الكود نفسه.
//
// 🔴 **البحث كان يقف عند عناوين الصفحات.** من يبحث عن قسمٍ داخل صفحة -
// «مصطلحات البحث»، «أفضل إعلان»، «الفحوص كلّها» - يُجاب «لا نتائج»، وهو
// موجود، على بُعد تمريرةٍ داخل صفحةٍ يعرف البحثُ طريقها.
//
// ولا يُكتب الفهرس بيدٍ: قائمةٌ من مئة عنوان تُصان يدوياً تتخلّف عن الكود
// أوّلَ قسمٍ يُضاف أو يُعاد تسميته، فيصير البحث يدلّ على ما ليس هناك -
// وهو أسوأ من ألّا يدلّ. فيُقرأ من المصدر في كلّ بناء.
//
// ما يُلتقَط: عنوانٌ (h2/h3) نصُّه نداءُ ترجمةٍ واحد. وما لا يُلتقَط: عنوانٌ
// نصُّه متغيّر (اسم حملةٍ مثلاً) - لأنّه بيانات لا بنية، ومكانه فهرس
// الكيانات في `/api/search` لا هذا.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "app", "dashboard");
const OUT = path.join(process.cwd(), "lib", "generated", "sectionIndex.ts");

/** كل ملفّات tsx تحت لوحة التحكّم */
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** المسار من موقع الملفّ: المجلّد هو الطريق، وأيّ مجلّدٍ خاصّ (_x) يُتخطّى */
function routeOf(file) {
  const rel = path.relative(path.join(process.cwd(), "app"), path.dirname(file));
  const parts = rel.split(path.sep).filter((s) => !s.startsWith("_") && !s.startsWith("("));
  return "/" + parts.join("/");
}

/** بادئة الاسم المستعار: `const tr = (k) => t(locale, `settings.${k}`)` → settings. */
function aliasPrefixes(src) {
  const out = {};
  const re = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*`([\w.]*)\$\{/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  // `const tr = (k) => t(locale, k)` - بلا بادئة
  const re2 = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*(\w+)[,)]/g;
  while ((m = re2.exec(src))) if (!(m[1] in out)) out[m[1]] = "";
  return out;
}

const entries = new Map(); // key -> { key, href }
let skippedDynamic = 0;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, "utf8");
  const route = routeOf(file);
  if (route.includes("[")) continue; // مسارٌ ديناميكيّ: لا وجهة ثابتة
  const prefixes = aliasPrefixes(src);

  // العنوان بكامل محتواه، ثمّ أوّل نداء ترجمةٍ فيه.
  //
  // ولا يُشترَط أن يكون النداء وحده: كثيرٌ من العناوين تحمل أيقونةً بجانب
  // النصّ أو تُكتب موزّعةً على أسطر - واشتراطُ ذلك كان يُسقط أغلبها.
  const re = /<(h[234])\b[^>]*>([\s\S]{0,600}?)<\/\1>/g;
  const inner = /(?:t\(\s*\w+\s*,\s*"([\w.]+)"\s*\)|\b(\w+)\(\s*"([\w.]+)"\s*\))/;
  let m;
  while ((m = re.exec(src))) {
    const hit = inner.exec(m[2]);
    if (!hit) continue;
    const key = hit[1] ?? (hit[2] in prefixes ? prefixes[hit[2]] + hit[3] : null);
    if (!key) continue;
    if (!entries.has(key)) entries.set(key, { key, href: route });
  }

  // عنوانٌ نصُّه متغيّر - يُعَدّ ولا يُفهرَس، ليُعرَف حجم ما لا يُغطّى
  const dyn = src.match(/<h[23]\b[^>]*>\s*\{(?!\s*(?:t\(|\w+\(\s*"))/g);
  if (dyn) skippedDynamic += dyn.length;
}

const list = [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));

const body = `// هذا الملفّ مُولَّد. لا يُحرَّر بيد.
// المصدر: scripts/generateSectionIndex.mjs - يقرأ عناوين h2/h3 من صفحات
// لوحة التحكّم في كلّ بناء، فلا يتخلّف الفهرس عن الكود.

/** عنوان قسمٍ داخل صفحة: مفتاح ترجمته، والصفحة التي يسكنها. */
export type SectionEntry = { key: string; href: string };

export const SECTION_INDEX: SectionEntry[] = [
${list.map((e) => `  { key: "${e.key}", href: "${e.href}" },`).join("\n")}
];
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, "utf8");
console.log(
  `✓ فهرس الأقسام: ${list.length} عنواناً من ${new Set(list.map((e) => e.href)).size} صفحة` +
    (skippedDynamic ? ` (وتُرك ${skippedDynamic} عنواناً نصُّه بيانات لا بنية)` : "")
);
