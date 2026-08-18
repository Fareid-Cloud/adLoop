// scripts/checkPlatformCallsCounted.mjs
//
// بوّابة بناء: كلّ نداء منصّةٍ يمرّ على عدّاد.
//
// 🔴 **نداءٌ خام واحدٌ يُفسد الرقم كلَّه في اتجاهٍ خطير.** العدُّ هنا يُبنى
// عليه سقفُ تخصيصٍ لاحقاً؛ فإن نقص العدُّ عن الحقيقة بدا الحوض أوسعَ ممّا
// هو، ووُزِّع على مشتركين أكثر ممّا يحتمل، فانكشف الخطأ يوم `RESOURCE_EXHAUSTED`
// لا قبله. والزيادة عن الحقيقة تُضيّق فحسب، أمّا النقص فيُعطِب.
//
// ولا يُحرَس ذلك بالمراجعة: `await fetch(` سطرٌ يكتبه أيُّ أحدٍ في أيّ ملفٍّ
// جديد بحسن نيّة. فيُحرَس هنا.

import fs from "node:fs";
import path from "node:path";

const LIB = path.join(process.cwd(), "lib");
const HOSTS = ["graph.facebook.com", "business-api.tiktok.com"];
const SELF = "platformUsage.ts";

const problems = [];

for (const name of fs.readdirSync(LIB)) {
  if (!name.endsWith(".ts") || name === SELF) continue;
  const src = fs.readFileSync(path.join(LIB, name), "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    // نداء HTTP خام إلى مضيف منصّة: يُفحص السطر وما يليه، فالعنوان كثيراً
    // ما يقع في السطر التالي لـ`fetch(`
    if (/\bfetch\(/.test(line) && !/countedFetch\(/.test(line)) {
      const window = lines.slice(i, i + 3).join(" ");
      if (HOSTS.some((h) => window.includes(h))) {
        problems.push(`${name}:${i + 1}  fetch خام إلى مضيف منصّة`);
      }
    }
    // استعلام Google Ads خام
    if (/\.query\(/.test(line) && /customer\b/.test(line) && !/countedGoogleQuery\(/.test(line)) {
      problems.push(`${name}:${i + 1}  customer.query خام`);
    }
  });
}

if (problems.length > 0) {
  console.error("نداءات منصّاتٍ لا تمرّ على العدّاد:\n");
  for (const p of problems) console.error("  • " + p);
  console.error(
    `\nالمجموع: ${problems.length}. استعمل countedFetch أو countedGoogleQuery من lib/platformUsage.ts`
  );
  process.exit(1);
}

console.log("✓ كلّ نداءات المنصّات تمرّ على العدّاد.");
