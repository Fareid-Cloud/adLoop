// scripts/db-push-safe.mjs
//
// يزامن بنية قاعدة البيانات مع prisma/schema.prisma أثناء البناء.
//
// 🔴 تغيير سلوك مقصود: كان السكربت يتجاهل الفشل ويُكمل النشر. النتيجة أن
// بناءً "ناجحاً" يُنشر فوق قاعدة بيانات ينقصها الأعمدة الجديدة، فتسقط كل
// صفحة تقرأ تلك الجداول - وهو ما حدث فعلاً على الإنتاج. الآن نُفشل البناء
// عند فشل المزامنة، فتُبقي منصة النشر النسخة السابقة العاملة بدل استبدالها
// بأخرى معطّلة.
//
// الاستثناء الوحيد: غياب DATABASE_URL تماماً (بناء محلي أو معاينة بلا
// قاعدة بيانات) - عندها نتخطى بهدوء لأنه لا يوجد ما يُزامَن أصلاً.

import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn("[db-push] DATABASE_URL غير مضبوط - تخطّي مزامنة البنية.");
  process.exit(0);
}

// عمليات تعديل البنية (DDL) لا تمرّ عبر connection pooler مثل pgbouncer
// في Neon وSupabase. إن وُفِّر DIRECT_URL نمرّره كـ DATABASE_URL لهذه
// العملية وحدها، فنحصل على اتصال مباشر دون وضع directUrl في المخطط
// (وضعه هناك يُفشل المخطط كلياً لدى كل من لم يضبط المتغيّر).
const directUrl = process.env.DIRECT_URL;

console.log(
  directUrl
    ? "[db-push] مزامنة البنية عبر الاتصال المباشر (DIRECT_URL)."
    : "[db-push] مزامنة البنية عبر DATABASE_URL (لم يُضبط DIRECT_URL)."
);

const res = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  shell: true,
  env: directUrl ? { ...process.env, DATABASE_URL: directUrl } : process.env,
});

if (res.status !== 0) {
  console.error(
    [
      "",
      "[db-push] فشلت مزامنة بنية قاعدة البيانات.",
      "البناء متوقف عمداً: نشر كود يتوقّع أعمدة غير موجودة يُسقط الموقع بالكامل.",
      "",
      "الأسباب الشائعة:",
      "  - DATABASE_URL يمر عبر connection pooler ولا يسمح بتعديل البنية.",
      "    الحل: اضبط DIRECT_URL بسلسلة الاتصال المباشر (بدون pooler).",
      "  - قاعدة البيانات متوقفة أو تجاوزت حصتها.",
      "  - تغيير في المخطط يتطلب تأكيداً يدوياً (احتمال فقدان بيانات).",
      "",
    ].join("\n")
  );
  process.exit(1);
}

console.log("[db-push] بنية قاعدة البيانات متزامنة.");
