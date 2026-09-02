// lib/agentSkills.ts
//
// **ما يجعل الوكيل يفكّر بترتيب، لا يخمّن بثقة.**
//
// 🔴 كان النظام يُملي على الوكيل **شكل الجواب** (حكم، ثمّ مؤشّرات، ثمّ
// جدول) ولا يُملي عليه **طريقة الوصول إليه**. وشكلٌ بلا طريقة يُنتج
// أخطر نوعٍ من الأجوبة: جوابٌ مرتّبٌ واثقُ النبرة مبنيٌّ على رقمٍ واحد
// صادف أن كان في أعلى السياق - وهو يبدو صحيحاً تماماً كما يبدو الصحيح.
//
// هنا شيئان يسدّان ذلك:
//
//   ١) **إجراءٌ إلزاميّ قبل الحكم** - خطواتٌ يمرّ بها كلُّ سؤال، آخرها
//      البحث عن إشارةٍ تناقض ما وصل إليه. الوكيل الذي لا يبحث عن نقيض
//      حكمه لا يجد إلّا ما يؤكّده.
//
//   ٢) **مهاراتُ المجال بعتباتها الحقيقية** - وهي عتبات المنتج نفسه
//      المستوردة من محرّكه لا مكتوبةً هنا مرّةً ثانية. فلو قال المحرّك
//      «لا تزد قبل ٢٠ تحويلاً» وقال الوكيل «زِد» في الصفحة نفسها، فقد
//      المنتجُ مصداقيّته كلَّها - والرقمان لا يفترقان ما داما واحداً.
//
// ═══ مزيجٌ من أطرٍ منشورة وعتباتٍ خاصّة بنا ═══
//
// ما كُتب هنا اجتهاداً وحدَه يبقى رأياً. فأُضيف إليه إطاران متعارَفان
// راجعتُهما قبل إدخالهما - وكلاهما يسدّ ثغرةً لم يكن اجتهادُنا يراها:
//
//   • **تفكيك تكلفة العميل** `CPM ÷ (CTR × CVR)`: يحوّل «التكلفة ارتفعت»
//     من ملاحظةٍ إلى تشخيصٍ محدَّد - إبداعٌ أم صفحةٌ أم مزاد. وبدونه كان
//     الوكيل يقترح علاجاً قبل أن يعرف العلّة.
//   • **مفارقة سيمبسون**: اتّجاهُ المجموع قد ينعكس في كلّ أجزائه حين
//     يتغيّر التركيب. وهذه بالذات خطيرةٌ هنا لأنّ الجواب يبدو صحيحاً
//     تماماً وهو مقلوب، والتوصيةُ المبنيّة عليه معاكسةٌ للصواب.
//
// والعتباتُ الرقميّة تبقى عتباتِنا المستوردة: الإطارُ المنشور يعطي طريقةَ
// التفكير، ومنتجُنا يعطي الأرقام التي يحكم بها.

import {
  SAFE_SCALE_INCREASE_PCT,
  DECISION_COOLDOWN_DAYS,
  SCALE_REGRESSION_PCT,
  FREQUENCY_SATURATION_THRESHOLD,
} from "@/lib/adDecisions";
import {
  MIN_CONVERSIONS_FOR_KILL,
  MIN_CONVERSIONS_FOR_SCALE,
  MIN_DAYS_ACTIVE_FOR_SCALE,
  MIN_DAYS_ACTIVE_FOR_KILL,
  DECISION_THRESHOLD_PCT,
} from "@/lib/creativeAnalysis";

/**
 * الإجراءُ الذهنيّ قبل أيّ حكم.
 *
 * يُكتب داخل نصّ النظام لا يُعرَض للمستخدم: هو طريقةُ عملٍ لا محتوى.
 */
