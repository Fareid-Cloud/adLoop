// scripts/checkTranslations.mjs
//
// تكافؤ القاموس بين العربية والإنجليزية.
//
// **لماذا هذا الملفّ موجود:** `t()` تُرجع **المسار نفسه** حين لا تجد المفتاح.
// أي أنّ مفتاحاً ناقصاً لا يُسقط شيئاً ولا يُوقف بناءً - يظهر للمستخدم نصّاً
// خاماً مثل `diag.highSub` في منتصف صفحة حقيقية، ولا يُكتشف إلّا حين يراه
// المستخدم بعينه. هذا الفحص يجعل الاختلال يظهر قبل النشر لا بعده.
//
// التشغيل: `node scripts/checkTranslations.mjs`
// يخرج بالرمز 1 عند وجود أيّ اختلال، فيصلح للربط بأيّ فحص آليّ لاحقاً.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const FILE = "lib/i18n/dictionary.ts";
const src = readFileSync(FILE, "utf8");

// نُصرّف الملفّ إلى JS ونشغّله بدل تحليل نصّه بتعبير نمطيّ: القاموس فيه
// آلاف الأسطر ونصوص تحوي أقواساً وعلامات اقتباس، وأيّ تحليل نصّيّ سيكذب.
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const mod = { exports: {} };
new Function("module", "exports", "require", js)(mod, mod.exports, require);

const dict = mod.exports.dictionary;
if (!dict?.ar || !dict?.en) {
  console.error("تعذّرت قراءة القاموس - تحقّق من تصدير `dictionary`.");
  process.exit(1);
}

/** كلّ المسارات المؤدّية إلى نصّ، مسطّحةً */
function paths(node, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(node ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") paths(v, p, out);
    else out.add(p);
  }
  return out;
}

const ar = paths(dict.ar);
const en = paths(dict.en);

const missingEn = [...ar].filter((p) => !en.has(p)).sort();
const missingAr = [...en].filter((p) => !ar.has(p)).sort();

if (missingEn.length === 0 && missingAr.length === 0) {
  console.log(`✓ القاموس متكافئ - ${ar.size} مفتاحاً في اللغتين.`);
  process.exit(0);
}

if (missingEn.length) {
  console.error(`\n✗ ${missingEn.length} مفتاحاً موجوداً في العربية وناقصاً في الإنجليزية:`);
  for (const p of missingEn) console.error("   " + p);
}
if (missingAr.length) {
  console.error(`\n✗ ${missingAr.length} مفتاحاً موجوداً في الإنجليزية وناقصاً في العربية:`);
  for (const p of missingAr) console.error("   " + p);
}
console.error("\nكلّ مفتاح أعلاه يظهر للمستخدم نصّاً خاماً بلغته.");
process.exit(1);
