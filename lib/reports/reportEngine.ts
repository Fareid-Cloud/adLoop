// lib/reports/reportEngine.ts
//
// محرّك التقارير. يستخرج صفوفاً مجمّعة حسب بُعد يختاره المستخدم، لفترة
// يختارها، ويقارنها بفترة أخرى.
//
// ثلاثة قرارات تحكم هذا الملف:
//
// ١) **مصدر البيانات اختيار صريح.** الرقم المُعلَن والرقم المتحقّق ليسا
//    نسختين من شيء واحد - أحدهما ما تدّعيه المنصة، والآخر ما أثبتناه.
//    خلطهما في تقرير واحد بلا تمييز يُفقد المنتج معناه كلّه.
//
// ٢) **المقارنة تنتهي بحكم لا برقمين.** "١٢٠ مقابل ١٠٠" ليست نتيجة؛
//    "الفائز أ، بفارق ٢٠٪، وأثر مالي ٣٬٤٠٠" هي النتيجة.
//
// ٣) **الاتجاه ليس الإشارة.** ارتفاع التكلفة سيّئ وارتفاع التحويلات جيّد؛
//    لكلّ مؤشّر `lowerIsBetter` تحدّد معنى ارتفاعه، ولا يُحكم بالإشارة وحدها.

import { prisma } from "@/lib/prisma";
import { toDateBounds, type DateRange } from "@/lib/dateRange";

// ==================== الأنواع ====================

export type DataSource = "REPORTED" | "VERIFIED" | "BOTH";
export type Dimension = "platform" | "campaign" | "creative" | "day" | "week" | "month" | "placement" | "none";
export type MetricKey =
  | "cost" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm"
  | "conversions" | "cpa" | "conversionRate"
  | "revenue" | "roas" | "roi" | "orders" | "aov" | "returnedOrders" | "rtoRate"
  | "verificationRate" | "inflationRate" | "wastedSpend" | "profit";

export interface MetricDef {
  key: MetricKey;
  group: "core" | "efficiency" | "truth" | "ecommerce";
  /** أهمّ ما يبحث عنه المستخدم عادةً - تظهر أولاً في المنتقي */
  common: boolean;
  lowerIsBetter: boolean;
  format: "number" | "currency" | "percent" | "ratio";
  /** يعتمد على مصدر البيانات: يتغيّر معناه بين المُعلَن والمتحقّق */
  sourceSensitive: boolean;
}

export const METRICS: MetricDef[] = [
  { key: "cost", group: "core", common: true, lowerIsBetter: false, format: "currency", sourceSensitive: false },
  { key: "impressions", group: "core", common: true, lowerIsBetter: false, format: "number", sourceSensitive: false },
  { key: "clicks", group: "core", common: true, lowerIsBetter: false, format: "number", sourceSensitive: false },
  { key: "conversions", group: "core", common: true, lowerIsBetter: false, format: "number", sourceSensitive: true },
  { key: "cpa", group: "core", common: true, lowerIsBetter: true, format: "currency", sourceSensitive: true },

  { key: "ctr", group: "efficiency", common: true, lowerIsBetter: false, format: "percent", sourceSensitive: false },
  { key: "cpc", group: "efficiency", common: false, lowerIsBetter: true, format: "currency", sourceSensitive: false },
  { key: "cpm", group: "efficiency", common: false, lowerIsBetter: true, format: "currency", sourceSensitive: false },
  { key: "conversionRate", group: "efficiency", common: true, lowerIsBetter: false, format: "percent", sourceSensitive: true },

  { key: "verificationRate", group: "truth", common: true, lowerIsBetter: false, format: "percent", sourceSensitive: false },
  { key: "inflationRate", group: "truth", common: true, lowerIsBetter: true, format: "percent", sourceSensitive: false },
  { key: "wastedSpend", group: "truth", common: false, lowerIsBetter: true, format: "currency", sourceSensitive: false },

  { key: "revenue", group: "ecommerce", common: true, lowerIsBetter: false, format: "currency", sourceSensitive: false },
  { key: "roas", group: "ecommerce", common: true, lowerIsBetter: false, format: "ratio", sourceSensitive: false },
  // العائد على الاستثمار بجانب العائد على الإنفاق - يفترقان عند ثمن البضاعة،
  // وقد يتناقضان: عائدُ إنفاقٍ ٣× على هامش ٢٥٪ خسارة.
  { key: "roi", group: "ecommerce", common: true, lowerIsBetter: false, format: "percent", sourceSensitive: false },
  { key: "orders", group: "ecommerce", common: false, lowerIsBetter: false, format: "number", sourceSensitive: false },
  { key: "aov", group: "ecommerce", common: false, lowerIsBetter: false, format: "currency", sourceSensitive: false },
  { key: "returnedOrders", group: "ecommerce", common: false, lowerIsBetter: true, format: "number", sourceSensitive: false },
  { key: "rtoRate", group: "ecommerce", common: false, lowerIsBetter: true, format: "percent", sourceSensitive: false },
  { key: "profit", group: "ecommerce", common: false, lowerIsBetter: false, format: "currency", sourceSensitive: false },
];


