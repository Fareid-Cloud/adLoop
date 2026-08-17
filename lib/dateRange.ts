// lib/dateRange.ts
//
// منطق الفترات الزمنية - مشترك بين الخادم والعميل، وبلا استيراد ثقيل.
//
// سبب وجوده مركزياً: الفترة كانت مثبّتة (٣٠ يوماً) في عشرات الصفحات، فلم
// يكن المستخدم يستطيع سؤال "وماذا عن الأسبوع الماضي؟" في أي مكان. أي
// صفحة تعرض أرقاماً تتغيّر بالزمن يجب أن تقبل فترة، ومصدر الحقيقة هنا.

export type PresetKey =
  | "today" | "yesterday" | "last7" | "todayAndYesterday" | "last14"
  | "last28" | "last30" | "thisWeek" | "lastWeek" | "thisMonth"
  | "lastMonth" | "last90" | "thisYear" | "maximum" | "custom";

export interface DateRange {
  /** بصيغة YYYY-MM-DD - نصّ لا Date حتى ينتقل في الـURL بلا التباس منطقة زمنية */
  from: string;
  to: string;
}

export interface ResolvedPeriod {
  preset: PresetKey;
  range: DateRange;
  /** فترة المقارنة - null إذا أطفأها المستخدم */
  compare: DateRange | null;
  /** 🔴 **النمط المختار نفسه، لا نتيجته وحدها.**
   *
   *  كان يُحسَب هنا ويُرمى، فيُعيد المنتقي فتحَه على «بلا مقارنة» مهما
   *  اختار القارئ - يختار «مقابل العام الماضي»، فتُطبَّق على الأرقام
   *  ويفتح المنتقي فارغاً كأنّه لم يختر. */
  compareMode: CompareMode;
}

/** أقدم تاريخ منطقي للبيانات حين يختار المستخدم "الأقصى" */
export const MAX_LOOKBACK_DAYS = 730;

export const QUICK_PRESETS: PresetKey[] = ["today", "yesterday", "last7"];
export const MORE_PRESETS: PresetKey[] = [
  "todayAndYesterday", "last14", "last28", "last30",
  "thisWeek", "lastWeek", "thisMonth", "lastMonth",
  "last90", "thisYear", "maximum",
];

// ==================== أدوات تاريخ خالصة ====================

export function toISODate(d: Date): string {
  // نبني النصّ من المكوّنات المحلّية لا من toISOString: الأخيرة تحوّل إلى
  // UTC فتُرجِع "أمس" لمن يعيش شرق جرينتش في ساعات الصباح الأولى.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function daysBetween(from: string, to: string): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** بداية الأسبوع - السبت في المنطقة العربية، الاثنين خارجها */
export function startOfWeek(d: Date, weekStartsOn: number): Date {
  const c = new Date(d);
  const diff = (c.getDay() - weekStartsOn + 7) % 7;
  c.setDate(c.getDate() - diff);
  return c;
}

// ==================== حلّ الاختصارات ====================

export function resolvePreset(preset: PresetKey, now: Date = new Date(), weekStartsOn = 6): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = toISODate;

  switch (preset) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: iso(y), to: iso(y) };
    }
    case "todayAndYesterday":
      return { from: iso(addDays(today, -1)), to: iso(today) };
    // "آخر ٧ أيام" لا تشمل اليوم الجاري: يومٌ لم يكتمل يسحب كل متوسّط
    // لأسفل ويجعل أي مقارنة مضلِّلة. هذا سلوك جوجل وميتا نفسيهما.
    case "last7":
      return { from: iso(addDays(today, -7)), to: iso(addDays(today, -1)) };
    case "last14":
      return { from: iso(addDays(today, -14)), to: iso(addDays(today, -1)) };
    case "last28":
      return { from: iso(addDays(today, -28)), to: iso(addDays(today, -1)) };
    case "last30":
      return { from: iso(addDays(today, -30)), to: iso(addDays(today, -1)) };
    case "last90":
      return { from: iso(addDays(today, -90)), to: iso(addDays(today, -1)) };
    case "thisWeek": {
      const s = startOfWeek(today, weekStartsOn);
      return { from: iso(s), to: iso(today) };
    }
    case "lastWeek": {
      const s = addDays(startOfWeek(today, weekStartsOn), -7);
      return { from: iso(s), to: iso(addDays(s, 6)) };
    }
    case "thisMonth":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case "lastMonth": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(s), to: iso(e) };
    }
    case "thisYear":
      return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
    case "maximum":
      return { from: iso(addDays(today, -MAX_LOOKBACK_DAYS)), to: iso(today) };
    default:
      return { from: iso(addDays(today, -30)), to: iso(addDays(today, -1)) };
  }
}

