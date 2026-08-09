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
      ar: `تكلفة العميل ارتفعت لأنّ **الإنفاق انتقل** إلى منصّات تحقّقها أضعف، لا لأنّ سعر العميل ارتفع في مكانه.

- الإنفاق الكليّ ثابت عند **{{69000}}** خلال ثلاثين يوماً.
- التحويلات المُعلَنة **١٬٨٣٠**، والمتحقَّق منها **٧١٧** فقط — فجوة **٦١٪**.
- تكلفة العميل المتحقَّق **{{96}}** مقابل **{{38}}** لو صدّقنا أرقام المنصّات.
- **٥٧٪** من الميزانية تذهب إلى ميتا وتيك توك، وهما مصدر **١٤٪** فقط من التحقّق الحقيقيّ.

| المنصّة | الإنفاق | مُعلَن | متحقَّق | التضخيم | تكلفة العميل |
|---|---|---|---|---|---|
| جوجل | {{20400}} | 360 | 296 | 18% | **{{69}}** |
| ميتا | {{31050}} | 900 | 322 | 64% | {{96}} |
| تيك توك | {{17550}} | 570 | 99 | 83% | {{177}} |

**لماذا:** جوجل تُبلغ عن أقلّ الأرقام وتُسلّم أعلاها تحقّقاً — تضخيمها **١٨٪** مقابل **٨٣٪** لتيك توك. فكلّ ريال ينتقل من جوجل إلى تيك توك يشتري ربع عميل بدل عميل كامل، والمتوسّط يرتفع بلا أن يتغيّر شيء داخل أيّ حملة.

**الخطوة:** انقل **{{3500}}** من «تيك توك — جمهور واسع» إلى «بحث — اسم العلامة»، وراقب أسبوعاً قبل أيّ نقل ثانٍ.`,
      en: `Cost per customer rose because **spend moved** to platforms that verify weakly — not because the price of a customer went up in place.

- Total spend is flat at **{{69000}}** over 30 days.
- Reported conversions **1,830**, verified **717** — a **61%** gap.
- Verified cost per customer **{{96}}**, against **{{38}}** if we believed the platforms.
- **57%** of the budget goes to Meta and TikTok, which together produce only **14%** of the real verification.

| Platform | Spend | Reported | Verified | Inflation | Cost/customer |
|---|---|---|---|---|---|
| Google | {{20400}} | 360 | 296 | 18% | **{{69}}** |
| Meta | {{31050}} | 900 | 322 | 64% | {{96}} |
| TikTok | {{17550}} | 570 | 99 | 83% | {{177}} |

**Why:** Google reports the smallest numbers and delivers the most verified ones — **18%** inflation against TikTok's **83%**. Every riyal that moves from Google to TikTok buys a quarter of a customer instead of a whole one, so the average climbs while nothing inside any campaign changes.

**Next step:** move **{{3500}}** out of "TikTok — Broad audience" into "Search — Brand terms", then watch for a week before a second move.`,
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
      ar: `**{{7350}}** ذهبت إلى «تيك توك — جمهور واسع»، وهي الحملة الوحيدة بصفر تحويل متحقَّق.

- الإنفاق **{{7350}}** خلال ثلاثين يوماً — **١١٪** من الميزانية كلّها.
- **١١٬٤٠٠** نقرة وصلت فعلاً، فالمشكلة ليست في الجذب.
- **١٢٠** تحويلاً مُعلَناً و**صفر** متحقَّق — تضخيم **١٠٠٪**.
- بمتوسّط قيمة الطلب في الحساب، هذا إيرادٌ ضائع قدره **{{28000}}**.

| الحملة | الإنفاق | نقرات | مُعلَن | متحقَّق |
|---|---|---|---|---|
| **تيك توك — جمهور واسع** | **{{7350}}** | 11,400 | 120 | **0** |
| ميتا — وعي بالعلامة | {{18150}} | 20,700 | 570 | 177 |
| تيك توك — فيديو المنتج | {{10200}} | 16,200 | 450 | 99 |

**لماذا:** النقرات تصل والتحويل المُعلَن يُسجَّل، لكن لا محادثة واحدة تصل بكودٍ يربطها بهذه الحملة. أحد أمرين: جمهورٌ لا نيّة شراء فيه، أو نقرٌ غير بشريّ. والنقرات الـ١١٬٤٠٠ بصفر تحقّق ترجّح الثاني.

**الخطوة:** أوقف الحملة اليوم. **{{245}}** يومياً تتحرّر فوراً، والقرار قابل للتراجع في أيّ لحظة.`,
      en: `**{{7350}}** went into "TikTok — Broad audience", the only campaign with zero verified conversions.

- Spend **{{7350}}** over 30 days — **11%** of the entire budget.
- **11,400** clicks actually arrived, so attraction is not the problem.
- **120** reported conversions and **zero** verified — **100%** inflation.
- At the account's average order value that is **{{28000}}** of lost revenue.

| Campaign | Spend | Clicks | Reported | Verified |
|---|---|---|---|---|
| **TikTok — Broad audience** | **{{7350}}** | 11,400 | 120 | **0** |
| Meta — Brand awareness | {{18150}} | 20,700 | 570 | 177 |
| TikTok — Product video | {{10200}} | 16,200 | 450 | 99 |

**Why:** the clicks land and the reported conversion is written, yet not one conversation arrives carrying a code that ties it to this campaign. Either the audience has no buying intent, or the clicks are not human. 11,400 clicks with zero verification points at the second.

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
      ar: `**جوجل** هي الفائزة بفارق واضح، والترتيب يثبت بمقياسين معاً لا بمقياسٍ واحد.