/**
 * مفتاح ترجمة اسم المؤشّر - يُشتقّ من مفتاحه لا يُكتب جدولاً موازياً.
 *
 * كان معرَّفاً داخل `ReportsClient` وحدها، فلمّا احتاجته لوحة الحكم كان
 * البديل نسخَه. مكانه هنا مع تعريف المؤشّرات نفسها.
 */
export function metricLabelKey(k: MetricKey): string {
  return `m${k[0].toUpperCase()}${k.slice(1)}`;
}

export const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export interface ReportFilters {
  platforms?: string[];
  campaignIds?: string[];
  adIds?: string[];
}

export interface ReportConfig {
  source: DataSource;
  dimension: Dimension;
  metrics: MetricKey[];
  filters: ReportFilters;
  range: DateRange;
  compare: DateRange | null;
}

/** صفّ مُجمَّع خام قبل اشتقاق المؤشّرات */
interface Totals {
  cost: number;
  impressions: number;
  clicks: number;
  rawConversions: number;
  verifiedConversions: number;
  revenue: number;
  orders: number;
  returnedOrders: number;
  cogs: number;
  shippingCost: number;
}

export interface ReportRow {
  key: string;
  label: string;
  /** المنصة إن كانت معروفة - للشعار */
  platform: string | null;
  values: Partial<Record<MetricKey, number | null>>;
  compareValues: Partial<Record<MetricKey, number | null>> | null;
  /** الفارق بالنسبة المئوية لكل مؤشّر - null حين لا أساس للمقارنة */
  deltaPct: Partial<Record<MetricKey, number | null>> | null;
}

export interface ComparisonVerdict {
  metric: MetricKey;
  /** مفتاح الصفّ الفائز - null عند التعادل أو تعذّر الحكم */
  winnerKey: string | null;
  winnerLabel: string | null;
  loserLabel: string | null;
  /**
   * رمز المنصّة للطرفين حين يكون البُعد منصّةً - ليُعرض الشعار والاسم
   * المترجَم بدل الرمز الخام.
   *
   * 🔴 كان `winnerLabel` يحمل الرمز نفسه (`META_ADS`) حين يكون البُعد
   * منصّةً، فيقرأ المستخدم شرطةً سفلية وحروفاً كبيرة في بطاقة نتيجة. وهي
   * أيضاً قاعدة المشروع: المحرّك يُرجع الرمز والعرضُ يترجمه بلغة القارئ.
   */
  winnerPlatform: string | null;
  loserPlatform: string | null;
  differencePct: number | null;
  /**
   * الأثر المالي: كم كنت ستوفّر أو تكسب لو كان الأداء الأضعف مثل الأقوى،
   * بحجم الإنفاق الفعلي نفسه. رقم بمعنى لا فارق نسبة مجرّد.
   */
  financialImpact: number | null;
  impactKind: "saving" | "gain" | null;
  /**
   * **الافتراض الذي بُني عليه الرقم، مصوغاً جملةً.**
   *
   * 🔴 كان يُعرَض «كسب محتمل · الأثر على الفترة المختارة: ٧٥٬٨١٥» وحده،
   * وسأل المالك بحقّ: كسبٌ من أين؟ لو فعلتُ ماذا؟ أم لو استمرّ الحال؟
   * الرقم بلا افتراضه لا يُقرأ - وهو **حسابٌ على ما مضى**: ماذا كان
   * سيحدث لو أنّ الطرف الأضعف أدّى كأداء الأقوى، بإنفاقه ونقراته
   * وتحويلاته نفسها في هذه الفترة بالذات. لا توقّع ولا وعد.
   *
   * المفتاح ومتغيّراته لا الجملة الجاهزة: يُعرَض في الواجهة وفي البريد
   * وفي الملفّ المصدَّر، ولكلٍّ لغةُ قارئه.
   */
  impactBasisKey: string | null;
  impactBasisVars: Record<string, number> | null;
}


/**
 * ما تحتاجه لوحة الحكم زيادةً على النتيجة نفسها: أهو حكمٌ يُبنى عليه،
 * وكم كبرت عيّنته، وكيف تحرّك الطرفان عبر الأيّام.
 */
