// lib/demoAgentShowcase.ts
//
// استعراض الوكيل داخل مساحة العرض التجريبية.
//
// **الفكرة:** الوكيل يستعرض قدرته بمثالٍ حيّ لا بوصفٍ لها. يُرسَل أحد
// الأسئلة المقترَحة، فتظهر خطوات بحثٍ وتحليل متتابعة كأنّه يعمل الآن، ثمّ
// تأتي إجابة كاملة بجدولها ومؤشّراتها وسببها.
//
// **وكلّ ما هنا محفوظ - صفر نداء على Claude.** ثلاثة أسباب متّصلة:
//
//   ١) مساحة العرض يدخلها من لم يشترك بعد، فلا رصيد يُخصم منه أصلاً.
//   ٢) `blockAiInDemo` تمنع كلّ نداء ذكاءٍ من الديمو - فالمحفوظ تطبيقٌ
//      لتلك القاعدة لا التفافٌ عليها.
//   ٣) البذرة حتمية بقرار، فالعرض يروي القصّة نفسها في كلّ تسجيل. جوابٌ
//      يولّده نموذج يختلف في كلّ مرّة، وقد يقرأ البيانات قراءةً أضعف.
//
// **الأرقام ليست مخترعة:** كلّها محسوبة من `demoSeed.ts` نفسه - مجاميع
// ثلاثين يوماً لكلّ حملة. أيّ تعديل على البذرة يجب أن يمرّ على هذا الملفّ،
// وإلّا قال الوكيل رقماً لا يجده المشاهد في الصفحة أمامه مباشرة.
//
// **`{{عدد}}` مبلغٌ بالريال** يُحوَّل إلى عملة المساحة عند العرض. أرقام
// النِّسب والأعداد والعائد تبقى كما هي - لا تتغيّر بتغيّر العملة.

import { demoMoney } from "@/lib/demoCurrency";

/**
 * النطاق مُعرَّف هنا لا مستورَداً من `AiAsk`: استيرادُه من مكوّن عميل كان
 * يجعل هذا الملفّ يجرّ المكوّن معه إلى كلّ مَن يستورده - وهو استيرادٌ
 * دائريّ فوق ذلك، لأنّ `AiAsk` يستورد من هنا.
 */
export type ShowcaseScope = "home" | "campaigns" | "store";

export interface ShowcaseEntry {
  /** خطوات العمل الظاهرة قبل الجواب - تتابع بمهلة، فتُقرأ كعملٍ يجري */
  steps: { ar: string[]; en: string[] };
  /** Markdown - يعرضه `MarkdownAnswer` */
  answer: { ar: string; en: string };
}

/**
 * مفتاح كلّ إجابة `<نطاق>_<رقم المثال>` - مطابق لترتيب `aiAsk.ph_*` في
 * القاموس. الربط بالترتيب لا بنصّ السؤال عمداً: نصٌّ مشترك بين ملفّين
 * ينكسر أوّل مرّة تُحرَّر فيها صياغة السؤال في لغةٍ واحدة.
 */
