// lib/productSearch.ts
//
// بحثٌ في كلّ نصٍّ يراه المشترك، لا في عناوين الصفحات وحدها.
//
// 🔴 **ما فشلت فيه المحاولتان قبله:** الأولى بحثت في عناوين التنقّل، فمن
// كتب «نسبة التحقّق» أُجيب «لا نتائج» وهي أمامه في بطاقة. والثانية فهرست
// عناوين الأقسام (h2/h3) - ثمانيةً وثلاثين - وأغلبُ ما يبحث عنه المرء ليس
// عنواناً بل تسميةَ بطاقةٍ أو زرٍّ أو عمودِ جدول.
//
// والمصدر هنا الفهرسُ المُولَّد من الكود: ألفٌ ومئتان وأربعة وعشرون نصّاً
// في ثمانٍ وخمسين صفحة.
//
// ── ثلاثة تجعله يُشبه ما طلبه المالك ───────────────────────────────
// ١) المطابقة بأيّ جزءٍ من الجملة، لا ببدايتها.
// ٢) تُعاد الجملةُ كاملةً ومعها موضعُ المطابقة، فتُظلَّل الكلمةُ نفسها -
//    لا يُترك القارئ يفتّش عن سبب ظهور النتيجة.
// ٣) يُعاد المسارُ الذي تسكنه («الحملات › جوجل › مصطلحات البحث»)، فيَعرف
//    أين يجدها لا أنّها موجودة فحسب.

import { SEARCH_INDEX } from "@/lib/generated/searchIndex";
import { NAV_GROUPS } from "@/lib/navConfig";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface ProductHit {
  /** النصّ كاملاً كما يقرؤه المشترك */
  label: string;
  /** موضع المطابقة داخله - للتظليل */
  start: number;
  end: number;
  /** أين يسكن: «الحملات › جوجل › مصطلحات البحث» */
  trail: string | null;
  href: string;
}

/** مسارُ الصفحة في التنقّل - يُبنى مرّةً ويُعاد استعماله. */
let trailCache: Map<string, string> | null = null;
function trailOf(href: string, ar: boolean): string | null {
  if (!trailCache) {
    trailCache = new Map();
    for (const g of NAV_GROUPS) {
      const groupLabel = ar ? g.labelAr : g.labelEn;
      for (const it of g.items) {
        const itemLabel = ar ? it.labelAr : it.labelEn;
        const head = groupLabel ? `${groupLabel} › ${itemLabel}` : itemLabel;
        if (!trailCache.has(it.href)) trailCache.set(it.href, head);
        for (const c of it.children ?? []) {
          const childLabel = ar ? c.labelAr : c.labelEn;
          if (!trailCache.has(c.href)) trailCache.set(c.href, `${head} › ${childLabel}`);
        }
      }
    }
  }
  return trailCache.get(href) ?? null;
}

/** يُبطَل عند تبدّل اللغة - وإلّا عُرض مسارُ اللغة السابقة. */
export function resetTrailCache(): void {
  trailCache = null;
}

/**
 * الترتيب: ما بدأ بالكلمة أوّلاً، ثمّ ما بدأت به كلمةٌ داخله، ثمّ ما احتواه.
 *
 * والسبب: من يكتب «تكل» يقصد «تكلفة» غالباً لا «مشكلة تكلّفنا» - فالبداية
 * أدلّ على القصد من مجرّد الاحتواء.
 */
function rank(label: string, q: string): number {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (new RegExp(`(^|\\s|[«"'(\\[])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(l)) return 1;
  return 2;
}

export function searchProduct(query: string, locale: Locale, limit = 12): ProductHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const ar = locale === "ar";

  const hits: Array<ProductHit & { r: number }> = [];
  const seen = new Set<string>();

  for (const entry of SEARCH_INDEX) {
    const label = t(locale, entry.k);
    // مفتاحٌ بلا ترجمةٍ يعود باسمه - ولا يُعرَض مفتاحٌ خام للمشترك
    if (!label || label === entry.k) continue;

    const idx = label.toLowerCase().indexOf(q);
    if (idx === -1) continue;

    // النصّ نفسه في الصفحة نفسها لا يتكرّر: مفتاحان بنصٍّ واحد شائعان
    const dedupe = `${label}::${entry.h}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    hits.push({
      label,
      start: idx,
      end: idx + q.length,
      trail: trailOf(entry.h, ar),
      href: `${entry.h}?highlight=${encodeURIComponent("s:" + entry.k)}`,
      r: rank(label, q),
    });
  }

  hits.sort((a, b) => a.r - b.r || a.label.length - b.label.length);
  return hits.slice(0, limit).map(({ r: _r, ...hit }) => hit);
}
