// lib/aiChat.ts
//
// مربّع السؤال - سؤال واحد عن أرقام مساحة العمل، وجواب مبنيّ عليها وحدها.
//
// **ليس مساعداً عامّاً.** النموذج لا يُسأل رأيه في الإعلانات، بل يُعطى
// أرقام هذا الحساب ويُطلب منه أن يقرأها. الفرق ليس تفصيلاً: مساعدٌ عامّ
// يجيب عن «كم أرفع ميزانيتي؟» بمتوسّطات السوق، وهذا يجيب بما في حسابك -
// أو يقول إنّ الرقم اللازم غير موجود.
//
// **القاعدة الحاكمة للردّ: لا رقم من خارج ما أُرسل.** منتجٌ جوهره «نتحقّق
// بدل أن نصدّق» لا يجوز أن يخترع فيه النموذج رقماً. وحين لا تكفي البيانات
// فالجواب الصحيح هو قول ما ينقص، لا تعبئة الفراغ بتقدير معقول الشكل.

import Anthropic from "@anthropic-ai/sdk";
import type { CampaignSummary } from "@/lib/aiInsights";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20_000,
  maxRetries: 2,
});

/** الصفحة التي طُرح منها السؤال - تضبط زاوية القراءة لا البيانات */
export type ChatScope = "home" | "campaigns" | "store";

const SCOPE_HINT: Record<ChatScope, { ar: string; en: string }> = {
  home: {
    ar: "السؤال مطروح من الصفحة الرئيسية: ابدأ من الصورة الكاملة عبر المنصّات.",
    en: "The question comes from the overview page: start from the whole picture across platforms.",
  },
  campaigns: {
    ar: "السؤال مطروح من صفحة الحملات: قارن الحملات ببعضها.",
    en: "The question comes from the campaigns page: compare campaigns against each other.",
  },
  store: {
    ar: "السؤال مطروح من صفحة المتجر: اربط الإنفاق الإعلاني بنتيجة البيع.",
    en: "The question comes from the store page: connect ad spend to the selling outcome.",
  },
};

export interface ChatAnswer {
  answer: string;
  /** ما لم تسمح به البيانات - يُعرض تحت الجواب لا داخله */
  missing: string | null;
}

export async function answerWorkspaceQuestion({
  question,
  campaigns,
  currency,
  scope,
  locale,
  model,
}: {
  question: string;
  campaigns: CampaignSummary[];
  currency: string;
  scope: ChatScope;
  locale: "ar" | "en";
  model: string;
}): Promise<ChatAnswer> {
  const ar = locale === "ar";
  const hint = SCOPE_HINT[scope][locale];

  const system = ar
    ? `أنت محلّل أداء إعلانيّ داخل منصّة AdLoop. تُجيب عن سؤال صاحب الحساب اعتماداً على أرقام حسابه المرفقة **وحدها**.

القواعد:
- لا تذكر رقماً غير موجود في البيانات المرفقة، ولا تُقدّر رقماً ناقصاً.
- إن كان السؤال يحتاج بياناتٍ غير مرفقة، قل بوضوح ما الذي ينقص لتُجيب.
- اربط كلّ جملة برقم. الجملة بلا رقم لا تُكتب.
- «المُعلَن» ما تقوله المنصّة، و«المتحقَّق» ما تأكّد بمصدر مستقلّ. حين يفترقان، ابنِ على المتحقَّق وقل الفارق.
- العملة ${currency}. لا تحوّل إلى عملة أخرى.
- بالعربية الفصحى. لا عامّية.
- جوابٌ قصير: ثلاث جمل إلى ستّ. لا مقدّمات ولا خاتمة.
${hint}`
    : `You are an ad performance analyst inside AdLoop. You answer the account owner's question using **only** the account figures attached.

Rules:
- Never state a number that is not in the attached data, and never estimate a missing one.
- If the question needs data that is not attached, say plainly what is missing.
- Tie every sentence to a number. A sentence without one is not written.
- "Reported" is what the platform claims; "verified" is what an independent source confirmed. When they differ, build on the verified figure and name the gap.
- Currency is ${currency}. Do not convert.
- Keep it short: three to six sentences. No preamble, no sign-off.
${hint}`;

  const message = await anthropic.messages.create({
    model,
    // سقفٌ لا رسمٌ: يُحاسَب المُنتَج فعلاً. وهو يشمل التفكير والردّ معاً،
    // فالسقف المنخفض هنا يقصّ التفكير أوّلاً - ولذلك جهدٌ منخفض لا متوسّط:
    // سؤال واحد عن أرقام مرفقة أخفّ من بناء تحليل كامل من الصفر.
    max_tokens: 1400,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system,
    messages: [
      {
        role: "user",
        content: `${ar ? "السؤال" : "Question"}: ${question}\n\n${
          ar ? "أرقام الحساب" : "Account figures"
        }:\n${JSON.stringify(campaigns, null, 2)}`,
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return { answer: text, missing: null };
}
