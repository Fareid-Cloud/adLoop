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

if (findings.length === 0) {
  console.log("✓ لا نصّ عربيّ مثبَّت في أيّ مكوّن.");
  process.exit(0);
}

console.error(`✗ ${findings.length} نصّاً عربياً مثبَّتاً في مكوّنات - سيراه مستخدم الواجهة الإنجليزية كما هو:\n`);
for (const f of findings) console.error(`   ${f.rel}:${f.line}  «${f.text}»`);
process.exit(1);
