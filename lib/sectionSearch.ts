// lib/sectionSearch.ts
//
// نتائج عناوين الأقسام لحقلَي البحث - من الفهرس المُولَّد من الكود.
//
// دالةٌ واحدة يناديها الشريط الجانبيّ والرأس: حقلان يجيبان الجواب نفسه،
// وهو ما لم يكن - كان أحدهما يبحث في عناوين الصفحات وحدها.

import { SECTION_INDEX } from "@/lib/generated/sectionIndex";
import { NAV_GROUPS } from "@/lib/navConfig";
import { t, type Locale } from "@/lib/i18n/dictionary";

/** اسم الصفحة التي يسكنها القسم - هو «في كذا» الذي يفصل المتشابهات. */
function pageLabel(href: string, ar: boolean): string | null {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (it.href === href) return ar ? it.labelAr : it.labelEn;
      for (const c of it.children ?? []) {
        if (c.href === href) return ar ? c.labelAr : c.labelEn;
      }
    }
  }
  return null;
}

/** الوجهة: الصفحة، ثمّ العنوان نفسه داخلها.
 *
 *  البادئة `s:` تُميّز هدفاً نصّياً عن معرّف كيان - فالعناوين لا تحمل
 *  `data-search-id`، ولا يصحّ أن تحمله: ثمانيةٌ وثلاثون عنواناً موسومةً
 *  بيدٍ قائمةٌ موازيةٌ للفهرس، وأوّلُ عنوانٍ يُضاف بعدها يظهر في البحث
 *  ولا يُهبَط عنده. والمُولِّد يقرأ الكود في كلّ بناء، فالاسم رابطٌ قائم. */
export function sectionHref(key: string, href: string): string {
  return `${href}?highlight=${encodeURIComponent("s:" + key)}`;
}

export function searchSections(
  query: string,
  locale: Locale
): Array<{ label: string; context: string | null; href: string }> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const ar = locale === "ar";
  const out: Array<{ label: string; context: string | null; href: string }> = [];
  for (const entry of SECTION_INDEX) {
    const label = t(locale, entry.key);
    // مفتاحٌ بلا ترجمة يعود باسمه - ولا يُعرَض مفتاحٌ خام للمشترك
    if (!label || label === entry.key) continue;
    if (!label.toLowerCase().includes(q)) continue;
    out.push({ label, context: pageLabel(entry.href, ar), href: sectionHref(entry.key, entry.href) });
  }
  return out;
}