export interface VerdictContext {
  /** أيّام الفترة - عيّنةُ يومين لا يُبنى عليها قرار مهما بلغ فارقها */
  periodDays: number;
  /** التحويلات التي قام عليها الحكم (الطرفان معاً) */
  sampleSize: number;
  /**
   * درجة ثقة **بقاعدة معلنة لا اختبارٍ إحصائيّ**: تكبر بحجم العيّنة،
   * وتزيد قليلاً باتّساع الفارق وطول الفترة. تسميتها «احتمالاً» كانت
   * ستوهم دقّةً لا نملكها - والقاعدة مكتوبة هنا ليقرأها من يشكّ فيها.
   */
  confidencePct: number;
  /** نسبة النقل الآمنة المقترَحة - حدّان لا رقمٌ واحد */
  shiftPct: { min: number; max: number } | null;
  /** السلسلة اليومية للطرفين على المؤشّر الحاسم */
  trend: Array<{ date: string; a: number | null; b: number | null }>;
  /** ما تغيّر عن الفترة السابقة - يُبنى من `deltaPct` لا من سجلٍّ محفوظ */
  changes: Array<{ metric: MetricKey; rowKey: string; label: string; platform: string | null; deltaPct: number }>;
}

export interface ReportResult {
  rows: ReportRow[];
  totals: ReportRow;
  verdicts: ComparisonVerdict[];
  /** ملخّص مكتوب بقواعد ثابتة - صفر استدعاء ذكاء اصطناعي */
  summary: SummaryLine[];
  /** سياق الحكم - `null` حين لا حكم أصلاً (الصفوف ليست اثنين) */
  verdictContext: VerdictContext | null;
  currency: string;
  rowCount: number;
}

export interface SummaryLine {
  key: string;
  vars?: Record<string, string | number>;
  tone: "positive" | "negative" | "neutral";
}

// ==================== الاستخراج ====================

const EMPTY: Totals = {
  cost: 0, impressions: 0, clicks: 0, rawConversions: 0, verifiedConversions: 0,
  revenue: 0, orders: 0, returnedOrders: 0, cogs: 0, shippingCost: 0,
};

function addInto(a: Totals, s: SnapshotLike): void {
  a.cost += s.cost ?? 0;
  a.impressions += s.impressions ?? 0;
  a.clicks += s.clicks ?? 0;
  a.rawConversions += s.rawConversions ?? 0;
  a.verifiedConversions += s.verifiedConversions ?? 0;
  a.revenue += s.revenue ?? 0;
  a.orders += s.ordersCount ?? 0;
  a.returnedOrders += s.returnedOrdersCount ?? 0;
  a.cogs += s.cogs ?? 0;
  a.shippingCost += s.shippingCost ?? 0;
}

interface SnapshotLike {
  platform: string;
  campaignId: string;
  date: Date;
  placementBreakdown: string;
  cost: number;
  impressions: number;
  clicks: number;
  rawConversions: number;
  verifiedConversions: number;
  revenue: number | null;
  ordersCount: number | null;
  returnedOrdersCount: number | null;
  cogs: number | null;
  shippingCost: number | null;
}

/**
 * الاشتقاق. `useVerified` يبدّل معنى "تحويل" بين ما تدّعيه المنصة وما
 * أثبتناه - وهو ما يجعل تكلفة العميل رقمين مختلفين تماماً لا رقماً واحداً.
 */
function derive(tt: Totals, useVerified: boolean): Partial<Record<MetricKey, number | null>> {
  const conv = useVerified ? tt.verifiedConversions : tt.rawConversions;
  const safe = (n: number, d: number) => (d > 0 ? n / d : null);

  const netRevenue = tt.revenue;
  const profit = netRevenue - tt.cost - tt.cogs - tt.shippingCost;

  return {
    cost: tt.cost,
    impressions: tt.impressions,
    clicks: tt.clicks,
    conversions: conv,
    cpa: safe(tt.cost, conv),
    ctr: tt.impressions > 0 ? (tt.clicks / tt.impressions) * 100 : null,
    cpc: safe(tt.cost, tt.clicks),
    cpm: tt.impressions > 0 ? (tt.cost / tt.impressions) * 1000 : null,
    conversionRate: tt.clicks > 0 ? (conv / tt.clicks) * 100 : null,

    verificationRate: tt.rawConversions > 0 ? (tt.verifiedConversions / tt.rawConversions) * 100 : null,
    inflationRate:
      tt.rawConversions > 0
        ? ((tt.rawConversions - tt.verifiedConversions) / tt.rawConversions) * 100
        : null,
    // الإنفاق الذي لم يقابله تحقّق: حصّة التحويلات غير المؤكَّدة من التكلفة
    wastedSpend:
      tt.rawConversions > 0
        ? tt.cost * ((tt.rawConversions - tt.verifiedConversions) / tt.rawConversions)
        : null,

    revenue: tt.revenue > 0 ? tt.revenue : null,
    roas: tt.cost > 0 && tt.revenue > 0 ? tt.revenue / tt.cost : null,
    // 🔴 **يشترط ثمن بضاعةٍ معلوماً، وإلّا لا يُعرض.**
    //
    // `profit` هنا = الإيراد − الإنفاق − ثمن البضاعة − الشحن. فإن كان ثمن
    // البضاعة صفراً (لا متجر موصول، أو تكاليف لم تُضبط)، انهار الحساب إلى
    // «الإيراد − الإنفاق» - وهو العائد على الإنفاق ناقص واحدٍ باسمٍ آخر،
    // يقول «ربحت ٢٠٠٪» لمن لم يربح شيئاً. ومؤشّرٌ يبالغ في الربح أسوأ من
    // مؤشّرٍ غائب، لأنّ صاحبه يزيد إنفاقه بناءً عليه.
    roi: tt.cost > 0 && tt.revenue > 0 && tt.cogs > 0 ? (profit / tt.cost) * 100 : null,
    orders: tt.orders > 0 ? tt.orders : null,
    aov: safe(tt.revenue, tt.orders),
    returnedOrders: tt.returnedOrders > 0 ? tt.returnedOrders : null,
    rtoRate: tt.orders > 0 ? (tt.returnedOrders / tt.orders) * 100 : null,
    profit: tt.revenue > 0 ? profit : null,
  };
}

