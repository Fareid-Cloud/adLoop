// lib/helpContent.ts
//
// محتوى مركز المساعدة - مصدر حقيقة واحد يستخدمه زر المساعدة (لوحة جانبية)
// وصفحة /dashboard/help. مكتوب بناءً على وظائف المنتج الفعلية، مش نصوص عامة.

/** نصّ باللغتين. الحقلان إلزاميّان: مقالة بلغة واحدة تصير خطأ أنواع. */
export interface HelpText {
  ar: string;
  en: string;
}

export interface HelpArticle {
  id: string;
  q: HelpText;
  a: HelpText;
  /** وسوم البحث - بالعربية والإنجليزية معاً ليعمل البحث في اللغتين */
  tags: string[];
}

export interface HelpSection {
  title: HelpText;
  articles: HelpArticle[];
}

export function helpText(locale: "ar" | "en", x: HelpText): string {
  return locale === "en" ? x.en : x.ar;
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: { ar: "البداية والأساسيات", en: "Getting started" },
    articles: [
      {
        id: "what-is-adloop",
        q: { ar: "ما هو AdLoop بالضبط؟", en: "What exactly is AdLoop?" },
        a: { ar: "AdLoop طبقة تحقّق فوق منصات الإعلانات. المنصات (Google/Meta/TikTok) تُبلغ عن عدد تحويلات قد يكون مبالغاً فيه؛ نحن نقارن ذلك الرقم بما تحقّق فعلياً من محادثات واتساب وماسنجر حقيقية، ونُظهر الفارق بوضوح. كل قرار في المنتج (زيادة ميزانية، إيقاف إعلان، تنبيه) مبني على الرقم المتحقَّق منه، لا الرقم المُعلَن.", en: "AdLoop is a verification layer on top of the ad platforms. Google, Meta and TikTok report a conversion count that is often inflated; we compare it against what we can actually prove from real WhatsApp and Messenger conversations, and show you the gap plainly. Every decision in the product - raising a budget, pausing an ad, firing an alert - is built on the verified number, never the reported one." },
        tags: ["أساسيات", "تعريف"],
      },
      {
        id: "first-steps",
        q: { ar: "ما أول خطوة بعد إنشاء الحساب؟", en: "What is the first step after signing up?" },
        a: { ar: "١) أنشئ مساحة عمل (تمثّل عميلاً أو مشروعاً). ٢) اذهب إلى الإعدادات ← مساحة العمل واربط حساب Google Ads أو Meta أو TikTok. ٣) اختر الحملات التي تريد متابعتها. ٤) انتظر أول مزامنة (تحدث يومياً تلقائياً، وقد تستغرق دقائق في أول مرة).", en: "1) Create a workspace - it stands for one client or one project. 2) Open Integrations and connect Google Ads, Meta or TikTok. 3) Pick the campaigns you want to follow. 4) Wait for the first sync; it runs daily on its own and may take a few minutes the first time." },
        tags: ["بداية", "ربط"],
      },
      {
        id: "workspace",
        q: { ar: "ما معنى «مساحة العمل»؟", en: "What does “workspace” mean?" },
        a: { ar: "مساحة العمل تعادل عميلاً أو مشروعاً واحداً: لها حساباتها الإعلانية وحملاتها وعملتها وأهدافها ومنتجاتها. يمكنك إنشاء أكثر من مساحة عمل والتنقّل بينها، وتبقى بياناتها منفصلة تماماً.", en: "A workspace is one client or one project: it has its own ad accounts, campaigns, currency, targets and products. You can create several and switch between them, and their data stays completely separate." },
        tags: ["أساسيات"],
      },
    ],
  },
  {
    title: { ar: "طبقة الحقيقة والتحقق", en: "The truth layer" },
    articles: [
      {
        id: "verified-vs-reported",
        q: { ar: "ما الفرق بين «تحويلات مُعلنة» و«محقّقة»؟", en: "What is the difference between “reported” and “verified” conversions?" },
        a: { ar: "«المُعلنة» هي ما تقوله منصة الإعلانات. «المحقّقة» هي ما استطعنا إثباته فعلياً بربط النقرة بمحادثة واتساب/ماسنجر حقيقية. الفارق بينهما = نسبة تضخيم المنصة، وهي المؤشر الأهم في المنتج.", en: "“Reported” is what the ad platform claims. “Verified” is what we could actually prove by tying a click to a real WhatsApp or Messenger conversation. The gap between them is the platform's inflation rate - the single most important number in the product." },
        tags: ["تحقق", "أرقام"],
      },
      {
        id: "tracking-accuracy",
        q: { ar: "ما هي «دقة التتبع»؟ ولماذا ليست 100%؟", en: "What is “tracking accuracy”, and why is it never 100%?" },
        a: { ar: "دقة التتبع = التحويلات المحقّقة ÷ المُعلنة. لا تصل إلى 100% عادةً لأن بعض العملاء يتواصلون بطرق لا نراها (اتصال مباشر، رسالة لاحقة بدون كود تتبع، جهاز مختلف). كلما ارتفعت النسبة، زادت ثقتك في القرارات.", en: "Tracking accuracy = verified conversions ÷ reported conversions. It rarely reaches 100% because some customers reach you in ways we cannot see: a direct phone call, a message sent later without a tracking code, a different device. The higher it climbs, the more you can trust every decision built on it." },
        tags: ["تحقق", "تتبع"],
      },
      {
        id: "improve-tracking",
        q: { ar: "كيف أرفع دقة التتبع؟", en: "How do I raise my tracking accuracy?" },
        a: { ar: "تأكد من إضافة وسم التتبع في أزرار «تواصل عبر واتساب» على موقعك، وتفعيل ويب هوك واتساب/ماسنجر، وإضافة معاملات URL لإعلانات Meta. صفحة «التشخيص ← تغطية التتبع» تُظهر بالضبط أين تفقد الإشارة.", en: "Add the tracking tag to the “Chat on WhatsApp” buttons on your site, turn on the WhatsApp and Messenger webhooks, and add the URL parameters to your Meta ads. The Account Health → Tracking coverage page shows exactly where the signal is being lost." },
        tags: ["تتبع", "إعداد"],
      },
    ],
  },
  {
    title: { ar: "القرارات والأتمتة", en: "Decisions and automation" },
    articles: [
      {
        id: "scale-kill",
        q: { ar: "متى يقترح النظام زيادة الميزانية (Scale)؟", en: "When does the system suggest raising a budget?" },
        a: { ar: "لا نقترح الزيادة إلا عند توفّر شروط مجتمعة: تكلفة عميل أرخص من متوسط حسابك بـ20% على الأقل، وعيّنة لا تقل عن 20 تحويلاً، وعبر 4 أيام مختلفة على الأقل (لا يوم حظ واحد)، وألا يكون الإعلان في حالة تعب إحصائي، وأن يكون فعلاً ضمن أرخص 30% من إعلاناتك. الزيادة المقترحة 20% كحد أقصى مع انتظار 3-4 أيام قبل زيادة تالية.", en: "Only when every condition holds at once: a cost per customer at least 20% below your account average, a sample of no fewer than 20 conversions, spread over at least 4 different days (not one lucky day), no statistical fatigue on the ad, and it genuinely sits in the cheapest 30% of your ads. The suggested increase is capped at 20%, with a 3-4 day wait before the next one." },
        tags: ["قرارات", "ميزانية"],
      },
      {
        id: "kill-rule",
        q: { ar: "متى يُقترح إيقاف إعلان (Kill)؟", en: "When is pausing an ad suggested?" },
        a: { ar: "عند إنفاق واضح بلا تحويلات عبر 3 أيام على الأقل، أو تكلفة أعلى من متوسط الحساب بـ20%+ مع كونه ضمن الأضعف فعلياً. وإذا حدّدت هامش ربحك في الإعدادات، فأي إعلان عائده تحت نقطة التعادل الحقيقية = خسارة مؤكدة ويُقترح إيقافه مباشرة.", en: "When there is clear spend with no conversions across at least 3 days, or a cost more than 20% above your account average while genuinely ranking among the weakest. And if you have set your profit margin in settings, any ad returning below your real break-even is a confirmed loss - pausing it is suggested straight away." },
        tags: ["قرارات"],
      },
      {
        id: "apply-actions",
        q: { ar: "هل «موافقة» تنفّذ التغيير فعلياً عند المنصة؟", en: "Does “Approve” actually apply the change on the platform?" },
        a: { ar: "نعم لبنود محددة (تدرّج استراتيجية المزايدة وإيقاف الإعلان) — يُنفَّذ فعلياً عبر واجهة المنصة. تتطلب الموافقة ضغطتين للتأكيد منعاً للخطأ. باقي الاقتراحات تُسجَّل كقرار ويُنفَّذ بعضها يدوياً؛ الواجهة توضّح ذلك.", en: "For specific items - bid strategy progression and pausing an ad - yes, it is applied through the platform's own API. Approval takes two clicks so it cannot happen by accident. Other suggestions are recorded as a decision and applied by you; the interface says which is which." },
        tags: ["قرارات", "أتمتة"],
      },
      {
        id: "automation",
        q: { ar: "كيف تعمل الأتمتة؟", en: "How does automation work?" },
        a: { ar: "من صفحة «التشغيل الذكي» تختار قاعدة (أو تبني واحدة): شرط + إجراء + فترة تهدئة. تعمل القواعد يومياً على كل المنصات المرتبطة. يمكنك ضبط سقف شهري لنسبة التغييرات حمايةً من التقلب الزائد.", en: "On the Automation page you pick a rule or build one: a condition, an action, and a cooldown. Rules run daily across every connected platform. You can also set a monthly ceiling on how much may change, so nothing swings too far." },
        tags: ["أتمتة"],
      },
    ],
  },
  {
    title: { ar: "الحساب والاشتراك", en: "Account and subscription" },
    articles: [
      {
        id: "change-theme",
        q: { ar: "كيف أغيّر اللغة أو الوضع الداكن أو اللون؟", en: "How do I change the language, dark mode or accent colour?" },
        a: { ar: "الإعدادات ← التفضيلات: اللغة (عربي/إنجليزي)، الوضع (فاتح/داكن)، اللون الأساسي، والمنطقة الزمنية. تُحفظ التفضيلات في حسابك وتظهر على كل أجهزتك.", en: "Settings → Preferences: language (Arabic or English), light or dark mode, accent colour, and timezone. Preferences are saved to your account and follow you across every device. Dark mode also has a quick toggle in the header." },
        tags: ["إعدادات"],
      },
      {
        id: "billing",
        q: { ar: "كيف أدير الاشتراك؟", en: "How do I manage my subscription?" },
        a: { ar: "من صفحة «الاشتراك» تستعرض خطتك الحالية وتاريخ التجديد وتُحدّث وسيلة الدفع. تُعالَج المدفوعات عبر مزوّد خارجي آمن، ولا نحتفظ ببيانات بطاقتك.", en: "The Billing & Plan page shows your current plan, the renewal date, and lets you update your payment method. Payments are handled by a secure external provider - we never store your card details." },
        tags: ["اشتراك"],
      },
      {
        id: "support",
        q: { ar: "كيف أتواصل مع الدعم؟", en: "How do I reach support?" },
        a: { ar: "زر المحادثة أسفل الشاشة: أدخل بياناتك وموضوع الرسالة والتفاصيل (مع إمكانية إرفاق صورة)، وسيصلك الرد داخل المحادثة نفسها مع إشعار — وتبقى محفوظة حتى لو أغلقت الجهاز.", en: "Use the Support button in the sidebar: enter your details, a subject and the specifics, and attach a screenshot if it helps. The reply arrives in that same conversation with a notification, and it stays there even if you close your device." },
        tags: ["دعم"],
      },
    ],
  },
];

/**
 * البحث يمسح **اللغتين** لا لغة الواجهة وحدها: من يكتب "tracking" وواجهته
 * عربية يقصد المقالة نفسها، ومن يكتب «تتبع» وواجهته إنجليزية كذلك.
 */
export function searchHelp(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const has = (x: HelpText) => x.ar.toLowerCase().includes(q) || x.en.toLowerCase().includes(q);
  return HELP_SECTIONS.flatMap((s) => s.articles).filter(
    (a) => has(a.q) || has(a.a) || a.tags.some((t) => t.toLowerCase().includes(q))
  );
}
