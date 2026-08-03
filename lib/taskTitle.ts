// lib/taskTitle.ts
//
// عرض عنوان المهمة اليومية بلغة **القارئ** لا بلغة لحظة التوليد.
//
// المهام تُولَّد مرّة واحدة يومياً بالكرون وتُقرأ مراراً بعد ذلك. تخزين
// النصّ المترجَم كان يثبّت لغة الكرون على القارئ إلى الأبد - مستخدم
// إنجليزي يرى مهامّ عربية ولا سبيل لتغييرها. الحلّ: يُخزَّن المفتاح
// ومتغيّراته، ويُترجَم هنا وقت العرض.
//
// ملفّ مستقلّ عمداً بلا استيراد من `dailyTasks.ts`: ذاك الملفّ يجرّ معه
// Prisma و`google-ads-api`، فاستيراده في مكوّن عميل كان سيكسر البناء.

import { t, type Locale } from "@/lib/i18n/dictionary";

/** الحدّ الأدنى الذي يحتاجه العرض - لا نُلزم القارئ بنوع Prisma كاملاً. */
export interface TaskTitleSource {
  title: string;
  titleKey?: string | null;
  titleVars?: unknown;
}

export function taskTitle(locale: Locale, task: TaskTitleSource): string {
  // بلا مفتاح: صفّ قديم سابق لهذا التغيير، أو مهمة مولّدة بالذكاء
  // الاصطناعي نصّها حرّ لا مفتاح له. النصّ المخزَّن هو كلّ ما لدينا.
  if (!task.titleKey) return task.title;

  const vars =
    task.titleVars && typeof task.titleVars === "object"
      ? (task.titleVars as Record<string, string | number>)
      : undefined;

  const translated = t(locale, task.titleKey, vars);
  // `t` تُرجع المفتاح نفسه حين لا تجده - وعرض "tasks.ctrDrop" على
  // المستخدم أسوأ من عرض النصّ المخزَّن ولو بلغة أخرى.
  return translated === task.titleKey ? task.title : translated;
}
