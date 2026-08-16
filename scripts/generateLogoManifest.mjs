// scripts/generateLogoManifest.mjs
//
// يحسم **امتداد** ملفّ كلّ شعار وقت البناء، فيولّد جدولاً يقرأه المكوّن.
//
// 🔴 البديل الذي كان: يطلب المتصفّح `.svg`، فإن فشل جرّب `.png`، فإن فشل
// رسم. وهو يعمل، لكنّه يعني ثلاثة أشياء سيّئة: طلبٌ فاشل (٤٠٤) لكلّ علامة
// ملفّها PNG، وحالةٌ في العميل تُجبر المكوّن أن يكون `"use client"` فيُشحن
// جافاسكريبت لأجل صورة، ووميضٌ قبل أن يستقرّ على الامتداد الصحيح.
//
// والمجلّد معروفٌ وقت البناء، فلا سبب لاكتشافه وقت التشغيل.

import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const DIR = "public/logos";
const OUT = "lib/logoManifest.ts";

const map = {};
if (existsSync(DIR)) {
  for (const file of readdirSync(DIR)) {
    const m = file.match(/^([A-Z0-9_]+)\.(svg|png)$/);
    if (!m) continue;
    const [, key, ext] = m;
    // المتّجه يفوز على الصورة حين يوجد الاثنان: يكبر بلا تشوّه.
    if (map[key] === "svg") continue;
    map[key] = ext;
  }
}

const entries = Object.keys(map).sort().map((k) => `  ${k}: "${map[k]}",`).join("\n");

if (!existsSync("lib")) mkdirSync("lib", { recursive: true });
writeFileSync(
  OUT,
  `// lib/logoManifest.ts
//
// ⚠️ **مولَّد آلياً — لا يُحرَّر بيد.** يعيد \`scripts/generateLogoManifest.mjs\`
// كتابته في كلّ بناء من محتويات \`public/logos\`. أسقِط ملفّاً هناك وابنِ،
// فيظهر. احذفه وابنِ، فيعود إلى الرسم المضمَّن.

/** مفتاح العلامة ← امتداد ملفّها الرسميّ الموجود فعلاً */
export const LOGO_FILES: Record<string, "svg" | "png"> = {
${entries}
};
`,
  "utf8"
);

console.log(`[logo-manifest] ${Object.keys(map).length} شعاراً: ${Object.entries(map).map(([k, v]) => k + "." + v).join(", ")}`);
