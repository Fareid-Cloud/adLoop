// scripts/build-next.mjs
//
// يشغّل `next build` برفع سقف ذاكرة Node.
//
// **لماذا سكربت بدل سطر واحد:** الصيغة `NODE_OPTIONS=... next build` تعمل
// على Linux (بيئة النشر) وتفشل على Windows - فكان البناء المحلّي مستحيلاً
// على جهاز المطوّر، أي أنّ أخطاء البناء لا تُكتشف إلّا بعد الدفع. Node
// يقرأ `NODE_OPTIONS` من بيئة العملية على النظامين، فتمريره هنا يعمل عليهما.
//
// سقف الذاكرة ليس تحسيناً: البناء كان يسقط بـSIGKILL/OOM على Vercel.

import { spawnSync } from "node:child_process";

const res = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=6144`.trim(),
  },
});

process.exit(res.status ?? 1);
