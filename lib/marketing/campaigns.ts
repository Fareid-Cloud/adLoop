// lib/marketing/campaigns.ts
//
// **خطّة البريد التسويقي.**
//
// ثلاث حملات متوازية، لكلٍّ هدف واحد لا أكثر:
//
//   1. `engage`   — مشترك ربط حساباً وتوقّف. كلّ 2-3 أيام، تُظهر له ما
//                   وجدناه في حسابه هو. الهدف: يفتح اللوحة.
//   2. `trial`    — دورة التجربة: قبلها وأثناءها وبعدها. الهدف: الاشتراك.
//   3. `winback`  — بعد الانتهاء بأسابيع. الهدف: العودة.
//
// **المبدأ الحاكم:** لا رسالة بلا رقم من حساب المستلم نفسه. «راجع لوحتك»
// بلا سبب هي بريد مهمَل؛ «ثلاثة إعلانات أنفقت 1,240 ريال بلا عميل واحد
// متحقَّق» هي سبب لفتح اللوحة الآن. لذلك تحمل كلّ رسالة `needsData`،
// وتُتخطّى إذا لم تتوفّر أرقامها بدل أن تُرسَل جوفاء.
//
// **التوقيت بالأيام لا بالتواريخ:** يُحسب من `createdAt` أو `currentPeriodEnd`
// لحظة التشغيل، فلا يختلّ الجدول إذا تعطّل الكرون يوماً.

export type CampaignId = "engage" | "trial" | "winback";

export interface MarketingMessage {
  /** فريد عبر الحملات كلّها - هو مفتاح منع التكرار في قاعدة البيانات */
  id: string;
  campaign: CampaignId;
  /**
   * متى تُرسَل، باليوم.
   * • `engage`: أيام مضت منذ آخر دخول
   * • `trial`: موجب = قبل انتهاء التجربة، سالب = بعده
   * • `winback`: أيام منذ الانتهاء
   */
  day: number;
  /** ما تحتاجه من أرقام - إن غاب، تُتخطّى الرسالة ولا تُرسَل فارغة */
  needsData: "decisions" | "truth" | "gap" | "none";
  tone: "neutral" | "urgent" | "positive";
  /** المسار الذي يفتحه زرّ الإجراء */
  ctaPath: string;
}

/**
 * حملة التفاعل: لمن ربط حساباً واحداً على الأقلّ ثمّ توقّف.
 *
 * كلّ رسالة تعرض **زاوية مختلفة** من المنتج، لا تكراراً بصياغة أخرى.
 * من رأى الأربع وما زال غير مقتنع، لن تقنعه الخامسة - ولذلك تنتهي.
 */
export const ENGAGE_MESSAGES: MarketingMessage[] = [
  { id: "engage-decisions", campaign: "engage", day: 3, needsData: "decisions", tone: "neutral", ctaPath: "/dashboard/actions" },
  { id: "engage-truth", campaign: "engage", day: 6, needsData: "truth", tone: "urgent", ctaPath: "/dashboard/truth" },
  { id: "engage-sync", campaign: "engage", day: 9, needsData: "none", tone: "positive", ctaPath: "/dashboard/settings?tab=conversions" },
  { id: "engage-gap", campaign: "engage", day: 12, needsData: "gap", tone: "urgent", ctaPath: "/dashboard/campaigns" },
];

/**
 * دورة التجربة.
 *
 * الكثافة مقصودة قرب النهاية (7 ← 3 ← 1) ثمّ تخفّ بعدها (1 ← 3 ← 7).
 * قبل الانتهاء القرار وشيك فالتذكير مفيد؛ بعده تصير المتابعة إلحاحاً.
 */
export const TRIAL_MESSAGES: MarketingMessage[] = [
  { id: "trial-d7", campaign: "trial", day: 7, needsData: "truth", tone: "neutral", ctaPath: "/dashboard/billing" },
  { id: "trial-d3", campaign: "trial", day: 3, needsData: "decisions", tone: "neutral", ctaPath: "/dashboard/billing" },
  { id: "trial-d1", campaign: "trial", day: 1, needsData: "gap", tone: "urgent", ctaPath: "/dashboard/billing" },
  { id: "trial-after1", campaign: "trial", day: -1, needsData: "truth", tone: "urgent", ctaPath: "/dashboard/billing" },
  { id: "trial-after3", campaign: "trial", day: -3, needsData: "none", tone: "neutral", ctaPath: "/dashboard/billing" },
  { id: "trial-after7", campaign: "trial", day: -7, needsData: "none", tone: "neutral", ctaPath: "/dashboard/billing" },
];

/**
 * الاستعادة: أسبوعان إلى ستّة.
 *
 * تباعُد متزايد عمداً. من لم يعد بعد ستّة أسابيع لن يعيده بريد سابع -
 * وإرساله يضرّ سمعة النطاق البريدي أكثر ممّا ينفع.
 */
export const WINBACK_MESSAGES: MarketingMessage[] = [
  { id: "winback-w2", campaign: "winback", day: 14, needsData: "none", tone: "neutral", ctaPath: "/dashboard/billing" },
  { id: "winback-w3", campaign: "winback", day: 21, needsData: "truth", tone: "neutral", ctaPath: "/dashboard/billing" },
  { id: "winback-w4", campaign: "winback", day: 28, needsData: "none", tone: "positive", ctaPath: "/dashboard/billing" },
  { id: "winback-w5", campaign: "winback", day: 35, needsData: "none", tone: "neutral", ctaPath: "/dashboard/billing" },
  { id: "winback-w6", campaign: "winback", day: 42, needsData: "none", tone: "neutral", ctaPath: "/dashboard/billing" },
];

export const ALL_MESSAGES = [...ENGAGE_MESSAGES, ...TRIAL_MESSAGES, ...WINBACK_MESSAGES];

/** نافذة التسامح: الكرون يومي، فيوم واحد يكفي ولا يُسقط رسالة عند تأخّره. */
export const DAY_TOLERANCE = 1;