- تكلفة العميل المتحقَّق **{{69}}** — أرخص من ميتا بـ**٢٨٪** ومن تيك توك بـ**٦١٪**.
- العائد على الإنفاق **٨٫٠×** مقابل **٤٫٤×** لميتا و**١٫٩×** لتيك توك.
- **٢٩٦** تحويلاً متحقَّقاً — عيّنة تكفي للحكم، لا صدفة أسبوع.
- تضخيمها **١٨٪** فقط، وهو الأدنى في الحساب كلّه.

| المنصّة | تكلفة العميل | العائد | متحقَّق | التضخيم |
|---|---|---|---|---|
| **جوجل** | **{{69}}** | **8.0×** | 296 | 18% |
| ميتا | {{96}} | 4.4× | 322 | 64% |
| تيك توك | {{177}} | 1.9× | 99 | 83% |

**لماذا:** ميتا تُسجّل تحويلات أكثر من جوجل (**٣٢٢** مقابل **٢٩٦**) بإنفاقٍ أعلى بـ**٥٢٪** — فتبدو الأقوى في لوحة ميتا نفسها وهي ليست كذلك. والفارق كلّه في النيّة: باحثٌ عن منتج يكتبه بنفسه، ومتصفّحٌ يُعرَض عليه.

**الخطوة:** لا توقف ميتا — عائدها **٤٫٤×** فوق نقطة التعادل. ابدأ بتيك توك: **١٫٩×** أقرب إلى الخسارة منه إلى الربح.`,
      en: `**Google** wins by a clear margin, and the ranking holds on two measures rather than one.

- Verified cost per customer **{{69}}** — **28%** cheaper than Meta and **61%** cheaper than TikTok.
- Return on spend **8.0×** against **4.4×** for Meta and **1.9×** for TikTok.
- **296** verified conversions — a sample large enough to judge, not one lucky week.
- Its inflation is **18%**, the lowest in the whole account.

| Platform | Cost/customer | Return | Verified | Inflation |
|---|---|---|---|---|
| **Google** | **{{69}}** | **8.0×** | 296 | 18% |
| Meta | {{96}} | 4.4× | 322 | 64% |
| TikTok | {{177}} | 1.9× | 99 | 83% |

**Why:** Meta records more conversions than Google (**322** against **296**) on **52%** more spend — so it looks strongest inside Meta's own dashboard while it is not. The whole difference is intent: someone searching types the product themselves; someone scrolling is shown it.

**Next step:** do not pause Meta — **4.4×** sits above break-even. Start with TikTok: **1.9×** is closer to a loss than to a profit.`,
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
      ar: `**«بحث — اسم العلامة»** هي الفائزة: أرخص عميلٍ في الحساب وأعلى عائدٍ فيه معاً.

- تكلفة العميل **{{38}}** — أرخص من ثاني أفضل حملة بـ**٥٧٪**.
- العائد **١٥٫٩×**، وأقرب منافسٍ له **٥٫٨×**.
- **١١٧** تحويلاً متحقَّقاً من **١٥٠** مُعلَناً — تضخيم **٢٢٪** فقط.
- إنفاقها **{{4500}}**، أي **٦٫٥٪** من الميزانية مقابل **١٦٪** من التحقّق.

