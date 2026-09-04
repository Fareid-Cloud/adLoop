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

  // ولوحةُ المالك تقرأ مساحاتِ الآخرين بحكم وظيفتها كذلك - لكنّ إعفاءها
  // إعفاءً مطلقاً يفتح تحت `/api/admin/` باباً بلا حارسٍ أصلاً.
  //
  // فالإعفاء **مشروط**: يمرّ المسار الإداريّ إن أثبت أنّ له حارسَه هو
  // (`isAdmin`). ومسارٌ إداريّ بلا أيّ فحصٍ للصفة ليس معفىً، بل مكشوف -
  // وهذا الفحص يمسكه.
  if (rel.includes("/api/admin/")) {
    // guardAdmin (lib/adminGuard.ts) هو الحارس المعتمَد: بيفحص الجلسة
    // والتعليق والدور والـCSRF والرفعة في نقطة واحدة - أصرم من فحص
    // isAdmin الخام، فقبوله هنا مش تخفيف بل ترقية. والفحص الخام بيفضل
    // مقبولاً للمسارات القديمة اللي لسه ما اتنقلتش عليه.
    if (/\bguardAdmin\b/.test(src) || /\bisAdmin\b/.test(src)) return;
    problems.push(`${rel}  مسارٌ إداريّ بلا فحص isAdmin`);
    return;
  }

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
    if (isWhere && (/\bid\s*:.*\buserId\s*:\s*["'`\w]/.test(line) || /\bid\s*,\s*userId\s*:\s*["'`\w]/.test(line))) {
      problems.push(`${rel}:${i + 1}  شرطُ مساحةٍ مكتوبٌ بيد (id + userId)`);
    }
  });

  // استعلامُ مساحةٍ يحمل `userId` خاماً في نطاقه القريب
  const re = /prisma\.workspace\.(findFirst|findUnique|findMany|update|updateMany|delete|deleteMany)\(/g;
  let m;
  while ((m = re.exec(src))) {
    const window = src.slice(m.index, m.index + 260);
    if (/userId\s*:\s*["'`\w]/.test(window) && !/workspace(Access|WriteFilter|OwnerFilter|AccessFilter)\(/.test(window)) {
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

// ══════════════════════════════════════════════════════════════════════
// 🔴 **الفحصُ الثاني: أيُّ فلتر، لا أيُّ ملفّ.**
//
// الفحصُ فوق بيتأكد إنّ الشرط جايٌّ من نقطة الاختناق - وده مايقولش حاجة
// عن **أيّ** فلترٍ منها اتّستعمل. وفي `lib/workspaceAccess.ts` أربعة،
// والخطرُ الحقيقيّ في اختيار الغلط:
//
//   `workspaceAccessFilter` بيشمل الأعضاء - فمسارُ كتابةٍ عليه بيحوّل
//   **كلَّ مقعد اطّلاع بنبيعه إلى مقعد تنفيذ**. مساحةٌ تتحذف، ومنصّةٌ
//   إعلانية تتفصل، وحسابٌ يتقفل فيمسح بيانات مساحةٍ مش بتاعته - كلُّها
//   كانت ممكنة بمقعدٍ «للاطّلاع فقط».
//
// اتكشفت في مسحٍ يدويّ لأربعةٍ وعشرين مساراً، والفحصُ ده هو اللي بيمنعها
// ترجع مع أوّل مسارٍ جديد يتكتب.
//
// الاستثناءُ الوحيد مُعلَنٌ بالاسم: تبديلُ مساحة العمل النشطة اختيارٌ بين
// ما تراه، لا كتابةٌ على المساحة نفسها.
// ══════════════════════════════════════════════════════════════════════

const WRITE_HANDLERS = ["POST", "PATCH", "PUT", "DELETE"];

/** مساراتُ كتابةٍ فلترُ الوصول فيها صحيحٌ فعلاً - بسببٍ مكتوب لكلّ واحد. */
const ACCESS_OK_IN_WRITE = new Set([
  // اختيارُ المساحة النشطة من بين ما يراه العضو: لا يكتب على المساحة.
  "app/api/workspaces/active/route.ts",
]);

const wrongFilter = [];

function checkWriteHandlers(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkWriteHandlers(full);
      continue;
    }
    if (entry.name !== "route.ts") continue;

    const rel = path.relative(process.cwd(), full).split(path.sep).join("/");
    if (ACCESS_OK_IN_WRITE.has(rel)) continue;

    const src = fs.readFileSync(full, "utf8");
    // نقسم عند كلّ handler مُصدَّر ونفحص أجسام الكتابة وحدها: نفس الملفّ
    // بيحمل `GET` بفلتر الوصول عن حقّ.
    const parts = src.split(/\nexport async function (\w+)/);
    for (let i = 1; i < parts.length - 1; i += 2) {
      const name = parts[i];
      const body = parts[i + 1];
      if (!WRITE_HANDLERS.includes(name)) continue;
      if (/workspaceAccess(Filter)?\s*\(/.test(body)) {
        const lineNo = src.slice(0, src.indexOf(body)).split("\n").length;
        wrongFilter.push(`${rel}:${lineNo}  ${name} يستعمل فلترَ الوصول في الكتابة`);
      }
    }
  }
}

checkWriteHandlers(ROOT);

if (wrongFilter.length > 0) {
  console.error("مساراتُ كتابةٍ على فلتر الوصول - كلُّ مقعد اطّلاع يصير مقعدَ تنفيذ:\n");
  for (const p of wrongFilter) console.error("  • " + p);
  console.error(
    `\nالمجموع: ${wrongFilter.length}.` +
      "\nاستعمل workspaceWriteFilter للكتابة العادية، وworkspaceOwnerFilter لما يمسّ" +
      "\nالمساحةَ نفسها أو الربطَ أو الفلوس. ولو الوصولُ صحيحٌ فعلاً، أضف المسار" +
      "\nإلى ACCESS_OK_IN_WRITE بسببٍ مكتوب."
  );
  process.exit(1);
}

console.log("✓ كلّ شروط الوصول تمرّ من lib/workspaceAccess.ts، ولا مسارَ كتابةٍ على فلتر الوصول.");

