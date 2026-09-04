// scripts/checkWaClickParity.mjs
//
// بوّابة بناء: جدولُ `wa_clicks` معرَّفٌ مرّتين، والتعريفان لازم يتطابقا.
//
// 🔴 **السببُ بندٌ من الأوديت لسه مفتوح (BI-11).**
//
// المنتجُ والمتتبّع بيشاركوا **نفس قاعدة البيانات**، وجدولُ `wa_clicks`
// معرَّفٌ في مكانين مستقلّين تماماً ومفيش حاجة رابطاهم:
//
//   • `wa-conversion-tracker/lib/db.ts` — `CREATE TABLE IF NOT EXISTS`
//   • `adloop-saas/prisma/schema.prisma` — `model WaClick`
//
// **والخطرُ في `IF NOT EXISTS` بالذات:** بعد أوّل إنشاءٍ بتبقى لا-عملية.
// فلو حدٌّ زوّد عموداً في المتتبّع، السطرُ بيمشي بلا خطأ **وما بيعملش
// حاجة** - والعمودُ مش موجودٌ في القاعدة. ولو زوّده في الشيما، `db push`
// بيضيفه وكودُ المتتبّع مش عارف بيه. وفي الاتّجاهين **مافيش رسالةُ خطأٍ
// واحدة**: الانحرافُ بيظهر كصفٍّ ناقص، أو ككليكٍ مابيتسجّلش، أو كرسالةِ
// واتساب مابتتطابقش - يعني **كرقمٍ متحقَّقٍ أقلّ من الحقيقة**، وهي دعوى
// المنتج كلّها.
//
// والأسوأ إنّ `db push` **بيمسح أيّ جدولٍ مش معرَّف في الشيما** - فوجودُ
// الجدول أصلاً معلَّقٌ على بقاء التعريفين متطابقين بإيد. الفحصُ ده بيخلّي
// «بإيد» تبقى «بالبناء».
//
// **وبيتخطّى بهدوءٍ لو المتتبّع مش موجود** (Vercel بيسحب مستودعاً واحداً
// بس): الغرضُ إمساكُ الانحراف على جهاز المطوِّر قبل ما يترفع، لا تفشيلُ
// كلّ نشرةٍ لأنّ المجلّد الشقيق مش هناك.

import fs from "node:fs";
import path from "node:path";

const TRACKER_DB = path.join(process.cwd(), "..", "wa-conversion-tracker", "lib", "db.ts");
const SCHEMA = path.join(process.cwd(), "prisma", "schema.prisma");

if (!fs.existsSync(TRACKER_DB)) {
  console.log("• wa_clicks: مستودع المتتبّع غير موجود جنب المنتج - تُخطّي المقارنة (طبيعيّ على Vercel).");
  process.exit(0);
}

// ── الجانب الخام: CREATE TABLE في المتتبّع ─────────────────────────────
const trackerSrc = fs.readFileSync(TRACKER_DB, "utf8");
const createMatch = trackerSrc.match(/CREATE TABLE IF NOT EXISTS\s+wa_clicks\s*\(([\s\S]*?)\)\s*;/i);
if (!createMatch) {
  console.error("لم يُعثر على CREATE TABLE لـwa_clicks في المتتبّع - تغيّر شكل الملفّ، فحدِّث هذا الفحص.");
  process.exit(1);
}

const sqlColumns = new Map(); // name -> { nullable }
for (const rawLine of createMatch[1].split("\n")) {
  const line = rawLine.replace(/--.*$/, "").trim().replace(/,$/, "");
  if (!line) continue;
  const m = line.match(/^([a-z_]+)\s+([A-Z]+)/i);
  if (!m) continue;
  const name = m[1];
  const isPk = /PRIMARY KEY/i.test(line);
  const notNull = /NOT NULL/i.test(line) || isPk;
  sqlColumns.set(name, { nullable: !notNull });
}

const sqlIndexes = new Set(
  [...trackerSrc.matchAll(/CREATE INDEX IF NOT EXISTS\s+([a-z_]+)\s+ON\s+wa_clicks/gi)].map((m) => m[1])
);

