// lib/aiChat.ts
//
// عقل الوكيل - يقرأ أرقام مساحة العمل ويجيب عن سؤال صاحبها.
//
// **ليس مساعداً عامّاً.** النموذج لا يُسأل رأيه في الإعلانات، بل يُعطى أرقام
// هذا الحساب ويُطلب منه أن يقرأها. الفرق ليس تفصيلاً: مساعدٌ عامّ يجيب عن
// «كم أرفع ميزانيتي؟» بمتوسّطات السوق، وهذا يجيب بما في حسابك - أو يقول إنّ
// الرقم اللازم غير موجود.
//
// **القاعدة الحاكمة للردّ: لا رقم من خارج ما أُرسل.** منتجٌ جوهره «نتحقّق
// بدل أن نصدّق» لا يجوز أن يخترع فيه النموذج رقماً. وحين لا تكفي البيانات
// فالجواب الصحيح هو قول ما ينقص، لا تعبئة الفراغ بتقديرٍ معقول الشكل.
//
// ── لماذا صار الجواب بأربع طبقات ─────────────────────────────────────
//
// كان الردّ فقرةً من ثلاث إلى ستّ جمل. وهذا يكفي سؤالاً بسيطاً («كم صرفت
// أمس؟») ولا يكفي السؤال الذي يستحقّ نموذجاً أصلاً: «أيّ حملة هي الفائزة؟»
// جوابُها مقارنةٌ بين ستّ حملات، والمقارنة لا تُقرأ في جملةٍ متلاحقة الأرقام.
//
// فالبنية المفروضة: **حكم** يجيب مباشرة، ثمّ **مؤشّرات** تسنده، ثمّ **جدول**
// يُظهر المقارنة، ثمّ **سبب وخطوة**. وهي ليست تنسيقاً: كلّ طبقة تمنع خطأً
// بعينه - الحكم يمنع المقدّمات، والمؤشّرات تمنع الرأي بلا رقم، والجدول يمنع
// سرد الأرقام في نثر، والسبب يمنع تشخيصاً بلا خطوة تالية.

import Anthropic from "@anthropic-ai/sdk";
import type { AgentContext } from "@/lib/agentContext";
import { agentSkills } from "@/lib/agentSkills";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30_000,
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
    ar: "السؤال مطروح من صفحة الحملات: قارن الحملات والإعلانات ببعضها.",
    en: "The question comes from the campaigns page: compare campaigns and ads against each other.",
  },
  store: {
    ar: "السؤال مطروح من صفحة المتجر: اربط الإنفاق الإعلاني بنتيجة البيع.",
    en: "The question comes from the store page: connect ad spend to the selling outcome.",
  },
};

export interface ChatAnswer {
  /** Markdown - عناوين وجداول وقوائم. يعرضه `MarkdownAnswer` لا `dangerouslySetInnerHTML` */
  answer: string;
}

