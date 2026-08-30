// scripts/checkArabicLeaks.mjs
//
// نصّ عربيّ مثبَّت داخل مكوّن.
//
// **لماذا هذا الملفّ موجود:** «عربي في الإنجليزي» أُبلغ عنه أكثر من ثلاث
// مرّات، وفي كلّ مرّة كان موضعاً جديداً لا يمسكه المترجم ولا فحص القاموس -
// لأنّ الكود سليم تماماً، وكلّ ما في الأمر أنّ الجملة مكتوبة بحرفها في
// الواجهة. لا يظهر إلّا لعينٍ إنجليزية تفتح تلك الصفحة بالذات.
//
// الفحص يقرأ الشجرة النحوية لا النصّ: التعليقات (وأكثرها عربيّ عمداً في
// هذا المشروع) ليست عُقَد نصّ في JSX، فتسقط من الفحص بحكم بنيته لا بحيلة.
//
// التشغيل: `node scripts/checkArabicLeaks.mjs`

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ARABIC = /[؀-ۿ]/;
const ROOT = "app";

/** خصائص يقرؤها المستخدم بعينه - لا `className` ولا `href` */
const VISIBLE_ATTRS = new Set(["placeholder", "title", "alt", "aria-label", "label", "aria-description"]);

/**
 * استثناءات بقرار، لا بإهمال. كلّ سطر هنا يحمل سببه.
 *
 * - `app/admin` : لوحة المالك، عربية بالكامل وليست واجهة عميل.
 * - `global-error` : يستبدل `<html>` نفسه فلا `locale` يصل إليه، ولا
 *   يستورد القاموس عمداً لأنّه يعمل حين يفشل كلّ ما عداه. مكتوب باللغتين
 *   معاً - وهو ما يجعل العربية فيه مقصودة لا مسرَّبة.
 */
const ALLOW = [/^app[\\/]admin[\\/]/, /^app[\\/]global-error\.tsx$/];

const findings = [];
/** رسائل الواجهة البرمجية: تُعرَض ولا تُسقط البناء - راجع التعليق أدناه */
const apiFindings = [];

function walkDir(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walkDir(p); continue; }
    if (!name.endsWith(".tsx")) continue;
    const rel = relative(".", p);
    if (ALLOW.some((re) => re.test(rel))) continue;
    scan(p, rel);
  }
}

function scan(path, rel) {
  const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const report = (node, text) => {
    const { line } = src.getLineAndCharacterOfPosition(node.getStart());
    findings.push({ rel, line: line + 1, text: text.trim().replace(/\s+/g, " ").slice(0, 70) });
  };

  (function visit(node) {
    // نصّ ظاهر مباشرةً بين وسمين
    if (ts.isJsxText(node) && ARABIC.test(node.text)) report(node, node.text);

    // 🔴 **ونصٌّ داخل تعبيرٍ بين وسمين: `{ar ? "مرحباً" : "Hello"}`.**
    //
    // لم يكن يُفحَص، لأنّه ليس `JsxText` ولا خاصّية - بل حرفيّةٌ داخل
    // `JsxExpression`. ومرّ به عشرون نصّاً في مكوّنين جديدين مرورَ الكرام،
    // كلٌّ منها لغتان مكتوبتان بيدٍ خارج القاموس: فلا يراهما مترجِمٌ، ولا
    // يمسك تكافؤَهما فحصُ القاموس، ولا يُغيَّران إلّا بتعديل الكود.
    //
    // والنمط يبدو بريئاً لأنّه ثنائيّ اللغة ظاهرياً - وهو بالضبط ما يجعله
    // يفلت من العين البشرية أيضاً.
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ARABIC.test(node.text)) {
      // داخل تعبيرٍ في JSX فقط - لا كلّ حرفيّةٍ في الملفّ (المفاتيح والأصناف
      // والمسارات تمرّ بلا معنى لو فُحصت).
      let p = node.parent;
      while (p && !ts.isJsxExpression(p) && !ts.isJsxAttribute(p)) p = p.parent;
      // حرفان عربيّان على الأقلّ: الفاصلةُ «،» وحدَها فاصلٌ لا نصٌّ يُترجَم،
      // والإبلاغ عنها ضجيجٌ يُفقد الفحصَ قيمته.
      if (p && ts.isJsxExpression(p) && (node.text.match(/[؀-ۿ]/g) || []).length >= 2) {
        report(node, node.text);
      }
    }

    // خاصّية يقرؤها المستخدم بقيمة نصّية
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText();
      if (VISIBLE_ATTRS.has(name)) {
        const init = node.initializer;
        const lit = ts.isStringLiteral(init)
          ? init
          : ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)
          ? init.expression
          : null;
        if (lit && ARABIC.test(lit.text)) report(node, `${name}="${lit.text}"`);
      }
    }

    ts.forEachChild(node, visit);
  })(src);
}