// ── الجانب المُدار: model WaClick في الشيما ────────────────────────────
const schemaSrc = fs.readFileSync(SCHEMA, "utf8");
const modelMatch = schemaSrc.match(/model WaClick \{([\s\S]*?)\n\}/);
if (!modelMatch) {
  console.error("لم يُعثر على model WaClick في schema.prisma.");
  process.exit(1);
}

const prismaColumns = new Map();
const prismaIndexes = new Set();
for (const rawLine of modelMatch[1].split("\n")) {
  const line = rawLine.replace(/\/\/\/.*$/, "").replace(/\/\/.*$/, "").trim();
  if (!line) continue;

  // 🔴 لا تستعمل `@@index\([^)]*map:` هنا: `[^)]*` بتقف عند أوّل قوسٍ
  // مغلق، و`createdAt(sort: Desc)` فيها واحدٌ قبل `map:` - فالفهرسُ
  // المركَّب كان بيتفوّت والفحصُ بيبلّغ انحرافاً مش موجود. وإنذارٌ كاذبٌ
  // في بوّابةِ بناءٍ أسوأ من غيابها: بيتعوّد الناسُ يتخطّوها.
  const idx = line.startsWith("@@index") ? line.match(/map:\s*"([a-z_]+)"/) : null;
  if (idx) { prismaIndexes.add(idx[1]); continue; }
  if (line.startsWith("@@")) continue;

  const f = line.match(/^(\w+)\s+(\w+)(\?)?/);
  if (!f) continue;
  const mapped = line.match(/@map\("([a-z_]+)"\)/);
  // بلا `@map` يكون اسمُ العمود هو اسمُ الحقل حرفياً - ليس snake_case.
  prismaColumns.set(mapped ? mapped[1] : f[1], { nullable: !!f[3] });
}

// ── المقارنة ──────────────────────────────────────────────────────────
const problems = [];

for (const [name, { nullable }] of sqlColumns) {
  const p = prismaColumns.get(name);
  if (!p) {
    problems.push(`العمود \`${name}\` بينشئه المتتبّع ومش معرَّف في الشيما — **\`db push\` هيمسح الجدول أو العمود**`);
  } else if (p.nullable !== nullable) {
    problems.push(
      `العمود \`${name}\`: المتتبّع ${nullable ? "بيسمح بالفراغ" : "بيمنع الفراغ"}` +
        ` والشيما ${p.nullable ? "بتسمح" : "بتمنع"} — الكتابةُ من ناحيةٍ هتفشل عند التانية`
    );
  }
}
for (const name of prismaColumns.keys()) {
  if (!sqlColumns.has(name)) {
    problems.push(`العمود \`${name}\` في الشيما ومش في \`CREATE TABLE\` بتاع المتتبّع — قاعدةٌ جديدة هتقوم بلا العمود ده`);
  }
}
for (const ix of sqlIndexes) {
  if (!prismaIndexes.has(ix)) {
    problems.push(`الفهرس \`${ix}\` بينشئه المتتبّع ومش معلَنٌ في الشيما — **\`db push\` بيحذفه**، فالاستعلام بيرجع مسحاً كاملاً بصمت`);
  }
}
for (const ix of prismaIndexes) {
  if (!sqlIndexes.has(ix)) {
    problems.push(`الفهرس \`${ix}\` في الشيما ومش في المتتبّع — فرقٌ مقبولٌ غالباً، بس اتأكّد إنّه مقصود`);
  }
}

if (problems.length > 0) {
  console.error("انحرافٌ بين تعريفَي `wa_clicks` — المنتج والمتتبّع بيشاركوا نفس القاعدة:\n");
  for (const p of problems) console.error("  • " + p);
  console.error(
    "\nالتعريفان:" +
      "\n  • wa-conversion-tracker/lib/db.ts   (CREATE TABLE IF NOT EXISTS)" +
      "\n  • prisma/schema.prisma              (model WaClick)" +
      "\n\n⚠️ `IF NOT EXISTS` بتبقى لا-عملية بعد أوّل إنشاء، فتعديلُ المتتبّع وحده" +
      "\nمابيغيّرش القاعدة ومابيرميش خطأً. عدِّل الاتنين معاً."
  );
  process.exit(1);
}

console.log(
  `✓ تعريفا wa_clicks متطابقان - ${sqlColumns.size} عموداً و${sqlIndexes.size} فهرساً في المشروعين.`
);