function bucketKey(s: SnapshotLike, dim: Dimension): string {
  const d = s.date;
  switch (dim) {
    case "platform": return s.platform;
    case "campaign": return `${s.platform}::${s.campaignId}`;
    case "placement": return s.placementBreakdown;
    case "day": return isoDay(d);
    case "week": {
      const c = new Date(d);
      c.setDate(c.getDate() - ((c.getDay() + 1) % 7)); // بداية السبت
      return isoDay(c);
    }
    case "month": return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    default: return "all";
  }
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadSnapshots(
  workspaceId: string,
  range: DateRange,
  filters: ReportFilters
): Promise<SnapshotLike[]> {
  // ⚠️ لا استيراد لحدّ التاريخ هنا: هذا الملفّ يُستورَد من `ReportsClient`
  // (مكوّن متصفّح) للأنواع والثوابت، فاستيراد `next/headers` عبره يكسر
  // البناء - وهو نفس ما وقع مع `automationRules` من قبل. المدى يصل إلى
  // هنا **مقصوصاً** من مستدعيه، وكلاهما على الخادم.
  const bounds = toDateBounds(range);
  // placementBreakdown="ALL" فقط عدا تقارير الأماكن: الصفوف التفصيلية
  // تكرّر نفس الإنفاق مقسَّماً، فجمعها مع المجمّع يضاعف كل رقم.
  const scope = {
    workspaceId,
    date: bounds,
    ...(filters.platforms?.length ? { platform: { in: filters.platforms as never[] } } : {}),
    ...(filters.campaignIds?.length ? { campaignId: { in: filters.campaignIds } } : {}),
  };

  const [rows, verifications] = await Promise.all([
    prisma.metricSnapshot.findMany({
      where: scope,
      select: {
        platform: true, campaignId: true, date: true, placementBreakdown: true,
        cost: true, impressions: true, clicks: true,
        rawConversions: true, verifiedConversions: true,
        revenue: true, ordersCount: true, returnedOrdersCount: true,
        cogs: true, shippingCost: true,
      },
    }),
    prisma.conversionVerification.groupBy({
      by: ["platform", "campaignId", "date"],
      where: scope,
      _sum: { verifiedCount: true },
    }),
  ]);

  const all = rows as unknown as SnapshotLike[];
  const key = (r: { platform: string; campaignId: string; date: Date }) =>
    `${r.platform}|${r.campaignId}|${r.date.toISOString().slice(0, 10)}`;

  // 🔴 **ميتا كانت تختفي من كلّ تقريرٍ غير تقرير الأماكن.**
  //
  // المزامنة تكتب صفّ `ALL` **أو** الصفوف المقسَّمة، لا كليهما (راجع
  // `syncMetaAds.ts:176`). والتجميع أدناه يُبقي صفوف `ALL` وحدها لكلّ بُعدٍ
  // عدا الأماكن - فحملةُ ميتا التي نجح تقسيمُها لا صفّ `ALL` لها، فتسقط
  // من التقرير كلّه: لا إنفاقها ولا تحويلاتها. فيُصطنَع لها صفّ `ALL`
  // بجمع مقسَّماتها حين لا يوجد - ولا يُصطنَع حين يوجد (فيتضاعف).
  const haveAll = new Set(all.filter((r) => r.placementBreakdown === "ALL").map(key));
  const synthesized = new Map<string, SnapshotLike>();
  for (const r of all) {
    if (r.placementBreakdown === "ALL") continue;
    const k = key(r);
    if (haveAll.has(k)) continue;
    const cur = synthesized.get(k);
    if (!cur) {
      synthesized.set(k, { ...r, placementBreakdown: "ALL" });
      continue;
    }
    cur.cost += r.cost ?? 0;
    cur.impressions += r.impressions ?? 0;
    cur.clicks += r.clicks ?? 0;
    cur.rawConversions += r.rawConversions ?? 0;
    cur.verifiedConversions += r.verifiedConversions ?? 0;
    cur.revenue = sumNullable(cur.revenue, r.revenue);
    cur.ordersCount = sumNullable(cur.ordersCount, r.ordersCount);
    cur.returnedOrdersCount = sumNullable(cur.returnedOrdersCount, r.returnedOrdersCount);
    cur.cogs = sumNullable(cur.cogs, r.cogs);
    cur.shippingCost = sumNullable(cur.shippingCost, r.shippingCost);
  }
  const merged = [...all, ...synthesized.values()];

  // overlay التحقّق الحقيقيّ: يعيش في `ConversionVerification` لا على
  // `MetricSnapshot` (راجع `lib/metricRollup.ts`). يُطبَّق على صفّ `ALL`
  // **بعد** الاصطناع أعلاه، فلا يبتلع صفٌّ مصطنَعٌ بلا تكلفةٍ إنفاقَ ميتا.
  // وتقريرُ الأماكن لا يناله: التحقّق لا يحمل مكان ظهور، ونسبتُه إلى أحدها
  // اختلاق.
  if (verifications.length > 0) {
    const allByKey = new Map(
      merged.filter((r) => r.placementBreakdown === "ALL").map((r) => [key(r), r])
    );
    for (const v of verifications) {
      const count = v._sum.verifiedCount ?? 0;
      if (count <= 0) continue;
      const target = allByKey.get(key(v));
      if (target) {
        target.verifiedConversions += count;
      } else {
        merged.push({
          platform: v.platform, campaignId: v.campaignId, date: v.date,
          placementBreakdown: "ALL",
          cost: 0, impressions: 0, clicks: 0, rawConversions: 0,
          verifiedConversions: count,
          revenue: null, ordersCount: null, returnedOrdersCount: null,
          cogs: null, shippingCost: null,
        });
      }
    }
  }

  return merged;
}

/** يجمع قيمتين قد تكونا غائبتين - ويبقى الغياب غياباً حين لا رقم أصلاً:
 *  الصفر يُقرأ «قيس فكان صفراً»، والغياب «لم يُقَس». */
function sumNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

function aggregate(
  snapshots: SnapshotLike[],
  dim: Dimension,
  useVerified: boolean
): { buckets: Map<string, Totals>; total: Totals } {
  const buckets = new Map<string, Totals>();
  const total: Totals = { ...EMPTY };
  const wantsPlacementDetail = dim === "placement";

  for (const s of snapshots) {
    const isAggregate = s.placementBreakdown === "ALL";
    if (wantsPlacementDetail ? isAggregate : !isAggregate) continue;

    const k = bucketKey(s, dim);
    const cur = buckets.get(k) ?? { ...EMPTY };
    addInto(cur, s);
    buckets.set(k, cur);
    addInto(total, s);
  }
  void useVerified;
  return { buckets, total };
}

// ==================== الحكم ====================

function pctDelta(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now === null || now === undefined || before === null || before === undefined) return null;
  if (before === 0) return now === 0 ? 0 : null; // القسمة على صفر ليست "زيادة لا نهائية"
  return ((now - before) / Math.abs(before)) * 100;
}

