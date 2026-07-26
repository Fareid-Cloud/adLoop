// scripts/db-push-safe.mjs
//
// بيشغّل `prisma db push` أثناء البناء، لكن **لا يُفشل البناء** لو قاعدة
// البيانات مش متاحة لحظتها (توقف مؤقت، تجاوز حصة، انقطاع شبكة). النشر
// بيكمل وبيطبع تحذير واضح - أفضل من إن نشر كامل يفشل بسبب عطل مؤقت.
// (سكربت Node بدل `||` في package.json عشان يشتغل على كل الأنظمة.)

import { spawnSync } from "node:child_process";

const res = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  shell: true,
});

if (res.status !== 0) {
  console.warn(
    "\n⚠️  تعذّر تشغيل prisma db push (قاعدة البيانات غير متاحة الآن).\n" +
      "   البناء سيكمل، لكن أي جداول/أعمدة جديدة لن تُنشأ حتى تُشغّل:  npm run db:push\n"
  );
}
process.exit(0);
