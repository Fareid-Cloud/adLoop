
import { platformLabel } from "@/lib/i18n/dictionary";// lib/attributionModels.ts
//
// ثمانية نماذج إسناد تعمل على مسار اللمسات نفسه، فتُقارَن جنباً إلى جنب.
//
// لماذا المقارنة هي الميزة لا النموذج الواحد: كل منصة إعلانية تنسب التحويل
// لنفسها بنموذج "آخر لمسة داخل نافذتها" - فمجموع ما تدّعيه المنصات مجتمعةً
// يفوق عدد التحويلات الحقيقي دائماً. عرض النماذج جنباً إلى جنب هو الطريقة
// الوحيدة لرؤية أي قناة تأخذ فضلاً ليس لها، وأي قناة تُبخَس حقها لأنها
// تعمل في أول الرحلة (وعي) لا في آخرها (حصاد).
//
// الملف **بلا أي استيراد** عن قصد: دوال حسابية صرفة تعمل على الخادم وداخل
// مكوّنات العميل معاً، ولا تجرّ Prisma ولا أي مكتبة إلى حزمة المتصفح.
// نفس نمط automationRuleDefinitions.ts وexperimentMetrics.ts وpricingCalculator.ts.

// ==================== الأنواع ====================

export interface PathTouch {
  id: string;
  platform: string | null; // GOOGLE_ADS | META_ADS | TIKTOK_ADS | ...
  channel: string; // TouchpointChannel
  kind: string; // TouchpointKind
  campaignId: string | null;
  adSetId: string | null;
  adId: string | null;
  source: string | null;
  // epoch بالمللي ثانية لا كائن Date - يعبر حدود الخادم/العميل بلا تسلسل
  occurredAt: number;
}

export interface ConversionPath {
  conversionId: string;
  value: number;
  verified: boolean;
  convertedAt: number;
  /** مرتّبة تصاعدياً زمنياً */
  touches: PathTouch[];
  /** المنصة التي أعلنت هذا التحويل لنفسها، إن عُرفت - أساس نموذج المصدر المحدَّد */
  platformReported: string | null;
}

export type AttributionModelKey =
  | "FIRST_TOUCH"
  | "LAST_TOUCH"
  | "LAST_NON_DIRECT"
  | "SOURCE_SPECIFIC"
  | "LINEAR"
  | "LINEAR_PAID"
  | "U_SHAPED"
  | "TIME_DECAY";

export interface AttributionModelDef {
  key: AttributionModelKey;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** هل يميل النموذج لصالح أعلى القمع (وعي) أم أسفله (حصاد) - يُستخدم في التفسير */
  bias: "UPPER_FUNNEL" | "LOWER_FUNNEL" | "BALANCED";
}

