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
//   ١) هل الفترةُ ثلاثون يوماً بالضبط، أيّاً كان الشهر؟
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
// الفترة ثلاثون يوماً ثابتة، فالمفحوصُ هو **الثبات** لا التقويم: أن تتساوى
// كلُّ الفترات مهما اختلف الشهرُ الذي تبدأ فيه.

console.log("\n[renewal] حساب الفترة:");

// الفترةُ ثلاثون يوماً بالضبط أيّاً كان الشهر - وهذا ما يُفحَص: **الثبات**
// لا التقويم. تُجرَّب كلُّ بدايةٍ ممكنة عبر سنتين، بما فيها نهاياتُ الشهور
// وفبراير الكبيسة، ويُتأكَّد أنّ الطول لا يتغيّر بينها.
const DAY_MS = 86_400_000;
let checked = 0;

for (const year of [2026, 2024]) {
  for (let m = 0; m < 12; m++) {
    const lastDay = new Date(year, m + 1, 0).getDate();
    for (const day of [1, 15, 28, lastDay]) {
      const from = new Date(year, m, day, 15, 30, 0);

      const month = addBillingPeriod(from, "monthly");
      const monthDays = (+month - +from) / DAY_MS;
      if (monthDays !== 30) {
        fail(`${from.toDateString()} → فترةٌ شهريّةٌ طولُها ${monthDays} يوماً لا ٣٠`);
      }

      const yearly = addBillingPeriod(from, "yearly");
      const yearDays = (+yearly - +from) / DAY_MS;
      if (yearDays !== 365) {
        fail(`${from.toDateString()} → فترةٌ سنويّةٌ طولُها ${yearDays} يوماً لا ٣٦٥`);
      }

      // ⚠️ **ولا تُفحَص ساعةُ الحائط عمداً.**
      //
      // «ثلاثون يوماً بالثانية» زمنٌ مطلق: ٣٠×٢٤ ساعة. وعبورُ التوقيت
      // الصيفيّ يزيح ساعةَ الحائط ساعةً (٣:٣٠ تصير ٢:٣٠) - وهذا **نتيجةٌ
      // صحيحة** لا خلل: الفترةُ بقيت ٧٢٠ ساعةً بالضبط، والذي تحرّك هو
      // التقويم لا الاشتراك. اشتراطُ بقاء الساعة كان سيناقض الطلب نفسه.
      checked++;
    }
  }
}

if (failures === 0) {
  console.log(`  ✓ ${checked} بدايةً مختلفة، وكلُّ فترةٍ ٣٠ يوماً (٣٦٥ للسنويّ) بالثانية.`);
}

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
