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
  // ══════════════════════════════════════════════════════════════════
  // تركيب التتبّع - القسم الأكثر طلباً للدعم، فهو الأطول والأدقّ.
  // كلُّ سؤالٍ هنا سؤالٌ يُسأل فعلاً في أوّل أسبوع، وإجابتُه هنا رسالةٌ
  // أقلّ في الصندوق.
  // ══════════════════════════════════════════════════════════════════
  {
    title: { ar: "تركيب التتبّع", en: "Installing tracking" },
    articles: [
      {
        id: "why-tag",
        q: { ar: "لماذا أحتاج تركيب كود على موقعي أصلاً؟", en: "Why do I need to install code on my site at all?" },
        a: { ar: "لأن المنصات الإعلانية لا تخبرنا بما حدث فعلاً. جوجل تقول إن الإعلان حقّق تحويلاً، لكنها لا تُثبت أن أحداً راسلك. الكود على موقعك يسجّل النقرة الحقيقية وهويّتها الإعلانية (معرّف الحملة والإعلان)، فحين تصل رسالة واتساب نستطيع ربطها بالإعلان الذي جاءت منه. بدون الكود يبقى المنتج قادراً على قراءة أرقام المنصات فقط — أي أنه يفقد سبب وجوده.", en: "Because the ad platforms do not tell us what actually happened. Google says an ad produced a conversion; it cannot prove anyone messaged you. The code on your site records the real click and its advertising identity — campaign and ad — so when a WhatsApp message arrives we can tie it back to the ad it came from. Without it the product can only read the platforms' own numbers, which is the one thing it exists not to do." },
        tags: ["تتبع", "كود", "tag", "tracking", "install"],
      },
      {
        id: "install-tag",
        q: { ar: "كيف أركّب كود التتبّع؟", en: "How do I install the tracking code?" },
        a: { ar: "افتح صفحة «التتبّع» من القائمة الجانبية، وانسخ الكود المعروض، وألصقه في صفحات موقعك قبل وسم </body> مباشرة. الكود واحد لكل الصفحات — لا تحتاج نسخة مختلفة لكل صفحة. بعد اللصق، ارجع لنفس الصفحة واضغط «فحص» لنتأكد أنه يعمل قبل أن تعتمد عليه.", en: "Open Tracking in the sidebar, copy the snippet shown, and paste it into your site's pages immediately before the closing </body> tag. It is the same snippet on every page — you do not need a different one per page. Then come back to that screen and press Check, so you know it works before you rely on it." },
        tags: ["تركيب", "كود", "install", "snippet", "body"],
      },
      {
        id: "install-gtm",
        q: { ar: "أستخدم Google Tag Manager — ما الخطوات؟", en: "I use Google Tag Manager — what are the steps?" },
        a: { ar: "أضف وسماً جديداً من نوع Custom HTML، ألصق فيه كودنا كما هو، واضبط المُشغّل (Trigger) على All Pages، ثم انشر الحاوية. النتيجة مطابقة تماماً للّصق المباشر. لاحظ أن التغيير لا يسري حتى تضغط Publish — الحفظ وحده لا يكفي، وهذا أكثر سبب لعدم ظهور التتبّع بعد التركيب عبر GTM.", en: "Add a new Custom HTML tag, paste our snippet into it unchanged, set the trigger to All Pages, and publish the container. The result is identical to pasting it directly. Note that nothing takes effect until you press Publish — saving alone does nothing, and that is the most common reason tracking does not appear after a GTM install." },
        tags: ["gtm", "tag manager", "جوجل", "حاوية"],
      },
      {
        id: "install-platform",
        q: { ar: "موقعي على شوبيفاي أو سلة أو ووردبريس — أين ألصق الكود؟", en: "My site is on Shopify, Salla or WordPress — where does the code go?" },
        a: { ar: "شوبيفاي: Online Store ← Themes ← Edit code ← theme.liquid، قبل </body>. سلة: الإعدادات ← الأكواد المخصّصة. ووردبريس: إمّا عبر إضافة تدعم إدراج الأكواد في الرأس/التذييل، أو في footer.php للقالب الفرعي (child theme) — وليس القالب الأصلي، لأن أول تحديث للقالب سيمسحه. في كل الحالات: ألصق، ثم ارجع واضغط «فحص».", en: "Shopify: Online Store → Themes → Edit code → theme.liquid, before </body>. Salla: Settings → Custom code. WordPress: either a plugin that inserts header/footer code, or footer.php in a child theme — not the parent theme, because the first theme update will erase it. In every case: paste, then come back and press Check." },
        tags: ["شوبيفاي", "سلة", "ووردبريس", "shopify", "salla", "wordpress"],
      },
      {
        id: "whatsapp-link",
        q: { ar: "كيف يعرف النظام أن رسالة واتساب جاءت من إعلان بعينه؟", en: "How does the system know a WhatsApp message came from a specific ad?" },
        a: { ar: "بطريقتين. الأولى: أزرار واتساب في موقعك — الكود يضيف للرابط معرّفاً يسافر مع الرسالة، فنعرف من أي إعلان جاءت. الثانية: إعلانات «انقر للمراسلة» على فيسبوك وإنستجرام — ميتا نفسها ترسل معرّف الإعلان مع المحادثة، ولا تحتاج تركيب شيء لهذه. أما من يفتح واتساب ويكتب رقمك بيده فلا مصدر له إطلاقاً، وهذا حدّ حقيقي نعرضه بوضوح بدل تخمينه.", en: "Two ways. First, WhatsApp buttons on your site: the snippet adds an identifier to the link that travels with the message, so we know which ad produced it. Second, click-to-message ads on Facebook and Instagram: Meta itself sends the ad identifier along with the conversation, and nothing needs installing for those. Someone who opens WhatsApp and types your number by hand carries no source at all — a real limit we show plainly rather than guess at." },
        tags: ["واتساب", "whatsapp", "ctwa", "click to message", "رابط"],
      },
      {
        id: "test-tracking",
        q: { ar: "كيف أتأكد أن التتبّع يعمل فعلاً قبل أن أعتمد عليه؟", en: "How do I confirm tracking really works before relying on it?" },
        a: { ar: "من صفحة التتبّع أضف صفحاتك المهمّة واضغط «فحص الكل» — نفتح كل صفحة ونتأكد من وجود الكود ونعرض النتيجة صفحةً صفحة. ثم اختبرها بنفسك: افتح موقعك من إعلان حقيقي (لا من الرابط مباشرة)، واضغط زر واتساب، وابعث رسالة. يفترض أن تظهر خلال دقائق في صندوق الرسائل مرتبطةً بالحملة. إن لم تظهر، راجع «مشاكل شائعة» أدناه قبل مراسلة الدعم.", en: "On the Tracking page add your important pages and press Check all — we open each one, confirm the snippet is present, and show the result page by page. Then test it yourself: reach your site from a real ad (not by typing the URL), press the WhatsApp button and send a message. It should appear in the inbox within minutes, attached to the campaign. If it does not, work through Common problems below before writing to support." },
        tags: ["اختبار", "فحص", "test", "verify", "تأكد"],
      },
      {
        id: "tracking-not-working",
        q: { ar: "ركّبت الكود ولا شيء يظهر — ما الأسباب الشائعة؟", en: "I installed the code and nothing appears — what are the common causes?" },
        a: { ar: "بالترتيب الذي نراه فعلاً: (١) التركيب عبر GTM بدون ضغط Publish. (٢) الكود في صفحة واحدة لا في القالب، فيغيب عن باقي الصفحات. (٣) وصلت لموقعك بكتابة العنوان مباشرة لا من إعلان، فلا توجد هويّة إعلانية أصلاً لتُسجَّل. (٤) مانع إعلانات في متصفّحك أنت وقت الاختبار. (٥) القالب حُدِّث فمُسح الكود — وهذا سبب توقّف التتبّع فجأة بعد شهور من العمل. صفحة التتبّع تفحص الأربعة الأولى نيابةً عنك.", en: "In the order we actually see them: (1) installed through GTM without pressing Publish. (2) pasted into one page instead of the template, so it is missing everywhere else. (3) you reached the site by typing the address rather than through an ad, so there was no advertising identity to record. (4) an ad blocker in your own browser during the test. (5) the theme was updated and wiped the code — which is why tracking stops suddenly after months of working. The Tracking page checks the first four for you." },
        tags: ["مشكلة", "لا يعمل", "troubleshoot", "not working", "خطأ"],
      },
      {
        id: "spa-tracking",
        q: { ar: "موقعي تطبيق صفحة واحدة (React/Next) — هل يعمل الكود؟", en: "My site is a single-page app (React/Next) — does the snippet work?" },
        a: { ar: "نعم. الكود يقرأ هويّة الإعلان عند أول وصول ويحتفظ بها أثناء تنقّل الزائر داخل الموقع، فلا يضيع المصدر عند تغيّر الصفحة بلا إعادة تحميل. ركّبه مرّة واحدة في القالب الأساسي (layout) وليس في كل صفحة.", en: "Yes. The snippet reads the advertising identity on first arrival and keeps it while the visitor moves around, so the source is not lost when the page changes without a reload. Install it once in the root layout, not per page." },
        tags: ["spa", "react", "next", "تطبيق صفحة واحدة"],
      },
      {
        id: "tracking-privacy",
        q: { ar: "ماذا يجمع الكود بالضبط؟ هل يخالف الخصوصية؟", en: "What exactly does the snippet collect? Is it a privacy problem?" },
        a: { ar: "يسجّل معرّفات الحملة والإعلان القادمة من رابط الإعلان، وعنوان الصفحة، ووقت النقرة، ونوع الجهاز والمتصفّح. لا يقرأ محتوى النماذج، ولا كلمات مرور، ولا وسائل دفع، ولا يبني ملفاً شخصياً عبر مواقع أخرى. أرقام الهواتف وعناوين IP التي تصل مع محادثات واتساب تُطمَس بعد تسعين يوماً تلقائياً. التفاصيل الكاملة في سياسة الخصوصية.", en: "It records the campaign and ad identifiers carried in the ad link, the page address, the time of the click, and the device and browser type. It does not read form contents, passwords or payment details, and does not build a profile across other sites. Phone numbers and IP addresses arriving with WhatsApp conversations are automatically redacted after ninety days. The full detail is in the Privacy Policy." },
        tags: ["خصوصية", "بيانات", "privacy", "gdpr", "قانون"],
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
  // ══════════════════════════════════════════════════════════════════
  // القيمة والتسعير - الأسئلة اللي بتتسأل قبل الاشتراك لا بعده.
  // مكتوبة بحجّة لا بوعد: بنقول إيه اللي بيحصل، ومابنضمنش نتيجة - ده
  // بند صريح في الشروط، وتكرارُه هنا بيحمي الاتنين.
  // ══════════════════════════════════════════════════════════════════
  {
    title: { ar: "ربط المنصات والمتاجر", en: "Connecting platforms and stores" },
    articles: [
      {
        id: "connect-platforms",
        q: { ar: "كيف أربط حساباتي الإعلانية؟ وما الصلاحيات التي تطلبونها؟", en: "How do I connect my ad accounts, and what permissions do you ask for?" },
        a: { ar: "من صفحة «ربط المنصات» تضغط على المنصة وتسجّل الدخول عندها مباشرة — لا نطلب كلمة مرورك ولا نراها. الصلاحية المطلوبة هي قراءة بيانات الحملات والأداء، وصلاحية رفع التحويلات إن فعّلتها أنت. توكنات الوصول مشفّرة في قاعدة البيانات، ويمكنك سحب الصلاحية من عند المنصة نفسها في أي وقت.", en: "From Connect platforms, press the platform and sign in with them directly — we never ask for or see your password. The permission requested is to read campaign and performance data, plus conversion upload if you enable it. Access tokens are encrypted in the database, and you can revoke access from the platform's own settings at any time." },
        tags: ["ربط", "جوجل", "ميتا", "تيك توك", "oauth", "صلاحيات"],
      },
      {
        id: "agency-mcc",
        q: { ar: "حسابي تحت وكالة (MCC) — هل يعمل الربط؟", en: "My account sits under an agency (MCC) — does connecting work?" },
        a: { ar: "نعم، وهي حالة مدعومة صراحةً. عند الربط اختر الحساب الصحيح تحت الوكالة، ونحن نمرّر هويّة حساب الوكالة مع كل قراءة وكل كتابة — من دونها تفشل الأوامر مع أي حساب تحت مدير.", en: "Yes, and it is explicitly supported. Choose the correct account under the manager when connecting, and we pass the manager account's identity with every read and every write — without it, commands fail against any account under a manager." },
        tags: ["mcc", "وكالة", "manager", "agency"],
      },
      {
        id: "sync-timing",
        q: { ar: "متى تتحدّث البيانات؟ ولماذا لا أرى شيئاً اليوم الأول؟", en: "When does data refresh, and why do I see nothing on day one?" },
        a: { ar: "المزامنة تعمل يومياً، ويمكنك تشغيلها يدوياً من صفحة الربط. أول يوم عادةً يعرض القليل: التاريخ يُسحب أولاً، والتحقّق يحتاج محادثات جديدة تصل بعد تركيب التتبّع — فالمحادثات التي وصلت قبل التركيب لا مصدر لها. أعطِ الأمر أسبوعاً قبل الحكم على الأرقام.", en: "Sync runs daily, and you can trigger it by hand from the connections page. Day one usually looks thin: history is pulled first, and verification needs new conversations arriving after the tracking is installed — conversations that came before it carry no source. Give it a week before judging the numbers." },
        tags: ["مزامنة", "تحديث", "sync", "يوم أول", "بيانات"],
      },
      {
        id: "sync-failed",
        q: { ar: "المزامنة فشلت أو المنصة تظهر «غير متصلة» فجأة", en: "Sync failed, or a platform suddenly shows as disconnected" },
        a: { ar: "أشيع سبب: انتهاء صلاحية الإذن عند المنصة — يحدث عند تغيير كلمة مرور حسابك الإعلاني، أو سحب الصلاحية، أو تغيير صلاحياتك داخل الوكالة. الحل إعادة الربط من نفس الصفحة، ولا تفقد بياناتك السابقة. إن تكرّر الفشل بعد إعادة الربط، فالسبب غالباً حدود الاستخدام عند المنصة نفسها وتُحلّ بالانتظار.", en: "The most common cause is the permission expiring at the platform — which happens when your ad account password changes, access is revoked, or your role inside the agency changes. Reconnect from the same page; you lose no existing data. If it keeps failing after reconnecting, it is usually the platform's own rate limits, and waiting resolves it." },
        tags: ["فشل", "انقطاع", "disconnected", "إعادة ربط", "خطأ"],
      },
      {
        id: "connect-store",
        q: { ar: "كيف أربط متجري؟ وما الفائدة؟", en: "How do I connect my store, and what does it add?" },
        a: { ar: "ندعم سلة وشوبيفاي وزد وووكومرس وإيزي أوردرز. الربط يجعل الطلب الحقيقي — لا التحويل المُعلَن — مصدر رقم الإيراد، فتصير مقارنة «صرفت كذا وعاد كذا» مبنيّة على مبيعات فعلية. بدون متجر مربوط نعرف الإنفاق ولا نعرف ما عاد منه.", en: "We support Salla, Shopify, Zid, WooCommerce and EasyOrders. Connecting makes the real order — not the reported conversion — the source of the revenue figure, so 'I spent this and got that back' rests on actual sales. Without a connected store we know the spend and not what came back from it." },
        tags: ["متجر", "سلة", "شوبيفاي", "زد", "ووكومرس", "store"],
      },
      {
        id: "cogs-limit",
        q: { ar: "هل تعرفون ربحي الحقيقي بعد تكلفة البضاعة؟", en: "Do you know my real profit after cost of goods?" },
        a: { ar: "جزئياً، وبصراحة عن الحدّ. لا توجد منصة من الخمس ترسل تكلفة البضاعة في بيانات الطلب — هذا حدّ فيها لا فينا. سلة تتيحها على المنتج، وشوبيفاي تتيحها بصلاحية إضافية، وزد وووكومرس وإيزي أوردرز لا تتيح الحقل أصلاً. يمكنك إدخال التكلفة يدوياً لكل منتج، أو تحديد هامش ربح عام للمساحة فنحسب نقطة التعادل منه. من دون أحدهما نعرض العائد لا الربح — ونقولها بدل أن نسمّي العائد ربحاً.", en: "Partly, and we will be plain about the limit. None of the five platforms sends cost of goods in the order data — that is their limit, not ours. Salla exposes it on the product, Shopify behind an extra permission, and Zid, WooCommerce and EasyOrders have no such field at all. You can enter cost per product by hand, or set an overall margin for the workspace and we compute a break-even from it. Without one of those we show return, not profit — and we say so rather than calling return profit." },
        tags: ["ربح", "تكلفة", "cogs", "هامش", "profit"],
      },
      {
        id: "conversion-upload",
        q: { ar: "ما معنى «رفع التحويلات» للمنصات؟ وهل بياناتي آمنة؟", en: "What does uploading conversions back to the platforms mean, and is my data safe?" },
        a: { ar: "بعد أن نتحقّق من تحويل حقيقي، نستطيع إبلاغ المنصة به لتتعلّم خوارزميتها من العملاء الحقيقيين لا من الإشارات المُعلَنة — وهو ما يحسّن الاستهداف مع الوقت. أي معرّف شخصي (هاتف أو بريد) يُهشَّم بخوارزمية SHA-256 قبل الإرسال، فلا يغادر النصّ الصريح خوادمنا. الميزة اختيارية بالكامل، تُفعّلها أنت وتوقفها متى شئت.", en: "Once we have verified a real conversion, we can report it back so the platform's algorithm learns from actual customers rather than its own reported signals — which improves targeting over time. Any personal identifier, phone or email, is hashed with SHA-256 before it is sent, so nothing leaves our servers in clear text. The feature is entirely optional: you switch it on, and off, whenever you like." },
        tags: ["رفع التحويلات", "capi", "تهشيم", "hashing", "استهداف"],
      },
    ],
  },
  {
    title: { ar: "الفريق والصلاحيات", en: "Team and permissions" },
    articles: [
      {
        id: "seats-roles",
        q: { ar: "ما الفرق بين مقعد الاطلاع ومقعد التنفيذ؟", en: "What is the difference between a viewer seat and an operator seat?" },
        a: { ar: "مقعد الاطلاع يرى كل شيء ولا يغيّر شيئاً: لا ينفّذ قراراً على حساب إعلاني، ولا يعدّل قاعدة أتمتة، ولا يربط أو يفصل منصّة أو متجراً. مقعد التنفيذ يفعل ذلك. الفصل مفروض عند نقطة قراءة قاعدة البيانات نفسها لا في إخفاء الأزرار — أي أن الطلب المباشر من مقعد اطلاع يُرفض كذلك. وإدارة المقاعد لصاحب الحساب وحده.", en: "A viewer sees everything and changes nothing: no decision executed against an ad account, no automation rule edited, no platform or store connected or disconnected. An operator can. The separation is enforced at the database query itself rather than by hiding buttons — so a direct request from a viewer is refused too. Managing seats belongs to the account owner alone." },
        tags: ["مقاعد", "صلاحيات", "seats", "viewer", "operator", "فريق"],
      },
      {
        id: "invite-teammate",
        q: { ar: "كيف أدعو زميلاً؟ وماذا يحدث لو لم تصله الرسالة؟", en: "How do I invite a colleague, and what if the email does not arrive?" },
        a: { ar: "من الإعدادات ← الفريق: اكتب بريده واختر الدور واضغط «ادعُ». تصله رسالة بهويّتنا تشرح من دعاه وإلى أي مساحة وبأي صلاحية. تظهر لك أيضاً نسخة من الرابط لترسلها بنفسك إن أحببت. الدعوة صالحة سبعة أيام ومرتبطة ببريده هو — فلا تُقبل من حساب آخر.", en: "Settings → Team: enter their email, pick the role, press Invite. They receive a message in our identity saying who invited them, to which workspace and with what permission. You also see a copy of the link to send yourself if you prefer. The invitation lasts seven days and is bound to that email address, so it cannot be accepted from another account." },
        tags: ["دعوة", "زميل", "invite", "فريق", "بريد"],
      },
      {
        id: "agency-clients",
        q: { ar: "أنا وكالة — كيف أفصل عملائي عن بعضهم؟", en: "I run an agency — how do I keep clients separate?" },
        a: { ar: "بمساحة عمل لكل عميل. كل مساحة لها حساباتها الإعلانية وقواعدها وتقاريرها وأرقامها، ولا تتسرّب بيانات بينها. باقة الوكالات تعطي خمس عشرة مساحة وعشرة مقاعد اطلاع وثلاثة مقاعد تنفيذ.", en: "One workspace per client. Each has its own ad accounts, rules, reports and figures, and nothing leaks between them. The Agency plan gives fifteen workspaces, ten viewer seats and three operator seats." },
        tags: ["وكالة", "عملاء", "مساحات", "agency", "فصل"],
      },
    ],
  },
  {
    title: { ar: "القيمة والتسعير", en: "Value and pricing" },
    articles: [
      {
        id: "why-pay",
        q: { ar: "عندي لوحات جوجل وميتا مجاناً — لماذا أدفع لكم؟", en: "I have the Google and Meta dashboards for free — why pay you?" },
        a: { ar: "لأن اللوحات تلك تُقيّم عمل نفسها. المنصة تحسب التحويل بمعاييرها هي — نافذة إسناد طويلة، ونماذج إحصائية، وأحياناً نقرة شاهدها المستخدم ولم يضغطها. نحن نحسب ما تستطيع إثباته: محادثة حقيقية وصلتك. الفرق بين الرقمين هو ما تدفع مقابل رؤيته، لأن قراراتك في الميزانية مبنية عليه. لا نَعِد بأن الفرق سيكون كبيراً عندك — قد يكون صغيراً، وهذه نتيجة مفيدة أيضاً.", en: "Because those dashboards grade their own work. The platform counts a conversion by its own rules — long attribution windows, statistical modelling, sometimes an ad that was seen rather than clicked. We count what can be proved: a real conversation that reached you. The gap between the two numbers is what you are paying to see, because your budget decisions rest on it. We do not promise the gap will be large for you — it may be small, and that is a useful result too." },
        tags: ["لماذا", "قيمة", "why pay", "مقارنة", "لوحات"],
      },
      {
        id: "roi-claim",
        q: { ar: "كم سأوفّر؟ هل يزيد المنتج مبيعاتي؟", en: "How much will I save? Will this increase my sales?" },
        a: { ar: "لا نعرف، ولن نعطيك رقماً مخترعاً. توفيرك يعتمد على حجم صرفك، وعلى مقدار الفارق بين المُعلَن والمتحقَّق في حسابك أنت، وعلى تصرّفك بعد رؤيته. ما نضمنه هو المعلومة لا النتيجة: سترى أي حملة تُنتج محادثات فعلية وأيها لا، وستعرف رقم تكلفة العميل المحسوب على تحويلات مؤكَّدة. القرار يبقى قرارك، ونتائجه تخصّك. من يَعِدك بنسبة توفير محدّدة قبل أن يرى حسابك يبيعك تخميناً.", en: "We do not know, and we will not invent a number. What you save depends on your spend, on how wide the gap between reported and verified turns out to be in your account, and on what you do after seeing it. What we guarantee is the information, not the outcome: you will see which campaigns produce real conversations and which do not, and a cost-per-customer computed on confirmed conversions. The decision stays yours and so do its results. Anyone promising you a specific saving before seeing your account is selling you a guess." },
        tags: ["عائد", "توفير", "roi", "نتائج", "ضمان"],
      },
      {
        id: "which-plan",
        q: { ar: "أي باقة تناسبني؟", en: "Which plan fits me?" },
        a: { ar: "اختر بالحدّ الذي ستصطدم به أولاً، لا بالسعر. تصرف على منصة واحدة وتدير حساباً واحداً: البداية تكفي. تدير عدّة علامات أو حسابات إعلانية متعدّدة: الاحترافية (ثلاث مساحات عمل). وكالة تدير عملاء: الوكالات (خمس عشرة مساحة، ومقاعد لفريقك). أكبر من ذلك أو لك متطلّب خاص: الاتفاقية بالتفاوض. يمكنك الترقية في أي وقت، والفرق يُحتسب من الدورة التالية.", en: "Pick by the limit you will hit first, not by price. One platform and one account: Starter is enough. Several brands or ad accounts: Pro, at three workspaces. An agency running clients: Agency, at fifteen workspaces with seats for your team. Larger than that, or with a specific requirement: Enterprise, agreed on a call. You can upgrade at any time and the difference applies from the next cycle." },
        tags: ["باقة", "اختيار", "plan", "ترقية", "أسعار"],
      },
      {
        id: "ai-credits",
        q: { ar: "ما هو «رصيد التحليل»؟ ومتى يُخصم؟", en: "What is an analysis credit and when is it deducted?" },
        a: { ar: "رصيد واحد لكل طلب تحليل ذكي: تحديث الرؤى، أو سؤال في صندوق «اسأل»، أو فحص جودة صورة إعلان. لا يُخصم شيء عند تصفّح الصفحات أو قراءة التقارير أو المزامنة اليومية — تلك كلها بلا رصيد. وإن فشل النداء لخطأ عندنا يُردّ الرصيد تلقائياً. الفحص العميق للموقع له عدّاد منفصل لأنه أثقل بكثير.", en: "One credit per AI request: refreshing insights, a question in the Ask box, or an ad image quality check. Nothing is deducted for browsing pages, reading reports or the daily sync — those cost no credits. If a call fails because of a fault on our side the credit is refunded automatically. Deep site scans have their own separate counter because they are far heavier." },
        tags: ["رصيد", "ذكاء اصطناعي", "credits", "ai", "استهلاك"],
      },
      {
        id: "hit-limit",
        q: { ar: "ماذا يحدث لو تجاوزت حد باقتي؟", en: "What happens if I exceed my plan's limit?" },
        a: { ar: "لا نوقف حسابك ولا نسحب مبلغاً إضافياً بلا إذنك. الميزة التي بلغت حدّها تتوقّف مع رسالة تقول أي حدّ بلغته وكم هو، وباقي المنتج يعمل. تنبيه يصلك قبل بلوغ الحد لا بعده. الترقية أو انتظار بداية الدورة الجديدة كلاهما يعيد الميزة.", en: "We do not suspend your account and we never take an extra payment without your consent. The feature that reached its limit stops, with a message naming which limit and what it is, and the rest of the product keeps working. You are warned before you reach it, not after. Upgrading or waiting for the next cycle both restore it." },
        tags: ["حد", "تجاوز", "limit", "إيقاف", "ترقية"],
      },
      {
        id: "cancel-refund",
        q: { ar: "كيف ألغي الاشتراك؟ وهل يُردّ المبلغ؟", en: "How do I cancel? Is there a refund?" },
        a: { ar: "الإلغاء من صفحة الاشتراك بضغطة، بلا مراسلة أحد ولا مكالمة احتفاظ. الإلغاء يوقف التجديد القادم ولا يقطع الخدمة: تكمل حتى نهاية الفترة المدفوعة. المبالغ عن فترة بدأت بالفعل لا تُردّ، إلا حيث يوجب القانون خلاف ذلك. بياناتك تظل متاحة للتصدير ثلاثين يوماً بعد الانتهاء.", en: "Cancel from the subscription page in one press, with nobody to email and no retention call. Cancelling stops the next renewal and does not cut off service: it runs to the end of the period you paid for. Amounts for a period already started are not refunded, except where the law requires otherwise. Your data stays available to export for thirty days after the end." },
        tags: ["إلغاء", "استرداد", "cancel", "refund", "اشتراك"],
      },
      {
        id: "currency-vat",
        q: { ar: "بأي عملة أُحاسَب؟ وهل السعر شامل الضريبة؟", en: "What currency am I billed in, and does the price include tax?" },
        a: { ar: "العملة تتبع بلد الفوترة التي تختارها عند الشراء، والمبلغ المعروض عند الدفع هو المبلغ الذي يُخصم — لا مفاجآت تُضاف بعد الضغط. أما أرقام حساباتك الإعلانية داخل المنتج فتظل بعملة الحساب الإعلاني نفسه، لأن تحويلها لعملة أخرى يخلق رقماً لم تدفعه فعلاً.", en: "Currency follows the billing country you choose at checkout, and the amount shown at payment is the amount taken — nothing is added after you press. Figures from your ad accounts inside the product stay in the ad account's own currency, because converting them would create a number you never actually spent." },
        tags: ["عملة", "ضريبة", "vat", "currency", "فاتورة"],
      },
      {
        id: "trial-demo",
        q: { ar: "هل أستطيع تجربة المنتج قبل الدفع؟", en: "Can I try the product before paying?" },
        a: { ar: "نعم. التجربة المجانية تنتهي تلقائياً عند انقضاء مدّتها ولا تتحوّل لاشتراك مدفوع إلا باختيارك الصريح لباقة — لا نحتفظ ببطاقتك لنخصم منها بصمت. مدّة التجربة ونطاقها معلنان عند التسجيل.", en: "Yes. A free trial ends automatically when its term expires and never converts into a paid subscription without you explicitly choosing a plan — we do not hold your card to charge it quietly. The trial's length and scope are stated at sign-up." },
        tags: ["تجربة", "مجاني", "trial", "demo", "قبل الدفع"],
      },
    ],
  },
  {
    title: { ar: "أرقام لا تتطابق ومشاكل شائعة", en: "Mismatched numbers and common problems" },
    articles: [
      {
        id: "numbers-differ",
        q: { ar: "رقمكم أقل من رقم جوجل/ميتا بكثير — من المخطئ؟", en: "Your number is far below Google's or Meta's — who is wrong?" },
        a: { ar: "لا أحد بالضرورة. نحن نقيس شيئاً آخر. المنصة تحسب التحويل بنافذة إسناد طويلة وبنماذج إحصائية وأحياناً بمشاهدة لا نقرة. نحن نحسب ما نستطيع إثباته: محادثة وصلت فعلاً. الاختلاف متوقَّع ومقصود، وليس عطلاً في المنتج. المفيد ليس أي الرقمين «صحيح» بل كم اتساع الفارق واتجاهه عبر الوقت.", en: "Not necessarily either. We are measuring a different thing. The platform counts with a long attribution window, with statistical modelling, and sometimes on a view rather than a click. We count what can be proved: a conversation that actually arrived. The difference is expected and intended, and is not a fault in the product. What matters is not which number is 'right' but how wide the gap is and which way it moves over time." },
        tags: ["فرق", "اختلاف", "أرقام", "mismatch", "جوجل", "ميتا"],
      },
      {
        id: "zero-verified",
        q: { ar: "التحويلات المتحقَّقة صفر — لماذا؟", en: "Verified conversions are zero — why?" },
        a: { ar: "بالترتيب: (١) التتبّع غير مركّب أو مركّب بعد بدء الحملة — راجع صفحة التتبّع. (٢) عملاؤك يراسلونك بطرق لا تمرّ بموقعك (رقمك في البايو، أو حفظوه من قبل) فلا مصدر لها. (٣) الحملة تُنتج نقرات ولا تُنتج محادثات فعلاً — وهذه ليست مشكلة تتبّع بل نتيجة، وهي أهمّ ما قد يخبرك به المنتج. افحص الأول والثاني قبل أن تستنتج الثالث.", en: "In order: (1) tracking is not installed, or was installed after the campaign started — check the Tracking page. (2) your customers reach you by routes that never touch your site (your number in a bio, or saved from before), so there is no source. (3) the campaign produces clicks and genuinely produces no conversations — which is not a tracking problem but a result, and possibly the most valuable thing the product can tell you. Rule out the first two before concluding the third." },
        tags: ["صفر", "لا تحويلات", "zero", "متحقق", "مشكلة"],
      },
      {
        id: "unattributed",
        q: { ar: "ما معنى «محادثات غير منسوبة»؟", en: "What does 'unattributed conversations' mean?" },
        a: { ar: "محادثات حقيقية وصلتك ولم نستطع ربطها بإعلان بعينه — لأن صاحبها لم يمرّ بموقعك، أو مرّ من غير إعلان، أو كتب رقمك بيده. نعرضها منفصلة ولا ندمجها في أي رقم إعلاني، لأن نسبها بالتخمين إلى حملة يفسد بالضبط الرقم الذي جئت من أجله. ارتفاعها لا يعني خطأ: كثير من العملاء يصلون بطرق لا تُتتبَّع، وهذه حقيقة سوق لا عطل.", en: "Real conversations that reached you which we could not tie to a specific ad — because the person never passed through your site, arrived without an ad, or typed your number by hand. We show them separately and never fold them into an advertising figure, because guessing them onto a campaign corrupts precisely the number you came for. A high count is not an error: many customers arrive by untrackable routes, and that is a fact of the market rather than a fault." },
        tags: ["غير منسوبة", "unattributed", "إسناد", "محادثات"],
      },
      {
        id: "double-count",
        q: { ar: "هل يمكن أن يُحسب العميل الواحد مرتين؟", en: "Can one customer be counted twice?" },
        a: { ar: "التحقّق يفحص وجود تسجيل سابق قبل أي زيادة، فالمحادثة الواحدة لا تزيد العدّاد مرتين حتى لو وصلت من قناتين. أما لو راسلك نفس الشخص من رقمين مختلفين فسيظهر كطرفين — لا وسيلة تقنية تربطهما بلا معلومة تعريفية إضافية لا نجمعها.", en: "Verification checks for an existing record before any increment, so a single conversation cannot raise the counter twice even if it arrives through two channels. If the same person messages you from two different numbers they will appear as two — there is no technical way to link them without extra identifying information that we do not collect." },
        tags: ["تكرار", "مرتين", "duplicate", "عدّ"],
      },
      {
        id: "why-alert",
        q: { ar: "وصلني تنبيه بإيقاف إعلان — على أي أساس؟", en: "I got an alert to pause an ad — on what basis?" },
        a: { ar: "التنبيه لا يخرج على رقم يوم واحد. الإعلان يجب أن يكون نشطاً أياماً كافية، وأن يبلغ حدّاً أدنى من التحويلات، وأن يكون موقعه رديئاً بالمقارنة النسبية بأقرانه في نفس الحساب — لا مجرد بُعد عن متوسّط. وإن حدّدت هامش ربحك تصير نقطة التعادل فحصاً أقوى من أي مقارنة نسبية. كل تنبيه يعرض السبب والأرقام التي بُني عليها، والقرار يبقى قرارك.", en: "An alert never fires on a single day's number. The ad must have been active for enough days, have reached a minimum number of conversions, and rank poorly against its peers in the same account — not merely sit below an average. If you have set your profit margin, break-even becomes a stronger test than any relative comparison. Every alert shows its reason and the figures behind it, and the decision stays yours." },
        tags: ["تنبيه", "إيقاف", "قرار", "alert", "kill"],
      },
      {
        id: "wrong-action",
        q: { ar: "هل يمكن للمنتج أن يغيّر حسابي الإعلاني بلا إذني؟", en: "Can the product change my ad account without my permission?" },
        a: { ar: "لا. كل تنفيذ حقيقي يمرّ بتأكيد من خطوتين: ضغطة أولى تسأل، وثانية تنفّذ. الاستثناء الوحيد قواعد الأتمتة التي أنشأتها أنت بنفسك وحدّدت شروطها، ويمكنك إيقافها في أي لحظة. وحتى الأتمتة لها سقوف أمان مفروضة: حدّ أقصى لزيادة الميزانية في المرّة الواحدة، وفترة راحة إجبارية بين زيادة وأخرى.", en: "No. Every real execution goes through a two-step confirmation: the first press asks, the second acts. The only exception is an automation rule you created yourself and whose conditions you set, and which you can switch off at any moment. Even automation has enforced safety ceilings: a maximum budget increase per step and a mandatory cooling-off period between increases." },
        tags: ["تنفيذ", "أمان", "تأكيد", "أتمتة", "safety"],
      },
      {
        id: "data-gap",
        q: { ar: "لماذا تختفي بيانات أيام قديمة؟", en: "Why does older data disappear?" },
        a: { ar: "سببان مختلفان. الأول: عمق التاريخ المتاح يتبع باقتك (ثلاثون يوماً في المجانية، وأربعة وعشرون شهراً في الاحترافية فما فوق). الثاني: بيانات خام قصيرة القيمة — كالنقرات الفردية — تُحذف أو تُطمَس بعد مدّة بحكم سياسة الاحتفاظ وقانون حماية البيانات. الأرقام اليومية المجمَّعة التي تبني عليها التقارير تبقى.", en: "Two different reasons. First, how far back you can look follows your plan — thirty days on Free, twenty-four months on Pro and above. Second, short-lived raw data such as individual clicks is deleted or redacted after a period, under our retention policy and data protection law. The daily aggregated figures your reports are built on remain." },
        tags: ["تاريخ", "بيانات قديمة", "history", "احتفاظ", "حذف"],
      },
    ],
  },
  {
    title: { ar: "البيانات والخصوصية والأمان", en: "Data, privacy and security" },
    articles: [
      {
        id: "who-owns-data",
        q: { ar: "من يملك بياناتي؟ وهل تستخدمونها؟", en: "Who owns my data, and do you use it?" },
        a: { ar: "بياناتك ملكك: حساباتك الإعلانية وحملاتك وعملاؤك وطلباتك. ترخيصنا محصور في تشغيل الخدمة لك. لا نبيع بياناتك، ولا نستخدمها في تسويقنا، ولا نعرضها لعميل آخر. قد نستخدم إحصاءات مجمَّعة ومجهولة الهويّة — لا تعرّف بك ولا بعملائك — لتحسين المنتج. ويمكنك تصدير بياناتك في أي وقت.", en: "Your data is yours: your ad accounts, campaigns, customers and orders. Our licence is limited to running the service for you. We do not sell it, do not use it in our own marketing, and never show it to another customer. We may use aggregated, anonymised statistics — which identify neither you nor your customers — to improve the product. You can export your data at any time." },
        tags: ["ملكية", "بيانات", "خصوصية", "own", "بيع"],
      },
      {
        id: "who-sees",
        q: { ar: "من يستطيع رؤية حسابي من فريقكم؟", en: "Who on your side can see my account?" },
        a: { ar: "الوصول لأغراض الدعم محدود ومسجَّل: أي دخول إلى حساب عميل يُكتب في سجلّ تدقيق لا يُعدَّل، والكتابة أثناء «العرض كـ» ممنوعة تقنياً لا بالاتفاق. ولا يستطيع موظف الدعم الوصول إلى فلوس أو صلاحيات أو مفاتيح.", en: "Support access is limited and recorded: any entry into a customer account is written to an audit log that cannot be edited, and writing while viewing as a customer is blocked technically rather than by policy. A support account cannot reach money, permissions or keys at all." },
        tags: ["وصول", "دعم", "تدقيق", "access", "موظفين"],
      },
      {
        id: "breach",
        q: { ar: "ماذا يحدث لو حصل اختراق؟", en: "What happens if there is a breach?" },
        a: { ar: "نخطر الجهة الرقابية في المدّة التي يحدّدها القانون، ونخطرك دون تأخير إن كان الحادث يمسّ بيانات في حسابك، ونقول ما نعرفه وقت الإخطار — طبيعة الحادث، ونوع البيانات المرجّح تأثرها، وما اتُّخذ، وما نوصيك به. ولا نَعِد بأن الاختراق مستحيل: لا يوجد نظام آمن بصورة مطلقة، ومن يَعِدك بذلك يبيعك وهماً. تفاصيل ذلك في سياسة الخصوصية.", en: "We notify the supervisory authority within the period the law sets, notify you without delay where the incident touches data in your account, and say what we know at the time — the nature of the incident, the kind of data likely affected, what was done and what we recommend. We do not promise a breach is impossible: no system is perfectly secure, and anyone promising otherwise is selling you a fiction. The detail is in the Privacy Policy." },
        tags: ["اختراق", "تسريب", "breach", "أمان", "حادث"],
      },
      {
        id: "delete-account",
        q: { ar: "كيف أحذف حسابي وبياناتي نهائياً؟", en: "How do I delete my account and data permanently?" },
        a: { ar: "من الإعدادات ← الحساب. الحذف نهائي ولا رجعة فيه، لذلك صدّر بياناتك أولاً — التصدير متاح من نفس الصفحة. بعد الحذف تبقى بعض السجلات التي يوجب القانون حفظها (سجلات الفوترة مثلاً) للمدّة المقرّرة، وما عداها يُحذف.", en: "Settings → Account. Deletion is permanent and cannot be undone, so export first — the export is on the same page. After deletion, records the law requires us to keep, such as billing records, remain for their statutory period; everything else is removed." },
        tags: ["حذف", "الحساب", "delete", "تصدير", "بيانات"],
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