/**
 * الحكم بين صفّين. الفائز ليس الأكبر رقماً بل الأفضل بحسب معنى المؤشّر،
 * والأثر المالي يُقاس بالإنفاق الفعلي للطرف الأضعف - لا بفارق نسبة مجرّد.
 */
function judge(metric: MetricKey, a: ReportRow, b: ReportRow): ComparisonVerdict {
  const def = METRIC_BY_KEY.get(metric)!;
  const va = a.values[metric];
  const vb = b.values[metric];

  const base: ComparisonVerdict = {
    metric, winnerKey: null, winnerLabel: null, loserLabel: null,
    winnerPlatform: null, loserPlatform: null,
    differencePct: null, financialImpact: null, impactKind: null,
    impactBasisKey: null, impactBasisVars: null,
  };
  if (va === null || va === undefined || vb === null || vb === undefined) return base;
  if (va === vb) return base;

  const aWins = def.lowerIsBetter ? va < vb : va > vb;
  const winner = aWins ? a : b;
  const loser = aWins ? b : a;
  const wv = aWins ? va : vb;
  const lv = aWins ? vb : va;

  const differencePct = lv === 0 ? null : (Math.abs(wv - lv) / Math.abs(lv)) * 100;

  // الأثر المالي محسوب فقط حيث يكون له معنى مالي حقيقي
  let financialImpact: number | null = null;
  let impactKind: "saving" | "gain" | null = null;

  let impactBasisKey: string | null = null;
  let impactBasisVars: Record<string, number> | null = null;

  if (metric === "cpa" && wv > 0) {
    const loserConv = loser.values.conversions ?? 0;
    financialImpact = Math.max(0, (lv - wv) * loserConv);
    impactKind = "saving";
    impactBasisKey = "basisCpa";
    impactBasisVars = { conv: round(loserConv), cpaWin: round(wv), cpaLose: round(lv), value: round(financialImpact) };
  } else if (metric === "roas") {
    const loserCost = loser.values.cost ?? 0;
    financialImpact = Math.max(0, (wv - lv) * loserCost);
    impactKind = "gain";
    impactBasisKey = "basisRoas";
    impactBasisVars = { roasWin: round(wv), roasLose: round(lv), cost: round(loserCost), value: round(financialImpact) };
  } else if (metric === "conversionRate") {
    const loserClicks = loser.values.clicks ?? 0;
    const extraConv = ((wv - lv) / 100) * loserClicks;
    const loserCpa = loser.values.cpa;
    financialImpact = loserCpa ? Math.max(0, extraConv * loserCpa) : null;
    impactKind = "gain";
    if (financialImpact !== null) {
      impactBasisKey = "basisRate";
      // التحويلات الإضافية تُقوَّم بتكلفة التحويل عند الطرف الأضعف: هي
      // ما كان سيدفعه ليحصل عليها، فقيمتُها ما وفّره بالحصول عليها مجّاناً.
      impactBasisVars = { clicks: round(loserClicks), rateWin: round(wv), extra: Math.round(extraConv), value: round(financialImpact) };
    }
  } else if (metric === "wastedSpend" || metric === "inflationRate") {
    const loserCost = loser.values.cost ?? 0;
    financialImpact = metric === "wastedSpend" ? Math.max(0, lv - wv) : Math.max(0, ((lv - wv) / 100) * loserCost);
    impactKind = "saving";
    impactBasisKey = "basisSaving";
    impactBasisVars = { value: round(financialImpact) };
  }

  return {
    metric,
    winnerKey: winner.key,
    winnerLabel: winner.label,
    loserLabel: loser.label,
    winnerPlatform: winner.platform,
    loserPlatform: loser.platform,
    differencePct,
    financialImpact,
    impactKind,
    impactBasisKey,
    impactBasisVars,
  };
}