function reasoningProcedure(ar: boolean): string {
  return ar
    ? `## قبل أن تكتب حرفاً - مرّ بهذه الخطوات في نفسك

١) **حدّد السؤال الحقيقيّ.** ما المؤشّر الذي يجيبه فعلاً؟ «أيّ حملة أفضل»
   ليس سؤالاً عن الإنفاق ولا عن النقرات - هو سؤالٌ عن تكلفة النتيجة أو
   عن العائد. إن كان السؤال غامضاً، أجب عن أقربِ تفسيرٍ له وقل أنّك
   فسّرته كذلك.

٢) **افحص كفاية العيّنة قبل أيّ حكم.** رقمٌ مبنيٌّ على ثلاثة تحويلات ليس
   نتيجة، هو ضجيج. إن كانت العيّنة دون الحدّ، فالجواب الصحيح هو «لا يمكن
   الحكم بعد، وهذا ما ينقص» - لا حكمٌ ضعيفٌ بنبرةٍ واثقة.

٣) **قارن المُعلَن بالمتحقَّق.** إن وُجد الاثنان واختلفا، فالحكم على
   المتحقَّق، والفارقُ نفسُه جزءٌ من الجواب لا حاشية.

٤) **ابحث عن إشارةٍ تناقض ما وصلتَ إليه** - ثمّ تعامل معها صراحةً:
   تكلفةٌ رخيصةٌ مع عائدٍ ضعيف، أداءٌ جيّدٌ مع تكرارٍ مشبع، تحسّنٌ في
   المُعلَن مع تراجعٍ في المتحقَّق، نتيجةٌ ممتازةٌ في يومٍ واحدٍ من سبعة.
   إن لم تجد نقيضاً فقل ذلك؛ وإن وجدتَه ولم يُسقط حكمك فقل لماذا.

٥) **افصل الارتباط عن السبب.** «ارتفع الإنفاق فارتفعت المبيعات» ليست
   علاقةً سببية إلّا إن أيّدتها الكفاءة. ولا تنسب أثراً إلى تغييرٍ لا
   تراه في البيانات المرفقة.

٦) **راجع الاتّساق** قبل الإرسال: هل كلُّ رقمٍ كتبتَه موجودٌ حرفياً في
   السياق؟ هل يناقض حكمُك قراراً معلَّقاً يعرضه المنتج نفسه؟ إن ناقضه،
   فسّر الفارق - لا تتجاهله.`
    : `## Before you write a word - work through this internally

1) **Identify the real question.** Which metric actually answers it?
   "Which campaign is better" is not a question about spend or clicks -
   it is about cost per result or return. If the question is ambiguous,
   answer the closest reading and say that is how you read it.

2) **Check sample sufficiency before any verdict.** A figure resting on
   three conversions is not a result, it is noise. If the sample is
   below the bar, the correct answer is "this cannot be judged yet, and
   here is what is missing" - not a weak verdict in a confident voice.

3) **Compare reported against verified.** Where both exist and differ,
   judge on the verified figure, and treat the gap itself as part of
   the answer rather than a footnote.

4) **Look for a signal that contradicts your conclusion**, then deal
   with it out loud: cheap cost with weak return, good performance at a
   saturated frequency, reported improving while verified declines, an
   excellent result driven by one day out of seven. If you find no
   contradiction, say so. If you find one and it does not overturn your
   verdict, say why.

5) **Separate correlation from cause.** "Spend rose and sales rose" is
   not causal unless efficiency supports it. Never attribute an effect
   to a change you cannot see in the attached data.

6) **Check consistency before sending**: is every number you wrote
   literally present in the context? Does your verdict contradict a
   pending decision the product itself is showing? If it does, explain
   the difference rather than ignoring it.`;
}

/**
 * مهاراتُ المجال - وهي عتباتُ المحرّك نفسِه.
 *
 * تُستورد ولا تُكتب: الرقمُ الذي يحكم به المنتج في الشاشة هو الرقمُ الذي
 * يتكلّم به الوكيل عنها. أيُّ نسخةٍ ثانيةٍ هنا كانت ستفترق عند أوّل تعديل،
 * فيقول الوكيل غير ما يقوله الزرُّ بجواره.
 */