walkDir(ROOT);
scanApiErrors();

/**
 * رسائل الخطأ في مسارات الواجهة البرمجية.
 *
 * 🔴 أضيف بعد أن ظهرت «Google Ads غير مربوط…» داخل نافذة إنجليزية: الفحص
 * كان يقرأ JSX وحده، ورسالة تُبنى في `NextResponse.json({ error })` ليست
 * JSX - فتمرّ. وهي تُعرض للمستخدم كما هي تماماً كأيّ نصّ في الواجهة.
 *
 * ما لا يُفحص عمداً: `console.error` و`throw new Error` - سجلّات وأخطاء
 * داخلية لا يقرؤها عميل، وعربيّتها مقصودة في هذا المشروع.
 */
function scanApiErrors() {
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (name !== "route.ts") continue;
      const rel = relative(".", p);
      if (ALLOW.some((re) => re.test(rel))) continue;

      const src = ts.createSourceFile(p, readFileSync(p, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      (function visit(node) {
        // `{ error: "نصّ عربيّ" }` في أيّ موضع
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText() === "error" &&
          ts.isStringLiteral(node.initializer) &&
          ARABIC.test(node.initializer.text)
        ) {
          const { line } = src.getLineAndCharacterOfPosition(node.getStart());
          apiFindings.push({ rel, line: line + 1, text: node.initializer.text.slice(0, 70) });
        }

        // 🔴 **والنصّ المُسنَد إلى متغيّر ثمّ المُمرَّر كخطأ.**
        // الفحص أعلاه يرى `error: "..."` مباشرةً وحدها، فمرّ من تحته نمطٌ
        // كامل: `const message = cond ? "نصّ" : \`نصّ\`` ثمّ
        // `{ error: message }`. وُجد هكذا في مسارَي الفحص العميق وجودة
        // الصور - رسالتان تُعرضان لكلّ مستخدم إنجليزيّ بالعربية.
        //
        // أيّ متغيّر باسمٍ يدلّ على رسالة، قيمتُه نصٌّ عربيّ أو شرطيّةٌ
        // أحد طرفيها عربيّ، يُعدّ تسريباً.
        if (
          ts.isVariableDeclaration(node) &&
          /^(message|msg|error|errorMessage|reason|text)$/i.test(node.name.getText()) &&
          node.initializer
        ) {
          const parts = ts.isConditionalExpression(node.initializer)
            ? [node.initializer.whenTrue, node.initializer.whenFalse]
            : [node.initializer];
          for (const part of parts) {
            const raw =
              ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part)
                ? part.text
                : ts.isTemplateExpression(part)
                  ? part.getText()
                  : null;
            if (raw && ARABIC.test(raw)) {
              const { line } = src.getLineAndCharacterOfPosition(node.getStart());
              apiFindings.push({ rel, line: line + 1, text: raw.replace(/\s+/g, " ").slice(0, 70) });
              break;
            }
          }
        }
        ts.forEachChild(node, visit);
      })(src);
    }
  };
  walk(join(ROOT, "api"));
}

// ── رسائل الواجهة البرمجية: تُسقط البناء ────────────────────────────
//
// وُجد ٦٨ منها دفعةً واحدة عند إضافة هذا الفحص، فكانت تُعرَض تحذيراً لا
// خطأً: إسقاط البناء على دَينٍ قديم يوقف النشر على ما ليس جديداً.
//
// **والدَّين سُدِّد بالكامل (٩ أغسطس ٢٠٢٦):** الثمانٍ والستّون كلّها صارت
// مفاتيح قاموس تُترجَم بلغة قارئها، وثمانٍ منها في مسارات الآلة
// (`attribution/*`) صارت معرّفاتٍ إنجليزيةً ثابتة - لا يقرؤها بشر.
//
// فالتحذير يصير خطأً الآن: الرقم صفر، وأيّ رسالةٍ جديدة بالعربية تُسقط
// البناء عند كاتبها لا بعد شهرٍ عند مستخدمٍ إنجليزيّ يقرؤها في أسوأ لحظة.
if (apiFindings.length > 0) {
  console.error(`
✗ ${apiFindings.length} رسالة خطأ عربية في مسارات الواجهة البرمجية - يراها مستخدم الواجهة الإنجليزية كما هي.
  اكتبها مفتاحاً في القاموس تحت \`apiErr\`، واقرأ اللغة بـ\`localeOf(user)\` أو \`localeOfRequest(req)\`:\n`);
  for (const f of apiFindings) console.error(`   ${f.rel}:${f.line}  «${f.text}»`);
  process.exit(1);
}

