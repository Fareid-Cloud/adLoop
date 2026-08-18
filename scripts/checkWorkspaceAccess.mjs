// scripts/checkWorkspaceAccess.mjs
//
// بوّابة بناء: سؤالُ «هل يصل هذا المستخدم إلى هذه المساحة؟» له جوابٌ واحد.
//
// 🔴 **الموضع المنسيّ لا يشكو.** مسارٌ يفحص الملكية بيده ثمّ يُنسى حين
// تأتي المقاعد يعمل تماماً لصاحب المساحة، ولا يظهر عطلُه إلّا حين يجرّبه
// من ليست له - وهو أسوأ وقتٍ لاكتشافه. ولا تمسكه مراجعةٌ بشرية: السطر
// `userId: user.id` سطرٌ صحيحُ المظهر يكتبه أيُّ أحدٍ بحسن نيّة.
//
// فما يُفحص هنا: ألّا يُكتب شرطُ المساحة بيدٍ خارج `lib/workspaceAccess.ts`.
//
// وما لا يُفحص: `userId` للبيانات الشخصية (أكواد التحقّق، التفضيلات،
// الاشتراك). تلك تخصّ المستخدم لا المساحة، ولا تعبر إلى عضوٍ أبداً.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "app", "api");
const problems = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".ts")) check(p);
  }
}

function check(file) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  // الكرون لا مستخدمَ له أصلاً: يمرّ على المساحات كلّها بحكم وظيفته، فشرطُ
  // الوصول لا معنى له فيه - وإلزامُه به يعني اختراع مستخدمٍ وهميّ.
  if (rel.includes("/api/cron/")) return;

  const lines = src.split("\n");

  lines.forEach((line, i) => {
    // `select: { id: true, userId: true }` اختيارُ حقولٍ لا شرط - ومنعُه
    // يمنع قراءة مالك المساحة، وهي قراءةٌ مشروعة.
    if (/\bselect\s*:/.test(line)) return;
    // ونماذجُ المستخدم نفسِه (تذاكر الدعم، المنصّات المربوطة) تخصّه لا
    // مساحتَه ولا تعبر إلى عضو - وإدخالُها هنا كان سيمنح عضواً في مساحةٍ
    // حقَّ العبث بحساب مالكها.
    // ويُقرأ اسمُ النموذج من السطور القليلة السابقة لا من السطر وحده:
    // `prisma.connectedPlatform.findFirst({` يقع كثيراً في سطرٍ و`where` في
    // الذي يليه.
    const stmt = lines.slice(Math.max(0, i - 2), i + 1).join(" ");
    if (/prisma\.(supportThread|connectedPlatform)\b/.test(stmt)) return;

    // سجلٌّ تابعٌ للمساحة: `workspace: { userId: ... }`
    if (/workspace:\s*\{\s*userId\s*:/.test(line)) {
      problems.push(`${rel}:${i + 1}  شرطُ مساحةٍ مكتوبٌ بيد (workspace: { userId })`);
    }
    // المساحة نفسها: `id` و`userId` في شرطٍ واحد - و`where` شرطُ التمييز
    // عن أيّ كائنٍ آخر يحمل الحقلين.
    const isWhere = /\bwhere\s*:/.test(line);
    if (isWhere && (/\bid\s*:.*\buserId\s*:\s*\w/.test(line) || /\bid\s*,\s*userId\s*:\s*\w/.test(line))) {
      problems.push(`${rel}:${i + 1}  شرطُ مساحةٍ مكتوبٌ بيد (id + userId)`);
    }
  });

  // استعلامُ مساحةٍ يحمل `userId` خاماً في نطاقه القريب
  const re = /prisma\.workspace\.(findFirst|findUnique|findMany|update|updateMany|delete|deleteMany)\(/g;
  let m;
  while ((m = re.exec(src))) {
    const window = src.slice(m.index, m.index + 260);
    if (/userId\s*:\s*\w/.test(window) && !/workspaceAccess\(/.test(window)) {
      const lineNo = src.slice(0, m.index).split("\n").length;
      problems.push(`${rel}:${lineNo}  استعلامُ مساحةٍ بشرطٍ مكتوبٍ بيد`);
    }
  }
}

walk(ROOT);

const unique = [...new Set(problems)];
if (unique.length > 0) {
  console.error("شروطُ وصولٍ إلى المساحة مكتوبةٌ بيدٍ خارج نقطة الاختناق:\n");
  for (const p of unique) console.error("  • " + p);
  console.error(
    `\nالمجموع: ${unique.length}. استعمل workspaceAccess(userId) من lib/workspaceAccess.ts`
  );
  process.exit(1);
}

console.log("✓ كلّ شروط الوصول إلى المساحة تمرّ من lib/workspaceAccess.ts");
