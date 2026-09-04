// scripts/checkReadinessCoverage.mjs
//
// بوّابة بناء: كلُّ متغيّر بيئةٍ يقرؤه المنتج له صفٌّ في `READINESS`.
//
// 🔴 **السببُ أنّ الملفّ ادّعى ما لم يفعله.**
//
// `lib/launchReadiness.ts` يقول عن قائمته حرفياً إنّها «مغلقة ومشتقّة من
// الكود (grep على `process.env.`)، مش من الذاكرة». وحين جُرِد الكود فعلاً
// وُجد نحو خمسين متغيّراً وفي القائمة أربعةٌ وثلاثون. الفارقُ لم يكن
// ثانوياً كلَّه: **سرُّ تسجيل الدخول بجوجل وسرُّ فيسبوك كانا خارجها
// والمعرّفان بداخلها** - أي فحصُ نصفِ زوج، وهو لا يفحص شيئاً: شاشةٌ خضراء
// وتسجيلُ دخولٍ يفشل عند تبادل التوكن بعد أن وافق المستخدم.
//
// وهذه الشاشةُ هي الجوابُ على «هل نحن جاهزون للنشر؟». فما لا تراه **تعلنه
// جاهزاً بالسكوت** - وهو أسوأ من ألّا تكون موجودة، لأنّ الغياب يُسأل عنه
// والخُضرةَ الكاذبة لا يُسأل عنها أحد.
//
// والقائمةُ تشيخ بصمت: كلُّ متغيّرٍ جديدٍ يُقرأ في الكود يقع خارجها ما لم
// يتذكّر كاتبُه. هذا الفحص هو التذكير.

import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "lib"].map((d) => path.join(process.cwd(), d));

/**
 * ما لا يُنتظر له صفٌّ في القائمة، ولكلٍّ سببُه.
 *
 * القائمةُ صريحةٌ لا نمطية: `startsWith("VERCEL_")` كان سيبتلع متغيّراً
 * حقيقياً يوماً ما بلا أن يلاحظه أحد.
 */
const NOT_CONFIGURATION = new Set([
  // تحقنها المنصّة نفسها - لا يضبطها أحد ولا يمكن أن تنقص
  "NODE_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "NEXT_RUNTIME", "CI",
  // إعدادُ بناءٍ في `package.json` لا إعدادُ تشغيل
  "NODE_OPTIONS", "BUILD_CPUS",
  // أسماءٌ بديلةٌ لنفس الوصلة المباشرة؛ `DATABASE_URL_UNPOOLED` هو المُدرَج
  "DIRECT_URL", "POSTGRES_URL_NON_POOLING",
]);

const readiness = fs.readFileSync(
  path.join(process.cwd(), "lib", "launchReadiness.ts"),
  "utf8"
);
const listed = new Set(
  [...readiness.matchAll(/\{\s*key:\s*"([A-Z0-9_]+)"/g)].map((m) => m[1])
);

const used = new Map(); // KEY -> first file:line that reads it

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") continue;
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const src = fs.readFileSync(full, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      // التعليقاتُ تُتخطّى: هذا الملفُّ وأمثالُه يذكرون أسماءَ متغيّراتٍ
      // في الشرح، وعدُّها استعمالاً يجعل الفحص يشتكي من توثيقه نفسه.
      const code = line.replace(/\/\/.*$/, "");
      for (const m of code.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (!used.has(m[1])) {
          used.set(m[1], `${path.relative(process.cwd(), full).split(path.sep).join("/")}:${i + 1}`);
        }
      }
    });
  }
}
for (const root of ROOTS) if (fs.existsSync(root)) walk(root);

const missing = [...used.entries()]
  .filter(([key]) => !listed.has(key) && !NOT_CONFIGURATION.has(key))
  .sort();

// والعكسُ يهمّ أيضاً: صفٌّ لمتغيّرٍ لم يعد يُقرأ يعرض نقصاً لا يُسَدّ أبداً،
// وهو ما فعله `SALLA_WEBHOOK_SECRET` بعد أن صار مساره مُحالاً.
// تُقرأ خارج `app`/`lib` فلا يراها المسح، وصفُّها في القائمة صحيحٌ ولازم:
// `DATABASE_URL` يقرؤها Prisma من `schema.prisma` نفسه لا من كود التطبيق -
// وهي أهمُّ صفٍّ في الشاشة كلّها، فاستبعادُها لأنّ المسح لم يرها كان
// سيحذف البند الوحيد الذي يعني «الموقع كلّه واقف».
const CONFIG_ONLY = new Set([
  "DATABASE_URL", "DATABASE_URL_UNPOOLED",
  "SENTRY_DSN", "SENTRY_ORG", "SENTRY_PROJECT", "NEXT_PUBLIC_SENTRY_DSN",
]);
const stale = [...listed].filter((k) => !used.has(k) && !CONFIG_ONLY.has(k)).sort();

let failed = false;

if (missing.length > 0) {
  failed = true;
  console.error("متغيّراتٌ يقرؤها الكود وليس لها صفٌّ في READINESS:\n");
  for (const [key, where] of missing) console.error(`  • ${key}  ←  ${where}`);
  console.error(
    "\nشاشةُ الجاهزية لا تراها، فتعلنها مضبوطةً بالسكوت." +
      "\nأضِف صفّاً في lib/launchReadiness.ts يقول ماذا يقف لو غاب،" +
      "\nأو أضِفه إلى NOT_CONFIGURATION هنا مع سببٍ مكتوب."
  );
}

if (stale.length > 0) {
  failed = true;
  console.error("\nصفوفٌ في READINESS لمتغيّراتٍ لم يعد الكود يقرؤها:\n");
  for (const key of stale) console.error("  • " + key);
  console.error(
    "\nالصفُّ ده بيعرض نقصاً مستحيلاً يُسَدّ - وشاشةُ جاهزيةٍ بتكذب في بندٍ" +
      "\nواحد بتفقد ثقتَها في البنود كلّها. احذفه، أو رجّع استعماله."
  );
}

if (failed) process.exit(1);

console.log(
  `✓ شاشة الجاهزية تغطّي كلّ ما يقرؤه الكود - ${listed.size} صفّاً مقابل ${used.size} متغيّراً.`
);