| الحملة | الإنفاق | متحقَّق | تكلفة العميل | العائد |
|---|---|---|---|---|
| **بحث — اسم العلامة** | {{4500}} | 117 | **{{38}}** | **15.9×** |
| بحث — طلب عرض سعر | {{15900}} | 179 | {{89}} | 5.8× |
| ميتا — إعادة استهداف | {{12900}} | 145 | {{89}} | 5.3× |
| ميتا — وعي بالعلامة | {{18150}} | 177 | {{103}} | 3.8× |
| تيك توك — فيديو المنتج | {{10200}} | 99 | {{103}} | 3.2× |
| تيك توك — جمهور واسع | {{7350}} | 0 | — | 0× |

**لماذا:** من يبحث باسم علامتك يعرفها ويقصدها، فالإعلان يلتقط طلباً قائماً لا يصنعه. ولهذا هي الأرخص — **ولهذا بالذات لا تُضاعَف ميزانيتها**: سقفها عدد من يبحثون عن اسمك، لا ما تدفعه. مضاعفة الميزانية هنا تشتري النقرة نفسها بسعرٍ أعلى.

**الخطوة:** الفائز القابل للتوسيع هو **«بحث — طلب عرض سعر»** — عائد **٥٫٨×** وطلبٌ غير محدود بالاسم. ارفع ميزانيته **٢٠٪** لا أكثر، وانتظر أربعة أيّام قبل الزيادة التالية.`,
      en: `**"Search — Brand terms"** is the winner: the cheapest customer in the account and the highest return, both at once.

- Cost per customer **{{38}}** — **57%** cheaper than the runner-up.
- Return **15.9×**, where the closest rival sits at **5.8×**.
- **117** verified out of **150** reported — only **22%** inflation.
- It spends **{{4500}}**, which is **6.5%** of the budget for **16%** of all verification.

| Campaign | Spend | Verified | Cost/customer | Return |
|---|---|---|---|---|
| **Search — Brand terms** | {{4500}} | 117 | **{{38}}** | **15.9×** |
| Search — Request a quote | {{15900}} | 179 | {{89}} | 5.8× |
| Meta — Retargeting | {{12900}} | 145 | {{89}} | 5.3× |
| Meta — Brand awareness | {{18150}} | 177 | {{103}} | 3.8× |
| TikTok — Product video | {{10200}} | 99 | {{103}} | 3.2× |
| TikTok — Broad audience | {{7350}} | 0 | — | 0× |

**Why:** someone searching your brand name already knows you and means it, so the ad captures demand rather than creating it. That is why it is cheapest — **and exactly why its budget should not be doubled**: its ceiling is how many people look for your name, not what you pay. Doubling here buys the same click at a higher price.

**Next step:** the scalable winner is **"Search — Request a quote"** — **5.8×** return and demand not capped by your name. Raise it by **20%**, no more, and wait four days before the next increase.`,
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
      ar: `**«تيك توك — فيديو المنتج»** هي التي انهارت: تكلفة العميل قفزت **+٤٤٪** في أسبوع بإنفاقٍ لم يتغيّر.

- تكلفة العميل **{{84}}** ← **{{121}}** بين الأسبوعين.
- الإنفاق ثابت عند **{{2380}}** أسبوعياً — فالسبب ليس الميزانية.
- التحويل المتحقَّق **٢٨** ← **١٩**، بانخفاض **٣٢٪**.
- إعلان **«فكّ التغليف»** وحده يبتلع **٢٥٪** من إنفاق الحملة بأضعف نتيجة فيها.

| الحملة | الأسبوع السابق | الأسبوع الأخير | التغيّر |
|---|---|---|---|
| **تيك توك — فيديو المنتج** | {{84}} | **{{121}}** | **+44%** |
| ميتا — وعي بالعلامة | {{97}} | {{108}} | +11% |
| بحث — طلب عرض سعر | {{91}} | {{87}} | −4% |
| ميتا — إعادة استهداف | {{93}} | {{86}} | −8% |

**لماذا:** الظهور استمرّ والنقر استمرّ، والذي سقط هو التحويل وحده — وهذه علامة إجهادٍ إبداعيّ لا علامة سوق. الجمهور نفسه رأى الفيديو مرّاتٍ كافية ليتوقّف عن الاستجابة له، ونسبة النقر في **«فكّ التغليف»** تنحدر منذ أحد عشر يوماً متّصلة.

