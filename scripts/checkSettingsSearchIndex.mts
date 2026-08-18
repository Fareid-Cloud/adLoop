// scripts/checkSettingsSearchIndex.mts
//
// بوّابة بناء لفهرس بحث الإعدادات.
//
// الهبوط عند الحقل داخل الإعدادات يتمّ بمطابقة **الاسم المعروض**، لا بسمةٍ
// موضوعة على كلّ حقل. وذلك يشترط شرطاً واحداً لا يراه أحدٌ حين يُكسر:
// **ألّا يتكرّر اسمان متطابقان في التبويب الواحد.** إن تكرّرا هبط الباحث
// عند الأوّل دائماً، ولا شيء يشكو - لا خطأ بناء ولا خطأ تشغيل، فقط نتيجةٌ
// تقود إلى المكان الخطأ.
//
// فيُفحص هنا: أنّ لكلّ بندٍ ترجمةً بلغتيه، وأنّ الأسماء لا تتصادم.

import { SETTINGS_SEARCH_INDEX, SETTINGS_TAB_LABEL_KEYS } from "../lib/settingsSearchIndex.ts";
import { t, type Locale } from "../lib/i18n/dictionary.ts";

const LOCALES: Locale[] = ["ar", "en"];
const problems: string[] = [];

for (const locale of LOCALES) {
  // ١) كلّ بندٍ له ترجمة - لا مفتاحٌ خام يظهر للمشترك في نتائج البحث
  for (const entry of SETTINGS_SEARCH_INDEX) {
    const key = `settings.${entry.labelKey}`;
    const text = t(locale, key);
    if (!text || text === key) {
      problems.push(`[${locale}] بندٌ بلا ترجمة: ${key}`);
    }
    const tabKey = SETTINGS_TAB_LABEL_KEYS[entry.tab];
    if (!tabKey) {
      problems.push(`[${locale}] تبويبٌ غير معروف: ${entry.tab} (البند ${entry.labelKey})`);
      continue;
    }
    const tabText = t(locale, `settings.${tabKey}`);
    if (!tabText || tabText === `settings.${tabKey}`) {
      problems.push(`[${locale}] تبويبٌ بلا ترجمة: settings.${tabKey}`);
    }
  }

  // ٢) لا اسمان متطابقان في تبويبٍ واحد - وهو شرط الهبوط بالاسم
  const seen = new Map<string, string>();
  for (const entry of SETTINGS_SEARCH_INDEX) {
    const text = t(locale, `settings.${entry.labelKey}`).trim();
    const slot = `${entry.tab}::${text}`;
    const previous = seen.get(slot);
    if (previous) {
      problems.push(
        `[${locale}] اسمان متطابقان في تبويب «${entry.tab}»: ${previous} و${entry.labelKey} كلاهما «${text}» - ` +
          `الهبوط سيقف عند الأوّل دائماً`
      );
    } else {
      seen.set(slot, entry.labelKey);
    }
  }
}

if (problems.length > 0) {
  console.error("فهرس بحث الإعدادات فيه ما يمنع البحث من العمل بصدق:\n");
  for (const p of problems) console.error("  • " + p);
  console.error(`\nالمجموع: ${problems.length}`);
  process.exit(1);
}

console.log(
  `✓ فهرس بحث الإعدادات: ${SETTINGS_SEARCH_INDEX.length} بنداً، مترجَمةٌ بلغتيها وبلا تصادم أسماء داخل التبويب.`
);
