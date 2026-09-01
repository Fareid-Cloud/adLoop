// scripts/checkRenewalSafety.mts
//
// **إثباتُ أنّ التجديد التلقائيّ لا يسرق ولا يهب.**
//
// التجديد يخصم من بطاقةٍ محفوظةٍ وصاحبُها غائب. وأخطاؤه لا تظهر في شاشة:
// تظهر في كشف حسابٍ بعد شهر. فبدل انتظار أوّل عميلٍ ليكتشفها، تُفحص
// الخصائص الخطرة هنا وتُفشِل البناء.
//
// أربعةُ أسئلةٍ يجيب عنها هذا الفحص:
//
//   ١) هل يعدّ الشهر صحيحاً؟ (لا يتخطّى فبراير، ولا يهب أياماً)
//   ٢) هل يمكن أن يُخصَم مرّتان؟ (الحجزُ الذرّيّ حقيقيٌّ أم شكليّ)
//   ٣) هل يمكن أن يُفعَّل اشتراكٌ بلا خصمٍ ناجح؟
//   ٤) هل يُخصَم ممّن ألغى؟
//
// ٢-٤ فحوصٌ بنيويّة على الكود (لا نداءَ ولا قاعدةَ بيانات): تتأكّد أنّ
// الشروط الحارسة موجودةٌ حيث يجب. و١ فحصٌ تنفيذيٌّ حقيقيّ على الدالّة.

import { readFileSync } from "node:fs";
import { addBillingPeriod } from "../lib/billingPeriod.ts";

let failures = 0;
const fail = (msg: string) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};

// ═══ ١) حسابُ الفترة ═══════════════════════════════════════════════════
//
// تُفحَص نهاياتُ الشهور والسنةُ الكبيسة تحديداً - وهي المواضع التي كان
// `setMonth(+1)` يفيض فيها فيتخطّى شهراً كاملاً.

console.log("\n[renewal] حساب الفترة:");

interface PeriodCase {
  from: string;
  cycle: "monthly" | "yearly";
  expect: string;
  why: string;
}

const periodCases: PeriodCase[] = [
  // الحالة التي كانت مكسورة: ٣١ يناير كانت تصير ٣ مارس
  { from: "2026-01-31", cycle: "monthly", expect: "2026-02-28", why: "٣١ يناير لا تتخطّى فبراير" },
  { from: "2024-01-31", cycle: "monthly", expect: "2024-02-29", why: "فبراير الكبيسة ٢٩" },
  { from: "2026-03-31", cycle: "monthly", expect: "2026-04-30", why: "٣١ في شهرٍ من ٣٠" },
  { from: "2026-05-31", cycle: "monthly", expect: "2026-06-30", why: "٣١ مايو ← ٣٠ يونيو" },
  { from: "2026-08-31", cycle: "monthly", expect: "2026-09-30", why: "٣١ أغسطس ← ٣٠ سبتمبر" },
  { from: "2026-12-31", cycle: "monthly", expect: "2027-01-31", why: "عبور السنة" },
  { from: "2026-01-15", cycle: "monthly", expect: "2026-02-15", why: "يومٌ عاديّ لا يتغيّر" },
  { from: "2026-02-28", cycle: "monthly", expect: "2026-03-28", why: "٢٨ فبراير تبقى ٢٨" },
  { from: "2024-02-29", cycle: "yearly", expect: "2025-02-28", why: "٢٩ فبراير سنوياً ← ٢٨" },
  { from: "2026-06-10", cycle: "yearly", expect: "2027-06-10", why: "سنويّ عاديّ" },
];

for (const c of periodCases) {
  // منتصفُ اليوم بالتوقيت المحلّي: يُبعد الحساب عن حدود المناطق الزمنية
  const from = new Date(`${c.from}T12:00:00`);
  const got = addBillingPeriod(from, c.cycle);
  const gotStr = `${got.getFullYear()}-${String(got.getMonth() + 1).padStart(2, "0")}-${String(got.getDate()).padStart(2, "0")}`;
  if (gotStr !== c.expect) {
    fail(`${c.from} (${c.cycle}) ← توقّعنا ${c.expect} وجاء ${gotStr} — ${c.why}`);
  }
}