**الخطوة:** أوقف **«فكّ التغليف»** وأعد توزيع حصّته على **«استخدام المنتج — ١٥ث»** داخل الحملة نفسها — تكلفة عميله أقلّ بـ**٣٤٪** واتّجاهه صاعد.`,
      en: `**"TikTok — Product video"** is the one that collapsed: cost per customer jumped **+44%** in a week on spend that did not move.

- Cost per customer **{{84}}** → **{{121}}** between the two weeks.
- Spend flat at **{{2380}}** per week — so the budget is not the cause.
- Verified conversions **28** → **19**, down **32%**.
- The **"Unboxing"** ad alone eats **25%** of the campaign's spend for its weakest result.

| Campaign | Previous week | Last week | Change |
|---|---|---|---|
| **TikTok — Product video** | {{84}} | **{{121}}** | **+44%** |
| Meta — Brand awareness | {{97}} | {{108}} | +11% |
| Search — Request a quote | {{91}} | {{87}} | −4% |
| Meta — Retargeting | {{93}} | {{86}} | −8% |

**Why:** impressions held, clicks held, and only conversion fell — that is a creative fatigue signature, not a market one. The same audience has seen the video enough times to stop responding, and click-through on **"Unboxing"** has been sliding for eleven straight days.

**Next step:** pause **"Unboxing"** and move its share to **"Product in use — 15s"** inside the same campaign — its cost per customer is **34%** lower and its trend is rising.`,
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
      ar: `وسّع **«سلة متروكة — صورة»** الآن، وهو الإعلان الوحيد الذي يستوفي الشروط الأربعة معاً.

- تكلفة العميل **{{56}}** مقابل **{{96}}** متوسّط الحساب — أرخص بـ**٤٢٪**.
- **٨٨** تحويلاً متحقَّقاً، فوق حدّ العشرين اللازم للتوسيع بأربعة أضعاف.
- العائد **٨٫٤×**، واتّجاه ثلاثين يوماً صاعد لا هابط.
- آخر زيادة ميزانية له **قبل أحد عشر يوماً** — خارج فترة الراحة.

| الإعلان | الحملة | الإنفاق | متحقَّق | تكلفة العميل | الاتّجاه |
|---|---|---|---|---|---|
| **سلة متروكة — صورة** | ميتا — إعادة استهداف | {{4902}} | 88 | **{{56}}** | ↑ صاعد |
| الاسم التجاري | بحث — اسم العلامة | {{4500}} | 140 | {{32}} | ↑ صاعد |
| عرض الخصم — نصّ | بحث — طلب عرض سعر | {{6678}} | 109 | {{61}} | ↑ صاعد |
| قصّة العلامة — ريلز | ميتا — وعي بالعلامة | {{8168}} | 79 | {{103}} | ← ثابت |
| فكّ التغليف | تيك توك — فيديو المنتج | {{2550}} | 15 | {{170}} | ↓ هابط |

**لماذا:** **«الاسم التجاري»** أرخص منه على الورق (**{{32}}**) لكنّه لا يُوسَّع: سقفه عدد من يبحثون عن اسمك. و**«عرض الخصم»** مرشّحٌ جيّد لكنّ ميزانيته زيدت قبل يومين، والزيادة الثانية داخل فترة الراحة تُربك التعلّم وتُفسد قراءة النتيجة.

**الخطوة:** ارفع ميزانيته **٢٠٪** — من **{{163}}** إلى **{{196}}** يومياً. لا تتجاوز ذلك: قفزة أكبر تُعيد الإعلان إلى فترة التعلّم من جديد وتُلغي ما بناه.`,
      en: `Scale **"Abandoned cart — image"** now — the only ad that meets all four conditions at once.

- Cost per customer **{{56}}** against the account average of **{{96}}** — **42%** cheaper.
- **88** verified conversions, four times over the twenty needed to scale.
- Return **8.4×**, and a thirty-day trend that is rising, not falling.
- Its last budget increase was **eleven days ago** — outside the cooling period.

| Ad | Campaign | Spend | Verified | Cost/customer | Trend |
|---|---|---|---|---|---|
| **Abandoned cart — image** | Meta — Retargeting | {{4902}} | 88 | **{{56}}** | ↑ rising |
| Brand name | Search — Brand terms | {{4500}} | 140 | {{32}} | ↑ rising |
| Discount offer — text | Search — Request a quote | {{6678}} | 109 | {{61}} | ↑ rising |
| Brand story — Reels | Meta — Brand awareness | {{8168}} | 79 | {{103}} | ← flat |
| Unboxing | TikTok — Product video | {{2550}} | 15 | {{170}} | ↓ falling |