// ==================== فترة المقارنة ====================

export type CompareMode = "previous" | "previousYear" | "sameWeekday" | "custom" | "none";

/**
 * الفترة السابقة بنفس الطول ومتّصلة بها. `sameWeekday` تُزيح بمضاعفات
 * سبعة حتى يقابل الاثنين اثنيناً - مقارنة يوم عمل بيوم عطلة تُنتج فارقاً
 * لا علاقة له بما غيّره المستخدم.
 */
export function resolveCompare(range: DateRange, mode: CompareMode): DateRange | null {
  if (mode === "none" || mode === "custom") return null;
  const len = daysBetween(range.from, range.to);
  const from = fromISODate(range.from);

  if (mode === "previousYear") {
    const f = new Date(from);
    f.setFullYear(f.getFullYear() - 1);
    return { from: toISODate(f), to: toISODate(addDays(f, len - 1)) };
  }

  if (mode === "sameWeekday") {
    const shift = Math.ceil(len / 7) * 7;
    const f = addDays(from, -shift);
    return { from: toISODate(f), to: toISODate(addDays(f, len - 1)) };
  }

  const f = addDays(from, -len);
  return { from: toISODate(f), to: toISODate(addDays(f, len - 1)) };
}

// ==================== قراءة/كتابة في الرابط ====================

/**
 * الفترة تعيش في الـURL لا في الحالة وحدها: بدون ذلك لا يستطيع المستخدم
 * مشاركة رابط تقرير أو حفظه في المفضّلة، ويضيع اختياره عند إعادة التحميل.
 */
export function periodFromParams(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): ResolvedPeriod {
  const get = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const preset = (get("preset") as PresetKey) ?? "last30";
  const from = get("from");
  const to = get("to");

  const range =
    preset === "custom" && from && to ? { from, to } : resolvePreset(preset, now);

  // المقارنة مطفأة افتراضياً: فتح كل صفحة على وضع مقارنة يضاعف كل رقم
  // معروض ويحوّل قراءة بسيطة إلى مقارنة لم يطلبها أحد. من يريدها يفعّلها.
  const cmpMode = (get("cmp") as CompareMode) ?? "none";
  const cmpFrom = get("cmpFrom");
  const cmpTo = get("cmpTo");
  const compare =
    cmpMode === "none"
      ? null
      : cmpMode === "custom" && cmpFrom && cmpTo
        ? { from: cmpFrom, to: cmpTo }
        : resolveCompare(range, cmpMode);

  return { preset, range, compare, compareMode: cmpMode };
}

export function periodToQuery(p: ResolvedPeriod, cmpMode: CompareMode): Record<string, string> {
  const q: Record<string, string> = { preset: p.preset };
  if (p.preset === "custom") {
    q.from = p.range.from;
    q.to = p.range.to;
  }
  q.cmp = cmpMode;
  if (cmpMode === "custom" && p.compare) {
    q.cmpFrom = p.compare.from;
    q.cmpTo = p.compare.to;
  }
  return q;
}

/** حدود التاريخ لاستعلام Prisma - نهاية اليوم شاملة */
export function toDateBounds(range: DateRange): { gte: Date; lte: Date } {
  const gte = fromISODate(range.from);
  const lte = fromISODate(range.to);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}
