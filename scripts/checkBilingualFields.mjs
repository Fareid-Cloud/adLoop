// scripts/checkBilingualFields.mjs
//
// 🔴 **حقلٌ عربيٌّ يُعرَض بلا فحصِ اللغة.**
//
// حين يحمل الكائن نسختين (`labelAr` و`labelEn`)، فعرضُ العربية مباشرةً
// يُظهر نصّاً عربياً وسط واجهةٍ إنجليزية - **وبخطٍّ ليس خطّنا**، لأنّ الحرف
// العربيّ يسقط إلى خطّ النظام حين تكون الصفحة إنجليزية.
//
// و`checkArabicLeaks` لا يلتقطه: النصّ ليس مثبَّتاً في المكوّن، بل يأتي من
// بياناتٍ صحيحةٍ تحمل الترجمتين - والعطب في **الاختيار** لا في المصدر.
//
// القاعدة: أيّ `‹شيء›.xxxAr` يُعرَض داخل JSX يجب أن يكون معه فحصُ لغة.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

// `app/**/*.tsx` يطابق المتداخل وحده، فكانت ثلاثة ملفّاتٍ في الجذر خارج
// الفحص - ومنها `app/layout.tsx` و`app/page.tsx`، أيْ صفحةُ الهبوط والقشرة
// التي تلفّ المنتج كلَّه. النمطان معاً يغطّيان الجذر والمتداخل.
const files = execSync('git ls-files "app/*.tsx" "app/**/*.tsx"', { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

const offenders = [];

for (const file of files) {
  // git ls-files بيقرا الفهرس مش القرص، فملفّ اتمسح ولسه ما اتسجّلش
  // مسحه بيفضل في القائمة ويكسر الفحص كله بـENOENT - وده فشل بناء
  // سببه توقيت التسجيل لا خطأ حقيقي في الكود.
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\{([\w.]+\.\w+Ar)\}/g)) {
    // السياق: هل يظهر اختيارُ لغةٍ في السطر نفسه أو الذي قبله؟
    const at = m.index ?? 0;
    const lineStart = src.lastIndexOf("\n", src.lastIndexOf("\n", at) - 1);
    const context = src.slice(Math.max(0, lineStart), at + m[0].length);
    if (/locale\s*===|\bbi\(|isAr|\bar\s*\?/.test(context)) continue;
    const line = src.slice(0, at).split("\n").length;
    offenders.push({ file, line, expr: m[1] });
  }
}

if (offenders.length === 0) {
  console.log("✓ كلّ حقلٍ ثنائيّ اللغة يُعرَض بحسب لغة الواجهة.");
  process.exit(0);
}

console.error(`\n✗ ${offenders.length} حقلاً عربياً يُعرَض بلا فحصِ لغة:\n`);
for (const o of offenders) console.error(`   ${o.file}:${o.line}  →  ${o.expr}`);
console.error("\nكلٌّ منها يُظهر عربيةً وسط الإنجليزية بخطٍّ ليس خطّنا.\n");
process.exit(1);
