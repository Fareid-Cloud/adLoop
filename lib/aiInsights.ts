// lib/aiInsights.ts
//
// طبقة الذكاء الاصطناعي - بتاخد الأرقام المحسوبة (من metricsEngine/ecommerceMetrics)
// وتحولها لجمل بشرية مفيدة: إيه اللي شغال، إيه اللي بيسرّب فلوس، وإيه أهم خطوة
// النهاردة. بتستخدم Claude API فعلياً (مش قالب نصوص ثابت).

import Anthropic from "@anthropic-ai/sdk";

// timeout صريح - من غيره، لو خدمة Claude اتأخرت لأي سبب، الطلب ممكن يفضل
// معلّق لدقائق بدل ما يفشل بسرعة برسالة واضحة للمستخدم
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20_000, // 20 ثانية
  maxRetries: 2,
});

export interface CampaignSummary {
  platform: string;
  campaignName: string;
  cost: number;
  // بيانات lead-gen (لو موجودة)
  cplVerified?: number;
  inflationRate?: number;
  // بيانات إيكومرس (لو موجودة)
  trueRoas?: number;
  displacedRoas?: number;
  rtoRate?: number;
  // اتجاه الأداء آخر 7 أيام مقارنة بالـ 7 اللي قبلها
  trendVsLastWeek?: number; // % تغيّر (موجب = تحسّن)
}

export interface AIInsightResult {
  /** ٣-٥ نقاط، كلٌّ منها برقم من البيانات لا وصف عامّ */
  whatsWorking: string[];
  /** ٣-٥ مشكلات مرتَّبة بالأثر المالي، الأكبر أوّلاً */
  whatsLeaking: string[];
  /** قراءة الفارق بين المُعلَن والمتحقَّق - جوهر المنتج، ولم يكن يُطلَب من
   *  النموذج أصلاً رغم أنّ البيانات المُرسَلة تحمله. */
  gapReading: string;
  /** اقتراح واحد فقط: قائمة إجراءات لا تُنفَّذ أفضلُ منها واحدٌ يُنفَّذ */
  nextAction: string;
  rawResponse: string;
}

export async function generateInsights(
  campaigns: CampaignSummary[],
  userLanguage: "ar" | "en" = "ar"
): Promise<AIInsightResult> {
  const dataForPrompt = JSON.stringify(campaigns, null, 2);

  const systemPrompt =
    userLanguage === "ar"
      ? `أنت محلّل أداء إعلاني محترف يساعد مدير الإعلانات على فهم بياناته بسرعة.
اكتب بالعربية الفصحى الواضحة والمباشرة، دون مقدمات، وبأسلوب عملي قابل للتنفيذ.
أجب بصيغة JSON فقط بالشكل التالي دون أي نص إضافي قبله أو بعده:
{
  "whatsWorking": ["٣ إلى ٥ نقاط، كلٌّ منها برقم من البيانات لا وصف عامّ"],
  "whatsLeaking": ["٣ إلى ٥ مشكلات، مرتّبة بالأثر المالي: الأكبر أولاً"],
  "gapReading": "جملة أو جملتان عن الفارق بين ما تعلنه المنصات وما تأكّد فعلياً، وما يعنيه للقرار",
  "nextAction": "اقتراح واحد محدد وقابل للتنفيذ فوراً"
}

قواعد: كلّ نقطة تحمل رقماً من البيانات المعطاة - لا تكتب نقطةً بلا رقم.
لا تخترع أرقاماً غير موجودة. إن كانت البيانات لا تكفي لمحور، أعده مصفوفةً فارغة.`
      : `You are a professional advertising performance analyst helping a media buyer understand their data quickly.
Write in clear, direct, professional English. No preamble, keep it actionable.
Respond in JSON format only, exactly as follows, with no additional text before or after:
{
  "whatsWorking": ["3-5 points, each carrying a number from the data, not a general description"],
  "whatsLeaking": ["3-5 issues, ordered by financial impact, largest first"],
  "gapReading": "one or two sentences on the gap between what the platforms report and what was actually verified, and what it means for the decision",
  "nextAction": "one specific, immediately actionable suggestion"
}

Rules: every point must carry a number from the data given - never write a
point without one. Do not invent figures. If the data cannot support an
axis, return it as an empty array.`;

  const userPrompt =
    userLanguage === "ar"
      ? `فيما يلي بيانات الحملات الحالية:\n${dataForPrompt}\n\nحلّل هذه البيانات وبيّن: ما الذي يعمل بشكل جيد، وما الذي يستنزف الميزانية، وما هي أهم خطوة يجب اتخاذها الآن.`
      : `Here is the current campaign data:\n${dataForPrompt}\n\nAnalyze this data and identify: what's working well, what's leaking budget, and the most important action to take right now.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    // ١٠٠٠ كانت تكفي نقطتين لكلّ محور بالكاد. المدى صار ٣-٥ ومعه محور
    // رابع، والقطع في منتصف JSON يُفقد الردّ كلّه لا آخر نقطة فيه.
    max_tokens: 1600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const rawResponse = textBlock && "text" in textBlock ? textBlock.text : "{}";

  try {
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      whatsWorking: parsed.whatsWorking ?? [],
      whatsLeaking: parsed.whatsLeaking ?? [],
      gapReading: parsed.gapReading ?? "",
      nextAction: parsed.nextAction ?? "",
      rawResponse,
    };
  } catch {
    // لو الرد مش JSON صحيح لأي سبب، نرجع نص خام بدل ما نكسر الصفحة
    return { whatsWorking: [], whatsLeaking: [], gapReading: "", nextAction: rawResponse, rawResponse };
  }
}

// كشف "تعب" الإعلان - بيقارن آخر 3 أيام بمتوسط الأسبوع اللي قبلهم
// لو الأداء نازل بشكل واضح ومستمر، ده مؤشر creative fatigue
export function detectCreativeFatigue(
  dailyCplVerified: { date: string; value: number }[]
): { isFatigued: boolean; declinePct: number } {
  if (dailyCplVerified.length < 10) {
    return { isFatigued: false, declinePct: 0 };
  }

  const sorted = [...dailyCplVerified].sort((a, b) => a.date.localeCompare(b.date));
  const last3 = sorted.slice(-3);
  const previous7 = sorted.slice(-10, -3);

  const avgLast3 = average(last3.map((d) => d.value));
  const avgPrevious7 = average(previous7.map((d) => d.value));

  // CPL بيزيد = الأداء بيسوء (كل عميل بقى أغلى)
  const declinePct =
    avgPrevious7 > 0 ? Math.round(((avgLast3 - avgPrevious7) / avgPrevious7) * 100) : 0;

  return { isFatigued: declinePct > 25, declinePct };
}

function average(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