export async function answerWorkspaceQuestion({
  question,
  context,
  scope,
  locale,
  model,
}: {
  question: string;
  context: AgentContext;
  scope: ChatScope;
  locale: "ar" | "en";
  model: string;
}): Promise<ChatAnswer> {
  const ar = locale === "ar";
  const hint = SCOPE_HINT[scope][locale];

  const system = ar
    ? `أنت محلّل أداء إعلانيّ داخل منصّة AdLoop. تُجيب عن سؤال صاحب الحساب اعتماداً على أرقام حسابه المرفقة **وحدها**.

${agentSkills(true)}

## قواعد الصدق
- لا تذكر رقماً غير موجود في البيانات المرفقة، ولا تُقدّر رقماً ناقصاً.
- إن كان السؤال يحتاج بياناتٍ غير مرفقة، قل بوضوح ما الذي ينقص لتُجيب، ولا تُكمل بتخمين.
- «المُعلَن» ما تقوله المنصّة، و«المتحقَّق» ما تأكّد بمصدر مستقلّ. حين يفترقان، ابنِ حكمك على المتحقَّق وسمِّ الفارق صراحةً.

## شكل الجواب - بهذا الترتيب
1. **الحكم**: سطر واحد يجيب عن السؤال مباشرة بالاسم أو بالرقم. بلا مقدّمة.
2. **المؤشّرات**: ثلاثة إلى أربعة أسطر قائمة، كلّ سطر مؤشّر ورقمه الذي يسند الحكم.
3. **الجدول**: جدول Markdown للمقارنة التي بُني عليها الحكم - صفوفه من البيانات المرفقة فقط. أدرجه كلّما كان في السؤال مقارنة بين حملات أو إعلانات أو منصّات أو فترات.
4. **لماذا، وما الخطوة**: فقرة قصيرة تشرح السبب من الأرقام، وتنتهي بخطوة واحدة قابلة للتنفيذ.

## الأسلوب
- بالعربية الفصحى. لا عامّية.
- اربط كلّ جملة برقم. الجملة بلا رقم لا تُكتب.
- لا مقدّمات ولا خاتمة ولا اعتذار. ابدأ بالحكم مباشرة.
- استخدم Markdown: **الغامق** للأرقام الحاسمة، وجداول بصيغة الأنابيب، وقوائم بشرطة.
`
    : `You are an ad performance analyst inside AdLoop. You answer the account owner's question using **only** the account figures attached.

${agentSkills(false)}

## Honesty rules
- Never state a number that is not in the attached data, and never estimate a missing one.
- If the question needs data that is not attached, say plainly what is missing, and do not fill the gap with a guess.
- "Reported" is what the platform claims; "verified" is what an independent source confirmed. When they differ, build your judgement on the verified figure and name the gap explicitly.

## Answer shape - in this order
1. **Verdict**: one line answering the question directly, by name or by number. No preamble.
2. **Key figures**: three to four bullet lines, each a metric and the number backing the verdict.
3. **Table**: a Markdown table of the comparison the verdict rests on - rows from the attached data only. Include it whenever the question compares campaigns, ads, platforms or periods.
4. **Why, and the next step**: a short paragraph explaining the cause from the numbers, ending in one actionable step.

## Style
- Tie every sentence to a number. A sentence without one is not written.
- No preamble, no sign-off, no apology. Open with the verdict.
- Use Markdown: **bold** for the decisive numbers, pipe tables, dashed lists.
`;

  // 🔴 **نصُّ النظام تضاعف بالإجراء والمهارات، ويُرسَل مع كلّ سؤال.**
  //
  // وهو ثابتٌ لا يتغيّر بين سؤالٍ وآخر، فيُخزَّن مؤقّتاً: الطلبُ التالي
  // يقرؤه من الذاكرة بعُشر الكلفة تقريباً بدل أن يُعاد إرساله كاملاً.
  // وبلا ذلك كان تقويةُ التفكير تُترجَم زيادةً في فاتورةِ كلّ سؤال -
  // والرصيدُ هنا مسقوفٌ لكلّ مستخدم.
  //
  // **والعملةُ والتلميحُ خارج الكتلة المخزَّنة عمداً**: التخزين مطابقةُ
  // بادئة، وأيُّ بايتٍ متغيّرٍ داخلها يُبطلها لكلّ مساحةِ عملٍ على حدة.
  const volatile = ar
    ? `العملة ${context.currency}. لا تحوّل إلى عملة أخرى ولا تكتب رمزاً غيرها.

${hint}`
    : `Currency is ${context.currency}. Do not convert and do not write any other symbol.

${hint}`;

  const message = await anthropic.messages.create({
    model,
    // رُفع من ١٤٠٠ حين صار الجواب يحمل جدولاً: السقف يشمل التفكير والردّ
    // معاً، وجدولٌ من ستّة صفوف يقتطع من التفكير ما يحتاجه ترتيبُ الصفوف.
    // والجهد `medium` لا `low` لسبب متّصل: ترتيب حملات بمعيارٍ مركّب
    // (المتحقَّق لا المُعلَن) عملُ تحليلٍ لا قراءةُ حقل.
    max_tokens: 2400,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
      { type: "text", text: volatile },
    ],
    messages: [
      {
        role: "user",
        content: `${ar ? "السؤال" : "Question"}: ${question}\n\n${
          ar ? "أرقام الحساب" : "Account figures"
        }:\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return { answer: text };
}
