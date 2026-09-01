// scripts/verify-nav-icons.mjs
//
// يتحقق أن كل اسم أيقونة في navConfig موجود فعلاً في مكتبة lucide.
//
// السبب: اسم أيقونة غير موجود يُرجع undefined عند العرض، فيُرمى
// React error #130 داخل layout اللوحة - وهو خطأ لا تلتقطه أي حدود خطأ،
// فيُسقط **كل** صفحات البرنامج. حدث ذلك فعلاً في الإنتاج.
//
// الفحص هنا يجعل الخطأ يظهر وقت البناء لا بعد النشر. الكود نفسه يحتوي
// بديلاً مضموناً أيضاً - طبقتا حماية لا واحدة.

import { readFileSync } from "node:fs";
import * as Icons from "lucide-react";

const src = readFileSync("lib/navConfig.ts", "utf8");
const names = [...src.matchAll(/iconName:\s*"([^"]+)"/g)].map((m) => m[1]);

// أيقوناتٌ مرسومةٌ عندنا لا في lucide (شعار MCP مثلاً). تُقرأ من
// `resolveIcon` نفسها لا تُكتب هنا ثانيةً: قائمتان تفترقان عند أوّل
// إضافة، فيعود الفحص يرفض اسماً صحيحاً أو يُمرّر اسماً يُسقط اللوحة.
const nav = readFileSync("app/components/SidebarNav.tsx", "utf8");
const local = new Set(
  [...nav.matchAll(/name\s*===\s*"([^"]+)"/g)].map((m) => m[1])
);

const missing = [...new Set(names)].filter((n) => !(n in Icons) && !local.has(n));

if (missing.length > 0) {
  console.error(
    [
      "",
      "[nav-icons] أسماء أيقونات غير موجودة في lucide-react:",
      ...missing.map((m) => `  - ${m}`),
      "",
      "هذه الأسماء ستُرجع undefined وقت العرض وتُسقط اللوحة بالكامل.",
      "صحّحها في lib/navConfig.ts.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

console.log(
  `[nav-icons] ${names.length} اسم أيقونة، كلها صالحة` +
    (local.size ? ` (منها ${local.size} مرسومة عندنا).` : ".")
);
