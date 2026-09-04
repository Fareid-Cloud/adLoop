// scripts/checkPlanLabels.mjs
//
// بوّابة بناء: كلُّ باقةٍ وكلُّ صفِّ مقارنةٍ له نصُّه في اللغتين.
//
// 🔴 **السببُ عطلٌ ظهر للمشترك على شاشة الأسعار.**
//
// صفحةُ الباقات تبني مفاتيحَها **تركيباً**: `` tr(`f_${row.key}`) ``
// و`` tr(`p_${plan.key}`) `` و`` tr(`feats_${plan.key}`) ``. وفحصُ التغطية
// (`checkTranslationCoverage`) يقرأ المفاتيحَ الساكنة وحدها - فلا يرى
// أيّاً من هذه، ولا يستطيع.
//
// فحين أُضيف صفُّ `mcp` إلى `COMPARISON_ROWS` بلا `f_mcp` في القاموس،
// مرّ البناءُ كاملاً وكلُّ فحوصه خضراء، وعرض الجدولُ للمشتري السطرَ
// النصّيّ `plans.f_mcp` بين صفوف الأسعار. سبعةَ عشرَ صفّاً مترجَماً
// وواحدٌ خام في الشاشة التي يُتَّخذ عندها قرارُ الدفع.
//
// **ولا يكفي إصلاحُ المفتاح الواحد:** الفجوةُ في الآلية لا في الصفّ -
// أيُّ باقةٍ أو صفٍّ يُضاف غداً يقع في نفس الحفرة بصمت. هذا الفحص يقرأ
// `lib/plans.ts` مصدراً للحقيقة ويطالب القاموسَ بما يلزمها.

import fs from "node:fs";
import path from "node:path";

const plansSrc = fs.readFileSync(path.join(process.cwd(), "lib", "plans.ts"), "utf8");
const dictSrc = fs.readFileSync(path.join(process.cwd(), "lib", "i18n", "dictionary.ts"), "utf8");

// مفاتيحُ الباقات من `PLANS` - `key: "starter"` وأخواتها
const planKeys = [...plansSrc.matchAll(/^\s{4}key:\s*"([a-z]+)"/gm)].map((m) => m[1]);

// صفوفُ المقارنة من `COMPARISON_ROWS`
const rowsBlock = plansSrc.slice(
  plansSrc.indexOf("export const COMPARISON_ROWS"),
  plansSrc.indexOf("// ==================== كريدت")
);
const rowKeys = [...rowsBlock.matchAll(/\{\s*key:\s*"(\w+)"/g)].map((m) => m[1]);

if (planKeys.length === 0 || rowKeys.length === 0) {
  console.error("لم يُقرأ شيءٌ من lib/plans.ts - تغيّر شكلُ الملفّ، فحدِّث هذا الفحص.");
  process.exit(1);
}

// كلُّ مفتاحٍ لازمٌ مرّتين: العربية والإنجليزية.
const required = [
  ...planKeys.flatMap((k) => [`p_${k}`, `d_${k}`, `feats_${k}`]),
  ...rowKeys.map((k) => `f_${k}`),
];

const missing = [];
for (const key of required) {
  const hits = (dictSrc.match(new RegExp(`^\\s+${key}:`, "gm")) ?? []).length;
  if (hits < 2) missing.push(`${key} (${hits}/2)`);
}

if (missing.length > 0) {
  console.error("مفاتيحُ باقاتٍ ناقصةٌ في القاموس - ستُعرض خاماً في شاشة الأسعار:\n");
  for (const m of missing) console.error("  • plans." + m);
  console.error(
    `\nالمجموع: ${missing.length}.` +
      "\nكلُّ مفتاحٍ يلزم في اللغتين. المفاتيح هنا تُبنى تركيباً في PlansClient،" +
      "\nففحصُ التغطية لا يراها - وهذا الفحص هو الذي يراها."
  );
  process.exit(1);
}

console.log(
  `✓ كلّ الباقات (${planKeys.length}) وصفوف المقارنة (${rowKeys.length}) لها نصوصها في اللغتين.`
);