export const DEMO_SHOWCASE: Record<string, ShowcaseEntry> = {
  // ==================== الصفحة الرئيسية ====================

  home_1: {
    steps: {
      ar: [
        "أقرأ إنفاق آخر ثلاثين يوماً عبر المنصّات الثلاث…",
        "أفصل التحويلات المُعلَنة عن المتحقَّقة لكلّ منصّة…",
        "أقارن الأسبوع الأخير بالأسبوع الذي قبله…",
        "أرتّب المنصّات بتكلفة العميل المتحقَّق…",
      ],
      en: [
        "Reading 30 days of spend across the three platforms…",
        "Separating reported from verified conversions per platform…",
        "Comparing the last week against the one before it…",
        "Ranking platforms by verified cost per customer…",
      ],
    },
    answer: {
      ar: `إنفاقك ثابت عند **{{69000}}**، لكنّ تكلفة العميل ارتفعت إلى **{{96}}** لأنّ المال **انتقل** إلى منصّتين تحقّقُهما أضعف. **جوجل** تُسلّم عميلاً بـ**{{69}}**، و**تيك توك** بـ**{{177}}** — ثلاثة أضعافه.

### أداء المنصّات · آخر ٣٠ يوماً
الإنفاق ← التحويل المتحقَّق ← تكلفة العميل

| المنصّة | تكلفة العميل | الإنفاق | مُعلَن | متحقَّق | التضخيم |
|---|---|---|---|---|---|
| **الإجمالي** | **{{96}}** +19.4% | **{{69000}}** +0.8% | 1,830 +12.1% | 717 -5.6% | 61% |
| جوجل | {{69}} -3.1% | {{20400}} -4.2% | 360 +2.4% | 296 +1.8% | 18% |
| ميتا | {{96}} +11.2% | {{31050}} +2.6% | 900 +9.7% | 322 -2.9% | 64% |
| تيك توك | {{177}} +44.0% | {{17550}} +6.1% | 570 +24.8% | 99 -13.4% | 83% |

**الخطوة:** انقل **{{3500}}** من «تيك توك — جمهور واسع» إلى «جوجل — اسم العلامة»، وراقب أسبوعاً كاملاً قبل أيّ نقلٍ ثانٍ.`,
      en: `Your spend is flat at **{{69000}}**, but cost per customer climbed to **{{96}}** because the money **moved** to two platforms that verify weakly. **Google** delivers a customer for **{{69}}**; **TikTok** costs **{{177}}** — three times as much.

### Platform performance · last 30 days
Spend → verified conversions → cost per customer

| Platform | Cost/customer | Spend | Reported | Verified | Inflation |
|---|---|---|---|---|---|
| **Total** | **{{96}}** +19.4% | **{{69000}}** +0.8% | 1,830 +12.1% | 717 -5.6% | 61% |
| Google Ads | {{69}} -3.1% | {{20400}} -4.2% | 360 +2.4% | 296 +1.8% | 18% |
| Meta Ads | {{96}} +11.2% | {{31050}} +2.6% | 900 +9.7% | 322 -2.9% | 64% |
| TikTok Ads | {{177}} +44.0% | {{17550}} +6.1% | 570 +24.8% | 99 -13.4% | 83% |

**Next step:** move **{{3500}}** out of "TikTok — Broad audience" into "Google — Brand terms", then watch a full week before a second move.`,
    },
  },

  home_2: {
    steps: {
      ar: [
        "أجمع الإنفاق لكلّ حملة على حدة…",
        "أستبعد ما له تحويل متحقَّق واحد على الأقلّ…",
        "أفحص النقرات لأميّز ضعف الجذب من ضعف التحويل…",
        "أحسب ما يقابل ذلك من إيرادٍ ضائع…",
      ],
      en: [
        "Aggregating spend per campaign…",
        "Excluding anything with at least one verified conversion…",
        "Checking clicks to separate weak attraction from weak conversion…",
        "Estimating the revenue that goes with it…",
      ],
    },
    answer: {
      ar: `**{{7350}}** ذهبت إلى **«تيك توك — جمهور واسع»** بصفر تحويل متحقَّق — **١١٪** من ميزانيتك كلّها. النقرات وصلت (**١١٬٤٠٠**)، فالمشكلة ليست في الجذب بل فيمَن يصل.

### أين يذهب المال بلا نتيجة · آخر ٣٠ يوماً
الحملات الأضعف تحقّقاً، مرتّبةً بالهدر

| الحملة | متحقَّق | الإنفاق | نقرات | مُعلَن |
|---|---|---|---|---|
| **الإجمالي المهدور** | **0** -100.0% | **{{7350}}** +6.1% | 11,400 +8.2% | 120 +3.4% |
| تيك توك — جمهور واسع | 0 -100.0% | {{7350}} +6.1% | 11,400 +8.2% | 120 +3.4% |
| ميتا — وعي بالعلامة | 177 -2.9% | {{18150}} +2.6% | 20,700 +5.1% | 570 +9.7% |
| تيك توك — فيديو المنتج | 99 -13.4% | {{10200}} +1.4% | 16,200 +7.8% | 450 +21.2% |

**لماذا:** النقرات تصل والتحويل المُعلَن يُسجَّل، لكن لا محادثة واحدة تحمل كوداً يربطها بهذه الحملة. جمهورٌ بلا نيّة شراء، أو نقرٌ غير بشريّ — و**١١٬٤٠٠** نقرة بصفر تحقّق ترجّح الثاني.

**الخطوة:** أوقفها اليوم. **{{245}}** يومياً تتحرّر فوراً، والقرار قابل للتراجع في أيّ لحظة.`,
      en: `**{{7350}}** went into **"TikTok — Broad audience"** with zero verified conversions — **11%** of your entire budget. The clicks arrived (**11,400**), so the problem is not attraction but who arrives.

### Where money goes with no result · last 30 days
Weakest campaigns by verification, ranked by waste

| Campaign | Verified | Spend | Clicks | Reported |
|---|---|---|---|---|
| **Total wasted** | **0** -100.0% | **{{7350}}** +6.1% | 11,400 +8.2% | 120 +3.4% |
| TikTok — Broad audience | 0 -100.0% | {{7350}} +6.1% | 11,400 +8.2% | 120 +3.4% |
| Meta — Brand awareness | 177 -2.9% | {{18150}} +2.6% | 20,700 +5.1% | 570 +9.7% |
| TikTok — Product video | 99 -13.4% | {{10200}} +1.4% | 16,200 +7.8% | 450 +21.2% |

**Why:** the clicks land and the reported conversion is written, yet not one conversation carries a code tying it to this campaign. Either an audience with no buying intent, or clicks that are not human — and **11,400** clicks with zero verification points at the second.

**Next step:** pause it today. **{{245}}** a day is freed immediately, and the decision reverses at any moment.`,
    },
  },

  home_3: {
    steps: {
      ar: [
        "أحسب تكلفة العميل المتحقَّق لكلّ منصّة…",
        "أضيف العائد على الإنفاق من قيم الطلبات الحقيقية…",
        "أفحص هل الترتيب يثبت بمقياسين لا بمقياسٍ واحد…",
        "أراجع حجم العيّنة قبل إعلان فائز…",
      ],
      en: [
        "Computing verified cost per customer for each platform…",
        "Adding return on spend from real order values…",
        "Checking whether the ranking holds on two measures, not one…",
        "Reviewing sample size before naming a winner…",
      ],
    },
    answer: {
      ar: `**جوجل** هي الفائزة، والترتيب يثبت بمقياسين معاً: عميلٌ بـ**{{69}}** وعائدٌ **٨٫٠×**. و**ميتا** تُسجّل تحويلاتٍ أكثر منها (**٣٢٢** مقابل **٢٩٦**) بإنفاقٍ أعلى بـ**٥٢٪** — فتبدو الأقوى في لوحتها وهي ليست كذلك.

### الفائز بعد التحقّق · آخر ٣٠ يوماً
تكلفة العميل والعائد على الإنفاق جنباً إلى جنب

| المنصّة | العائد | تكلفة العميل | متحقَّق | التضخيم |
|---|---|---|---|---|
| **متوسّط الحساب** | **4.8×** -8.2% | **{{96}}** +19.4% | 717 -5.6% | 61% |
| جوجل | 8.0× +4.1% | {{69}} -3.1% | 296 +1.8% | 18% |
| ميتا | 4.4× -6.7% | {{96}} +11.2% | 322 -2.9% | 64% |
| تيك توك | 1.9× -22.5% | {{177}} +44.0% | 99 -13.4% | 83% |

**لماذا:** الفارق كلّه في النيّة — باحثٌ عن منتجٍ يكتبه بنفسه، ومتصفّحٌ يُعرَض عليه.

**الخطوة:** لا توقف ميتا، عائدها **٤٫٤×** فوق نقطة التعادل. ابدأ بتيك توك: **١٫٩×** أقرب إلى الخسارة منه إلى الربح.`,
      en: `**Google** wins, and the ranking holds on two measures at once: a customer for **{{69}}** and an **8.0×** return. **Meta** records more conversions than it does (**322** against **296**) on **52%** more spend — so it looks strongest inside its own dashboard while it is not.

### The winner once verified · last 30 days
Cost per customer and return on spend, side by side

| Platform | Return | Cost/customer | Verified | Inflation |
|---|---|---|---|---|
| **Account average** | **4.8×** -8.2% | **{{96}}** +19.4% | 717 -5.6% | 61% |
| Google Ads | 8.0× +4.1% | {{69}} -3.1% | 296 +1.8% | 18% |
| Meta Ads | 4.4× -6.7% | {{96}} +11.2% | 322 -2.9% | 64% |
| TikTok Ads | 1.9× -22.5% | {{177}} +44.0% | 99 -13.4% | 83% |

**Why:** the whole difference is intent — someone searching types the product themselves; someone scrolling is shown it.

**Next step:** do not pause Meta, its **4.4×** sits above break-even. Start with TikTok: **1.9×** is closer to a loss than to a profit.`,
    },
  },

  // ==================== الحملات ====================

  campaigns_1: {
    steps: {
      ar: [
        "أرتّب الحملات الستّ بتكلفة العميل المتحقَّق…",
        "أستبعد ما عيّنته أصغر من عشرين تحويلاً…",
        "أتحقّق من ثبات الترتيب على العائد كذلك…",
        "أفحص هل للفائز مساحة نموّ أصلاً…",
      ],
      en: [
        "Ranking the six campaigns by verified cost per customer…",
        "Excluding anything with a sample under twenty conversions…",
        "Confirming the ranking holds on return as well…",
        "Checking whether the winner has any headroom…",
      ],
    },
    answer: {
      ar: `**«جوجل — اسم العلامة»** هي الفائزة: عميلٌ بـ**{{38}}** وعائدٌ **١٥٫٩×**، بفارقٍ يقارب ثلاثة أضعاف أقرب منافسٍ لها. تصرف **٦٫٥٪** من الميزانية وتُنتج **١٦٪** من التحقّق كلّه.

### ترتيب الحملات بعد التحقّق · آخر ٣٠ يوماً
الأرقام على التحويل المتحقَّق لا المُعلَن

| الحملة | تكلفة العميل | العائد | الإنفاق | متحقَّق |
|---|---|---|---|---|
| **متوسّط الحساب** | **{{96}}** +19.4% | **4.8×** -8.2% | **{{69000}}** +0.8% | 717 -5.6% |
| جوجل — اسم العلامة | {{38}} -4.8% | 15.9× +6.2% | {{4500}} +1.1% | 117 +5.9% |
| جوجل — طلب عرض سعر | {{89}} -4.0% | 5.8× +3.7% | {{15900}} -2.3% | 179 +2.4% |
| ميتا — إعادة استهداف | {{89}} -8.1% | 5.3× +7.4% | {{12900}} +3.2% | 145 +11.6% |
| ميتا — وعي بالعلامة | {{103}} +11.4% | 3.8× -9.1% | {{18150}} +2.6% | 177 -2.9% |
| تيك توك — فيديو المنتج | {{103}} +44.0% | 3.2× -18.7% | {{10200}} +1.4% | 99 -13.4% |
| تيك توك — جمهور واسع | — | 0× -100.0% | {{7350}} +6.1% | 0 -100.0% |

**لماذا لا تُضاعَف ميزانيتها:** مَن يبحث باسم علامتك يعرفها ويقصدها، فالإعلان يلتقط طلباً قائماً لا يصنعه. سقفُها عدد مَن يبحثون عن اسمك لا ما تدفعه.

**الخطوة:** الفائز القابل للتوسيع هو **«جوجل — طلب عرض سعر»** — عائد **٥٫٨×** وطلبٌ غير محدود بالاسم. ارفع ميزانيته **٢٠٪** لا أكثر، وانتظر أربعة أيّام قبل الزيادة التالية.`,
      en: `**"Google — Brand terms"** is the winner: a customer for **{{38}}** at a **15.9×** return, nearly three times its closest rival. It spends **6.5%** of the budget and produces **16%** of all verification.

### Campaigns ranked after verification · last 30 days
Every figure on verified conversions, not reported ones

| Campaign | Cost/customer | Return | Spend | Verified |
|---|---|---|---|---|
| **Account average** | **{{96}}** +19.4% | **4.8×** -8.2% | **{{69000}}** +0.8% | 717 -5.6% |
| Google — Brand terms | {{38}} -4.8% | 15.9× +6.2% | {{4500}} +1.1% | 117 +5.9% |
| Google — Request a quote | {{89}} -4.0% | 5.8× +3.7% | {{15900}} -2.3% | 179 +2.4% |
| Meta — Retargeting | {{89}} -8.1% | 5.3× +7.4% | {{12900}} +3.2% | 145 +11.6% |
| Meta — Brand awareness | {{103}} +11.4% | 3.8× -9.1% | {{18150}} +2.6% | 177 -2.9% |
| TikTok — Product video | {{103}} +44.0% | 3.2× -18.7% | {{10200}} +1.4% | 99 -13.4% |
| TikTok — Broad audience | — | 0× -100.0% | {{7350}} +6.1% | 0 -100.0% |

**Why its budget should not be doubled:** someone searching your brand name already knows you and means it, so the ad captures demand rather than creating it. Its ceiling is how many people look for your name, not what you pay.

**Next step:** the scalable winner is **"Google — Request a quote"** — **5.8×** return and demand not capped by your name. Raise it **20%**, no more, and wait four days before the next increase.`,
    },
  },

  campaigns_2: {
    steps: {
      ar: [
        "أقارن آخر سبعة أيّام بالسبعة التي قبلها لكلّ حملة…",
        "أفصل تغيّر الإنفاق عن تغيّر التحويل…",
        "أنزل إلى مستوى الإعلان الفرديّ داخل الحملة المتأثّرة…",
        "أفحص نسبة النقر بحثاً عن إجهادٍ إحصائيّ…",
      ],
      en: [
        "Comparing the last seven days to the seven before, per campaign…",
        "Separating the change in spend from the change in conversion…",
        "Going down to individual ads inside the affected campaign…",
        "Checking click-through rate for statistical fatigue…",
      ],
    },
    answer: {
      ar: `**«تيك توك — فيديو المنتج»** انهارت: تكلفة العميل قفزت **+٤٤٪** في أسبوع، والإنفاق لم يتحرّك. الظهور استمرّ والنقر استمرّ، والذي سقط هو التحويل وحده — وهذه علامة **إجهادٍ إبداعيّ** لا علامة سوق.

### تغيّر تكلفة العميل · أسبوعان متتاليان
الأسبوع الأخير مقابل الأسبوع الذي قبله

| الحملة | تكلفة العميل | الأسبوع السابق | الإنفاق | متحقَّق |
|---|---|---|---|---|
| **متوسّط الحساب** | **{{96}}** +19.4% | {{80}} | **{{16100}}** +0.8% | 167 -5.6% |
| تيك توك — فيديو المنتج | {{121}} +44.0% | {{84}} | {{2380}} +0.2% | 19 -32.1% |
| ميتا — وعي بالعلامة | {{108}} +11.3% | {{97}} | {{4235}} +2.6% | 39 -8.1% |
| جوجل — طلب عرض سعر | {{87}} -4.4% | {{91}} | {{3710}} -2.3% | 43 +2.4% |
| ميتا — إعادة استهداف | {{86}} -7.5% | {{93}} | {{3010}} +3.2% | 35 +11.6% |

**لماذا:** الجمهور نفسه رأى الفيديو مرّاتٍ كافية ليتوقّف عن الاستجابة، ونسبة النقر في إعلان **«فكّ التغليف»** تنحدر منذ **أحد عشر يوماً** متّصلة — وهو وحده يبتلع **٢٥٪** من إنفاق الحملة.

**الخطوة:** أوقف **«فكّ التغليف»** وأعد حصّته إلى **«استخدام المنتج — ١٥ث»** داخل الحملة نفسها: تكلفة عميله أقلّ بـ**٣٤٪** واتّجاهه صاعد.`,
      en: `**"TikTok — Product video"** collapsed: cost per customer jumped **+44%** in a week while spend did not move. Impressions held, clicks held, and only conversion fell — that is a **creative fatigue** signature, not a market one.

### Change in cost per customer · two consecutive weeks
Last week against the week before it

| Campaign | Cost/customer | Previous week | Spend | Verified |
|---|---|---|---|---|
| **Account average** | **{{96}}** +19.4% | {{80}} | **{{16100}}** +0.8% | 167 -5.6% |
| TikTok — Product video | {{121}} +44.0% | {{84}} | {{2380}} +0.2% | 19 -32.1% |
| Meta — Brand awareness | {{108}} +11.3% | {{97}} | {{4235}} +2.6% | 39 -8.1% |
| Google — Request a quote | {{87}} -4.4% | {{91}} | {{3710}} -2.3% | 43 +2.4% |
| Meta — Retargeting | {{86}} -7.5% | {{93}} | {{3010}} +3.2% | 35 +11.6% |

**Why:** the same audience has seen the video enough times to stop responding, and click-through on the **"Unboxing"** ad has been sliding for **eleven straight days** — that one ad eats **25%** of the campaign's spend.

**Next step:** pause **"Unboxing"** and move its share to **"Product in use — 15s"** inside the same campaign: its cost per customer is **34%** lower and its trend is rising.`,
    },
  },

  campaigns_3: {
    steps: {
      ar: [
        "أرتّب الإعلانات الخمسة عشر بتكلفة العميل المتحقَّق…",
        "أطبّق شرط العيّنة: عشرون تحويلاً على الأقلّ قبل أيّ توسيع…",
        "أفحص هل زيدت ميزانيته خلال آخر أربعة أيّام…",
        "أستبعد كلّ إعلانٍ اتّجاهه هابط ولو كانت تكلفته جيّدة…",
      ],
      en: [
        "Ranking the fifteen ads by verified cost per customer…",
        "Applying the sample rule: at least twenty conversions before any scale…",
        "Checking whether its budget was already raised in the last four days…",
        "Excluding any ad on a falling trend even if its cost looks good…",
      ],
    },
    answer: {
      ar: `وسّع **«سلة متروكة — صورة»**: عميلٌ بـ**{{56}}** مقابل **{{96}}** متوسّط الحساب، و**٨٨** تحويلاً متحقَّقاً — أربعة أضعاف حدّ العشرين اللازم للتوسيع. آخر زيادةٍ لميزانيته كانت **قبل أحد عشر يوماً**، أي خارج فترة الراحة.

### مرشّحو التوسيع · آخر ٣٠ يوماً
تكلفة العميل، والعيّنة، والاتّجاه — الشروط الثلاثة معاً

| الإعلان | تكلفة العميل | العائد | متحقَّق | الإنفاق |
|---|---|---|---|---|
| **متوسّط الحساب** | **{{96}}** +19.4% | **4.8×** -8.2% | 717 -5.6% | **{{69000}}** +0.8% |
| ميتا — سلة متروكة (صورة) | {{56}} -12.4% | 8.4× +14.2% | 88 +18.6% | {{4902}} +3.2% |
| جوجل — الاسم التجاري | {{32}} -5.1% | 19.0× +6.8% | 140 +5.9% | {{4500}} +1.1% |
| جوجل — عرض الخصم (نصّ) | {{61}} -6.3% | 8.5× +7.9% | 109 +9.4% | {{6678}} -2.3% |
| ميتا — قصّة العلامة (ريلز) | {{103}} +2.1% | 3.8× -1.4% | 79 -0.8% | {{8168}} +2.6% |
| تيك توك — فكّ التغليف | {{170}} +51.2% | 1.9× -24.1% | 15 -38.7% | {{2550}} +1.4% |

**لماذا هو لا غيره:** **«الاسم التجاري»** أرخص على الورق (**{{32}}**) لكنّه لا يُوسَّع — سقفه عدد مَن يبحثون عن اسمك. و**«عرض الخصم»** مرشّحٌ جيّد لكنّ ميزانيته زيدت **قبل يومين**، وزيادةٌ ثانية داخل فترة الراحة تُربك التعلّم وتُفسد قراءة النتيجة.

**الخطوة:** ارفع ميزانيته **٢٠٪** — من **{{163}}** إلى **{{196}}** يومياً. لا تتجاوز ذلك: قفزةٌ أكبر تُعيد الإعلان إلى فترة التعلّم وتُلغي ما بناه.`,
      en: `Scale **"Abandoned cart — image"**: a customer for **{{56}}** against the **{{96}}** account average, on **88** verified conversions — four times the twenty needed to scale. Its last budget increase was **eleven days ago**, outside the cooling period.

### Scale candidates · last 30 days
Cost per customer, sample size and trend — all three conditions together

| Ad | Cost/customer | Return | Verified | Spend |
|---|---|---|---|---|
| **Account average** | **{{96}}** +19.4% | **4.8×** -8.2% | 717 -5.6% | **{{69000}}** +0.8% |
| Meta — Abandoned cart (image) | {{56}} -12.4% | 8.4× +14.2% | 88 +18.6% | {{4902}} +3.2% |
| Google — Brand name | {{32}} -5.1% | 19.0× +6.8% | 140 +5.9% | {{4500}} +1.1% |
| Google — Discount offer (text) | {{61}} -6.3% | 8.5× +7.9% | 109 +9.4% | {{6678}} -2.3% |
| Meta — Brand story (Reels) | {{103}} +2.1% | 3.8× -1.4% | 79 -0.8% | {{8168}} +2.6% |
| TikTok — Unboxing | {{170}} +51.2% | 1.9× -24.1% | 15 -38.7% | {{2550}} +1.4% |

**Why that one and not another:** **"Brand name"** is cheaper on paper (**{{32}}**) but cannot be scaled — its ceiling is how many people search your name. **"Discount offer"** is a good candidate, but its budget was raised **two days ago**, and a second increase inside the cooling period disturbs learning and ruins the reading of the result.

**Next step:** raise it **20%** — from **{{163}}** to **{{196}}** a day. Do not go further: a larger jump pushes the ad back into learning and undoes what it built.`,
    },
  },

  // ==================== المتجر ====================

  store_1: {
    steps: {
      ar: [
        "أجمع إيراد الطلبات الحقيقية آخر ثلاثين يوماً…",
        "أطرح تكلفة البضاعة والشحن ورسوم الدفع…",
        "أطرح الإنفاق الإعلانيّ المتحقَّق…",
        "أفحص المرتجعات وأثرها على الهامش…",
      ],
      en: [
        "Summing real order revenue over the last thirty days…",
        "Subtracting cost of goods, shipping and payment fees…",
        "Subtracting verified ad spend…",
        "Checking returns and their effect on margin…",
      ],
    },
    answer: {
      ar: `إيرادك **{{326880}}** من **٧٢٠** طلباً، وصافي ربحك **{{54651}}** — هامش **١٦٫٧٪** فقط. كلّ طلبٍ إضافيّ يجرّ معه **٣٦٪** بضاعة و**٢١٪** إعلاناً، فينمو الإيراد وينمو ما يأكله بالنسبة نفسها. الذي يكسر التوازن هو **المرتجعات**.

### من الإيراد إلى الربح · آخر ٣٠ يوماً
كلّ بندٍ ونسبته من الإيراد

| البند | المبلغ | من الإيراد |
|---|---|---|
| **صافي الربح** | **{{54651}}** -4.2% | 16.7% |
| إيراد الطلبات | {{326880}} +8.4% | 100% |
| تكلفة البضاعة | {{117677}} +8.4% | 36% |
| الإنفاق الإعلانيّ | {{69000}} +0.8% | 21% |
| الشحن والرسوم | {{30960}} +7.1% | 9% |
| أثر المرتجعات | {{54592}} +14.6% | 17% |

**لماذا:** **١١٪** من الطلبات تعيد إيرادها وتُبقي تكلفة شحنها ذهاباً وإياباً — ونموّها **+١٤٫٦٪** أسرع من نموّ الإيراد نفسه (**+٨٫٤٪**).

**الخطوة:** ابدأ بـ**«مجموعة العناية الكاملة»** — معدّل ارتجاعها **٢٢٪**، ضعف متوسّط المتجر، وهي وحدها تفسّر ثلث أثر المرتجعات.`,
      en: `Revenue is **{{326880}}** from **720** orders, and net profit **{{54651}}** — a margin of only **16.7%**. Every extra order drags **36%** goods and **21%** advertising with it, so revenue grows and what eats it grows at the same rate. What breaks the balance is **returns**.

### From revenue to profit · last 30 days
Every line and its share of revenue

| Line | Amount | Of revenue |
|---|---|---|
| **Net profit** | **{{54651}}** -4.2% | 16.7% |
| Order revenue | {{326880}} +8.4% | 100% |
| Cost of goods | {{117677}} +8.4% | 36% |
| Ad spend | {{69000}} +0.8% | 21% |
| Shipping and fees | {{30960}} +7.1% | 9% |
| Effect of returns | {{54592}} +14.6% | 17% |

**Why:** **11%** of orders send their revenue back and keep the shipping cost in both directions — and that line is growing **+14.6%**, faster than revenue itself (**+8.4%**).

**Next step:** start with **"Complete care set"** — its return rate is **22%**, double the store average, and it alone explains a third of the return impact.`,
    },
  },

  store_2: {
    steps: {
      ar: [
        "أقسم الإنفاق الإعلانيّ المتحقَّق على الطلبات الحقيقية…",
        "أقارنه بما تقوله المنصّات عن تكلفة الطلب…",
        "أضيف تكلفة الطلبات المرتجعة إلى العملاء الباقين…",
        "أوازن الناتج بمتوسّط قيمة الطلب…",
      ],
      en: [
        "Dividing verified ad spend by real orders…",
        "Comparing it to what the platforms claim per order…",
        "Adding the cost of returned orders onto the customers who stayed…",
        "Weighing the result against average order value…",
      ],
    },
    answer: {
      ar: `العميل يكلّفك **{{96}}** فعلياً لا **{{38}}** كما تُظهر لوحات المنصّات — فارقٌ **٢٫٥ ضعف**. وبعد استبعاد المرتجعات **١١٪**، التكلفة الحقيقية للعميل الباقي **{{108}}**. متوسّط الطلب **{{454}}**، فالعميل يغطّي تكلفته أربع مرّات والهامش يبقى موجباً.

### المُعلَن مقابل المتحقَّق · آخر ٣٠ يوماً
الرقم نفسه محسوباً بالطريقتين

| المقياس | المتحقَّق | المُعلَن | الفارق |
|---|---|---|---|
| **تكلفة العميل** | **{{96}}** +19.4% | {{38}} +6.2% | +153% |
| التحويلات | 717 -5.6% | 1,830 +12.1% | -61% |
| العائد على الإنفاق | 4.8× -8.2% | 12.3× +11.4% | -61% |
| تكلفة العميل الباقي | {{108}} +21.7% | — | — |

**لماذا:** المنصّة تحسب التحويل عند إشارتها هي — نقرةٍ، أو زيارة صفحة، أو محادثةٍ بدأت. ونحن نحسبه عند وصول رسالةٍ حقيقية تحمل كوداً يربطها بالحملة. الفارق **١٬١١٣** تحويلاً لا وجود لها خارج لوحات المنصّات.

**الخطوة:** ابنِ قرار الميزانية على **{{96}}** لا **{{38}}**. أيّ حملةٍ تتجاوز تكلفة عميلها **{{114}}** — نقطة التعادل عند هامشك — تخسر وهي تبدو رابحة.`,
      en: `A customer actually costs **{{96}}**, not the **{{38}}** the platform dashboards show — a **2.5×** difference. After removing the **11%** that get returned, the true cost of a customer who stays is **{{108}}**. Average order value is **{{454}}**, so a customer covers their cost four times over and the margin stays positive.

### Reported against verified · last 30 days
The same figure computed both ways

| Measure | Verified | Reported | Difference |
|---|---|---|---|
| **Cost per customer** | **{{96}}** +19.4% | {{38}} +6.2% | +153% |
| Conversions | 717 -5.6% | 1,830 +12.1% | -61% |
| Return on spend | 4.8× -8.2% | 12.3× +11.4% | -61% |
| Cost of a customer who stays | {{108}} +21.7% | — | — |

**Why:** the platform counts a conversion at its own signal — a click, a page view, a chat that opened. We count it when a real message arrives carrying a code that ties it to the campaign. The gap is **1,113** conversions that exist nowhere outside the platform dashboards.

**Next step:** build budget decisions on **{{96}}**, not **{{38}}**. Any campaign whose cost per customer passes **{{114}}** — break-even at your margin — is losing money while it looks profitable.`,
    },
  },

  store_3: {
    steps: {
      ar: [
        "أقرأ تكلفة البضاعة والشحن لكلّ منتج…",
        "أضيف حصّته من الإنفاق الإعلانيّ ورسوم الدفع…",
        "أطرح أثر المرتجعات بمعدّل كلّ منتج على حدة…",
        "أقارن الناتج بسعر البيع الحاليّ…",
      ],
      en: [
        "Reading cost of goods and shipping for each product…",
        "Adding its share of ad spend and payment fees…",
        "Subtracting the return impact at each product's own rate…",
        "Comparing the result to the current selling price…",
      ],
    },
    answer: {
      ar: `**«مجموعة العناية الكاملة»** تُباع بخسارة **{{18}}** في كلّ طلب، وهي المنتج الوحيد تحت الصفر. بيعت **٩٤** مرّة هذا الشهر، فالخسارة المتراكمة **{{1692}}**.

### هامش المنتج بعد كلّ التكاليف · آخر ٣٠ يوماً
السعر مقابل التكلفة الكاملة: بضاعة وشحن وإعلان ورسوم ومرتجعات

| المنتج | الهامش | السعر | التكلفة الكاملة | الارتجاع |
|---|---|---|---|---|
| **متوسّط الكتالوج** | **{{27}}** -18.4% | {{227}} +2.1% | {{200}} +6.8% | 12% |
| مجموعة العناية الكاملة | {{-18}} -41.2% | {{399}} +0.0% | {{417}} +9.4% | 22% |
| كريم مرطّب ليلي | {{14}} -9.7% | {{189}} +0.0% | {{175}} +5.2% | 14% |
| غسول لطيف | {{18}} -3.1% | {{129}} +0.0% | {{111}} +2.4% | 6% |
| واقي شمس ٥٠ | {{33}} +4.6% | {{169}} +0.0% | {{136}} -1.8% | 9% |
| سيروم فيتامين سي | {{86}} +7.2% | {{249}} +0.0% | {{163}} -2.1% | 8% |

**لماذا:** المجموعة تضمّ أربعة منتجات بسعرٍ مخفَّض، فتكلفة بضاعتها **٦٧٪** من سعرها قبل أيّ شيء آخر. ثمّ الشحن **{{35}}**، وحصّة الإعلان **{{46}}**، وارتجاع **٢٢٪** — فتنزل تحت الصفر. وهي تبدو رابحة في تقرير متجرك لأنّه يقارن السعر بتكلفة البضاعة وحدها.

**الخطوة:** ارفع سعرها إلى **{{449}}** فيعود الهامش إلى **٧٪** موجب — أو أخرجها من الإعلان: بلا حصّة الإعلان **{{46}}** تصير رابحة بسعرها الحاليّ.`,
      en: `**"Complete care set"** sells at a loss of **{{18}}** per order — the only product below zero. It sold **94** times this month, so the accumulated loss is **{{1692}}**.

### Product margin after every cost · last 30 days
Price against fully loaded cost: goods, shipping, advertising, fees and returns

| Product | Margin | Price | Loaded cost | Returns |
|---|---|---|---|---|
| **Catalogue average** | **{{27}}** -18.4% | {{227}} +2.1% | {{200}} +6.8% | 12% |
| Complete care set | {{-18}} -41.2% | {{399}} +0.0% | {{417}} +9.4% | 22% |
| Night moisturiser | {{14}} -9.7% | {{189}} +0.0% | {{175}} +5.2% | 14% |
| Gentle cleanser | {{18}} -3.1% | {{129}} +0.0% | {{111}} +2.4% | 6% |
| SPF 50 sunscreen | {{33}} +4.6% | {{169}} +0.0% | {{136}} -1.8% | 9% |
| Vitamin C serum | {{86}} +7.2% | {{249}} +0.0% | {{163}} -2.1% | 8% |

**Why:** the set bundles four products at a discount, so its cost of goods is **67%** of its price before anything else. Then shipping **{{35}}**, its share of ad spend **{{46}}**, and a **22%** return rate push it under zero. It looks profitable in your store's own report because that report compares price to cost of goods alone.

**Next step:** raise it to **{{449}}** and the margin returns to a positive **7%** — or take it out of the ads: without the **{{46}}** ad share it is profitable at today's price.`,
    },
  },
};

/**
 * يستبدل `{{عدد}}` بالمبلغ محوَّلاً إلى عملة المساحة.
 *
 * الاستبدال عند العرض لا عند الكتابة: النصّ مكتوب مرّةً بالريال، ويُقرأ
 * بأيّ عملة تُختار - وإلّا لزم تسع إجاباتٍ مكرّرة لكلّ عملةٍ من العشر.
 */
export function fillShowcaseMoney(markdown: string, currency: string): string {
  return markdown.replace(/\{\{(\d+(?:\.\d+)?)\}\}/g, (_, n: string) =>
    demoMoney(Number(n), currency),
  );
}

/** الإجابة المحفوظة لمثالٍ بعينه، أو `null` لسؤالٍ لم يُكتب له استعراض */
export function showcaseFor(scope: ShowcaseScope, exampleIndex: number): ShowcaseEntry | null {
  return DEMO_SHOWCASE[`${scope}_${exampleIndex + 1}`] ?? null;
}