// ── دَينٌ موروث، بعددٍ مرصود لكلّ ملفّ ─────────────────────────────
//
// وُسّع هذا الفحص ليرى النصّ داخل تعبيرٍ في JSX (`{ar ? "…" : "…"}`)، فكشف
// أربعةً وثلاثين نصّاً في خمسة ملفّاتٍ **سابقةٍ لهذا التوسيع**. وإسقاطُ
// البناء عليها يعاقب من لم يكتبها ويُعطّل الجميع، وتجاهلُها يعيد الفحص إلى
// عماه.
//
// فالعدد مرصودٌ لكلّ ملفّ: الدَّين لا يزيد أبداً - أيّ نصٍّ جديد في هذه
// الملفّات نفسها يُسقط البناء - **ولا يُنسى**، لأنّه مكتوبٌ هنا بالأرقام.
// وكلّما نُقل نصٌّ إلى القاموس نقص رقمُه هنا حتى يبلغ صفراً فيُحذف سطرُه.
// **الدَّين سُدِّد.** الأربعةُ والثلاثون نُقلت إلى القاموس: نموذجُ التسجيل
// بعشرين نصّاً، وتدفّقُ الإعداد، وشاشةُ الدخول، وشات الدعم - ومعها قوالبُ
// النصّ الثنائية المكتوبة بيدٍ في تلك الملفّات، وهي دَينٌ من الصنف نفسه لم
// يكن هذا الفحص يراه أصلاً.
//
// ويبقى واحد **مقصود**: اسمُ اللغة العربية في مبدّل اللغة. هو اسمُ اللغة
// بلسانها (كما تظهر «EN» بالإنجليزية دائماً)، فترجمتُه إلى «Arabic» تجعل
// القارئَ العربيّ يبحث عن لغته باسمٍ لا يكتبه بها. نصٌّ لا يُترجَم، لا نصٌّ
// نُسي.
const GRANDFATHERED = {
  "app/components/AuthShell.tsx": 1,
};

const byFile = new Map();
for (const f of findings) {
  const key = f.rel.replace(/\\/g, "/");
  byFile.set(key, (byFile.get(key) ?? 0) + 1);
}

const fresh = [];
for (const f of findings) {
  const key = f.rel.replace(/\\/g, "/");
  const allowed = GRANDFATHERED[key] ?? 0;
  if (byFile.get(key) > allowed) fresh.push(f);
}
// ملفٌّ نقص دَينُه: يُذكَّر به كي يُحدَّث الرقم فلا يبقى بابٌ مفتوح
const shrunk = Object.entries(GRANDFATHERED).filter(([k, n]) => (byFile.get(k) ?? 0) < n);

if (fresh.length === 0) {
  const debt = Object.values(GRANDFATHERED).reduce((a, b) => a + b, 0);
  console.log(
    `✓ لا نصّ عربيّ مثبَّت جديد.` +
      (debt ? ` (دَينٌ موروث: ${debt} نصّاً في ${Object.keys(GRANDFATHERED).length} ملفّات)` : "")
  );
  for (const [k, n] of shrunk) {
    console.log(`  ↓ ${k}: بقي ${byFile.get(k) ?? 0} من ${n} - أنقص الرقم في GRANDFATHERED.`);
  }
  process.exit(0);
}

console.error(`✗ ${fresh.length} نصّاً عربياً مثبَّتاً في مكوّنات - سيراه مستخدم الواجهة الإنجليزية كما هو:\n`);
for (const f of fresh) console.error(`   ${f.rel}:${f.line}  «${f.text}»`);
process.exit(1);