// ==================== سياق الحكم ====================

/**
 * درجة الثقة بقاعدة صريحة.
 *
 * **ليست اختباراً إحصائياً ولا تدّعي أن تكون.** ثلاثة عوامل تُقرأ كما
 * يقرؤها ميديا باير: كم تحويلاً وراء الرقم، وكم اتّسع الفارق، وكم طالت
 * الفترة. عيّنة صغيرة تخفض الثقة مهما بدا الفارق هائلاً - وهي بالضبط
 * الحالة التي يُتّخذ فيها أسوأ القرارات.
 */
function confidenceOf(sample: number, gapPct: number, days: number): number {
  let base = sample >= 1000 ? 88 : sample >= 200 ? 78 : sample >= 50 ? 62 : 40;
  if (gapPct >= 20) base += 4;
  if (days >= 21) base += 3;
  return Math.min(95, base);
}

function buildVerdictContext(args: {
  snapshots: SnapshotLike[];
  rows: ReportRow[];
  verdicts: ComparisonVerdict[];
  dimension: Dimension;
  useVerified: boolean;
  range: DateRange;
  headline: ComparisonVerdict | null;
}): VerdictContext | null {
  const { snapshots, rows, verdicts, dimension, useVerified, range, headline } = args;
  if (rows.length !== 2 || !headline) return null;

  const bounds = toDateBounds(range);
  const periodDays = Math.max(
    1,
    Math.round((bounds.lte.getTime() - bounds.gte.getTime()) / 86_400_000) + 1,
  );

  const sampleSize = rows.reduce((n, r) => n + (r.values.conversions ?? 0), 0);
  const gap = Math.abs(headline.differencePct ?? 0);

  // السلسلة اليومية تُبنى من اللقطات المحمَّلة أصلاً - لا استعلام ثانٍ.
  // الأيّام قليلة والصفوف في الذاكرة، فالتجميع هنا أرخص من نداء قاعدة.
  const wantsPlacementDetail = dimension === "placement";
  const byDay = new Map<string, Map<string, Totals>>();
  for (const snap of snapshots) {
    // نفس شرط `aggregate` حرفاً: الصفوف التفصيلية تكرّر الإنفاق مقسَّماً،
    // وخلطُها بالمجمّع يضاعف كلّ نقطة في الرسم.
    const isAggregate = snap.placementBreakdown === "ALL";
    if (wantsPlacementDetail ? isAggregate : !isAggregate) continue;

    const day = snap.date.toISOString().slice(0, 10);
    const key = bucketKey(snap, dimension);
    let dayMap = byDay.get(day);
    if (!dayMap) { dayMap = new Map(); byDay.set(day, dayMap); }
    const t = dayMap.get(key) ?? { ...EMPTY };
    addInto(t, snap);
    dayMap.set(key, t);
  }

  const metric = headline.metric;
  const trend = [...byDay.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([date, dayMap]) => {
      const ta = dayMap.get(rows[0].key);
      const tb = dayMap.get(rows[1].key);
      return {
        date,
        a: ta ? derive(ta, useVerified)[metric] ?? null : null,
        b: tb ? derive(tb, useVerified)[metric] ?? null : null,
      };
    });

  // «ما تغيّر»: من مقارنة الفترة السابقة لا من سجلٍّ نحتفظ به. أكبر ثلاثة
  // تحرّكات، فسردُ كلّ مؤشّر تحرّك بواحد بالمئة ضجيجٌ لا خبر.
  const changes = rows
    .flatMap((r) =>
      (verdicts.map((v) => v.metric) as MetricKey[]).map((m) => {
        const d = r.deltaPct?.[m];
        return d === null || d === undefined
          ? null
          : { metric: m, rowKey: r.key, label: r.label, platform: r.platform, deltaPct: d };
      }),
    )
    .filter((c): c is NonNullable<typeof c> => c !== null && Math.abs(c.deltaPct) >= 3)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 3);

  return {
    periodDays,
    sampleSize,
    confidencePct: confidenceOf(sampleSize, gap, periodDays),
    // الحدّان من ممارسة مؤكَّدة لا من تقدير: عشرون بالمئة سقفُ الزيادة
    // الآمنة في جولة واحدة (`SAFE_SCALE_INCREASE_PCT`)، وخمسة عشر أدناها
    // كي تُقرأ النتيجة أصلاً. ولا تُقترَح إن كان الفارق أضيق من ذلك.
    shiftPct: gap >= 15 ? { min: 15, max: 20 } : null,
    trend,
    changes,
  };
}

