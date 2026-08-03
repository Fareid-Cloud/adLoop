// lib/localizedRecord.ts
//
// عرض نصّ **مخزَّن** بلغة القارئ لا بلغة لحظة التوليد.
//
// المشكلة التي يحلّها: التنبيهات والمهام تُولَّد مرّة واحدة بالكرون ثمّ
// تُقرأ مراراً. تخزين النصّ مترجَماً كان يثبّت لغة الكرون على القارئ إلى
// الأبد - مستخدم إنجليزي يرى تنبيهات عربية ولا سبيل لتغييرها. لذلك
// يُخزَّن **مفتاح القاموس ومتغيّراته**، ويُترجَم هنا وقت العرض.
//
// ملفّ مستقلّ بلا استيراد من `actionFeed.ts` أو `dailyTasks.ts`: هذان
// يجرّان Prisma و`google-ads-api`، فاستيرادهما في مكوّن عميل يكسر البناء.

import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

/**
 * متغيّرات تحمل قيمة **مترجَمة** بطبيعتها لا يصحّ تخزينها كنصّ.
 *
 * اسم المنصّة مثال حقيقي: تخزين «جوجل» في المتغيّرات يجعل القارئ
 * الإنجليزي يرى "Large gap between جوجل's conversions". لذلك يُخزَّن
 * المعرّف الخام في `<name>Key` ويُترجَم هنا وقت العرض.
 */
const RESOLVERS: Record<string, (locale: Locale, raw: string) => string> = {
  platformKey: (locale, raw) => platformLabel(locale, raw),
};

/**
 * القاعدة العامّة: أي متغيّر ينتهي بـ`Key` يملأ نظيره بلا اللاحقة.
 *
 * `platformKey` يمرّ عبر `platformLabel`، وأي `<x>Key` آخر يُعامَل كمفتاح
 * قاموس مباشر (`reasonKey`، `actionKey`، `cheapKey`...). هكذا تُترجَم
 * الجُمَل المركَّبة - جملة داخل جملة - بلغة القارئ كاملةً لا نصفها.
 */
function resolveVars(
  locale: Locale,
  vars: Record<string, string | number>
): Record<string, string | number> {
  let out = vars;
  for (const [varName, raw] of Object.entries(vars)) {
    if (!varName.endsWith("Key") || typeof raw !== "string" || !raw) continue;
    const target = varName.slice(0, -3);
    const resolver = RESOLVERS[varName];
    // مفتاح لا يُترجَم (لم يُعرَّف بعد) يُترك على قيمته المخزَّنة بدل
    // أن يُستبدل باسمه الحرفيّ فيراه المستخدم.
    const value = resolver ? resolver(locale, raw) : t(locale, raw, vars);
    if (!resolver && value === raw) continue;
    if (out === vars) out = { ...vars };
    out[target] = value;
  }
  return out;
}

/** الحدّ الأدنى الذي يحتاجه العرض - لا نُلزم القارئ بنوع Prisma كاملاً. */
export interface LocalizedField {
  key?: string | null;
  vars?: unknown;
  fallback: string | null | undefined;
}

/**
 * يترجم المفتاح إن وُجد، وإلّا يعيد النصّ المخزَّن.
 *
 * حين يكون المفتاح موجوداً لكن مفقوداً من القاموس، `t` تُعيد المفتاح نفسه
 * - وعرض "alerts.costTrend" على المستخدم أسوأ من عرض النصّ المخزَّن ولو
 * بلغة أخرى، فنرجع إليه.
 */
export function localized(locale: Locale, field: LocalizedField): string {
  const fallback = field.fallback ?? "";
  if (!field.key) return fallback;

  const raw =
    field.vars && typeof field.vars === "object"
      ? (field.vars as Record<string, string | number>)
      : undefined;
  const vars = raw ? resolveVars(locale, raw) : undefined;

  const translated = t(locale, field.key, vars);
  return translated === field.key ? fallback : translated;
}

/** الشكل الذي يصل من Prisma لبنود قائمة القرارات والإشعارات. */
export interface LocalizableItem {
  title: string;
  titleKey?: string | null;
  titleVars?: unknown;
  description?: string | null;
  descKey?: string | null;
  descVars?: unknown;
}

export function itemTitle(locale: Locale, item: LocalizableItem): string {
  return localized(locale, { key: item.titleKey, vars: item.titleVars, fallback: item.title });
}

export function itemDescription(locale: Locale, item: LocalizableItem): string {
  return localized(locale, { key: item.descKey, vars: item.descVars, fallback: item.description });
}