export const ATTRIBUTION_MODELS: AttributionModelDef[] = [
  {
    key: "FIRST_TOUCH",
    labelAr: "أول لمسة",
    labelEn: "First touch",
    descriptionAr:
      "كل الفضل للقناة التي عرّفت العميل بك أول مرة. تُظهر ما يبني الطلب، وتتجاهل ما يُغلقه.",
    descriptionEn:
      "All credit to the channel that first introduced the customer. Shows what creates demand, ignores what closes it.",
    bias: "UPPER_FUNNEL",
  },
  {
    key: "LAST_TOUCH",
    labelAr: "آخر لمسة",
    labelEn: "Last touch",
    descriptionAr:
      "كل الفضل لآخر قناة قبل التحويل. النموذج الافتراضي في أغلب الأدوات، وأكثرها تحيّزاً لقنوات الحصاد.",
    descriptionEn:
      "All credit to the last channel before conversion. The default nearly everywhere, and the most biased toward harvesting channels.",
    bias: "LOWER_FUNNEL",
  },
  {
    key: "LAST_NON_DIRECT",
    labelAr: "آخر لمسة غير مباشرة",
    labelEn: "Last non-direct",
    descriptionAr:
      "يتجاهل الزيارة المباشرة الأخيرة وينسب لآخر قناة تسويقية فعلية. يصحّح تضخّم «مباشر» الناتج عن كتابة الرابط يدوياً.",
    descriptionEn:
      "Skips a final direct visit and credits the last real marketing channel. Corrects the Direct inflation caused by typed URLs.",
    bias: "LOWER_FUNNEL",
  },
  {
    key: "SOURCE_SPECIFIC",
    labelAr: "ما تدّعيه المنصة",
    labelEn: "Platform-claimed",
    descriptionAr:
      "ينسب التحويل للمنصة التي أعلنته لنفسها. ليس نموذجاً «عادلاً» - هو مرآة لما تقوله لوحات المنصات، ووجوده هنا ليُقارَن به لا ليُصدَّق.",
    descriptionEn:
      "Credits whichever platform claimed the conversion. Not a fair model - it mirrors what the platform dashboards say, and exists here to be compared against, not believed.",
    bias: "LOWER_FUNNEL",
  },
  {
    key: "LINEAR",
    labelAr: "توزيع متساوٍ",
    labelEn: "Linear",
    descriptionAr: "كل لمسة في الرحلة تأخذ حصة متساوية. أبسط نموذج متعدّد اللمسات وأقلها افتراضات.",
    descriptionEn: "Every touch in the journey gets an equal share. The simplest multi-touch model, with the fewest assumptions.",
    bias: "BALANCED",
  },
  {
    key: "LINEAR_PAID",
    labelAr: "توزيع متساوٍ - المدفوع فقط",
    labelEn: "Linear paid",
    descriptionAr:
      "توزيع متساوٍ على اللمسات المدفوعة وحدها. يجيب سؤال الميزانية مباشرة: كل ريال أُنفق، أين ذهب أثره؟",
    descriptionEn:
      "Equal split across paid touches only. Answers the budget question directly: for every riyal spent, where did its effect land?",
    bias: "BALANCED",
  },
  {
    key: "U_SHAPED",
    labelAr: "على شكل U",
    labelEn: "U-shaped",
    descriptionAr:
      "٤٠٪ لأول لمسة و٤٠٪ لآخر لمسة و٢٠٪ تُوزَّع على ما بينهما. يعترف بأن التعريف والإغلاق أهم لحظتين.",
    descriptionEn:
      "40% first, 40% last, 20% spread across the middle. Recognises that discovery and closing are the two decisive moments.",
    bias: "BALANCED",
  },
  {
    key: "TIME_DECAY",
    labelAr: "التلاشي الزمني",
    labelEn: "Time decay",
    descriptionAr:
      "كلما اقتربت اللمسة من لحظة الشراء زاد وزنها (نصف العمر ٧ أيام). مناسب لدورات البيع القصيرة.",
    descriptionEn:
      "The closer a touch is to the purchase, the more weight it carries (7-day half-life). Suits short sales cycles.",
    bias: "LOWER_FUNNEL",
  },
];

export const TIME_DECAY_HALF_LIFE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const PAID_CHANNELS = new Set(["PAID_SEARCH", "PAID_SOCIAL", "PAID_VIDEO"]);

export function isPaidTouch(touch: PathTouch): boolean {
  return PAID_CHANNELS.has(touch.channel);
}

// ==================== توزيع الفضل داخل مسار واحد ====================

/**
 * تُعيد وزناً لكل لمسة في المسار، مجموعه 1 (أو 0 إن تعذّر الإسناد أصلاً -
 * مثل مسار عضوي بالكامل في نموذج «المدفوع فقط»). المجموع صفر حالة صحيحة
 * ومقصودة، لا خطأ: تعني «هذا التحويل لا يخصّ الإنفاق الإعلاني».
 */
