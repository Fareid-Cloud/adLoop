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
  whatsWorking: string[];   // أهم 2-3 نقاط إيجابية
  whatsLeaking: string[];   // أهم 2-3 مشاكل بتسرّب فلوس
  nextAction: string;       // اقتراح واحد بس، الأهم
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
  "whatsWorking": ["نقطة 1", "نقطة 2"],
  "whatsLeaking": ["مشكلة 1", "مشكلة 2"],
  "nextAction": "اقتراح واحد محدد وقابل للتنفيذ فوراً"
}`
      : `You are a professional advertising performance analyst helping a media buyer understand their data quickly.
Write in clear, direct, professional English. No preamble, keep it actionable.
Respond in JSON format only, exactly as follows, with no additional text before or after:
{
  "whatsWorking": ["point 1", "point 2"],
  "whatsLeaking": ["issue 1", "issue 2"],
  "nextAction": "one specific, immediately actionable suggestion"
}`;

  const userPrompt =
    userLanguage === "ar"
      ? `فيما يلي بيانات الحملات الحالية:\n${dataForPrompt}\n\nحلّل هذه البيانات وبيّن: ما الذي يعمل بشكل جيد، وما الذي يستنزف الميزانية، وما هي أهم خطوة يجب اتخاذها الآن.`
      : `Here is the current campaign data:\n${dataForPrompt}\n\nAnalyze this data and identify: what's working well, what's leaking budget, and the most important action to take right now.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
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
      nextAction: parsed.nextAction ?? "",
      rawResponse,
    };
  } catch {
    // لو الرد مش JSON صحيح لأي سبب، نرجع نص خام بدل ما نكسر الصفحة
    return { whatsWorking: [], whatsLeaking: [], nextAction: rawResponse, rawResponse };
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
