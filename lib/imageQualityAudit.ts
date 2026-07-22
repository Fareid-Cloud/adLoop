// lib/imageQualityAudit.ts
//
// السؤال: "صور إعلاناتي جودتها كويسة مقارنة بمعايير المنصة؟" - بنستخدم
// رؤية Claude (نفس أسلوب lib/landingPageAudit.ts) عشان نحلل الصورة فعلياً،
// مبني على معايير 2026 الحقيقية (اتأكدت منها بالبحث، مش افتراضات قديمة):
//
// - ميتا: شالت قاعدة "20% نص" الرسمية من 2020، لكن الخوارزمية (Andromeda)
//   لسه بتعاقب الصور تقيلة النص بترتيب أقل - النصيحة العملية: النص أقل
//   من ثلث مساحة الصورة تقريباً، مش قاعدة صارمة
// - جوجل: لسه بتخصم فعلياً من أي أصل فيه نص أكتر من 20% من المساحة
// - الدقة الموصى بيها ارتفعت لـ 1440x1440 (مش 1080x1080 القديمة) عشان
//   الشاشات عالية الكثافة

import Anthropic from "@anthropic-ai/sdk";
import { Locale } from "@/lib/i18n/dictionary";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20_000,
  maxRetries: 2,
});

export interface ImageQualityResult {
  score: number; // 0-100
  resolutionAssessment: string;
  textOverlayAssessment: string;
  professionalismAssessment: string;
  recommendation: string;
}

export async function auditAdImageQuality(
  imageUrl: string,
  platform: "GOOGLE_ADS" | "META_ADS",
  locale: Locale = "ar"
): Promise<ImageQualityResult | null> {
  let imageBase64: string;
  let mediaType: "image/jpeg" | "image/png";

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    mediaType = contentType.includes("png") ? "image/png" : "image/jpeg";

    const buffer = await res.arrayBuffer();
    imageBase64 = Buffer.from(buffer).toString("base64");
  } catch {
    // فشل تحميل الصورة (رابط منتهي، أو الصورة اتشالت من المنصة) - بنرجع
    // null بدل ما نكسر باقي الصفحة اللي بتعرض نتائج إعلانات تانية
    return null;
  }

  const platformGuideline =
    platform === "META_ADS"
      ? "ميتا: النص أقل من ثلث مساحة الصورة تقريباً (نصيحة عملية، مش قاعدة صارمة رسمية)، دقة موصى بيها 1440×1440 أو أعلى."
      : "جوجل: بتخصم فعلياً من أي صورة فيها نص أكتر من 20% من المساحة، بتفضّل صور نظيفة بأقل نص ممكن.";

  const systemPrompt =
    locale === "ar"
      ? `أنت خبير تصميم إعلانات مدفوعة. حلّل الصورة دي كإعلان حقيقي على ${platform === "META_ADS" ? "ميتا" : "جوجل"}، بناءً على المعيار ده تحديداً: ${platformGuideline}

قيّم: (1) وضوح ودقة الصورة، (2) نسبة النص المكتوب على الصورة تقريبية، (3) الاحترافية والتكوين البصري العام.

أجب بصيغة JSON فقط:
{"score": 0-100, "resolutionAssessment": "...", "textOverlayAssessment": "...", "professionalismAssessment": "...", "recommendation": "..."}`
      : `You are a paid ads creative expert. Analyze this image as a real ad on ${platform === "META_ADS" ? "Meta" : "Google"}, based on this specific guideline: ${platformGuideline}

Assess: (1) image clarity/resolution, (2) approximate text overlay ratio, (3) overall professionalism and composition.

Respond in JSON only:
{"score": 0-100, "resolutionAssessment": "...", "textOverlayAssessment": "...", "professionalismAssessment": "...", "recommendation": "..."}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: locale === "ar" ? "حلّل جودة الصورة دي." : "Analyze this image's quality." },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const rawResponse = textBlock && "text" in textBlock ? textBlock.text : "{}";

  try {
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
