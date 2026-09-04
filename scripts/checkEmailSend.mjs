// scripts/checkEmailSend.mjs
//
// بوّابة بناء: كلُّ إيميل يمرّ من `lib/sendEmail.ts`.
//
// 🔴 **السببُ عطلٌ وقع فعلاً، ولم يُصدر صوتاً.**
//
// مكتبةُ Resend لا ترمي استثناءً حين يرفض الـAPI - ترجّع `{ data, error }`.
// وكلُّ نداءٍ في المنتج كان `await resend.emails.send(...)` داخل
// `try/catch`، والـ`catch` لا يُنفَّذ لأنّ شيئاً لم يُرمَ. فرفضُ المزوّد
// (نطاقٌ غير موثَّق، عنوانٌ غير صالح، تجاوزُ حدّ) كان يمرّ **كنجاح**:
// المسار يرجّع 200، والسجلُّ صامت، والرسالةُ غير موجودة.
//
// اتكشف حين لم تصل دعوةُ فريق - أي بعد أن انتظر أحدٌ رسالةً لم تُرسَل.
// وثلاثةَ عشرَ موضعاً كانت تحمل العطلَ نفسه، منها إعادةُ تعيين كلمة السرّ
// وكودُ التحقّق بخطوتين وإشعارُ التجديد.
//
// والغلافُ يقرأ `error` ويرجّع نتيجةً يمكن فحصُها. هذا الفحص يمنع العودة
// إلى النداء المباشر في أوّل ملفٍّ جديد.

import fs from "node:fs";
import path from "node:path";

const ROOTS = [path.join(process.cwd(), "app"), path.join(process.cwd(), "lib")];
const ALLOWED = path.join("lib", "sendEmail.ts");

const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full);
      continue;
    }
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;

    const rel = path.relative(process.cwd(), full);
    if (rel.endsWith(ALLOWED)) continue;

    const src = fs.readFileSync(full, "utf8");
    if (/\.emails\.send\s*\(/.test(src)) {
      const lineNo = src.slice(0, src.search(/\.emails\.send\s*\(/)).split("\n").length;
      offenders.push(`${rel.split(path.sep).join("/")}:${lineNo}`);
    }
  }
}

for (const root of ROOTS) if (fs.existsSync(root)) walk(root);

if (offenders.length > 0) {
  console.error("نداءُ بريدٍ مباشر خارج lib/sendEmail.ts - رفضُ المزوّد سيمرّ كنجاح:\n");
  for (const o of offenders) console.error("  • " + o);
  console.error(
    `\nالمجموع: ${offenders.length}.` +
      "\nاستعمل sendEmail من lib/sendEmail.ts - هي التي تقرأ حقل error." +
      "\nمكتبة Resend لا ترمي استثناءً عند الرفض، فالـtry/catch حولها لا يلتقط شيئاً."
  );
  process.exit(1);
}

console.log("✓ كلّ إرسال بريدٍ يمرّ من lib/sendEmail.ts، ورفضُ المزوّد يُقرأ.");