// ==================== الملخّص (بقواعد ثابتة) ====================

/**
 * ملخّص مكتوب بقواعد صريحة - **صفر استدعاء ذكاء اصطناعي**، بقرار واعٍ:
 * سقف تكلفة Claude محجوز لتحليلات لا يمكن اشتقاقها حسابياً، وهذه يمكن.
 * النتيجة أيضاً حتمية: نفس البيانات تُنتج نفس الجملة دائماً.
 */
function buildSummary(result: {
  rows: ReportRow[];
  totals: ReportRow;
  verdicts: ComparisonVerdict[];
  hasCompare: boolean;
}): SummaryLine[] {
  const out: SummaryLine[] = [];
  const { rows, totals, verdicts, hasCompare } = result;

  if (rows.length === 0) return [{ key: "sNoData", tone: "neutral" }];

  const infl = totals.values.inflationRate;
  if (infl !== null && infl !== undefined) {
    out.push({
      key: infl >= 40 ? "sInflationHigh" : infl >= 20 ? "sInflationMid" : "sInflationLow",
      vars: { pct: round(infl) },
      tone: infl >= 40 ? "negative" : infl >= 20 ? "neutral" : "positive",
    });
  }

  const wasted = totals.values.wastedSpend;
  if (wasted !== null && wasted !== undefined && wasted > 0) {
    out.push({ key: "sWasted", vars: { value: round(wasted) }, tone: "negative" });
  }

  // أفضل وأضعف صفّ بتكلفة العميل - القرار الأكثر تكراراً في الاستخدام اليومي
  const withCpa = rows.filter((r) => typeof r.values.cpa === "number" && (r.values.cpa as number) > 0);
  if (withCpa.length >= 2) {
    const sorted = [...withCpa].sort((a, b) => (a.values.cpa as number) - (b.values.cpa as number));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const ratio = (worst.values.cpa as number) / (best.values.cpa as number);
    if (ratio >= 1.2) {
      out.push({
        key: "sCpaSpread",
        vars: { best: best.label, worst: worst.label, times: ratio.toFixed(1) },
        tone: "neutral",
      });
    }
  }

  // صفوف تصرف بلا نتيجة مؤكّدة - أوضح إشارة إهدار في المنتج
  const dead = rows.filter((r) => (r.values.cost ?? 0) > 0 && (r.values.conversions ?? 0) === 0);
  if (dead.length > 0) {
    const deadCost = dead.reduce((s, r) => s + (r.values.cost ?? 0), 0);
    out.push({ key: "sDeadRows", vars: { n: dead.length, value: round(deadCost) }, tone: "negative" });
  }

  if (hasCompare) {
    const costDelta = totals.deltaPct?.cost;
    const convDelta = totals.deltaPct?.conversions;
    if (typeof costDelta === "number" && typeof convDelta === "number") {
      // الإشارة وحدها لا تكفي: الحكم من العلاقة بين الإنفاق والنتيجة
      const key =
        costDelta > 5 && convDelta < -5 ? "sSpendUpConvDown"
        : costDelta < -5 && convDelta > 5 ? "sSpendDownConvUp"
        : convDelta > 5 ? "sConvUp"
        : convDelta < -5 ? "sConvDown"
        : "sStable";
      out.push({
        key,
        vars: { cost: round(Math.abs(costDelta)), conv: round(Math.abs(convDelta)) },
        tone: key === "sSpendUpConvDown" || key === "sConvDown" ? "negative"
            : key === "sStable" ? "neutral" : "positive",
      });
    }
  }

  const topVerdict = verdicts.find((v) => v.financialImpact && v.financialImpact > 0);
  if (topVerdict) {
    out.push({
      key: topVerdict.impactKind === "saving" ? "sImpactSaving" : "sImpactGain",
      vars: {
        winner: topVerdict.winnerLabel ?? "",
        loser: topVerdict.loserLabel ?? "",
        value: round(topVerdict.financialImpact ?? 0),
      },
      tone: "positive",
    });
  }

  return out.length > 0 ? out : [{ key: "sNothingNotable", tone: "neutral" }];
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// ==================== الواجهة العامّة ====================

export async function runReport(
  workspaceId: string,
  config: ReportConfig,
  labels: { currency: string; campaignNames: Map<string, string> }
): Promise<ReportResult> {
  const useVerified = config.source === "VERIFIED";

  const [current, previous] = await Promise.all([
    loadSnapshots(workspaceId, config.range, config.filters),
    config.compare ? loadSnapshots(workspaceId, config.compare, config.filters) : Promise.resolve([]),
  ]);

  const cur = aggregate(current, config.dimension, useVerified);
  const prev = config.compare ? aggregate(previous, config.dimension, useVerified) : null;

  const rows: ReportRow[] = [];
  for (const [key, tt] of cur.buckets) {
    const values = derive(tt, useVerified);
    const prevT = prev?.buckets.get(key) ?? null;
    const compareValues = prevT ? derive(prevT, useVerified) : null;

    const deltaPct: Partial<Record<MetricKey, number | null>> | null = compareValues ? {} : null;
    if (compareValues && deltaPct) {
      for (const m of config.metrics) deltaPct[m] = pctDelta(values[m], compareValues[m]);
    }

    rows.push({
      key,
      label: labelFor(key, config.dimension, labels.campaignNames),
      platform: platformOf(key, config.dimension),
      values,
      compareValues,
      deltaPct,
    });
  }

  // الترتيب بالإنفاق افتراضياً عدا الأبعاد الزمنية - الزمن يُقرأ بترتيبه
  const timeDim = config.dimension === "day" || config.dimension === "week" || config.dimension === "month";
  rows.sort((a, b) => (timeDim ? a.key.localeCompare(b.key) : (b.values.cost ?? 0) - (a.values.cost ?? 0)));

  const totalValues = derive(cur.total, useVerified);
  const totalCompare = prev ? derive(prev.total, useVerified) : null;
  const totalDelta: Partial<Record<MetricKey, number | null>> | null = totalCompare ? {} : null;
  if (totalCompare && totalDelta) {
    for (const m of config.metrics) totalDelta[m] = pctDelta(totalValues[m], totalCompare[m]);
  }

  const totals: ReportRow = {
    key: "__total__",
    label: "",
    platform: null,
    values: totalValues,
    compareValues: totalCompare,
    deltaPct: totalDelta,
  };

  // الحكم يُبنى فقط حين تكون المقارنة بين طرفين محدَّدين - إصدار حكم
  // "فائز" على عشرين صفّاً بلا سياق أسوأ من عدم إصداره.
  const verdicts =
    rows.length === 2
      ? config.metrics.map((m) => judge(m, rows[0], rows[1])).filter((v) => v.winnerKey !== null)
      : [];

  const headline =
    [...verdicts].sort((a, b) => (b.financialImpact ?? 0) - (a.financialImpact ?? 0))[0] ?? null;

  return {
    rows,
    totals,
    verdicts,
    summary: buildSummary({ rows, totals, verdicts, hasCompare: config.compare !== null }),
    verdictContext: buildVerdictContext({
      snapshots: current,
      rows,
      verdicts,
      dimension: config.dimension,
      useVerified,
      range: config.range,
      headline,
    }),
    currency: labels.currency,
    rowCount: rows.length,
  };
}

function labelFor(key: string, dim: Dimension, names: Map<string, string>): string {
  if (dim === "campaign") {
    const id = key.split("::")[1] ?? key;
    return names.get(id) ?? id;
  }
  return key;
}

function platformOf(key: string, dim: Dimension): string | null {
  if (dim === "platform") return key;
  if (dim === "campaign") return key.split("::")[0] ?? null;
  return null;
}