export function distributeCredit(path: ConversionPath, model: AttributionModelKey): number[] {
  const n = path.touches.length;
  if (n === 0) return [];

  const zeros = () => new Array(n).fill(0) as number[];

  switch (model) {
    case "FIRST_TOUCH": {
      const w = zeros();
      w[0] = 1;
      return w;
    }

    case "LAST_TOUCH": {
      const w = zeros();
      w[n - 1] = 1;
      return w;
    }

    case "LAST_NON_DIRECT": {
      const w = zeros();
      for (let i = n - 1; i >= 0; i--) {
        if (path.touches[i].channel !== "DIRECT") {
          w[i] = 1;
          return w;
        }
      }
      // المسار كله مباشر - لا توجد قناة تسويقية تستحق الفضل، فنعطيه لآخر
      // لمسة بدل أن نفقد التحويل من الحساب تماماً
      w[n - 1] = 1;
      return w;
    }

    case "SOURCE_SPECIFIC": {
      const w = zeros();
      if (!path.platformReported) return w; // لم تدّعِه أي منصة - يبقى بلا إسناد
      // آخر لمسة تخص المنصة المدّعية (وهي فعلياً ما تراه تلك المنصة)
      for (let i = n - 1; i >= 0; i--) {
        if (path.touches[i].platform === path.platformReported) {
          w[i] = 1;
          return w;
        }
      }
      // ادّعت المنصة التحويل ولا توجد لمسة مسجّلة لها عندنا إطلاقاً.
      // هذه ليست حالة تُهمَل - هي بالضبط الفجوة التي يقيسها المنتج،
      // ويلتقطها countUnbackedClaims() أدناه.
      return w;
    }

    case "LINEAR": {
      return new Array(n).fill(1 / n);
    }

    case "LINEAR_PAID": {
      const paidIdx = path.touches.map((t, i) => (isPaidTouch(t) ? i : -1)).filter((i) => i >= 0);
      if (paidIdx.length === 0) return zeros();
      const w = zeros();
      for (const i of paidIdx) w[i] = 1 / paidIdx.length;
      return w;
    }

    case "U_SHAPED": {
      if (n === 1) return [1];
      if (n === 2) return [0.5, 0.5];
      const w = zeros();
      w[0] = 0.4;
      w[n - 1] = 0.4;
      const middle = n - 2;
      for (let i = 1; i < n - 1; i++) w[i] = 0.2 / middle;
      return w;
    }

    case "TIME_DECAY": {
      const raw = path.touches.map((t) => {
        const daysBefore = Math.max(0, (path.convertedAt - t.occurredAt) / DAY_MS);
        return Math.pow(2, -daysBefore / TIME_DECAY_HALF_LIFE_DAYS);
      });
      const total = raw.reduce((s, v) => s + v, 0);
      if (total <= 0) return zeros();
      return raw.map((v) => v / total);
    }
  }
}

// ==================== التجميع عبر المسارات ====================

export type AttributionDimension = "platform" | "channel" | "campaign" | "ad";

function dimensionKey(touch: PathTouch, dimension: AttributionDimension): string | null {
  switch (dimension) {
    case "platform":
      return touch.platform;
    case "channel":
      return touch.channel;
    case "campaign":
      return touch.campaignId;
    case "ad":
      return touch.adId;
  }
}

export interface AttributionCredit {
  key: string;
  /** عدد التحويلات المنسوبة (كسري - التحويل الواحد يُقسَّم على عدة قنوات) */
  conversions: number;
  /** الإيراد المنسوب بنفس التقسيم */
  revenue: number;
  /** التحويلات المتحقّق منها فقط - طبقة الحقيقة داخل الإسناد نفسه */
  verifiedConversions: number;
}

export function attributeByModel(
  paths: ConversionPath[],
  model: AttributionModelKey,
  dimension: AttributionDimension = "platform"
): Map<string, AttributionCredit> {
  const out = new Map<string, AttributionCredit>();

  for (const path of paths) {
    const weights = distributeCredit(path, model);
    for (let i = 0; i < path.touches.length; i++) {
      const w = weights[i];
      if (w <= 0) continue;
      const key = dimensionKey(path.touches[i], dimension);
      if (!key) continue;

      const cur = out.get(key) ?? { key, conversions: 0, revenue: 0, verifiedConversions: 0 };
      cur.conversions += w;
      cur.revenue += w * path.value;
      if (path.verified) cur.verifiedConversions += w;
      out.set(key, cur);
    }
  }

  return out;
}

