// lib/settingsSearchIndex.ts
//
// فهرس إعدادات واحد يقرؤه اثنان: مربّع البحث داخل صفحة الإعدادات، والبحث
// العامّ في الشريط الجانبيّ والرأس.
//
// 🔴 **كان يعيش داخل `SettingsClient` وحده، فلم يكن البحث العامّ يعرف أنّ
// «العملة» إعدادٌ أصلاً.** من يكتبها في حقل البحث الظاهر أمامه يُجاب «لا
// نتائج»، فيقرؤها «غير موجود في المنتج» لا «ابحث عنه في مكانٍ آخر». وهو
// موجود، على بُعد تبويبٍ واحد.
//
// ولا يُنسخ الفهرس هنا وهناك: نسختان تفترقان أوّلَ إعدادٍ يُضاف إلى
// إحداهما، فيصير البحثان يجيبان جوابين مختلفين عن السؤال نفسه.

import { t, type Locale } from "@/lib/i18n/dictionary";

/** مفاتيح التبويبات - مصدرها `TABS` في `SettingsClient`، وهي الوجهة في `?tab=`. */
export type SettingsTabKey =
  | "profile"
  | "preferences"
  | "accounts"
  | "workspace"
  | "automation"
  | "conversionSync"
  | "security"
  | "danger";

/** اسم كلّ تبويب - يُعرَض سياقاً للنتيجة («في تبويب كذا»). */
export const SETTINGS_TAB_LABEL_KEYS: Record<SettingsTabKey, string> = {
  profile: "tabProfile",
  preferences: "tabPreferences",
  accounts: "tabAccounts",
  workspace: "tabWorkspace",
  automation: "tabAutomation",
  conversionSync: "tabConversionSync",
  security: "tabSecurity",
  danger: "tabDanger",
};

export type SettingsSearchEntry = {
  /** مفتاح الترجمة للاسم المعروض - تحت `settings.` في القاموس */
  labelKey: string;
  tab: SettingsTabKey;
};

// فهرس بحث حقيقي - كل سطر هنا يمثّل حقلاً موجوداً فعلاً في أحد التبويبات،
// لا أسماء وهمية. أي حقل جديد يُضاف إلى تبويب يجب أن يُضاف هنا أيضاً كي
// يبقى البحث دقيقاً ومطابقاً للواقع.
export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  { labelKey: "idxName", tab: "profile" },
  { labelKey: "idxAvatar", tab: "profile" },
  { labelKey: "idxLanguage", tab: "preferences" },
  { labelKey: "idxMode", tab: "preferences" },
  { labelKey: "idxAccent", tab: "preferences" },
  { labelKey: "idxTimezone", tab: "preferences" },
  { labelKey: "idxGoogle", tab: "accounts" },
  { labelKey: "idxMeta", tab: "accounts" },
  { labelKey: "idxWorkspaceName", tab: "workspace" },
  { labelKey: "idxCurrency", tab: "workspace" },
  { labelKey: "idxMarket", tab: "workspace" },
  { labelKey: "idxCampaigns", tab: "workspace" },
  { labelKey: "idxAi", tab: "automation" },
  { labelKey: "idxRules", tab: "automation" },
  { labelKey: "idxDaily", tab: "automation" },
  { labelKey: "idxPricingHealth", tab: "automation" },
  { labelKey: "idxModeled", tab: "automation" },
  { labelKey: "idxResponse", tab: "automation" },
  { labelKey: "idxFatigue", tab: "automation" },
  { labelKey: "idxCtr", tab: "automation" },
  { labelKey: "idxPriceWarn", tab: "automation" },
  { labelKey: "idxPriceCrit", tab: "automation" },
  { labelKey: "idxRto", tab: "automation" },
  { labelKey: "idxCeiling", tab: "automation" },
  { labelKey: "idxSyncEnable", tab: "conversionSync" },
  { labelKey: "idxMetaPixel", tab: "conversionSync" },
  { labelKey: "idxCapiToken", tab: "conversionSync" },
  { labelKey: "idxGoogleAction", tab: "conversionSync" },
  { labelKey: "idxTiktokPixel", tab: "conversionSync" },
  { labelKey: "idxDeleteWorkspace", tab: "danger" },
];

/** وجهة النتيجة: التبويب الصحيح، ثمّ الحقل نفسه داخله.
 *
 *  `highlight` هو `labelKey` نفسه - المعرّف الذي يحمله الحقل في
 *  `data-search-id`، فلا جدول ثالث يربط بينهما. */
export function settingsEntryHref(entry: SettingsSearchEntry): string {
  return `/dashboard/settings?tab=${entry.tab}&highlight=${encodeURIComponent(entry.labelKey)}`;
}

/** نتائج الإعدادات لأيّ حقل بحثٍ عامّ - بصيغة النتيجة نفسها التي تعرضها.
 *
 *  دالةٌ واحدة يناديها الشريط الجانبيّ والرأس، فيستحيل أن يجيب أحدهما
 *  بما لا يجيب به الآخر. */
export function searchSettingsEntries(
  query: string,
  locale: Locale
): Array<{ label: string; context: string; href: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tr = (k: string) => t(locale, `settings.${k}`);
  return SETTINGS_SEARCH_INDEX.filter((e) => tr(e.labelKey).toLowerCase().includes(q)).map((e) => ({
    label: tr(e.labelKey),
    // «في تبويب كذا» - المفتاح موجود أصلاً ويُستعمل داخل الصفحة، فلا نصّ جديد
    context: t(locale, "settings.inTab", { tab: tr(SETTINGS_TAB_LABEL_KEYS[e.tab]) }),
    href: settingsEntryHref(e),
  }));
}
