// lib/returnMetrics.ts
//
// **تعريفٌ واحدٌ للعائد، تستعمله كلّ صفحة.**
//
// 🔴 السبب من واقعةٍ حدثت: كان في المنتج «ROAS المتحقَّق» في صفحة المنصّة،
// و«ROAS» في مركز الحقيقة، و«العائد الحقيقي» في الأتمتة - ثلاثة أسماء
// لحسابات مختلفة، فسأل المالك بحقّ: «يعني ايه verified roas؟ هو نفس الرقم
// بديهياً». ورقمان مختلفان لشيءٍ واحد يُفقدان الثقة في الاثنين معاً.
//
// فالحساب هنا وحده، والصفحات تُغذّيه ولا تُعيد تعريفه:
//
//   ROAS = الإيراد ÷ الإنفاق الإعلانيّ            «بكم باع كلّ ريالٍ أنفقتَه»
//   ROI  = (الربح − الإنفاق) ÷ الإنفاق × ١٠٠      «وهل ربحتَ منه فعلاً»
//
// **والفرق بينهما هو ثمن البضاعة.** حسابٌ بعائد ٣× وهامشٍ ٢٥٪ خاسرٌ فعلاً:
// من كلّ ثلاثة ريالات عائدة، ريالان وربع ثمنُ المنتج - فالباقي أقلّ ممّا
// دُفع للإعلان. ولهذا لا يُعرض أحدهما دون الآخر.
//
// ═══ الاختلاف المشروع الوحيد: **دقّة معرفتنا بالربح، لا تعريفه** ═══
//
// `grossProfit` هو الربح **قبل** خصم الإعلان، ويصل إلينا بدقّتين:
//
//   • صفحات الإعلانات: الإيراد × هامش الربح المضبوط في الإعدادات - تقديرٌ
//     بنسبةٍ واحدةٍ لكلّ المبيعات.
//   • صفحات المتجر: التكاليف الحقيقية مطروحةً بندًا بندًا (بضاعة، شحن،
//     رسوم، مرتجعات) - أدقّ بكثير لأنّ البيانات هناك أغنى.
//
// المعنى واحدٌ في الحالتين («كم ربحتُ من كلّ ريالٍ للإعلان»)، والدقّة تختلف،
// **وتُذكر الدقّة للقارئ** عبر `basis` - لا تُخفى.

/** من أين جاء البسط - يُعرَض للقارئ، فرقمٌ بلا مصدره ادّعاء. */
export type RevenueBasis =
  /** قيمة التحويل التي تنسبها المنصّة الإعلانية لإعلانها هي */
  | "AD_ATTRIBUTED"
  /** مبيعات المتجر الفعلية - تشمل ما جاء بلا إعلان */
  | "STORE_TOTAL";

/** كيف عرفنا الربح - يفصل التقدير عن المقروء. */
export type ProfitBasis =
  /** الإيراد × نسبة هامشٍ واحدة من الإعدادات */
  | "MARGIN_PCT"
  /** التكاليف الحقيقية مطروحةً بنداً بنداً */
  | "REAL_COSTS"
  /** لا نعرف الربح - يُعرَض العائد وحده ويُسكت عن الاستثمار */
  | "UNKNOWN";

export interface ReturnInput {
  /** 🔴 **`null` ليس `0`.** الصفر يعني «لم يُنفق على هذا شيء» - وهي حقيقةٌ
   *  قابلةٌ للقراءة. و`null` يعني «لا نعرف كم أُنفق عليه» - وهي جهلٌ بمصدر.
   *  خلطُهما يجعل منتجاً لا نستطيع نسبة إنفاقٍ إليه يبدو كمنتجٍ مجّانيّ
   *  الإعلان، وهو أسوأ ما قد يُقرأ في صفحة ربحية. */
  adSpend: number | null;
  revenue: number;
  /** الربح **قبل** خصم الإنفاق الإعلانيّ. `null` حين لا نعرفه. */
  grossProfit: number | null;
  revenueBasis: RevenueBasis;
  profitBasis: ProfitBasis;
}