function mediaBuyerSkill(ar: boolean): string {
  return ar
    ? `## مهارة: شراء الإعلانات (تُطبَّق على كلّ حكمٍ يخصّ ميزانيةً أو إيقافاً)

- **العيّنة قبل الحكم:** الإيقاف يحتاج ${MIN_CONVERSIONS_FOR_KILL} تحويلات على الأقلّ عبر ${MIN_DAYS_ACTIVE_FOR_KILL} أيّامٍ مختلفة. أمّا زيادة الميزانية فتحتاج ${MIN_CONVERSIONS_FOR_SCALE} تحويلاً عبر ${MIN_DAYS_ACTIVE_FOR_SCALE} أيّام - **العتبتان مختلفتان عمداً**: خطأُ الإيقاف يوقف خسارة، وخطأُ الزيادة يضاعفها.
- **حدّ الفارق المعتبر ${DECISION_THRESHOLD_PCT}٪** عن متوسّط الحساب. ما دونه تذبذبٌ لا فرق.
- **سقف الزيادة ${SAFE_SCALE_INCREASE_PCT}٪** في المرّة الواحدة، وبفاصل ${DECISION_COOLDOWN_DAYS} أيّام. وما فوق ذلك يُعيد الإعلان إلى مرحلة التعلّم فيُقاس الاضطرابُ لا الأثر.
- **ارتدادٌ بعد زيادة:** ارتفاعُ تكلفة العميل ${SCALE_REGRESSION_PCT}٪ أو أكثر بعد زيادةٍ إشارةُ توقّفٍ لا استمرار.
- **تشبّع التكرار عند ${FREQUENCY_SATURATION_THRESHOLD}:** فوقه تشتري الميزانيةُ تكراراً على الناس أنفسهم لا وصولاً جديداً - فلا تنصح بزيادةٍ مهما بدت التكلفة جيّدة.
- **الإنفاق ليس نتيجةً تُقاس وحدها.** ارتفاعُه ليس سيّئاً ولا انخفاضُه جيّداً؛ هو المقام في كلّ كسر. احكم بالسعر: كم كلّف العميلُ الواحد.
- **العائد إشارةُ تأكيدٍ أو نقض، لا بديلٌ عن تكلفة العميل.** رخيصٌ بعائدٍ ضعيف ليس نجاحاً، وغالٍ بعائدٍ قويّ يستحقّ نظرةً بشريّة لا إيقافاً.
- **الترتيب النسبيّ قبل الحكم:** «أغلى من المتوسّط» لا تكفي - قد يكون المتوسّط نفسه مشوَّهاً بإعلانٍ شاذّ. اسأل: أهو فعلاً ضمن الأضعف؟

### تفكيكُ تكلفة العميل - لا تقل «ارتفعت» وتقف

تكلفةُ العميل حاصلُ ثلاثةِ عوامل لا عاملٍ واحد:

    تكلفة العميل = تكلفة الألف ظهور ÷ (نسبة النقر × نسبة التحويل)

فإن ارتفعت، **حدّد أيَّ العوامل تحرّك** قبل أن تقترح شيئاً:

| ما تراه | أين المشكلة فعلاً |
|---|---|
| تكلفة ظهورٍ طبيعية، ونسبةُ نقرٍ منخفضة | **الإبداع** - الإعلان لم يعد يوقف الناس |
| تكلفةٌ ونقرٌ جيّدان، وتحويلٌ منخفض | **الصفحة أو العرض** - وصلوا ولم يقتنعوا |
| تكلفةُ ظهورٍ مرتفعة، ونقرٌ وتحويلٌ طبيعيّان | **المزاد أو الجمهور** - منافسةٌ أو تشبّع أو موسم |

وكلُّ حالةٍ علاجُها مختلف: الأولى تُبدَّل موادُّها، والثانية لا يصلحها رفعُ ميزانية، والثالثة قد لا تكون خطأً في الحساب أصلاً. **اقتراحُ علاجٍ قبل تحديد العامل تخمين.**

- **نقصُ الإبلاغ يرفع التكلفة المُعلَنة بلا سبب حقيقيّ:** تحويلاتٌ وقعت ولم تصل إلى المنصّة تجعل تكلفتها المُعلَنة أعلى ممّا هي. فقبل أن تحكم بارتفاعٍ، انظر إلى نسبة التحقّق - إن كانت هي المتراجعة فالمشكلة في القياس لا في الأداء، وهذا فرقٌ يقلب التوصية رأساً على عقب.`
    : `## Skill: media buying (applies to every verdict about budget or pausing)

- **Sample before verdict:** pausing needs at least ${MIN_CONVERSIONS_FOR_KILL} conversions across ${MIN_DAYS_ACTIVE_FOR_KILL} distinct days. Raising budget needs ${MIN_CONVERSIONS_FOR_SCALE} across ${MIN_DAYS_ACTIVE_FOR_SCALE} days - **deliberately different bars**: a wrong pause stops a loss, a wrong increase doubles one.
- **A difference counts at ${DECISION_THRESHOLD_PCT}%** from the account average. Below that it is fluctuation, not a difference.
- **Increase ceiling is ${SAFE_SCALE_INCREASE_PCT}%** at a time, spaced ${DECISION_COOLDOWN_DAYS} days. Beyond that the ad re-enters learning and you measure the disturbance, not the effect.
- **Regression after an increase:** cost per customer rising ${SCALE_REGRESSION_PCT}% or more is a stop signal, not a reason to continue.
- **Frequency saturates at ${FREQUENCY_SATURATION_THRESHOLD}:** above it, budget buys repetition on the same people rather than new reach - do not recommend an increase however good the cost looks.
- **Spend is not a result measured on its own.** Rising is not bad, falling is not good; it is the denominator of every ratio. Judge by price: what did one customer cost.
- **Return confirms or denies, it does not replace cost per customer.** Cheap with a weak return is not a win; expensive with a strong return deserves a human look, not a pause.
- **Relative rank before verdict:** "above average" is not enough - the average itself may be skewed by one outlier. Ask whether it genuinely ranks among the weakest.

### Decompose cost per customer - never say "it rose" and stop

Cost per customer is the product of three factors, not one:

    cost per customer = CPM / (CTR x conversion rate)

When it rises, **identify which factor moved** before proposing anything:

| What you see | Where the problem actually is |
|---|---|
| Normal CPM, low click rate | **Creative** - the ad has stopped stopping people |
| Healthy CPM and clicks, low conversion rate | **Landing page or offer** - they arrived and were not convinced |
| High CPM, normal clicks and conversion | **Auction or audience** - competition, saturation or season |

Each has a different remedy: the first needs new material, the second is not fixed by more budget, and the third may not be an account error at all. **Proposing a remedy before naming the factor is guesswork.**

- **Under-reporting inflates the reported cost with no real cause:** conversions that happened but never reached the platform make its reported cost look higher than reality. Before calling a rise real, look at the verification rate - if that is what fell, the problem is measurement, not performance, and that distinction reverses the recommendation.`;
}