// ==================== المقارنة - القيمة الحقيقية للملف ====================

export interface ModelComparisonRow {
  key: string; // القناة/المنصة
  /** الفضل حسب كل نموذج، بنفس ترتيب ATTRIBUTION_MODELS */
  byModel: Record<AttributionModelKey, AttributionCredit>;
  /** ما تدّعيه المنصة لنفسها */
  claimed: number;
  /** متوسط النماذج متعددة اللمسات (linear, linear paid, u-shaped, time decay) */
  multiTouchAverage: number;
  /**
   * موجب = النموذج متعدد اللمسات يعطيها أكثر مما تدّعيه لنفسها ⇒ **مبخوسة**،
   * غالباً قناة أعلى القمع تُبنى عليها رحلات تُغلَق في مكان آخر.
   * سالب = تدّعي لنفسها أكثر مما تستحق ⇒ **متضخّمة**.
   */
  creditGap: number;
  creditGapPct: number | null;
  verdict: "UNDER_CREDITED" | "OVER_CREDITED" | "FAIR";
}

const MULTI_TOUCH_MODELS: AttributionModelKey[] = ["LINEAR", "LINEAR_PAID", "U_SHAPED", "TIME_DECAY"];

// عتبة اعتبار الفرق ذا معنى. أقل منها ضجيج تقريب لا إشارة - ١٥٪ متحفّظة
// بما يكفي لألّا نصف قناة بالتضخّم لفارق تقريب.
const CREDIT_GAP_SIGNIFICANCE_PCT = 15;

export function compareModels(
  paths: ConversionPath[],
  dimension: AttributionDimension = "platform"
): ModelComparisonRow[] {
  const perModel = new Map<AttributionModelKey, Map<string, AttributionCredit>>();
  for (const def of ATTRIBUTION_MODELS) {
    perModel.set(def.key, attributeByModel(paths, def.key, dimension));
  }

  const allKeys = new Set<string>();
  for (const map of perModel.values()) for (const k of map.keys()) allKeys.add(k);

  const empty = (key: string): AttributionCredit => ({ key, conversions: 0, revenue: 0, verifiedConversions: 0 });

  const rows: ModelComparisonRow[] = [];
  for (const key of allKeys) {
    const byModel = {} as Record<AttributionModelKey, AttributionCredit>;
    for (const def of ATTRIBUTION_MODELS) {
      byModel[def.key] = perModel.get(def.key)!.get(key) ?? empty(key);
    }

    const claimed = byModel.SOURCE_SPECIFIC.conversions;
    const multiTouchAverage =
      MULTI_TOUCH_MODELS.reduce((s, m) => s + byModel[m].conversions, 0) / MULTI_TOUCH_MODELS.length;

    const creditGap = multiTouchAverage - claimed;
    const creditGapPct = claimed > 0 ? (creditGap / claimed) * 100 : null;

    let verdict: ModelComparisonRow["verdict"] = "FAIR";
    if (creditGapPct !== null) {
      if (creditGapPct > CREDIT_GAP_SIGNIFICANCE_PCT) verdict = "UNDER_CREDITED";
      else if (creditGapPct < -CREDIT_GAP_SIGNIFICANCE_PCT) verdict = "OVER_CREDITED";
    } else if (multiTouchAverage > 0) {
      // تساهم في رحلات حقيقية ولا تدّعي شيئاً لنفسها إطلاقاً - أوضح
      // صورة للقناة المبخوسة
      verdict = "UNDER_CREDITED";
    }

    rows.push({ key, byModel, claimed, multiTouchAverage, creditGap, creditGapPct, verdict });
  }

  return rows.sort((a, b) => b.multiTouchAverage - a.multiTouchAverage);
}