export interface ReturnResult {
  /** الإيراد ÷ الإنفاق. `null` حين يتعذّر الحساب - لا صفراً. */
  roas: number | null;
  /** نسبةً مئوية. سالبٌ يعني خسارةً فعلية بعد ثمن البضاعة. */
  roiPct: number | null;
  adSpend: number | null;
  revenue: number;
  revenueBasis: RevenueBasis;
  profitBasis: ProfitBasis;
  /** 🔴 **ما ينقص بالضبط - لا «لا توجد بيانات».**
   *
   *  القاعدة الحاكمة في هذا المنتج: كلّ نقطةٍ تمنع المستخدم من المتابعة
   *  تحمل معها حلّها. فلا يكفي أن نُخفي الرقم؛ يجب أن نقول أيّ خطّافٍ
   *  ينقص حتى يعرف القارئ ماذا يفعل، ولكلّ حالةٍ رسالتُها وخطوتُها. */
  missing: "NO_SPEND_SOURCE" | "NO_SPEND" | "NO_REVENUE" | "NO_PROFIT_BASIS" | null;
}

export function computeReturn(input: ReturnInput): ReturnResult {
  const { adSpend, revenue, grossProfit, revenueBasis, profitBasis } = input;
  const base = { adSpend, revenue, revenueBasis, profitBasis };

  // «لا نعرف إنفاقه» تسبق «لم يُنفق عليه»: الأولى نقصُ خطّافٍ له خطوةٌ
  // يفعلها المستخدم، والثانية خبرٌ عن حسابه. ورسالتاهما مختلفتان تماماً.
  if (adSpend === null) {
    return { ...base, roas: null, roiPct: null, missing: "NO_SPEND_SOURCE" };
  }
  // القسمة على صفرٍ لا تعطي «صفر عائد» بل لا شيء: من لم يُنفق لم يشترِ
  // عائداً أصلاً، فالسؤال نفسه لا ينطبق عليه.
  if (adSpend <= 0) {
    return { ...base, roas: null, roiPct: null, missing: "NO_SPEND" };
  }
  if (revenue <= 0) {
    return { ...base, roas: null, roiPct: null, missing: "NO_REVENUE" };
  }

  const roas = round2(revenue / adSpend);

  // العائد على الإنفاق يُعرَض ولو جهلنا الربح - ونسكت عن الثاني وحده بدل
  // أن نخسر الأوّل معه، أو نخترع هامشاً لم يضبطه أحد.
  if (grossProfit === null || profitBasis === "UNKNOWN") {
    return { ...base, roas, roiPct: null, missing: "NO_PROFIT_BASIS" };
  }

  return {
    ...base,
    roas,
    roiPct: Math.round(((grossProfit - adSpend) / adSpend) * 100),
    missing: null,
  };
}

/** مفتاح الرسالة التي تشرح الغياب وتحمل خطوته التالية. */
export function missingReturnKey(missing: ReturnResult["missing"]): string | null {
  switch (missing) {
    case "NO_SPEND_SOURCE": return "returns.noSpendSource";
    case "NO_SPEND": return "returns.noSpend";
    case "NO_REVENUE": return "returns.noRevenue";
    case "NO_PROFIT_BASIS": return "returns.noProfitBasis";
    default: return null;
  }
}

/** مفتاح السطر الذي يسمّي مصدر البسط تحت الرقم. */
export function revenueBasisKey(basis: RevenueBasis): string {
  return basis === "AD_ATTRIBUTED" ? "returns.basisAdAttributed" : "returns.basisStoreTotal";
}

/** لون العائد على الاستثمار: الصفر حدٌّ فاصل حقيقيّ لا عتبةُ ذوق.
 *  تحته يعني أنّ الإعلان يكلّف أكثر ممّا يربح بعد ثمن البضاعة. */
export function roiTone(roiPct: number | null): "verified" | "critical" | "neutral" {
  if (roiPct === null) return "neutral";
  return roiPct >= 0 ? "verified" : "critical";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