**Why:** **"Brand name"** is cheaper on paper (**{{32}}**) but cannot be scaled — its ceiling is how many people search your name. **"Discount offer"** is a good candidate, but its budget was raised two days ago, and a second increase inside the cooling period disturbs learning and ruins the reading of the result.

**Next step:** raise it by **20%** — from **{{163}}** to **{{196}}** a day. Do not go further: a larger jump pushes the ad back into learning and undoes what it built.`,
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
      ar: `الإيراد يرتفع والربح لا يتبعه لأنّ **المرتجعات وتكلفة البضاعة تنموان أسرع منه** — والهامش الصافي **١٦٫٧٪** فقط.

- إيراد الطلبات **{{326880}}** من **٧٢٠** طلباً خلال ثلاثين يوماً.
- تكلفة البضاعة **{{117677}}** — **٣٦٪** من الإيراد.
- الإنفاق الإعلانيّ **{{69000}}** — **٢١٪** من الإيراد.
- المرتجعات **١١٪** من الطلبات، أي **{{35957}}** إيراداً يعود بتكلفة شحنٍ لا تعود.

| البند | المبلغ | من الإيراد |
|---|---|---|
| إيراد الطلبات | {{326880}} | 100% |
| تكلفة البضاعة | −{{117677}} | 36% |
| الإنفاق الإعلانيّ | −{{69000}} | 21% |
| الشحن والرسوم | −{{30960}} | 9% |
| أثر المرتجعات | −{{54592}} | 17% |
| **صافي الربح** | **{{54651}}** | **16.7%** |

**لماذا:** كلّ طلبٍ إضافيّ يجرّ معه **٣٦٪** بضاعة و**٢١٪** إعلاناً، فينمو الإيراد وينمو معه ما يأكله بالنسبة نفسها. والذي يكسر التوازن هو المرتجعات: **١١٪** من الطلبات تعيد إيرادها وتُبقي تكلفة شحنها ذهاباً وإياباً.

**الخطوة:** ابدأ بـ**«مجموعة العناية الكاملة»** — معدّل ارتجاعها **٢٢٪**، ضعف متوسّط المتجر، وهي وحدها تفسّر ثلث أثر المرتجعات.`,
      en: `Revenue rises and profit does not follow because **returns and cost of goods grow faster than it does** — net margin is only **16.7%**.

- Order revenue **{{326880}}** from **720** orders over thirty days.
- Cost of goods **{{117677}}** — **36%** of revenue.
- Ad spend **{{69000}}** — **21%** of revenue.
- Returns run at **11%** of orders, sending back **{{35957}}** of revenue while the shipping cost stays gone.

| Line | Amount | Of revenue |
|---|---|---|
| Order revenue | {{326880}} | 100% |
| Cost of goods | −{{117677}} | 36% |
| Ad spend | −{{69000}} | 21% |
| Shipping and fees | −{{30960}} | 9% |
| Effect of returns | −{{54592}} | 17% |
| **Net profit** | **{{54651}}** | **16.7%** |

**Why:** every extra order drags **36%** goods and **21%** advertising along with it, so revenue grows and what eats it grows at the same rate. What breaks the balance is returns: **11%** of orders send their revenue back and keep the shipping cost in both directions.

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
      ar: `العميل يكلّفك **{{96}}** فعلياً، لا **{{38}}** كما تُظهر لوحات المنصّات — الفارق **٢٫٥ ضعف**.

- الإنفاق **{{69000}}** ÷ **٧١٧** تحويلاً متحقَّقاً = **{{96}}**.
- الرقم المُعلَن **{{38}}** لأنّه يقسم على **١٬٨٣٠** تحويلاً لم يتأكّد أكثرها.
- بعد استبعاد المرتجعات **١١٪**، التكلفة الحقيقية للعميل الباقي **{{108}}**.
- متوسّط قيمة الطلب **{{454}}** — فالعميل يغطّي تكلفته أربع مرّات، والهامش يبقى موجباً.

| المقياس | المُعلَن | المتحقَّق | الفارق |
|---|---|---|---|
| التحويلات | 1,830 | 717 | −61% |
| تكلفة العميل | {{38}} | **{{96}}** | +153% |
| العائد على الإنفاق | 12.3× | **4.8×** | −61% |

**لماذا:** المنصّة تحسب التحويل عند إشارتها هي — نقرة، أو زيارة صفحة، أو محادثة بدأت. ونحن نحسبه عند وصول رسالة حقيقية تحمل كوداً يربطها بالحملة. الفارق **١٬١١٣** تحويلاً لا وجود له خارج لوحات المنصّات.

**الخطوة:** ابنِ قرار الميزانية على **{{96}}** لا على **{{38}}**. أيّ حملة تتجاوز تكلفة عميلها **{{114}}** — أي نقطة التعادل عند هامشك — تخسر وهي تبدو رابحة.`,
      en: `A customer actually costs you **{{96}}**, not the **{{38}}** the platform dashboards show — a **2.5×** difference.

- Spend **{{69000}}** ÷ **717** verified conversions = **{{96}}**.
- The reported figure is **{{38}}** because it divides by **1,830** conversions, most of which were never confirmed.
- After removing the **11%** that get returned, the true cost of a customer who stays is **{{108}}**.
- Average order value is **{{454}}** — so a customer covers their cost four times over and the margin stays positive.

| Measure | Reported | Verified | Difference |
|---|---|---|---|
| Conversions | 1,830 | 717 | −61% |
| Cost per customer | {{38}} | **{{96}}** | +153% |
| Return on spend | 12.3× | **4.8×** | −61% |

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
      ar: `**«مجموعة العناية الكاملة»** تُباع بخسارة **{{18}}** في كلّ طلب، وهي المنتج الوحيد تحت الصفر.

