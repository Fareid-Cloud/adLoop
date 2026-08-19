// scripts/checkCronAuth.mts
//
// **يشغّل حارس الكرون فعلاً، ويتأكّد إنّ كلّ مسارٍ مجدول بيمرّ منه.**
//
// 🔴 وُلد الفحص ده من ثغرتين حقيقيتين، الاتنين بيظهروا لمّا `CRON_SECRET`
// ما يكونش مضبوطاً - وهي حالةٌ عاديّة جداً في بيئةٍ جديدة أو معاينة:
//   • خمسة مسارات كانت بتقارن مع `` `Bearer ${process.env.CRON_SECRET}` ``
//     فبيطلع النصّ "Bearer undefined"، وأي طلبٍ بالهيدر ده بيعدّي.
//   • `marketing-emails` كان `if (secret && ...)` - يعني السرّ الناقص
//     بيتخطّى الحارس كلّه ويفتح المسار للعالم.
//
// الاتنين بيعدّوا من `tsc` ومن البناء سالمين، وما بيظهروش غير لمّا حد
// يستغلّهم. عشان كده الفحص هنا بينفّذ الدالّة الحقيقية على حالاتٍ ملفَّقة
// بدل ما يقرأ الكود، وبيفحص كمان إنّ مافيش مسارٌ رجع للنمط القديم.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { denyUnlessCron } from "../lib/cronAuth.ts";

let failed = 0;
const ok = (name: string, pass: boolean) => {
  if (!pass) failed++;
  console.log((pass ? "  " : "✗ ") + name);
};

function reqWith(authorization?: string): NextRequest {
  return new NextRequest("https://example.test/api/cron/x", {
    headers: authorization ? { authorization } : {},
  });
}

// ==================== ١) سلوك الحارس نفسه ====================

const SECRET = "s3cr3t-value-for-the-test";

// (أ) من غير سرٍّ مضبوط: كلّ شيء يُرفض - ده جوهر "الفشل المقفول"
delete process.env.CRON_SECRET;
ok("بلا سرٍّ مضبوط: طلبٌ بلا ترويسة يُرفض", denyUnlessCron(reqWith()) !== null);
ok(
  'بلا سرٍّ مضبوط: "Bearer undefined" يُرفض (الثغرة الأصلية)',
  denyUnlessCron(reqWith("Bearer undefined")) !== null
);
ok(
  "بلا سرٍّ مضبوط: أيّ سرٍّ صحيحٍ سابقاً يُرفض",
  denyUnlessCron(reqWith(`Bearer ${SECRET}`)) !== null
);

// (ب) بسرٍّ مضبوط: الصحيح وحده يعدّي
process.env.CRON_SECRET = SECRET;
ok("بسرٍّ مضبوط: الترويسة الصحيحة تعدّي", denyUnlessCron(reqWith(`Bearer ${SECRET}`)) === null);
ok("بسرٍّ مضبوط: ترويسة غلط تُرفض", denyUnlessCron(reqWith("Bearer wrong")) !== null);
ok("بسرٍّ مضبوط: بلا ترويسة يُرفض", denyUnlessCron(reqWith()) !== null);
ok(
  'بسرٍّ مضبوط: "Bearer undefined" يُرفض',
  denyUnlessCron(reqWith("Bearer undefined")) !== null
);
ok(
  "بسرٍّ مضبوط: السرّ بلا بادئة Bearer يُرفض",
  denyUnlessCron(reqWith(SECRET)) !== null
);
ok(
  "بسرٍّ مضبوط: بادئةٌ مطابقةٌ جزئياً تُرفض",
  denyUnlessCron(reqWith(`Bearer ${SECRET.slice(0, -1)}`)) !== null
);

// ==================== ٢) كلّ مسارٍ مجدول يمرّ من الحارس ====================

const CRON_DIR = "app/api/cron";
const routes = readdirSync(CRON_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(CRON_DIR, d.name, "route.ts"));

console.log(`\n  ${routes.length} مسار كرون:`);
for (const path of routes) {
  const src = readFileSync(path, "utf8");
  // التعليقات بتذكر اسم المتغيّر بشكلٍ مشروع - الممنوع هو قراءته في كود
  const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const usesGuard = code.includes("denyUnlessCron(");
  const readsRaw = code.includes("process.env.CRON_SECRET");
  ok(`${path.replace(/\\/g, "/")}: يمرّ من denyUnlessCron`, usesGuard);
  ok(`${path.replace(/\\/g, "/")}: لا يقرأ CRON_SECRET مباشرةً`, !readsRaw);
}

console.log(
  failed === 0
    ? "\n✓ حارس الكرون يفشل مقفولاً، وكلّ مسارٍ مجدول يمرّ منه."
    : `\n✗ ${failed} حالة فاشلة`
);
process.exit(failed === 0 ? 0 : 1);
