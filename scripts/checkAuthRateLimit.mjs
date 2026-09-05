// scripts/checkAuthRateLimit.mjs
//
// بوّابة بناء: كلُّ مسارٍ عامٍّ في مجموعة المصادقة يحمل حدَّ معدّل.
//
// 🔴 **السبب: `verify-email` كان بلا حدّ معدّل، وحده بين مسارات المصادقة.**
//
// التوكن عشوائيّ ١٢٨-بت فالتخمينُ غيرُ عمليّ - لكنّ الغياب يترك بابَ
// **استنزاف** مفتوحاً: كلُّ نداءٍ يعمل استعلامَ قاعدةٍ، ونداءٌ غيرُ محدودٍ
// يحوّله إلى ضغطٍ مجّانيّ على أغلى مورد. أُصلح المسارُ نفسُه، لكنّ الإصلاح
// الواحد يعالج المسارَ لا الصنف: **أيُّ مسارِ مصادقةٍ جديدٍ يقع في نفس
// الحفرة بصمت.** هذه البوّابة تجعل النسيانَ يوقف البناء.
//
// النطاق: `app/api/auth/**` - وهي المسارات التي تُستدعى قبل وجود جلسة،
// فحدُّها الوحيد هو المعدّل. المسارات خلف جلسةٍ لها حدُّها الطبيعيّ
// (الجلسة نفسها) فلا تدخل هنا.

import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.join(process.cwd(), "app", "api", "auth");

// مساراتٌ لا تجرّب سرّاً ولا تكتب صفّاً ثقيلاً، فلا يلزمها حدٌّ:
//   logout - يمسح كوكي، بلا استعلام ولا سرّ يُخمَّن.
//   mfa/setup - خلف جلسةٍ قائمة، فالجلسةُ حدُّه.
const EXEMPT = new Set(["logout", "mfa/setup"]);

function walk(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.name === "route.ts") out.push(base);
  }
  return out;
}

if (!fs.existsSync(AUTH_DIR)) {
  console.error("app/api/auth غير موجود - تغيّر شكل المشروع، فحدِّث هذا الفحص.");
  process.exit(1);
}

const routes = walk(AUTH_DIR);
const missing = [];

for (const r of routes) {
  if (EXEMPT.has(r)) continue;
  const src = fs.readFileSync(path.join(AUTH_DIR, r, "route.ts"), "utf8");
  // خلف جلسةٍ؟ إذن الجلسةُ حدُّه، لا يلزم معدّل.
  // حدُّ الكلمة (`\b`) ضروريّ: بدونه `DISABLED_checkRateLimit(` يطابق
  // كأنّه استدعاءٌ حقيقيّ - وهو ما فوّت أوّلَ اختبارٍ سلبيّ لهذه البوّابة.
  const sessionGuarded = /\bgetSessionUser\(/.test(src);
  const rateLimited = /\bcheckRateLimit\(/.test(src);
  if (!sessionGuarded && !rateLimited) missing.push(r);
}

if (missing.length > 0) {
  console.error("مسارُ مصادقةٍ عامٌّ بلا حدّ معدّل - بابُ تخمينٍ واستنزاف:\n");
  for (const m of missing) console.error(`  • app/api/auth/${m}/route.ts`);
  console.error(
    "\nكلُّ مسارٍ يُستدعى قبل وجود جلسةٍ لازمه `checkRateLimit`." +
      "\nلو المسارُ فعلاً لا يلزمه (يمسح كوكي مثلاً)، أضِفه إلى EXEMPT هنا بسببٍ مكتوب."
  );
  process.exit(1);
}

console.log(`✓ كلّ مسارات المصادقة العامّة (${routes.length - EXEMPT.size}) عليها حدُّ معدّل.`);