- سعر البيع **{{399}}** وتكلفتها الكاملة **{{417}}**.
- معدّل ارتجاعها **٢٢٪** — الأعلى في الكتالوج وضعف المتوسّط.
- تكلفة البضاعة وحدها **{{268}}**، أي **٦٧٪** من سعر البيع.
- بيعت **٩٤** مرّة خلال ثلاثين يوماً، فالخسارة المتراكمة **{{1692}}**.

| المنتج | السعر | التكلفة الكاملة | الهامش | الارتجاع |
|---|---|---|---|---|
| **مجموعة العناية الكاملة** | {{399}} | {{417}} | **−{{18}}** | 22% |
| كريم مرطّب ليلي | {{189}} | {{175}} | +{{14}} | 14% |
| واقي شمس ٥٠ | {{169}} | {{136}} | +{{33}} | 9% |
| سيروم فيتامين سي | {{249}} | {{163}} | +{{86}} | 8% |
| غسول لطيف | {{129}} | {{111}} | +{{18}} | 6% |

**لماذا:** المجموعة تجمع أربعة منتجات بسعرٍ مخفَّض، فتكلفة بضاعتها **٦٧٪** من سعرها قبل أيّ شيء آخر. ثمّ يأتي الشحن **{{35}}** وحصّة الإعلان **{{46}}** والارتجاع **٢٢٪**، فتنزل تحت الصفر. وهي تبدو رابحة في تقرير المتجر لأنّه يقارن السعر بتكلفة البضاعة وحدها.

**الخطوة:** ارفع سعرها إلى **{{449}}** — يعيد الهامش إلى **٧٪** موجب. أو أخرجها من الإعلان: بلا حصّة الإعلان **{{46}}** تصير رابحة عند سعرها الحاليّ.`,
      en: `**"Complete care set"** sells at a loss of **{{18}}** per order — the only product below zero.

- Selling price **{{399}}** against a fully loaded cost of **{{417}}**.
- Its return rate is **22%** — the highest in the catalogue and double the average.
- Cost of goods alone is **{{268}}**, which is **67%** of the selling price.
- It sold **94** times in thirty days, so the accumulated loss is **{{1692}}**.

| Product | Price | Loaded cost | Margin | Returns |
|---|---|---|---|---|
| **Complete care set** | {{399}} | {{417}} | **−{{18}}** | 22% |
| Night moisturiser | {{189}} | {{175}} | +{{14}} | 14% |
| SPF 50 sunscreen | {{169}} | {{136}} | +{{33}} | 9% |
| Vitamin C serum | {{249}} | {{163}} | +{{86}} | 8% |
| Gentle cleanser | {{129}} | {{111}} | +{{18}} | 6% |

**Why:** the set bundles four products at a discount, so its cost of goods is **67%** of its price before anything else. Then shipping **{{35}}**, its share of ad spend **{{46}}** and a **22%** return rate push it under zero. It looks profitable in the store's own report because that report compares price to cost of goods alone.

**Next step:** raise it to **{{449}}** — that brings the margin back to a positive **7%**. Or take it out of the ads: without the **{{46}}** ad share it is profitable at today's price.`,
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
