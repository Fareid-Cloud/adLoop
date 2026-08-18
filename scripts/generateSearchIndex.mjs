// scripts/generateSearchIndex.mjs
//
// يولّد فهرس البحث من الكود: كلُّ نصٍّ يراه المشترك، وأين يراه.
//
// 🔴 **المحاولة الأولى فهرست العناوين (h2/h3) وحدها - ثمانيةً وثلاثين.**
// وكان ذلك سبب فشلها: ما يبحث عنه المشترك ليس عناوين الأقسام، بل أيَّ نصٍّ
// وقعت عليه عينه - «نسبة التحقّق»، «تكلفة البضاعة»، «إضافة قرار جديد».
// وهذه ليست عناوين، بل تسمياتٌ داخل بطاقاتٍ وأزرارٍ وأعمدةِ جداول.
//
// فالمصدر الصحيح هو **القاموس**: كلُّ نصٍّ فيه يُنادى من صفحةٍ ما هو نصٌّ
// يراه أحدٌ ويصحّ أن يُبحَث عنه. والفهرس يربط المفتاح بالصفحة التي تناديه.
//
// وما لا يُفهرَس، ولكلٍّ سببه:
//   - النصّ الأطول من ستّين حرفاً: فقرةٌ شارحة لا تسمية، ونتيجةُ بحثٍ
//     بفقرةٍ كاملة تملأ القائمة ولا تدلّ.
//   - النصّ ذو المتغيّرات (`{count}`): لا وجود له إلّا بعد الملء، فمطابقتُه
//     مطابقةٌ لقالبٍ لا لما قرأه المشترك.

import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "app");
const DICT = path.join(process.cwd(), "lib", "i18n", "dictionary.ts");
const OUT = path.join(process.cwd(), "lib", "generated", "searchIndex.ts");

const MAX_LABEL = 60;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function routeOf(file) {
  const rel = path.relative(APP, path.dirname(file));
  const parts = rel.split(path.sep).filter((s) => !s.startsWith("_") && !s.startsWith("("));
  return "/" + parts.join("/");
}

/** بادئة الاسم المستعار: `const tr = (k) => t(locale, `settings.${k}`)` → settings. */
function aliasPrefixes(src) {
  const out = {};
  let m;
  const re = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*`([\w.]*)\$\{/g;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  // 🔴 والجمعُ بالنصوص لا القالبَ وحده: `t(locale, ("diagPage." + k))`.
  // كان إغفالُ هذه الصيغة يُسقط صفحاتٍ بأكملها من الفهرس بلا أثرٍ ظاهر -
  // المولّد ينجح، والعدّ يبدو معقولاً، والنصّ لا يُوجَد حين يُبحَث عنه.
  const re3 = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*\(?\s*"([\w.]*\.)"\s*\+/g;
  while ((m = re3.exec(src))) if (!(m[1] in out)) out[m[1]] = m[2];
  const re2 = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*(\w+)[,)]/g;
  while ((m = re2.exec(src))) if (!(m[1] in out)) out[m[1]] = "";
  return out;
}

// ── أين يُنادى كلُّ مفتاح ───────────────────────────────────────────
const used = new Map();
for (const file of walk(APP)) {
  if (!file.includes(`${path.sep}dashboard${path.sep}`)) continue;
  const route = routeOf(file);
  if (route.includes("[")) continue; // مسارٌ ديناميكيّ: لا وجهة ثابتة
  const src = fs.readFileSync(file, "utf8");
  const pre = aliasPrefixes(src);

  for (const m of src.matchAll(/\bt\(\s*\w+\s*,\s*"([\w.]+)"/g)) {
    if (!used.has(m[1])) used.set(m[1], route);
  }
  for (const m of src.matchAll(/\b(\w+)\(\s*"([\w.]+)"\s*[,)]/g)) {
    if (!(m[1] in pre)) continue;
    const key = pre[m[1]] + m[2];
    if (!used.has(key)) used.set(key, route);
  }
}

// ── نصوص القاموس: الورقة الأخيرة من المفتاح ─────────────────────────
const dict = fs.readFileSync(DICT, "utf8");
const texts = new Map();
for (const m of dict.matchAll(/^\s{4,}(\w+): "(.*?)",?\s*$/gm)) {
  if (!texts.has(m[1])) texts.set(m[1], m[2]);
}

const entries = [];
let skippedLong = 0;
let skippedVars = 0;
for (const [key, href] of used) {
  const leaf = key.split(".").pop();
  const txt = texts.get(leaf);
  if (!txt) continue;
  if (txt.includes("{")) { skippedVars++; continue; }
  if (txt.length > MAX_LABEL) { skippedLong++; continue; }
  entries.push({ k: key, h: href });
}

entries.sort((a, b) => a.k.localeCompare(b.k));

const body = `// هذا الملفّ مُولَّد. لا يُحرَّر بيد.
// المصدر: scripts/generateSearchIndex.mjs - يُعاد بناؤه في كلّ بناء، فلا
// يتخلّف الفهرس عن الكود ولا يدلّ على نصٍّ أُزيل.

/** \`k\` مفتاح الترجمة، و\`h\` الصفحة التي تناديه. */
export type SearchEntry = { k: string; h: string };

export const SEARCH_INDEX: SearchEntry[] = [
${entries.map((e) => `  { k: "${e.k}", h: "${e.h}" },`).join("\n")}
];
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, "utf8");

console.log(
  `✓ فهرس البحث: ${entries.length} نصّاً من ${new Set(entries.map((e) => e.h)).size} صفحة` +
    ` (تُرك ${skippedLong} نصّاً أطول من ${MAX_LABEL} حرفاً، و${skippedVars} فيها متغيّرات)`
);