/**
 * تحويلات ادّعتها منصة ولا نملك لها أي لمسة مسجّلة. رقم صريح بدل تقدير:
 * إمّا الوسم ناقص على تلك المنصة، وإمّا الادّعاء نفسه لا سند له.
 */
export function countUnbackedClaims(paths: ConversionPath[]): number {
  return paths.filter(
    (p) => p.platformReported && !p.touches.some((t) => t.platform === p.platformReported)
  ).length;
}

// ==================== وصف الرحلة نفسها ====================

export interface JourneyStats {
  totalPaths: number;
  singleTouchPaths: number;
  multiTouchPaths: number;
  multiTouchRatePct: number;
  avgTouchesPerConversion: number;
  avgDaysToConvert: number;
  /** مسارات لمستها أكثر من منصة إعلانية - الحالة التي يستحيل فيها أن تكون
   *  أي لوحة منصة منفردة صادقة، لأن كلاً منها لا ترى إلا نفسها */
  crossPlatformPaths: number;
  crossPlatformRatePct: number;
  /** أكثر تسلسلات القنوات تكراراً */
  topSequences: Array<{ sequence: string[]; count: number; revenue: number }>;
}

export function computeJourneyStats(paths: ConversionPath[], topN = 5): JourneyStats {
  const total = paths.length;
  if (total === 0) {
    return {
      totalPaths: 0,
      singleTouchPaths: 0,
      multiTouchPaths: 0,
      multiTouchRatePct: 0,
      avgTouchesPerConversion: 0,
      avgDaysToConvert: 0,
      crossPlatformPaths: 0,
      crossPlatformRatePct: 0,
      topSequences: [],
    };
  }

  let single = 0;
  let touchSum = 0;
  let daysSum = 0;
  let crossPlatform = 0;
  const sequences = new Map<string, { sequence: string[]; count: number; revenue: number }>();

  for (const p of paths) {
    const n = p.touches.length;
    touchSum += n;
    if (n <= 1) single++;

    if (n > 0) {
      daysSum += Math.max(0, (p.convertedAt - p.touches[0].occurredAt) / DAY_MS);
    }

    const platforms = new Set(p.touches.map((t) => t.platform).filter(Boolean));
    if (platforms.size > 1) crossPlatform++;

    // نضغط التكرار المتتالي لنفس القناة: زيارتان متتاليتان من نفس المصدر
    // رحلة واحدة لا نمطان مختلفان
    // 🔴 كان `platformLabel("ar", ...)` هنا: الاسم يُترجَم **وقت الحساب**
    // فيُخزَّن نصّاً عربياً في البيانات، فيقرأه المستخدم الإنجليزيّ «ميتا»
    // بجانب «Other» الإنجليزية في البطاقة نفسها. الرمز الخام هو ما يُحفظ،
    // والترجمة تقع عند العرض بلغة القارئ - نفس قاعدة `titleKey` في التنبيهات.
    const seq: string[] = [];
    for (const t of p.touches) {
      const token = t.platform || t.channel;
      if (seq[seq.length - 1] !== token) seq.push(token);
    }
    const seqKey = seq.join(" → ");
    const cur = sequences.get(seqKey) ?? { sequence: seq, count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += p.value;
    sequences.set(seqKey, cur);
  }

  return {
    totalPaths: total,
    singleTouchPaths: single,
    multiTouchPaths: total - single,
    multiTouchRatePct: round1(((total - single) / total) * 100),
    avgTouchesPerConversion: round1(touchSum / total),
    avgDaysToConvert: round1(daysSum / total),
    crossPlatformPaths: crossPlatform,
    crossPlatformRatePct: round1((crossPlatform / total) * 100),
    topSequences: [...sequences.values()].sort((a, b) => b.count - a.count).slice(0, topN),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