// **ولا فترةً تهب شهراً**: أطولُ فترةٍ شهريّةٍ مشروعة ٣١ يوماً.
for (let m = 0; m < 12; m++) {
  for (const day of [28, 29, 30, 31]) {
    const from = new Date(2026, m, 1, 12);
    const last = new Date(2026, m + 1, 0).getDate();
    from.setDate(Math.min(day, last));
    const to = addBillingPeriod(from, "monthly");
    const days = Math.round((+to - +from) / 86_400_000);
    if (days < 28 || days > 31) {
      fail(`فترةٌ شهريّةٌ طولُها ${days} يوماً من ${from.toDateString()} — خارج [28،31]`);
    }
  }
}
if (failures === 0) console.log("  ✓ لا شهرَ يُتخطّى، ولا فترةَ خارج [28،31] يوماً.");

// ═══ ٢-٤) الحرّاسُ في مواضعهم ══════════════════════════════════════════
//
// تُقرأ الشيفرة نصّاً: الغرضُ ألّا يسقط حارسٌ في تعديلٍ لاحق بلا أن
// يصرخ البناء. وهي فحوصُ وجودٍ لا فحوصُ سلوك - تُقال حدودُها صراحةً.

console.log("[renewal] الحرّاس:");
const billing = readFileSync("lib/billing.ts", "utf8");
const paymob = readFileSync("lib/paymob.ts", "utf8");
const cron = readFileSync("app/api/cron/billing-renewals/route.ts", "utf8");

// ٢) الخصمُ المزدوج: الحجز لا يكفي أن يكون على الفترة وحدها - لا بدّ أن
//    يشترط ما **يكتبه الحجزُ نفسه**، وإلّا مرّت دورتان متزامنتان معاً.
if (!/lastRenewalAttempt:\s*null/.test(billing) || !/lastRenewalAttempt:\s*\{\s*lt:/.test(billing)) {
  fail("حجزُ المحاولة لا يشترط `lastRenewalAttempt` — دورتان متزامنتان تخصمان مرّتين.");
}
if (!/claimed\.count\s*===\s*0/.test(billing)) {
  fail("نتيجةُ الحجز غير مفحوصة — الخاسرُ في السباق سيُكمل ويخصم.");
}

// ٣) التفعيلُ بلا خصم: تمديدُ الفترة يجب أن يقع **بعد** نجاح الخصم.
const chargeIdx = billing.indexOf("const charge = await chargeSavedCard");
const failIdx = billing.indexOf("if (!charge.ok)");
const extendIdx = billing.indexOf("currentPeriodEnd: nextEnd");
if (chargeIdx < 0 || failIdx < 0 || extendIdx < 0) {
  fail("تعذّر العثور على تسلسل (خصم ← فحص فشل ← تمديد) في `renewViaSavedCard`.");
} else if (!(chargeIdx < failIdx && failIdx < extendIdx)) {
  fail("الفترةُ تُمدَّد قبل فحص نجاح الخصم — تفعيلٌ بلا مال.");
}

// ٤) من ألغى لا يُخصَم منه - في الدالّة وفي المهمّة معاً.
if (!/user\.cancelAtPeriodEnd/.test(billing)) {
  fail("`renewViaSavedCard` لا تفحص الإلغاء.");
}
if (!/if\s*\(!user\.cancelAtPeriodEnd\)/.test(cron)) {
  fail("المهمّة تحاول التجديد بلا فحص الإلغاء.");
}

// والمُغلَقُ ببنيته: لا نداءَ خارجيٌّ بلا تكامل MOTO.
if (!/isAutoChargeConfigured\(\)/.test(paymob) || !/return\s*\{\s*ok:\s*false,\s*reason:\s*"not_configured"\s*\}/.test(paymob)) {
  fail("`chargeSavedCard` قد تنادي Paymob بلا `PAYMOB_MOTO_INTEGRATION_ID`.");
}

if (failures > 0) {
  console.error(`\n✗ ${failures} فحصاً فشل في أمان التجديد.\n`);
  process.exit(1);
}
console.log("  ✓ الحجز الذرّيّ، وترتيب (خصم ← تمديد)، وفحص الإلغاء، والإغلاق بلا MOTO.");
console.log("✓ أمان التجديد التلقائيّ.\n");
