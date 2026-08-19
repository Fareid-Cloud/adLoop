// scripts/checkTranslationCoverage.mjs
//
// 🔴 **التكافؤ ليس تغطية.**
//
// `checkTranslations.mjs` يقارن العربية بالإنجليزية، فيلتقط مفتاحاً موجوداً
// في إحداهما وناقصاً من الأخرى. لكنّ مفتاحاً **يناديه الكود وهو غائبٌ عن
// الاثنتين** يمرّ منه سالماً - لأنّ الغياب متكافئ.
//
// وهذا بالضبط ما وصل إلى المالك ثلاث مرّات في جلسةٍ واحدة: `demo.title`،
// و`api.wrongCurrentPassword`، و`truthPage.vsPrevPeriod` - كلُّها ظهرت على
// الشاشة كمسارٍ خام، وكلُّها عدّت من فحصٍ يقول «✓ متكافئ».
//
// هذا الفحص يسأل السؤال الآخر: **كلُّ مفتاحٍ يناديه الكود، هل له نصّ؟**

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const dictSource = readFileSync("lib/i18n/dictionary.ts", "utf8");

/** مجموعة المسارات الموجودة فعلاً في القاموس العربيّ (والإنجليزيّ مطابقٌ
 *  له بحكم فحص التكافؤ، فيكفي أحدهما). تُستخرَج بالنصّ لا بالاستيراد:
 *  الملفّ TypeScript ولا يُستورَد في Node بلا ترجمة. */
function dictionaryPaths() {
  const arStart = dictSource.indexOf("  ar: {");
  const enStart = dictSource.indexOf("\n  en: {");
  const ar = dictSource.slice(arStart, enStart);

  const found = new Set();
  let ns = null;
  for (const line of ar.split("\n")) {
    const nsMatch = line.match(/^    (\w+): \{/);
    if (nsMatch) { ns = nsMatch[1]; continue; }
    if (/^    \},/.test(line)) { ns = null; continue; }
    const keyMatch = line.match(/^      (\w+):/);
    if (keyMatch && ns) found.add(`${ns}.${keyMatch[1]}`);
  }
  return found;
}

const available = dictionaryPaths();
const files = execSync('git ls-files "app/**/*.ts" "app/**/*.tsx" "lib/**/*.ts"', {
  encoding: "utf8",
}).trim().split("\n").filter(Boolean);

const missing = [];

for (const file of files) {
  if (file.endsWith("lib/i18n/dictionary.ts")) continue;
  // git ls-files بيقرا الفهرس مش القرص، فملفّ اتمسح ولسه ما اتسجّلش
  // مسحه بيفضل في القائمة ويكسر الفحص كله بـENOENT - وده فشل بناء
  // سببه توقيت التسجيل لا خطأ حقيقي في الكود.
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");

  // ═══ ١) النداء الكامل: t(locale, "ns.key") ═══
  for (const m of src.matchAll(/\bt\(\s*[\w.]+\s*,\s*["'`]([\w]+\.[\w]+)["'`]/g)) {
    if (!available.has(m[1])) missing.push({ file, key: m[1] });
  }

  // ═══ ٢) النداء المختصر: tr("key") داخل ملفٍ له مساحةُ اسمٍ واحدة ═══
  //
  // تُستنتَج المساحة من تعريف `tr` نفسه. وإن تعدّدت في الملفّ الواحد لم
  // نستطع النسبة بثقة، فيُتخطّى - **إنذارٌ كاذبٌ واحد يُفقد الفحص قيمته**
  // لأنّ من يراه مرّتين يتجاهله بعدها.
  // 🔴 **كان يتخطّى الملفّ كلَّه إن تعدّدت فيه المساحات، ويفحص الاسم `tr`
  // وحده.** وثمنُ ذلك ثلاثةَ عشرَ ملفّاً من خمسةٍ وثمانين لا يُفحَص منها
  // حرفٌ - منها إحدى عشرة صفحةَ متجر - فوصل مفتاحان خامّان إلى الإنتاج
  // يقرؤهما المشترك: `productsPage.gap` و`storeReports.perMonth`.
  //
  // والعلّة أنّ التخطّي عولج كأنّه احتياط، وهو إسقاطٌ صامت. والصواب أن
  // يُنسَب كلُّ اسمٍ مستعارٍ إلى مساحته هو، فلا يبقى التباسٌ يُتّقى بالتخطّي.
  const aliases = new Map();
  // `const tr = (k) => t(locale, `ns.${k}`)`
  // 🔴 القالبُ كلُّه لا بدايتُه: `` `ns.${k}` `` وحدها تُنسَب.
  //
  // القالب `` `legal.${doc}.${id}${suffix}` `` يبدأ ببادئةٍ كذلك، لكنّ
  // مفتاحه يُركَّب من ثلاثة أجزاء - فنسبتُه إلى `legal` تُنتج `legal.Title`
  // وهو مفتاحٌ لا يناديه أحد. **وإنذارٌ كاذبٌ واحد يُفقد الفحص قيمته**،
  // فيُشترَط أن ينتهي القالب فور التعويض.
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*`([\w.]+)\.\$\{\w+\}`/g)) {
    aliases.set(m[1], m[2]);
  }
  // `const tp = (k) => t(locale, ("ns." + k))` - الصيغة بالجمع لا بالقالب
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*\(?\s*"([\w.]+)\."\s*\+/g)) {
    if (!aliases.has(m[1])) aliases.set(m[1], m[2]);
  }
  if (aliases.size === 0) continue;

  for (const [name, ns] of aliases) {
    const re = new RegExp(`\\b${name}\\(\\s*["'\`]([\\w]+)["'\`]`, "g");
    for (const m of src.matchAll(re)) {
      const path = `${ns}.${m[1]}`;
      if (!available.has(path)) missing.push({ file, key: path });
    }
  }
}

if (missing.length === 0) {
  console.log(`✓ كلّ مفتاحٍ يناديه الكود له نصّ - ${available.size} مفتاحاً متاحاً.`);
  process.exit(0);
}

console.error(`\n✗ ${missing.length} مفتاحاً يناديه الكود ولا نصّ له:\n`);
for (const { file, key } of missing.slice(0, 40)) {
  console.error(`   ${key}`);
  console.error(`      ${file}`);
}
if (missing.length > 40) console.error(`   … و${missing.length - 40} غيرها`);
console.error("\nكلّ واحدٍ منها يظهر للمستخدم مساراً خاماً على الشاشة.\n");
process.exit(1);