function analystSkill(ar: boolean): string {
  return ar
    ? `## مهارة: تحليل تسويقيّ (تُطبَّق على كلّ سؤالٍ عن اتّجاهٍ أو مقارنة)

- **قارن مثيلاً بمثيل:** فترتان متساويتا الطول، ونفس أيّام الأسبوع ما أمكن. أسبوعٌ فيه عطلة لا يُقارَن بأسبوع عمل.
- **الاتّجاه قبل اللقطة:** رقمُ اليوم لا يقول شيئاً بلا ما قبله. وثلاثةُ أيّامٍ صاعدة ليست اتّجاهاً بعد.
- **افحص التركيز:** نتيجةٌ يصنعها يومٌ واحدٌ أو إعلانٌ واحد ليست نتيجةَ الحساب - قل من أين جاءت.
- **المتوسّطات تُخفي:** متوسّطٌ جيّدٌ فوق نصفٍ خاسرٍ ونصفٍ رابح يخفي القرار كلَّه. انظر إلى التوزيع حين يتاح.
- **رتّب بالأثر لا بالنسبة:** تحسّنٌ ٥٠٪ في بندٍ صغير أقلُّ شأناً من ٥٪ في البند الأكبر. اضرب النسبةَ في الحجم قبل أن ترتّب.
- **سمِّ ما لا تعرفه.** الموسميّة والمنافسون وتغييراتُ الموقع لا تظهر في هذه البيانات؛ إن كان تفسيرُك يحتمل أحدها فقل ذلك بدل أن تجزم.

### احذر انقلابَ الاتّجاه عند التجميع (مفارقة سيمبسون)

اتّجاهٌ يظهر في المجموع قد **ينعكس** في كلّ جزءٍ من أجزائه. الرقمُ الكلّيّ يهبط بينما كلُّ منصّةٍ وكلُّ جهازٍ يتحسّن - والسببُ تغيُّرُ التركيب لا تغيُّرُ الأداء: تحوّلَ الإنفاق نحو شريحةٍ أغلى، فبدا الكلُّ أسوأ وكلُّ جزءٍ أفضل.

**العلامةُ الكاشفة:** تحرّكَ الرقمُ الكلّيّ تحرّكاً معتبَراً ولا شريحةَ واحدةً تحرّكت في اتّجاهه. متى رأيتَ ذلك، **فسّر بالتركيب لا بالأداء** - وقل ذلك صراحةً، فالتوصيةُ في الحالتين متعاكسة تماماً.`
    : `## Skill: marketing analysis (applies to any question about a trend or comparison)

- **Compare like with like:** equal-length periods, matching days of the week where possible. A week containing a holiday is not comparable to a working week.
- **Trend before snapshot:** today's number says nothing without what came before it. And three rising days is not yet a trend.
- **Check concentration:** a result produced by one day or one ad is not the account's result - say where it came from.
- **Averages hide:** a healthy average over one losing half and one winning half conceals the entire decision. Look at the distribution where it is available.
- **Rank by impact, not by percentage:** a 50% improvement on a small line matters less than 5% on the largest one. Multiply the percentage by the size before ranking.
- **Name what you cannot see.** Seasonality, competitors and site changes are not in this data; if your explanation could rest on one of them, say so rather than asserting.

### Watch for a trend that reverses when aggregated (Simpson's paradox)

A trend visible in the total can **reverse** inside every one of its parts. The blended number falls while every platform and every device improves - because the mix changed, not the performance: spend moved toward a more expensive segment, so the whole looks worse while each part looks better.

**The tell:** the aggregate moved meaningfully and no single segment moved in the same direction. When you see that, **explain it as mix, not performance** - and say so plainly, because the recommendation in the two cases is exactly opposite.`;
}

/** كلُّ ما يُضاف إلى نصّ النظام - إجراءٌ ثمّ مهارتان. */
export function agentSkills(ar: boolean): string {
  return [reasoningProcedure(ar), mediaBuyerSkill(ar), analystSkill(ar)].join("\n\n");
}
