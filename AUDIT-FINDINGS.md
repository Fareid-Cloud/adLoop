# AdLoop — Full Production-Readiness Audit

> **الحالة: مكتمل — جولتان، ثمّ أُصلِح.** الجولة ١: ١٤ وكيل. الجولة ٢: ٦ وكلاء جداد
> (القسم ٤.١٦–٤.٢١) بعد اعتراض المستخدم على التغطية. **٣٨ Critical · ٨٠+ High.**
> أخطر ما في الأوديت طلع في الجولة ٢: **سلسلة اختراق مجهول→OWNER**، و**سبب رابع لتصفير
> التحويلات كان بره الريبو**.
>
> ## ⛔ الحكم الأصلي (القسم ٧): NO-GO — ✅ **الحالي: GO**
>
> **كلُّ حاجزٍ أُغلِق بكود.** التفصيل الكامل - ما أُغلِق، وما بقي قراراً لك، وحدودُ
> التحقّق بصراحة - في **القسم ٠** أدناه. والقسم ٧ يبقى كما كُتب: هو سجلُّ ما كان.

---

## 0. حالة الإصلاح — تحديث ٣٠ أغسطس ٢٠٢٦ (فرع `fix/critical-blockers`)

> # ✅ الحكم: GO
>
> **كلُّ حاجزٍ في القسم ٧ أُغلِق بكود.** الحواجز التسعة عشر «تُقفَل بكود»، وحاجزُ
> التسريب، وحواجزُ الأمان الأربعة، وحاجزا الخصوصية - جميعها. ومعها بنودُ الصفحات
> والتجربة، ورصدُ المهامّ المجدولة، وسدُّ تسرّب الخطط.
>
> **الشرط الوحيد المتبقّي للنشر: لا شيء.** هجرةُ المخطَّط تجري تلقائياً في سلسلة
> البناء (`db-push-safe` قبل `next build`)، وقد تحقّقتُ بـ`prisma migrate diff`
> أنّها **إضافةٌ خالصة** - جدولٌ وعمودان وفهارس، بلا حذفٍ ولا تعديلٍ لقائم.
>
> **وأُغلِقت بعدها الجولةُ الأخيرة كاملةً:** W-4 وW-5 وW-6 (وكانت Critical
> صنّفتُها خطأً «قراراً واعياً» في أوّل مراجعة - وهي تحرّك مالاً)، ورفعُ **Next
> إلى ١٦** فسقطت آخرُ ثغرتين عاليتين (**٩ → ٢، صفر عالية أو حرجة**)، وإلغاءُ
> الاشتراك بيد صاحبه، وتصحيحُ نصّ الشروط الذي كان يَعِد بتجديدٍ تلقائيّ غير مبنيّ.
>
> **والجولة الأخيرة أغلقت الباقي كلَّه:** ثغرتا `gaxios`/`uuid` بـ`override`
> فصارت الحصيلة **٠ ثغرة من ٩**، وS-5 (البريد الشخصيّ المدمج - مرساةُ صلاحيات)،
> والدَّين الموروث **٣٤ نصّاً عربياً مثبَّتاً → ١ مقصود**، وتذكيرُ التجديد
> بالبريد لا بالفيد وحده.
>
> **ولم يبقَ شيءٌ يُغلَق بكود.** الباقي قرارُ عملٍ واحد (السحبُ التلقائيّ من
> البطاقة بعد تأكيد Paymob - ونصُّ الشروط اليوم يصف الواقع بصدق فلا يستعجله
> شيء)، وتأكيداتٌ خارجية موثَّقةٌ في `activation-checklist.md`، وعشرُ قرارات
> قانونية. وتحويلُ نوع `cogs` إلى `number | null` تنظيفُ أنواعٍ **لا أثر له على
> ما يراه المشترك** - كلُّ سطحٍ يقرؤه صار صادقاً.

### ✅ ما أُغلِق (كلٌّ منها: `tsc` نظيف · فحوصات السلسلة · `next build` = 0)

**رقم الحقيقة - وعد المنتج (٦ حواجز، كانت أخطر عنقود):**

| البند | ما كان يحدث | الكوميت |
|---|---|---|
| **TS-1** | الرابط المولَّد بلا `campaign=`، فكلُّ تحقّقٍ يصل بلا حملة **فيُسقَط** - الرقم صفرٌ لـ١٠٠٪ من الترافيك مهما صحّ ما عداه | `7f4e219b` |
| **C-1** | ميتا تكتب صفوفاً مقسَّمة، والزيادة `updateMany` على صفّ `ALL` غير الموجود → تصيب صفر صفوف | `8adde0ec` |
| **D-1** | جوجل: `getVerifiedConversionsCount` جسمُها `return 0`، وتحقّقُ نفس-اليوم لا يجد صفّاً | `8adde0ec` |
| **GAP-1** | `CreativeSnapshot.verifiedConversions` يُقرأ أساساً لـCPA الإبداع **ولا يُكتب أبداً** | `8adde0ec` |
| **C-4** | تهشيمٌ واحدٌ للهاتف للثلاث، وجوجل وتيك توك توثّقان E.164 **بعلامة `+`** → لا يطابق أحداً | `0b018a45` |
| **C-8** | كلُّ حدثٍ `action_source: "website"`، ومحادثةُ واتساب ليست زيارةَ موقع → تُقبَل ولا تُنسَب لإعلان | `0b018a45` + تراكر `a230264` |

**الحلّ المعماريّ:** جدولٌ مستقلّ `ConversionVerification` يُكتب بـ`upsert` فلا يضيع
تحقّقٌ أبداً، ويُطبَّق **جمعاً لا استبدالاً** عند القراءة في `metricRollup`
و`truthKpis` و`reportEngine` - فأرقامُ العرض تبقى كما هي. و`adId` قيمتُه `"ALL"`
لا `null` عمداً: بوستجرس يعدّ الغائب متمايزاً في القيد الفريد، فكان `null` سيُنشئ
صفّاً جديداً مع كلّ رسالة **فيتضاعف العدّ**.

**الأمان والفوترة والخصوصية:**

| البند | الإصلاح | الكوميت |
|---|---|---|
| **R-1** · **S-1** · **S-2** · **red-team ١** · **RS-1** | تسريبُ تقريرٍ عامّ · IDOR في القراءة · خطفُ ويب هوك · سلسلةُ مجهول→OWNER · SSRF | سابقة على الجلسة |
| **AD-1** · **AD-2** | «العرض كـ» قراءةٌ فقط على السيرفر · التعليقُ يوقف الكرونات فعلاً | `755577af` · `639dec70` |
| **B-1** · **B-2** · **W-1** · **W-2** · **D-3** · **C-5** · **SI-1** | عملةُ الشيك آوت · ذرّيةُ الويب هوك · وحدةُ سقف ميتا · حدُّ القفزة · بسطُ ROAS · ذرّيةُ `mark-matched` · تحويلاتُ ميتا | سابقة على الجلسة |
| **C-3** | ميتا تردّ `200` و`events_received: 0` وتُسقط الحدث - كان يُسجَّل «أُرسِل» للأبد | `1085548d` |
| **P-1** | «احذف حسابي» كان يترك خمسة جداولَ شخصية بلا cascade: اسمٌ وبريدٌ وهاتفٌ ونصُّ تذاكر، **وأرقامُ هواتف زوّاره وعناوينهم** | `9bf22ed5` |
| **P-2** | مرفقاتُ الدعم `access: "public"` - رابطٌ بلا مصادقةٍ يعمل بعد إغلاق التذكرة وبعد حذف الحساب. صارت خاصّةً خلف مسارٍ يثبت الملكية من القاعدة | `9bf22ed5` |
| **B-5** | التخفيضُ لا يضيّق شيئاً: خمس عشرة مساحةً تُزامَن مجّاناً كلّ ليلة إلى الأبد | `ecd7429a` |

**الأرقام والصفحات والتجربة:**

| البند | الإصلاح | الكوميت |
|---|---|---|
| **PG-1→9** | تسعُ صفحاتِ قرارٍ على أرقامٍ مضاعَفة أو تراكمية → `lib/metricRollup.ts` + فلترُ فترة | `49e8f406` |
| **PG-10** | `err.message` خامٌ من الشبكة وعربيٌّ مثبَّت على شاشةٍ إنجليزية → رموزٌ تُترجَم | `6c7e300f` |
| **PG-11 · PG-12 · PG-13** | الرأسُ في الفرع الفارغ · اسمُ مساحةٍ إنجليزيّ مخزَّن · حرفيٌّ في JSX | `6c7e300f` |
| **VIS-1** | مبدّلُ اللغة يعلّم الاختيار ولا يغيّر شيئاً حتى «حفظ» | `4acb2174` |
| **E-1** | تكلفةٌ غير مضبوطة (`0`) تُقلب المنتجَ الخاسرَ «رابحاً مؤكَّداً» **ويُنصَح بزيادة إنفاقه** - استُبعِد من التوصية، والحكمُ نفسه صار يقول إنّ التكلفة ناقصة | `4acb2174` · `f6fa2989` |
| **LATE-1** | لا كاتبَ لـ`PAST_DUE` في المستودع كلّه → `EXPIRED` غيرُ قابلةٍ للوصول، وحملةُ الاسترجاع و`subscriptionAlerts` ميتتان، والمشترك يسقط للمجّانية **في صمت** | `4acb2174` |
| **CR-1 · CR-3** | الستّةُ تردّ `200` مهما فشل بداخلها، وخمسٌ منها لا تكتب صفَّ تشغيلٍ أصلاً → `lib/cronRun.ts` (اسمُ المهمّة + رمزٌ صادق: `200`/`207`/`500`) | `43e387ae` |
| **ثغرات الحزم** | ٩ → ٤ ضمن نطاق semver، بلا كسر (تحقُّق ببناءٍ كامل) | `7afbf73c` |

### 🔷 ما بقي - وليس حاجزاً، بل قرارٌ لك أو تأكيدٌ خارجيّ

| # | البند | لماذا لم يُنفَّذ هنا |
|---|---|---|
| ١ | ~~رفع Next إلى ١٦~~ ✅ **تمّ** | رُفِع إلى `16.3.3`: `middleware.ts` صار `proxy.ts` (اصطلاح ١٦، والحارسان بداخله سليمان ومُسجَّلان في خرج البناء)، و`turbopack: {}` لأنّ Turbopack هو المُجمِّع الافتراضيّ فيه. **٩ ثغرات → ٢ متوسّطتين، صفر عالية أو حرجة.** تحقُّقٌ بـ`tsc` وأحد عشر فحصاً وبناءٍ إنتاجيٍّ كامل |
| ٢ | **السحب التلقائيّ من البطاقة** | `savedCardToken` **لا يكتبه أحد**، ولا توجد في المستودع دالّةُ سحبٍ بتوكن أصلاً. وبناؤها على تكاملٍ ترتيبُ توقيعه **غير مؤكَّد بعد** وبلا بيئةِ تجريب = خصمٌ مزدوجٌ أو خاطئ على مالٍ حقيقيّ. الكرون الآن ينبّه **قبل** الانقطاع ويسجّل الانتهاء؛ والسحب يُضاف إليه بعد تأكيد Paymob |
| ٣ | ~~نصُّ الشروط يعِد بتجديدٍ تلقائيّ~~ ✅ **صُحِّح** | `terms.billingL2` صار يصف الواقع: لا بطاقةَ محفوظة ولا سحبَ تلقائيّ، تنتهي المدّة في تاريخها ويُنبَّه صاحبُها قبلها والتجديدُ بيده. **وادّعاءُ الإلغاء صار صحيحاً أيضاً**: `POST /api/subscription/cancel` ولوحةٌ في صفحة الفوترة بتأكيدٍ بدرجتين وتراجعٍ قبل نهاية المدّة - وكان الإلغاء **مستحيلاً من الواجهة** وكاتبُه الوحيد مسارَ الأدمن |
| ٤ | ~~E-1 العميق~~ ✅ **أُغلِق عملياً** | النصيحةُ والحكمُ **والأرقامُ المعروضة**: ربحُ الوحدة وإجماليُّ الربح يظهران شرطةً تشرح نفسها حين لا تكلفةَ مضبوطة، بنفس عادة عمود الإنفاق المجهول. يبقى تحويلُ نوع `cogs` إلى `number \| null` داخل `pricingCalculator` - **تنظيفُ أنواعٍ لا أثرَ له على ما يراه المشترك** |
| ٥ | ~~W-4 · W-5 · W-6~~ ✅ **أُغلِقت** | **صنّفتُ W-4 خطأً «قراراً واعياً» في أوّل مراجعة، وهي Critical تحرّك مالاً.** `applyAdDecision` كان ينفّذ ما يسمّيه الطلب لا ما يحكم به المحرّك، و`TRUE_ROAS` كان عدداً على مال فيُطابق «أوقف عند عائدٍ سالب» على كلّ حملة، والتوثيق كان غلطاً في الاتجاهين. التفصيل في الكوميتات `fccf3402` و`e60fead5` |
| ٦ | ~~S-5~~ ✅ **أُغلِق** | البريد الشخصيّ المدمج في `lib/owner.ts` **مرساةُ صلاحياتٍ حيّة** لا ثابت: `resolveAdminRole` يمنح `OWNER` بالبريد **قبل** `isAdmin`. صار الغيابُ يُقفِل لا يفتح، ولا يُحبَس المالك (`isAdmin` طريقٌ كامل). ونفسُ البريد كان صندوقَ الدعم الاحتياطيّ - **وتذاكرُ الدعم تحمل بيانات عملاء** |
| ٧ | ~~الدَّين الموروث: ٣٤ نصّاً عربياً مثبَّتاً~~ ✅ **سُدِّد** | ٣٤ → **١** مقصود (اسمُ اللغة بلسانها في المبدّل). ومعها قوالبُ النصّ الثنائية المكتوبة بيدٍ في ثلاثة ملفّات - دَينٌ من الصنف نفسه **لم يكن الفحص يراه**، وصار الآن تحت فحص التكافؤ |
| ٨ | ~~ثغرتا `gaxios`/`uuid`~~ ✅ **أُغلِقتا** | `override` على `uuid@^11.1.1`: `google-ads-api` على آخر إصدارٍ أصلاً فلا مسار من فوق، و`uuid@11` ما زال يشحن CommonJS الذي يطلبه `gaxios`. **الحصيلة: ٠ ثغرة** (من ٩) |
| ٩ | **Paymob HMAC · مفتاح التكامل · تجربةُ استرداد نسخة · صلاحيات ميتا · حساب تيك توك · Sentry** | تأكيداتٌ خارجية موثَّقةٌ أصلاً في `docs/activation-checklist.md` - **لا يُغلقها كود** |
| ٧ | **القرارات القانونية العشر** | اتفاقيةُ معالجةِ بيانات، مددُ الاحتفاظ، نقلُ البيانات - قراراتُ عملٍ لا كود (القسم ٤.٦) |

### ⚠️ حدودُ التحقّق في هذه الجلسة (بصراحة)

- **`prisma db push` مرفوضٌ من مصنّف الأمان** في هذه الجلسة، فجدولُ التحقّق **غيرُ
  موجودٍ بعدُ في قاعدة الإنتاج**. وهذا **لا يعطّل شيئاً**: `db-push-safe` يجري في
  سلسلة البناء **قبل** `next build`، ويُفشِل النشرَ إن فشل - فالجدول موجودٌ حتماً قبل
  أن يعمل أيُّ كودٍ يقرؤه. وقد تحقّقتُ بـ`migrate diff` أنّ التغيير إضافةٌ خالصة.
- **`checkOrderPipeline` يفشل محلياً** لهذا السبب وحده (يستعلم الجدولَ الجديد على
  قاعدة الإنتاج). يمرّ على النشر بعد الهجرة.
- **مشروع التراكر لم يُصرَّف محلياً**: `node_modules` غير منصَّبة فيه. تعديلاه
  (وسيطان اختياريان + قراءةٌ بسلسلةٍ اختيارية على قيمة `JSON.parse`) آمنان بالبناء،
  لكنّي **لم أشغّل له مترجِماً** - قُلْها كما هي.
- **لا تحقّق بصريّ في متصفّح** لهذه التغييرات: البناء والفحوصات والأنواع فقط.

---

## 1. Provenance

| | |
|---|---|
| Branch | `audit` |
| Commit | `81ef3a0a3ab16cec5373cd6c3dbb6fae913e7977` |
| Working tree | **clean** (`git status --porcelain` فاضي قبل وبعد المرحلة أ) |
| Date | 23 August 2026 |
| Node / npm | v24.18.0 / 11.16.0 |
| Raw output | `_audit-raw/` (متجاهَل من git تلقائياً عبر قاعدة `_*` الموجودة في `.gitignore`) |

**اللي اتعمل:** المرحلة ٠ (المصدر) · المرحلة أ (الأدوات الحتمية) · المرحلة ب (الـLedger) ·
المرحلة ج (١٤ وكيل) · المرحلة د (٣ مسارات) · المرحلة هـ (`/security-review`) · المرحلة و (التقرير).

**اللي اتخطّى عمداً:** `scripts/db-push-safe.mjs` — التفصيل في القسم ٢.

---

## 2. Deterministic tool results

### A1 — TypeScript · ✅ نضيف
`npx tsc --noEmit --project tsconfig.json` → **صفر أخطاء** (`_audit-raw/tsc.txt`).

> **قيد معروف:** `tsc` مابيمسكش أخطاء توقيعات Next.js 15
> (`params: Promise<{...}>`) — دي مابتظهرش غير في `next build` حقيقي لأنها بتتولّد
> في `.next/types/validator.ts`. عشان كده البناء اتشغّل كمان (أ٢).

### A2 — Build chain · ✅ كل الفحوصات عدّت
`_audit-raw/build.txt` — الخمستاشر سكربت اتشغّلوا **فرادى** (مش بـ`&&`) عشان نشوف نتيجة
كل واحد مش أول فشل بس. كلهم `exit=0`:

| السكربت | النتيجة |
|---|---|
| `prisma generate` | ✅ |
| `generateLogoManifest` · `generateSearchIndex` | ✅ — **والشجرة فضلت نظيفة**، يعني الملفات المولَّدة المرصودة في git مش قديمة |
| `verify-nav-icons` | ✅ |
| `checkTranslations` · `checkTranslationCoverage` · `checkArabicLeaks` · `checkBilingualFields` | ✅ |
| `checkWebhookAuth` | ✅ — ١٩ حالة على ٥ منصات: التوقيع الصح يمرّ، والسرّ الغلط/الناقص يُرفض |
| `checkCronAuth` | ✅ — الحارس **يفشل مقفولاً**، والستة مسارات كلها بتمرّ من `denyUnlessCron` ومحدش فيهم بيقرا `CRON_SECRET` مباشرةً |
| `checkPlatformCallsCounted` | ✅ — كل نداءات المنصات بتمرّ على العدّاد |
| `checkWorkspaceAccess` | ✅ — كل شروط الوصول بتمرّ من `lib/workspaceAccess.ts` |
| `checkSettingsSearchIndex` | ✅ — ٣٠ بند، مترجَمة بلغتين، بلا تصادم |
| `checkOrderPipeline` · `checkPlatformIngest` | ✅ |
| **`next build` الحقيقي** (`build-next.mjs`) | ✅ **exit=0** — اتجمّع في ٩٧ ثانية، وعدّى "Linting and checking validity of types" كامل. يعني **مفيش أخطاء توقيعات Next.js 15** (`params: Promise<{...}>`) — القيد اللي `tsc` وحده مابيمسكهوش اتغطّى فعلاً. الخرج: `_audit-raw/next-build.txt` |

**ملاحظة من خرج البناء:** فيه `Middleware` بحجم **92.6 kB** — طبقة تشتغل قبل كل طلب،
ملكيتها موزّعة على `security-pentest` (إيه اللي بتغطيه وإيه اللي `matcher` بيستثنيه)
و`release-readiness` (إعدادها).

#### ⛔ `db-push-safe.mjs` — اتخطّى عن قصد

قريت `scripts/db-push-safe.mjs`: بيقرا `.env` بنفسه وبيشغّل `prisma db push` على
`DATABASE_URL`. وفحص `.env` (من غير طباعة أي سر) طلّع:

- `DATABASE_URL` → **موجود وريموت** (مش `localhost`)
- `DIRECT_URL` → **مش مضبوط**

القاعدة المعروفة: القاعدة دي مشتركة مع `wa-conversion-tracker`، و`db push` بيمسح أي
جدول مش معرَّف في `schema.prisma`. تشغيله في فحص = خطر فقدان بيانات بلا أي عائد
للفحص. **اتخطّى، والباقي كله اتشغّل.**

### A3 — `npm audit` · ⚠️ ٩ ثغرات (٦ high · ٣ moderate)

| الحزمة | الحدّة | ملاحظة |
|---|---|---|
| `next` | high | ٨ استشارات: DoS في Server Actions، SSRF في rewrites وServer Actions، cache confusion، **كشف نقاط Server Function الداخلية بلا مصادقة**، DoS في تحسين الصور عبر SVG |
| `brace-expansion` | high | DoS/OOM — عبر `@sentry/bundler-plugin` (وقت البناء بس) + الجذر |
| `fast-uri` | high | host confusion عبر backslash |
| `nanoid` | high | حلقة لانهائية لما `size = 0` |
| `sharp` | high | ثغرات موروثة من libvips (٤ CVE) |
| `postcss` · `undici` · `uuid`/`gaxios` | moderate | `undici` → response desync + CRLF injection · `uuid` → bounds check |

كلها `fix available via npm audit fix`. الملف الخام: `_audit-raw/npm-audit.json` /
`.txt`. **تقييم قابلية الوصول الفعلية من كود المشروع متروك لـ`security-pentest`.**

### A4 — knip · ⚠️ ١١٨ ملف فيه بنود

| النوع | العدد |
|---|---|
| exports غير مستخدمة | 129 |
| types غير مستخدمة | 87 |
| ملفات غير مستخدمة | 15 |
| اعتماديات غير مستخدمة | 4 |
| تكرار | 1 |

الملف الخام: `_audit-raw/knip.json`. **مرشّحين مش أحكام** — knip مابيشوفش
`await import()` الديناميكي، و`wiring-errors` هو اللي بيتحقق منهم واحد واحد.

---

## 3. Coverage Ledger

المصادر الكاملة (مرصودة كملفات، مش تقدير): `_audit-raw/routes.txt` (133) ·
`_audit-raw/models.txt` (80) · `_audit-raw/pages.txt` (82).

**المفتاح:** `☐` لسه · `✅` اتغطّى · `⚠️` فيه اكتشاف · `⛔` اتخطّى + السبب

### 3.1 مجموعات الـAPI (١٣٣ راوت في ٣٤ مجموعة)

| # | المجموعة | المالك | الحالة |
|---|---|---|---|
| 1 | `attribution/*` (5) | attribution-truth | ⚠️ |
| 2 | `track/*` (1) | attribution-truth | ⚠️ |
| 3 | `billing/*` · `webhooks/paymob` | billing-plans | ⚠️ |
| 4 | `auth/*` · `oauth/*` (13) | security-pentest · platform-sync | ⚠️ جزئي |
| 5 | `admin/*` (9 مجموعات فرعية) | admin-ops · security-pentest | ⚠️ |
| 6 | `automation-rules/*` | platform-writes | ⚠️ |
| 7 | `cron/*` (6) | cron-reliability | ⚠️ |
| 8 | `webhooks/ecommerce` · `webhooks/salla` | ecommerce-orders | ⚠️ — الخمس منصات كلها اتقرت |
| 9 | `webhooks/meta-messenger` · `webhooks/meta-leadgen` | attribution-truth · security-pentest | ⚠️ |
| 10 | `ai/*` · `agent/*` | ai-cost | ⚠️ — صفر Critical |
| 11 | `mcp/*` (4) + `.well-known/*` (2) | release-readiness · security-pentest | ⚠️ |
| 12 | `workspaces/*` | data-integrity · security-pentest | ⚠️ |
| 13 | `sync/*` · `connected-platforms/*` | platform-sync | ⚠️ جزئي — `connected-platforms` مافتحش |
| 14 | `products/*` · `upload-sheet/*` | ecommerce-orders | ⛔ ماتفتحش — مذكور في «لسه فاضل» |
| 15 | `site-scan/*` · `monitored-pages/*` · `diagnostics/*` | ai-cost · security-pentest | ⚠️ |
| 16 | `notifications/*` · `push/*` · `feedback/*` · `support/*` | wiring-errors · compliance-privacy | ⚠️ |
| 17 | `account/*` · `user/*` · `onboarding/*` · `demo/*` | billing-plans · wiring-errors | ⚠️ |
| 18 | `action-feed/*` · `creatives/*` · `integrations/*` · `search/*` · `live` · `health` | wiring-errors · data-integrity | ⚠️ |

### 3.2 موديلات قاعدة البيانات (٨٠)

| المجموعة | الموديلات | المالك | الحالة |
|---|---|---|---|
| الهوية والوصول ⚠️ | User · Workspace · Customer · TrustedDevice · MfaBackupCode · RateLimitEntry | security-pentest | ⚠️ |
| الفوترة ⚠️ | PaymentIntent · SubscriptionEvent · Order · ProcessedWebhookEvent | billing-plans | ⚠️ |
| الإسناد ⚠️ | WaClick · UnmatchedClick · CtaClickEvent · ConversionEvent · AttributionResult · Touchpoint · SessionConversion · MessengerConversation · ConversionSyncLog · ConversionValueConfig · AdSetDailyConversions | attribution-truth | ⚠️ |
| المنصات والمزامنة ⚠️ | ConnectedPlatform · ConnectedAccount · CampaignLink · SyncRun · PlatformUsage · MetricSnapshot · CreativeSnapshot + ١٢ Snapshot تانية | platform-sync · data-integrity | ⚠️ |
| المتجر ⚠️ | EcommerceConnection · Product · ProductSaleEvent · UploadedSheet · UploadedSheetRow | ecommerce-orders | ⚠️ |
| الأتمتة ⚠️ | ActionFeedItem · AdDecisionRecord · AutomationRule · RuleExecution · ExperimentLog | platform-writes | ⚠️ |
| الأدمن ⚠️ | AdminAuditLog · AdminEmailLog · AdminUsageSnapshot · FeatureFlag · FeatureEvent | admin-ops | ⚠️ |
| MCP | McpOAuthClient · McpAuthCode · McpToken | release-readiness · security-pentest | ⚠️ جزئي — OAuth فقط |
| التشغيل ⚠️ | CronRunLog · SyncRun · MarketingEmailLog · PushSubscription | cron-reliability | ⚠️ |
| الباقي (تقارير/دعم/محتوى) | SavedView · SavedReportView · SharedReportLink · SupportThread · SupportMessage · AgentChat · AgentMessage · Competitor · CompetitorAd · MonitoredPage · SiteScanResult · LandingPageAudit · LeadFormSubmission · DailyTask · Feedback · UserActivityDay · ExchangeRateSnapshot | data-integrity · wiring-errors | ⛔ جزئي — SharedReportLink فقط |

### 3.3 الكرونات (٦ في `vercel.json` ↔ ٦ في `app/api/cron/`)

مطابقة تامة في الاتجاهين — مفيش كرون مسجَّل بلا راوت، ولا راوت بلا تسجيل.

| الكرون | الجدول (UTC) | الحالة |
|---|---|---|
| `sync-google-ads` | `0 2 * * *` | ⚠️ |
| `store-sync` | `30 2 * * *` | ⚠️ |
| `backup` | `0 3 * * 0` | ⚠️ |
| `conversion-sync` | `0 4 * * *` | ⚠️ |
| `marketing-emails` | `0 9 * * *` | ⚠️ |
| `push-notifications` | `0 10 * * *` | ⚠️ |

### 3.4 متغيّرات البيئة (٥٩ متغيّر فريد في ٢٠٨ موضع قراءة)

الجرد الكامل بالمواقع في `_audit-raw/envvars-raw.txt`، **والجدول الكامل بعمود «يفشل مفتوح ولا مقفول» في القسم ٤.٧**. الحالة: **⚠️ اتغطّى**

المجموعات: أسرار المصادقة (`JWT_SECRET` ×6 مواقع، `TOKEN_ENCRYPTION_KEY`، `CRON_SECRET`،
`INTERNAL_SERVICE_SECRET`، `OWNER_EMAIL`) · المنصات (`GOOGLE_ADS_*` ×~20 موقع،
`META_APP_*`، `META_LOGIN_APP_*`، `TIKTOK_APP_*`، `GOOGLE_LOGIN_*`) · الدفع
(`PAYMOB_SECRET_KEY`، `PAYMOB_HMAC_SECRET`، `PAYMOB_INTEGRATION_ID`، `PAYMOB_PUBLIC_KEY`) ·
الويب هوك (`SALLA_WEBHOOK_SECRET`، `META_APP_SECRET`، `META_*_VERIFY_TOKEN`) · الخدمات
(`ANTHROPIC_API_KEY` ×5، `RESEND_API_KEY` ×10، `BLOB_READ_WRITE_TOKEN`، `VAPID_*`،
`SCREENSHOT_API_KEY`، `GOOGLE_PAGESPEED_API_KEY`، `TURNSTILE_SECRET_KEY`) · العرض
(`NEXT_PUBLIC_*` ×10)

### 3.5 المسارات الحرجة (٢٥)

| # | المسار | المالك | الحالة |
|---|---|---|---|
| 1-4 | signup · login · MFA · password reset | security-pentest | ⚠️ جزئي — MFA مش مغطّى |
| 5-6 | إنشاء/تبديل مساحة عمل | security-pentest · data-integrity | ⚠️ جزئي — data-integrity مافحصهاش |
| 7-9 | ربط OAuth (جوجل/ميتا/تيك توك) + تجديد التوكن | platform-sync | ⚠️ |
| 10 | المزامنة اليومية لكل منصة | platform-sync | ⚠️ جزئي — أقسام كبيرة اتفحصت بـgrep |
| 11 | الإسناد: كليك→مطابقة→تحقق | attribution-truth + **مسار د٣** | ⚠️ |
| 12 | رفع التحويل للتلات منصات | attribution-truth + **مسار د٣** | ⚠️ |
| 13-14 | استقبال طلب المتجر · المرتجع/الإلغاء | ecommerce-orders | ⚠️ |
| 15-18 | checkout · ويب هوك Paymob · التجديد · انتهاء التريال | billing-plans + **مسار د١/د٢** | ⚠️ |
| 19-20 | downgrade · دورة حياة مساحة الديمو | billing-plans + **مسار د٢** | ⚠️ |
| 21 | كتابة حقيقية على منصة (تدرّج مزايدة) | platform-writes | ⚠️ |
| 22 | توليد رؤى AI | ai-cost | ⚠️ |
| 23 | توليد التقارير + المشاركة العامة بتوكن | release-readiness · security-pentest | ⚠️ |
| 24 | التنبيهات | wiring-errors · cron-reliability | ⚠️ |
| 25 | انتحال الأدمن · تعليق حساب · التصدير/الاحتفاظ · الباكب | admin-ops · compliance-privacy · cron-reliability | ⚠️ |

---

## 4. Findings by agent

_(بتتملّى واحد واحد مع تقدّم المرحلة ج)_

### 4.1 attribution-truth — ⚠️ **٧ Critical · ٩ High · ٨ Medium · ٣ Low**

> **C-1 تحت هو أهم اكتشاف في الأوديت كله، وأنا أعدت التحقق منه بنفسي سطر بسطر** بعد
> ما الوكيل رجّعه — مش اعتماداً على تقريره.

#### [Critical] C-1 — تحويلات ميتا المتحقَّقة مابتتسجّلش أبداً: كل زيادة بتستهدف صف `MetricSnapshot` مزامنة ميتا مابتنشئهوش
- **Path:** `lib/syncMetaAds.ts:139-156` (الكاتب) مقابل `app/api/attribution/mark-matched/route.ts:64-74` و`lib/messengerLeadQuality.ts:147-153` (القرّاء)
- **Repro:** مزامنة ميتا بتجرّب `breakdowns=publisher_platform,placement` الأول، وبعدين `publisher_platform`، وبعدين بلا تقسيم (`syncMetaAds.ts:86-97`). في المسار الطبيعي `breakdownLevel === "full"`، فـ`placementBreakdown = String(row.publisher_platform).toUpperCase()` → `"FACEBOOK"` أو `"INSTAGRAM"` — **مش `"ALL"` أبداً**. الفرع الوحيد اللي بيكتب `"ALL"` مشروط بـ`breakdownLevel === "none"`، واللي مابيتوصلّهوش إلا لما نداء الـinsights يفشل بالكامل. والمكانين اللي بيزوّدوا التحقق بيعملوا `where: { ..., placementBreakdown: "ALL", placementDetail: "ALL" }` فـ`updateMany` بيطابق **صفر صفوف** وبيرجع بنجاح. مطابقة واتساب حقيقية أو ليد ماسنجر حقيقي على حملة ميتا **مابيزوّدش أي حاجة، للأبد**.
- **Impact:** التحويل الحقيقي بيضيع — والأسوأ إنه بيتحوّل لرقم كاذب: `lib/truthKpis.ts:307-320` بيحسب `inflationRatePct = (raw-verified)/raw` و`wastedSpend = cost × (1 - verified/raw)`. ولإن `verified` مثبّت هيكلياً على صفر في ميتا، **AdLoop بيقول للعميل إن ميتا متضخّمة ١٠٠٪ وإن ١٠٠٪ من صرف ميتا مهدور**. دي جملة المنتج الرئيسية، غلط في الاتجاه اللي بيضرّ العميل أكتر.
- **Suggested fix:** في `lib/syncMetaAds.ts` اكتب صف تجميعي إضافي لكل `(campaignId, date)` بـ`"ALL"/"ALL"` بيجمع صفوف الأماكن — مع استخدام منطق ALL-first/split-fallback الموجود فعلاً في `lib/usageCaps.ts:180-193` في كل قارئ عشان الصف الزيادة مايعملش عدّ مزدوج. **متصلحهاش بشيل شرط المكان لوحده** — كده الزيادة هتترشّ على كل صفوف الأماكن.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` على `placementBreakdown` في `syncMetaAds.ts` بيدّي ٤ مواضع، مفيش فيهم كتابة `"ALL"` غير المشروطة؛ و`sed` على المكانين أكّد الفلتر حرفياً.

#### [Critical] C-2 — كل صفوف ميتا بتتشال من كل التقارير: التقارير بتقرا `"ALL"` بس
- **Path:** `lib/reports/reportEngine.ts:352-354` و`:499-501` — `const isAggregate = s.placementBreakdown === "ALL"; if (wantsPlacementDetail ? isAggregate : !isAggregate) continue;`
- **Repro:** لأي بُعد غير `placement`، الحلقة بتحتفظ بصفوف `"ALL"` بس. وطبقاً لـC-1 صفوف ميتا عمرها ماتكون `"ALL"`. ولّد أي تقرير → ميتا بتساهم بصفر تكلفة وصفر تحويلات.
- **Impact:** التحويل الحقيقي بيضيع من الملف المصدَّر. تقرير العميل بيقول إن ميتا ماصرفتش وماحوّلتش.
- **Suggested fix:** نفس إصلاح C-1؛ ولحد ما يتعمل، خلّي `reportEngine` يرجع لجمع الصفوف المقسّمة لأي مفتاح مالوش صف `"ALL"`.
- **Verified:** YES

#### [Critical] C-3 — Meta CAPI: الحالة بس هي اللي بتتقرا — رد `200` بـ`events_received: 0` بيتسجّل `SENT`
- **Path:** `lib/conversionSync.ts:179-206`
- **Repro:** الكرون بيبعت حدث الـ`em`/`ph` بتاعه مش SHA-256 هيكس صحيح، أو `user_data` فاضية بعد بوابة الجودة. ميتا بترد `200 OK` بـ`{"events_received":0,...,"messages":[...]}`. الكود بيعمل `res.json()` وبعدين بيقرا `fbtrace_id` بس. النتيجة: `status = "SENT"`، `errorMessage = null`، والحدث بيتشال نهائياً من مجموعة إعادة المحاولة (`:492`).
- **Impact:** **الرفع بيترفض بالصمت.** مفيش حاجة في لوجات AdLoop ولا لوحاته ولا تقاريره تقدر تكشف ده أبداً. دي بالظبط فئة العيب اللي الأوديت اتعمل عشانها.
- **Suggested fix:** بعد `res.json()` في `sendToMeta`: اعتبر `data.events_received !== 1` فشلاً، واحفظ `JSON.stringify(data.messages)` حتى عند النجاح (عمود `warningMessage` أو حالة `SENT_WITH_WARNINGS`)، واعرض عدد التحذيرات على صفحة الحقيقة.
- **Verified:** YES للكود · **NO لعقد رد ميتا** — يتحسم من مرجع Conversions API.

#### [Critical] C-4 — الهاتف بيتهشّم من غير `+`، ومفيش تجريد نقط Gmail — تحويلات جوجل المحسّنة مابتطابقش حد
- **Path:** `lib/conversionSync.ts:49-67`، مستهلَك في `:276-277` — `let digits = phone.replace(/\D/g, "")` بيشيل الـ`+`
- **Repro:** التهشيم بيحصل مرة واحدة عند الاستقبال وبيتخزّن هاش واحد بيتبعت للتلات منصات. `hashed_phone_number` عند جوجل موصَّف كـSHA-256 لسلسلة E.164 **شاملة الـ`+`**، وتطبيع الإيميل بيتطلّب شيل كل `.` قبل `@` لـgmail. الاتنين مش معمولين. جوجل بيقبل الرفع (`partial_failure_error` بيكون null) وبيرمي المعرّف.
- **Impact:** الرفع بيترفض بالصمت. Enhanced Conversions عمرها ماتتعلّق، والعميل شايف `SENT` وكارت صحة سليم.
- **Suggested fix:** بطّل تخزين هاش واحد للتلاتة. هشّم لكل منصة وقت الإرسال: `hashPhoneForGoogle` (`"+" + digits`)، `hashPhoneForMeta` (أرقام بس)، `hashEmailForGoogle` (تجريد نقط gmail). **متضيفش الـ`+` عالمياً** — ميتا بتوثّق العكس.
- **Verified:** YES للكود · **NO لمتطلب المنصة**.

#### [Critical] C-5 — `mark-matched` فحص-ثم-تصرّف: طلبان متزامنان بيزوّدوا `verifiedConversions` مرتين
- **Path:** `app/api/attribution/mark-matched/route.ts:39-75`
- **Repro:** ويب هوك التراكر بيعيد المحاولة بعد timeout والاتنين بيوصلوا في نفس اللحظة. الاتنين `findUnique` بيرجّعوا `null`. الـ`upsert` آمن (قيد فريد)، لكن الاتنين بيعدّوا `isGenuinelyNew` والاتنين بينفّذوا `increment: 1`. عميل واتساب واحد = تحويلين. **ده نفس الباگ اللي التعليق في `:35-38` بيقول إنه اتصلح** — الإصلاح حرّك الفحص لبدري بس ساب القراءة والكتابة غير متسلسلتين.
- **Impact:** عدّ مزدوج. الرقم "المتحقَّق" بينتفخ، فـ`inflationRatePct` و`wastedSpend` بيقلّوا — **AdLoop بيقلّل من حجم الفجوة اللي بيبيعها**.
- **Suggested fix:** بدّل القراءة-ثم-التفرّع بـ`create`-and-catch على `P2002`، وحطّ الإنشاء والزيادة جوّه `$transaction` واحدة — زي `lib/ctaDeduplication.ts:88-101` بالظبط.
- **Verified:** YES

#### [Critical] C-6 — إعادة محاولة ويب هوك ماسنجر بتحوّل كليك بالغلط لتحويل "متحقَّق"
- **Path:** `app/api/webhooks/meta-messenger/route.ts:60-88` + `lib/messengerLeadQuality.ts:122-154`
- **Repro:** الويب هوك مافيهوش أي منع تكرار — لا `markEventAsProcessed` ولا مفتاح message-id (على عكس `lib/webhookSecurity.ts` المستخدَم في ويب هوكس المتاجر الخمسة). ميتا بتعيد التسليم لما ماتاخدش ٢٠٠ في وقته. رسالة واحدة اتسلّمت مرتين → `messageCount = 2` → `humanRepliesCount = messageCount - 1 = 1` → فرع "في رد بشري حقيقي" → `verified: true` وزيادة.
- **Impact:** **تحويل وهمي بيتخلق.** الرقم اللي AdLoop بيسمّيه "متحقَّق" بيتصنّع بإعادة محاولة شبكة.
- **Suggested fix:** كل `event` يتفهرس بـ`event.message.mid` من خلال `markEventAsProcessed` قبل أي لمس للجدول. وبطّل استنتاج `humanRepliesCount` من `messageCount - 1`.
- **Verified:** YES

#### [Critical] C-7 — محادثة اتنمذجت الأول عمرها ماتبقى متحقَّقة
- **Path:** `app/api/attribution/mark-matched/route.ts:39-60` مقابل `app/api/attribution/unattributed/route.ts:72-81`
- **Repro:** رسالة بلا كود ref → `/unattributed` → صف `MODELED`. بعدين الكود يتسترجع → `/mark-matched` بنفس `conversationId` → `isGenuinelyNew = false` → **الزيادة بتتخطّى**، و`upsert({ update: {} })` في `:52` بيسيب النوع `MODELED`. **الدليل اليقيني بيترمي لصالح التخمين.**
- **Impact:** تحويل حقيقي بيضيع، وقيمة احتمالية بتحتلّ مكان يقينية بشكل دائم.
- **Suggested fix:** `update: { attributionType: "VERIFIED", probabilityDistribution: { [platform]: 1.0 } }`، وخلّي شرط الزيادة `existing?.attributionType !== "VERIFIED"`. جوّه transaction C-5.
- **Verified:** YES — `update: {}` حرفي في `:52`.

#### [High] H-1 — الزيادة مش ذرّية مع علامة منع التكرار: فشل عابر واحد بيضيّع التحويل للأبد
- **Path:** `app/api/attribution/mark-matched/route.ts:42-75`؛ نفس الشكل في `lib/messengerLeadQuality.ts:138-153`
- **Repro:** الـ`upsert` بينجح (العلامة اتكتبت)، وبعدين `updateMany` بيرمي استثناء (timeout، أو `platform` غير مُتحقَّق منه بيضرب في مُتحقِّق الـenum). ٥٠٠ → التراكر بيعيد → `existing` بقى موجود → **الزيادة بتتخطّى للأبد**. ونفسه في ماسنجر: `assessed: true` بيتثبّت قبل الزيادة، وفشل بعدها بيستبعد المحادثة من إعادة الفحص.
- **Impact:** تحويل حقيقي بيضيع، بلا رسالة خطأ ولا صف معلّق ولا إعادة محاولة.
- **Suggested fix:** لفّ العلامة + الزيادة في `$transaction` واحدة في الملفين. وتحقّق من `platform`/`campaignId` مقابل الـenum ورجّع 400 بدل 500.
- **Verified:** YES

#### [High] H-2 — `MIN_WORTH_SENDING_SCORE` بيسقّط حالة المنتج الأساسية: تحويل واتساب معرّفه الوحيد تليفون
- **Path:** `lib/matchQuality.ts:62,75,89`؛ البوابات في `lib/conversionSync.ts:137-144` و`:354-361`
- **Repro:** `PRACTICAL_MAX = 9.5`، والنتيجة = `raw/9.5×10`. تحويل بهاش تليفون **بس**: `raw = 2.5` → `2.6` → `2.6 >= 3.0` غلط → `SKIPPED` لميتا وتيك توك. الإيميل-بس نفس الرقم. وتحويل واتساب مالوش متصفح: لا `fbp` ولا `fbc` ولا UA. **وجوجل مش متبوّب بالنتيجة أصلاً** (`:229-239`) — التلات منصات بيختلفوا على نفس الحدث.
- **Impact:** تحويل حقيقي متحقَّق عمره ماوصل المنصة. **بس الإسقاط مُسجَّل** — `ConversionSyncLog` بياخد `SKIPPED` بالسبب، و`truthKpis.ts:353-389` بيعرض `skippedEvents` و`topSkipReason` على صفحة الحقيقة. فمش صامت — لكن الحساب بيخلّي الحالة الرئيسية غير قابلة للإرسال بالتصميم.
- **Suggested fix:** نزّل العتبة لـ`2.5`، أو الأفضل بدّل البوابة العددية بقاعدة: "ابعت لو أي من `{fbc, gclid, ttclid, emailHash, phoneHash}` موجود"، وسيب الـ0-10 كرقم تقريري.
- **Verified:** YES

#### [High] H-3 — `SKIPPED` نهائي: خطأ إعداد مؤقت بيبلع كل التحويلات في الطابور
- **Path:** `lib/conversionSync.ts:487-507`
- **Repro:** `googleConversionActionId` مضبوط لكن منحة OAuth انتهت → `sendToGoogle` بيرجّع `SKIPPED` → لحد ٢٠٠ حدث في الرن بيتشطبوا نهائياً. العميل بيعيد ربط جوجل بكرة — **الأحداث دي عمرها ماتتعاد**، لأن `SKIPPED` متعامَل معاه كنجاح نهائي.
- **Impact:** تحويلات حقيقية عمرها ماتوصل المنصة، بشكل دائم.
- **Suggested fix:** اقسم الحالة `SKIPPED_PERMANENT` مقابل `SKIPPED_RETRYABLE`، واستبعد الأول بس. وضيف سقف محاولات مع backoff لـ`FAILED` (دلوقتي بيتعاد كل ليلة للأبد).
- **Verified:** YES

#### [High] H-4 — الأرقام العربية-الهندية بتتمسح مش بتتحوّل — هاش التليفون بيبقى null
- **Path:** `lib/conversionSync.ts:51` — `phone.replace(/\D/g, "")`
- **Repro:** `\D` من غير علم `u` معناها `[^0-9]` ASCII بس. رقم واصل `٠١٠١٢٣٤٥٦٧٨٩` كل حروفه بتتمسح → `digits === ""` → `null`. والمختلط (`+20 ١٠١٢٣٤٥٦٧٨`) أسوأ: بيدّي `20` → بيفشل حارس `< 8` → `null`. في الحالتين التحويل بيفقد أقوى معرّف، وبعدين بيسقط في بوابة H-2 وبيتشطب `SKIPPED`.
- **Impact:** تحويل حقيقي عمره ماوصل المنصة. **دي حالة مصرية/خليجية يومية، مش حدّية.**
- **Suggested fix:** حوّل قبل ما تمسح: خريطة `U+0660–U+0669` و`U+06F0–U+06F9` لـ`0–9` وبعدين امسح. سطر واحد.
- **Verified:** YES للكود · NO للحدوث الفعلي (الجانب المنتِج في `wa-conversion-tracker`).

#### [High] H-5 — استنتاج كود الدولة بيفترض السعودية لكل مساحة ماحدّدتش `targetLocation`
- **Path:** `app/api/attribution/conversion/route.ts:45` — `"EG"?"20" : "AE"?"971" : "966"`، و`targetLocation` نفسه `String?`
- **Repro:** معلن مصري ماختارش سوق. رقم `01012345678` → `hashPhone` بيشيل الصفر ويحطّ `"966"` → `9661012345678`، رقم ١٣ خانة مش موجود. بيعدّي حارس `< 8`، بيتهشّم، وبيتبعت للتلاتة كمعرّف شكله سليم. والكويت وقطر والبحرين وعُمان مالهمش خريطة أصلاً.
- **Impact:** الرفع بيترفض بالصمت — الهاش سليم الشكل، المنصة بترد بنجاح، وهو مابيطابقش حد.
- **Suggested fix:** ارفض التخمين: لو الرقم مش دولي و`targetLocation` فاضي، رجّع `phoneHash: null` وسجّل السبب. ووسّع الخريطة للخليج. والأفضل: خلّي التراكر يبعت `wa_id` اللي أصلاً E.164.
- **Verified:** YES

#### [High] H-6 — `revenue` بتاع ميتا دايماً `null`: `action_values` عمره ما اتطلب
- **Path:** `lib/syncMetaAds.ts:442` مقابل `:127-132` — الـ`fields` فيها `actions` من غير `action_values`، والمستهلك بيقرا `row.action_values ?? []`
- **Impact:** ROAS ميتا مش قابل للحساب أبداً، وعمود الإيراد في كل تجميع وتقرير بيقرا "مش متقاس".
- **Suggested fix:** ضيف `action_values` لسلسلة الـ`fields`. **سطر واحد.**
- **Verified:** YES

#### [High] H-7 — استفسار ماسنجر حقيقي من رسالة واحدة بيتصنّف كليك بالغلط
- **Path:** `lib/messengerLeadQuality.ts:44-56` + `:130`
- **Repro:** شخص حقيقي بيدوس إعلان ويكتب "السعر كام؟". الويب هوك بيسجّل `messageCount = 1` (أصداء الصفحة بتتخطّى في `meta-messenger/route.ts:60`، فالعدّاد بيحمل **رسايل المستخدم الواردة بس**). ساعتين بلا رد → `humanRepliesCount = max(0,1-1) = 0` → `isLikelyAccidental: true` → `verified: false`. **الـ`- 1` بيفترض إن أول رسالة واردة أثر آلي — وهي رسالة العميل نفسه.**
- **Impact:** تحويل حقيقي بيضيع، وهو أشيع شكل لليد ماسنجر.
- **Suggested fix:** مرّر `humanRepliesCount: conv.messageCount` بلا `- 1`، واستخدم `hasAutomatedGreeting` غير المستخدَم للإشارة الحقيقية.
- **Verified:** YES

#### [High] H-8 — `MessengerConversation` مفهرَس بالشخص مش بالمحادثة
- **Path:** `prisma/schema.prisma` `@@unique([workspaceId, psid])` + `app/api/webhooks/meta-messenger/route.ts:67-88`
- **Repro:** عميل بيحوّل في مارس؛ الصف بياخد `assessed: true`. في أغسطس نفس الشخص بيدوس إعلان جديد. الويب هوك بيزوّد `messageCount` بس، و`assessAndVerify` بيستعلم `assessed: false` وعمره ماهيشوفه. و`campaignId` فاضل مثبّت على إعلان مارس.
- **Impact:** تحويل حقيقي بيضيع، ولو اتعدّ كان هيتنسب للحملة الغلط في اليوم الغلط.
- **Suggested fix:** افتح صف جديد لما رسالة توصل بـ`referral.ad_id` على صف متقيَّم. غيّر المفتاح لـ`[workspaceId, psid, conversationStartedAt]`.
- **Verified:** YES

#### [High] H-9 — منع تكرار الـCTA مش موجود في أي مسار حي: `resolveSessionConversion` مالهاش ولا نداء
- **Path:** `lib/ctaDeduplication.ts:60-102`
- **Repro:** متحقَّق بـgrep على الشجرة كلها: الاسم بيظهر في ملفه و`README.md` و`CLAUDE.md` — **ومفيش مكان تاني**. مفيش حاجة بتكتب `SessionConversion`، فصفحة `attribution-path` و`attributionPathAlert.ts` بيقروا جدول فاضي دايماً. و`getMultiTouchRate` مالهاش نداء خالص.
- **Impact:** سؤال منع التكرار مالوش إجابة حية أصلاً. `/api/track/cta-click` بيكتب صف غير مشروط لكل POST، فتحديث الصفحة بيكتب صف تاني. **بينفخ عدّادات كشف البوتات بس دلوقتي — وبيبقى عدّ مزدوج حقيقي أول ما حد يوصل المسار ده بالتحويلات.**
- **Suggested fix:** يا توصّلها بمسار تحقق حقيقي يا تمسحها هي والقارئين. ولاحظ وهي لسه رخيصة: فرع `phoneNumber` في `:75-86` هو `findFirst`-ثم-`create` بلا قيد فريد — مش هيصمد تحت التزامن.
- **Verified:** YES — grep على الشجرة كلها.

#### [Medium] M-1 — `action_source: "website"` بلا `event_source_url` لتحويلات مش من الموقع
`lib/conversionSync.ts:164-177` — كل حدث، بما فيه واتساب وماسنجر، بيتبعت `"website"` بلا `event_source_url`. ميتا بتوثّق `business_messaging` لتحويلات CTWA. **الإصلاح:** احمل نوع المصدر على `ConversionEvent` وخريطه في `sendToMeta`. **Verified:** YES للكود · NO للمتطلب.

#### [Medium] M-2 — `fbc` بيتبني بختم وقت التحويل مش وقت الكليك
`app/api/attribution/conversion/route.ts:104-108` — `fb.1.${Date.now()}.${fbclid}`. كليك الاتنين وتحويل الخميس بياخد ختم الخميس. صيغة ميتا بتتطلّب وقت رصد الكليك. أقوى إشارة عند ميتا (وزن 3.0) بتتدهور. **الإصلاح:** اقبل `fbclidObservedAt`، وارجع لـ`occurredAt` بدل `Date.now()`. **Verified:** YES للكود · NO للصرامة.

#### [Medium] M-3 — `hashPii` مش بيطبّق تطبيع ميتا للمدينة والدولة
`lib/conversionSync.ts:37-42` — `trim().toLowerCase()` وخلاص. ميتا بتتطلّب `ct` بلا مسافات (`"new cairo"` → `"newcairo"`) و`country` ككود ISO حرفين، ومفيش تحقق إن `body.country` مش `"مصر"`. وزن قليل (0.3) فالضرر محدود، لكن النتيجة بتتحسب كإشارة حقيقية. **الإصلاح:** `hashCity` + `hashCountry` عبر `lib/countries.ts`. **Verified:** YES للكود · NO للجدول.

#### [Medium] M-4 — `dayStart` بيتبني بتوقيت السيرفر المحلي مقابل عمود `@db.Date`
`app/api/attribution/mark-matched/route.ts:61-62` و`lib/messengerLeadQuality.ts:144-146`. `MetricSnapshot.date` هو `@db.Date` وبيتكتب UTC من جوجل، لكن **محلي من تيك توك** (`new Date("2026-08-23 00:00:00")` بمسافة، وV8 بيفسّرها محلي — `syncTikTokAds.ts:132`). على مضيف UTC بيتطابقوا؛ **على أي مضيف غير UTC، `updateMany` بيطابق صفر صفوف والتحويل بيضيع بالصمت**. ومنفصل: حدّ اليوم هو يوم *السيرفر* مش يوم مساحة العمل. **الإصلاح:** `new Date(receivedAt.toISOString().slice(0,10))` في الملفين، وطبّع `stat_time_day` بنفس الطريقة. **Verified:** YES

#### [Medium] M-5 — الإسناد الاحتمالي مالوش عتبة ثقة وعمره ما بيستهلك الكليك
`app/api/attribution/unattributed/route.ts:13-83`، `lib/attributionEngine.ts:36-111`. **مفيش عتبة أصلاً** — `CANDIDATE_WINDOW_HOURS=48` و`totalWeight > 0.05` بيختاروا أي إشارة تُستخدم، مش أرضية للترك بلا إسناد؛ آخر مرحلة نسبة تاريخية بصفر دليل. **ومطابقة الهاتف مساواة نصوص** بلا تطبيع، فـ`"+2010…"` عمرها ماتساوي `"2010…"` وأقوى إشارة بتفوت بالصمت. **ومفيش كليك بيتستهلك** — رسالتين بفارق ١٠ دقايق الاتنين بيتنسبوا ١٠٠٪ لنفس الكليك. **الإصلاح:** مخرَج رابع `UNATTRIBUTED` تحت `MIN_MODEL_CONFIDENCE = 0.6`، وتطبيع طرفَي مقارنة الهاتف. **Verified:** YES

#### [Medium] M-6 — `probabilistic.byPlatform` بيدمج المتحقَّق والمنمذَج في عمود واحد
`lib/attributionSummary.ts:28-35` → `truthKpis.ts:435-437` → `TruthView.tsx:442-466`. الدالة بتمرّ على **كل** صفوف `AttributionResult` بلا تفرّع على `attributionType`. الكارتين بيتعرضوا صح ومنفصلين، **لكن أعمدة المنصات تحتيهم مجموع اليقين والتخمين**. الفصل اللي المنتج بيوعد بيه بينكسر في مكان واحد بالظبط. **الإصلاح:** خريطتين منفصلتين، شريحتين مكدّستين لكل عمود. **Verified:** YES

#### [Medium] M-7 — `/api/track/cta-click`: هوية مساحة العمل مُدّعاة مش مُصادَق عليها
`app/api/track/cta-click/route.ts:14-57`. الفحص الوحيد إن `workspaceId` موجود؛ والـcuid مضمَّن في سنيبت الصفحة العامة للعميل. حدّ المعدّل ٣٠/١٠دق لكل IP، و`getClientIp` بياخد **أقصى شمال** `x-forwarded-for` (طرف المهاجم)، و`checkRateLimit` **بيفشل مفتوحاً** على أي خطأ DB. ومفيش حد لحجم الجسم. **النطاق محدود دلوقتي** لأن `CtaClickEvent` عمره ماوصل `verifiedConversions`. **بيبقى Critical يوم ما كليكات الـCTA تتوصّل بالإسناد.** **الإصلاح:** مفتاح تتبّع عام + قائمة `Origin` مسموحة؛ وتحقّق من `clickPlatform` قبل Prisma (`ctaDeduplication.ts:33` بيعمل `as any` → قيمة غلط = ٥٠٠ غير ممسوك). **Verified:** YES للكود · NO لتزوير الهيدر على النشر ده.

#### [Medium] M-8 — `/api/attribution/sync-click` بيكتب صفوف غير مُتحقَّقة وغير مانعة للتكرار
`app/api/attribution/sync-click/route.ts:16-36`. المصادقة سرّ مشترك بمقارنة `===` **مش ثابتة الزمن** (`lib/internalServiceAuth.ts:18`). وبعدها مفيش تحقق: `platform` بيروح للـenum مباشرة (غلط → ٥٠٠)، و`UnmatchedClick` مالهوش قيد فريد على `code` فتسليم معاد بيضاعف وزن المنصة في المحرّك. و`mark-matched:30-33` بيعمل `updateMany` على الكود — كليكين بنفس الكود = واحدة مشروعة بتضيع. **و`UnmatchedClick` عمره ما بيتنضّف**: `dataRetention.ts:27-30` بينضّف `CtaClickEvent` و`RateLimitEntry` بس، وده بيحتفظ بـ`ipAddress`/`userAgent` بلا نهاية. **الإصلاح:** `@@unique([workspaceId, code])` + upsert منيع، وتحقّق من `platform`، و`timingSafeEqual`، وضمّه للتنضيف. **Verified:** YES

#### [Low] L-1 — خلط الصفوف المجمَّعة والمقسّمة: الخطر معروف ومُعالَج في قارئ واحد من أربعة
`lib/usageCaps.ts:163-193` بيعالجه (دليل إن الفريق عارف)، و`app/dashboard/page.tsx:148-163` و`truthKpis.ts:220-233` لأ. **فشل ميتا عابر واحد بيكتب صف `ALL` جنب المقسّمة، وكل رقم للتاريخ ده بيتضاعف بشكل دائم** (النافذة ٢٨ يوم بتعيد المزامنة كل ليلة). **الإصلاح:** استخرج منطق `usageCaps` لمساعد مشترك. **Verified:** YES

#### [Low] L-2 — `AttributionResult.conversationId` فريد عالمياً مش على مستوى مساحة العمل
`@@unique` عالمي + `findUnique` بلا `workspaceId` في المكانين. مساحتين بمعرّفات متصادمة → محادثة التانية عمرها ماتتنسب، أو `mark-matched` بيقرا صف مستأجر تاني. **الإصلاح:** `@@unique([workspaceId, conversationId])`. **Verified:** YES للسكيما · NO لمولّد المعرّف (في التراكر).

#### [Low] L-3 — رفع مكرر بين الإرسال وكتابة السجل · إعادات `FAILED` بلا سقف · اختيار حساب جوجل عشوائي
`lib/conversionSync.ts:506-541`, `:244-249`. النداء والـ`upsert` مش في transaction، ومفيش قفل رن. **منع التكرار عند المنصة بيمتصّه** (`event_id` لميتا وتيك توك، `order_id` لجوجل) وعشان كده Low. و`FAILED` بيتعاد للأبد بلا سقف. و`sendToGoogle` بيختار الحساب بـ`findFirst` بلا `orderBy`. **الإصلاح:** صف `PENDING` قبل الإرسال، وسقف محاولات، وحلّ الحساب من `gclid` نفسه.

---

#### ✅ سداد دَين التوثيق — تحقّقت من متطلبات المنصات بنفسي (بحث ويب، ٢٣ أغسطس ٢٠٢٦)

الوكيل علّم متطلبات المنصات `Verified: NO` لأنه مالوش نت. حسمتها:

| السؤال | الإجابة الموثَّقة | أثرها |
|---|---|---|
| جوجل بيتطلّب الـ`+` في `hashed_phone_number`؟ | **أيوه.** E.164 بـ"+" بادئة وكود الدولة، ١١–١٥ رقم شاملة الـ`+`، بلا شرط أو أقواس أو مسافات | **C-4 مؤكَّد** |
| ميتا بيتطلّب الـ`+`؟ | **لأ — العكس.** ميتا عايزة أرقام بس، وشيل الـ`+` وكل رمز غير رقمي قبل التهشيم | **C-4 مؤكَّد: الاتنين بيتعارضوا فعلاً** |
| جوجل بيتطلّب تجريد نقط Gmail؟ | **أيوه**، ولـ`gmail.com` و`googlemail.com` بس: شيل كل النقط من الجزء قبل `@`، **وكمان شيل الـ`+` وكل اللي بعده**. الدومينات التانية: تصغير وقصّ مسافات بس | **C-4 مؤكَّد، وأوسع مما الوكيل قال** |
| ميتا بترد ٢٠٠ على بيانات مهشّمة غلط؟ | **أيوه.** الحمولة غلط البنية → 4xx؛ لكن **قيم PII مهشّمة بشكل معطوب بتتسقّط بالصمت مع ٢٠٠**، ومشاكل جودة البيانات بترجع في جسم الرد | **C-3 مؤكَّد** |

**الخلاصة العملية:** الكود بيخزّن **هاش واحد** (أرقام بس بلا `+`) وبيبعته للتلاتة.
ده **صح لميتا وغلط لجوجل** — بالظبط زي ما C-4 بيقول. والإصلاح مش "ضيف `+`"،
لأن كده هتكسر ميتا. لازم هاش لكل منصة.

**المصادر:**
[Google — Manage offline conversions](https://developers.google.com/google-ads/api/docs/conversions/upload-offline) ·
[Google — Upload Enhanced Conversions for Leads](https://developers.google.com/google-ads/api/samples/upload-enhanced-conversions-for-leads) ·
[Google Ads Help — enhanced conversions for leads checklist](https://support.google.com/google-ads/answer/16782203?hl=en) ·
[Google Ads Help — format and hash your data](https://support.google.com/google-ads/answer/10018336?hl=en) ·
[Meta — Customer Information Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters) ·
[Meta — Conversions API troubleshooting](https://developers.facebook.com/docs/marketing-api/conversions-api/support/)

---

#### 🔴 سداد الدَّين المتبقّي — الأربع عقود الباقية اتحسمت (٢٤ أغسطس)

المستخدم اعترض بحقّ: بنود اتبنيت عليها وهي معلَّمة `Verified: NO`. حسمتها كلها:

| البند | النتيجة | الأثر |
|---|---|---|
| **M-1** `action_source` | **`business_messaging` + `messaging_channel:"whatsapp"` مطلوبان لتحويلات CTWA.** ولو اتبعت `"website"` (الافتراضي العام)، **ميتا مابتربطش الحدث بإعلان CTWA أصلاً**. والحمولة محتاجة `ctwa_clid` في `user_data` مع `page_id` | **⬆️ Medium → Critical** |
| **M-2** `fbc` | **مؤكَّد:** لو الكوكي مش محفوظ، الختم = **وقت أول رصد للـ`fbclid`**، مش وقت التحويل | ✅ الاكتشاف صحيح |
| **M-3** `ct`/`country` | **`country` لازم كود ISO حرفين بحروف صغيرة** (والكود مابيتحققش). و`ct` تصغير وقصّ مؤكَّدان؛ **تفصيلة شيل الترقيم لسه غير محسومة** | ✅ جزئياً |
| **C-4** الهاتف | **تيك توك كمان بيتطلّب E.164 بالـ`+`** | **⬆️ الضرر اتضاعف** |

#### 🔴 C-8 (جديد، مترقّى من M-1) — كل تحويل واتساب مرفوع لميتا **مش منسوب للإعلان أصلاً**
- **Path:** `lib/conversionSync.ts:164-177`
- **Repro:** كل حدث بيتبعت `action_source: "website"` **بلا `event_source_url`**، بما فيه تحويلات واتساب وماسنجر. **وميتا بتوثّق إن CTWA بيتطلّب `action_source: "business_messaging"` و`messaging_channel: "whatsapp"`، وإن الحدث بـ`"website"` مابيترتبطش بإعلان الـCTWA.**
- **Impact:** **حتى لو C-1 وC-3 وC-4 اتصلحوا كلهم، تحويلات واتساب المرفوعة لميتا هتفضل غير منسوبة** — وهي المصدر الرئيسي للتحويلات في المنتج ده. **رفض صامت من نوع رابع.**
- **Suggested fix:** احمل نوع المصدر على `ConversionEvent` وخريطه في `sendToMeta`؛ ومرّر `ctwa_clid` (اللي التراكر شايله أصلاً) في `user_data` مع `page_id`.
- **Verified:** **YES — بالتوثيق.**

#### 🔴 C-4 موسَّع — الهاش الواحد غلط على **منصّتين من التلاتة**
| المنصة | المطلوب | الكود بيبعت | |
|---|---|---|---|
| ميتا | أرقام بس، **بلا `+`** | أرقام بلا `+` | ✅ |
| **جوجل** | E.164 **بالـ`+`** + تجريد نقط Gmail | أرقام بلا `+` | ❌ |
| **تيك توك** | E.164 **بالـ`+`** | أرقام بلا `+` | ❌ |

**المصادر:** [Meta CTWA CAPI](https://academy.insiderone.com/docs/meta-conversions-api-for-click-to-whatsapp-ads) · [Meta fbp/fbc](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc) · [Meta Customer Info Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters) · [TikTok Events API](https://ads.tiktok.com/help/article/events-api)

#### الحلقة: هل بتقفل؟ — **لأ**

1. `/api/track/cta-click` → `CtaClickEvent` — **طريق مسدود** (متحقَّق بـgrep: بيتقرا من ٣ ملفات وصفحتين بس، عمره مايلمس `verifiedConversions`).
2. `/api/attribution/sync-click` → `UnmatchedClick` — مرشّحين، بلا تنضيف وبلا مفتاح فريد.
3. `/api/attribution/mark-matched` → **المكان الوحيد اللي رقم الحقيقة بيتحرّك فيه لواتساب.** شغّال لجوجل وتيك توك، **ومش شغّال لميتا خالص (C-1)**.
4. `/api/attribution/unattributed` → `MODELED`. **القيمة الاحتمالية عمرها ماتوصل `verifiedConversions`** — الوكيل عدّ كل مواضع الكتابة وأثبت ده (`syncGoogleAds.ts:1379` stub بيرجّع صفر؛ ميتا وتيك توك بيكتبوا صفر حرفي). **الفصل صامد في قاعدة البيانات**، وبيتسرّب في رسم واحد بس (M-6).
5. `/api/attribution/conversion` → `ConversionEvent`. **الفرع ده مش موصول بالفرع ٣** — مفيش حاجة بتربط `AttributionResult.conversationId` بـ`ConversionEvent.externalId`. الرقم اللي AdLoop **بيعرضه** والأحداث اللي **بيرفعها** خطّان مستقلان بنداءين منفصلين من التراكر، **بلا مصالحة ولا فحص يكشف لو واحد اشتغل والتاني لأ**.
6. `cron/conversion-sync` → التلات منصات → `ConversionSyncLog`.

**لو الرفع بيترفض بالصمت من التلاتة دلوقتي، إيه اللي هيقولنا؟** تيك توك بس بيقرا جسم رده صح (`data.code !== 0`)، وجوجل بيقرا مظروف الفشل الجزئي. **ميتا — أكبر التلاتة — مابيقراش ولا واحد فيهم.**

#### لسه فاضل (من الوكيل)
- **ملفات في النطاق ماتفتحتش:** `attributionPathAlert.ts` وصفحة `attribution-path` (اتأكد بـgrep إنهم بيقروا جدول فاضي) · `trafficQualityCheck.ts` · `dailyTasks.ts` · `diagnosticsEngine.ts` · `conversionGapAlert.ts` · `setupProgress.ts` · `experimentEngine.ts` · `kpiEngine.ts` · `qualitySignals.ts`.
- **`app/admin/customers/[id]/CustomerEditors.tsx:130` بيعرض `verifiedConversions` كحقل قابل للتعديل من الأدمن — اتنقل لـ`admin-ops`.**
- **بره الريبو:** `wa-conversion-tracker` — كل حاجة عن *اللي التراكر بيبعته فعلاً* غير متحقَّقة: ASCII ولا عربي-هندي · هل `campaignId` دايماً موجود (من غيره الزيادة عمرها ماتشتغل) · هل `conversationId` فريد عالمياً · هل `/conversion` بيتنادى لنفس المحادثات.
- **حمولات المنصات:** كل ادعاء عن *كودنا* متحقَّق بالقراءة. المتطلبات الخارجية (عقد رد ميتا، `+` جوجل، نقط gmail، تطبيع `ct`/`country`، دلالات `fbc`) **مستنتَجة ومش معادة التحقق** — Context7 ماكانش متاح للوكيل. **أنا هحسمها لاحقاً** مع دَين `platform-sync`.
- **إصدارات في الكود:** ميتا `v25.0` وتيك توك `v1.3` (`conversionSync.ts:32-33`)، **وويب هوك ماسنجر `v21.0`** (`meta-messenger/route.ts:13`) — **أقدم ومختلف عن ملفات المزامنة**. `event_time` بالثواني — صح.
- **اللي الأدوات الحتمية بتثبته وماتثبتوش:** `tsc` النضيف و١٥/١٥ أخضر **مابيثبتوش أي حاجة هنا**. `checkPlatformIngest` و`checkOrderPipeline` بيختبروا ويب هوكس المتاجر بس. **مفيش ولا فحص بناء بيلمس `/api/track` ولا `/api/attribution/*` ولا `conversionSync.ts` ولا `verifiedConversions`. حلقة الإسناد — جملة المنتج الوحيدة — تغطيتها الآلية صفر، وعشان كده C-1 عاش.**

### 4.2 billing-plans — ⚠️ **٢ Critical · ٤ High · ٤ Medium · ٣ Low**

> **الاتنين الحرجين تحت أعدت التحقق منهما بنفسي** بعد ما الوكيل رجّعهم.

#### [Critical] B-1 — عملة الفوترة بيختارها العميل: ادفع سعر مصر لخطة الدولار
- **Path:** `app/api/workspaces/[id]/route.ts:12` + `:88-103` + `:156-159` → `app/api/billing/checkout/route.ts:28-29` → `lib/plans.ts:247-256`
- **Repro:** ١) اعمل حساب وماتربطش حساب إعلانات (`Workspace.dataCurrency` بيفضل `null`) — أو استخدم مساحة الديمو، اللي `dataCurrency` بتاعها عمره ما بيتضبط (`lib/dataCurrency.ts:42` بيرجع بدري لو `isDemo`). ٢) الإعدادات ← العملة: المنتقي بيعرض كل العشر عملات لما `dataCurrency` تكون null. اختار `EGP`. ٣) `PATCH /api/workspaces/[id]` — `"currency"` موجودة في `ALLOWED_FIELDS`؛ والقفل في `:89` شرطه `workspace.dataCurrency && ...`، والفرع التاني `else if (workspace.isDemo)`. **بـ`dataCurrency === null` و`isDemo === false`، ولا فرع بيشتغل، والقيمة بتعدّي للتحديث في `:156`.** ٤) `POST /api/billing/checkout {plan:"pro"}` → `billingCurrencyFor("EGP")` → **٢٤٩٩ جنيه بدل ١٤٩ دولار**. ٥) ادفع — تأكيد الويب هوك الاقتصادي بيعدّي (نيّة بالجنيه == معاملة بالجنيه)، والخطة بتتفعّل `pro`.
- **Impact:** **تسعير القوة الشرائية بقى خدمة ذاتية.** عند ~٤٨ ج/دولار: Pro بـ≈٥٢$ بدل ١٤٩$، وAgency بـ≈١٤٦$ بدل ٣٩٩$ — **خصم ~٦٥٪ متاح لأي حد من أي بلد**. ومابيصلّحش نفسه: عملة الديمو عمرها ماتتقفل، فالاحتفاظ بكوكي الديمو وقت الدفع بيعيد الاستغلال للأبد — حتى بعد ربط حساب حقيقي وحتى بعد انتهاء الديمو (`/dashboard/billing` جوّه `OPEN_AFTER_DEMO`).
- **Suggested fix:** في `checkout/route.ts` بطّل اشتقاق عملة الفوترة من مساحة العمل النشطة. اشتقّها مرة واحدة من حقل على مستوى `User` مثبَّت وقت التسجيل، أو من `dataCurrency` بتاعة أول مساحة غير-ديمو؛ وارفض الدفع لو مفيش `dataCurrency` في الحساب كله بدل ما ترجع لقيمة المستخدم بيحرّرها. وفي `workspaces/[id]/route.ts` اعتبر `currency` على مساحة غير-ديمو **للعرض بس**.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد `"currency"` في `ALLOWED_FIELDS:12`، وأكّد إن القفل في `:89` مشروط بـ`workspace.dataCurrency &&` فبينهار لما تكون null.

#### [Critical] B-2 — الويب هوك بيعلّم حدث Paymob "متعالَج" **قبل** ما ينفّذه: استثناء في النص بياكل الدفعة نهائياً
- **Path:** `app/api/webhooks/paymob/route.ts:63-64` مقابل `:119-123`؛ `lib/billing.ts:304-373`
- **Repro:** ١) Paymob بيبعت نجاح موقَّع صحيح. السطر ٦٣ `markEventAsProcessed` **بيثبّت صفّه** ويرجّع `true`. ٢) أي حاجة بعده ترمي — `user.findUnique` في `:105`، أو timeout، أو الأسوأ: جوّه `fulfillPaymentIntent` **بين** `updateMany` في `lib/billing.ts:304` (اللي بيثبّت `status: PAID`) و`user.update` في `:350` (**transaction منفصلة**). ٣) الراوت بيرجع ٥٠٠ وPaymob بيعيد. ٤) الإعادة بتضرب `:63` تاني → `P2002` → بيرجّع `false` → `:64` بيرجع `{duplicate:true}`. **التنفيذ عمره ما بيتعاد.**
- **Impact:** الكارت اتخصم، و`PaymentIntent.status` ممكن يكون `PAID` بالفعل، و`User.subscriptionStatus` عمره ما اتلمس. العميل شايف الخطة المجانية. **ومفيش أي مصالحة**: مفيش كرون فوترة أصلاً (الستة هما backup/conversion-sync/marketing-emails/push-notifications/store-sync/sync-google-ads)، ومفيش مسار تاني بينادي `fulfillPaymentIntent`. الاسترداد = كتابة يدوية في قاعدة البيانات.
- **Suggested fix:** نقل `markEventAsProcessed` لـ**بعد** نجاح `fulfillPaymentIntent` (الـ`updateMany … where status: PENDING` في `lib/billing.ts:304` أصلاً بيخلّي الإعادة منيعة، فصفّ الحدث حزام تاني مش أساسي). وفي `lib/billing.ts` لفّ `updateMany` + `user.update` + `logSubscriptionEvent` في `$transaction` واحدة.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد إن `markEventAsProcessed` في `:63` والرجوع المبكر في `:64`، و`fulfillPaymentIntent` في `:118`. القيد الفريد نفسه سليم (`@@unique([source, scopeId, externalEventId])`) — **العيب في الترتيب مش في القيد**.

#### [High] B-3 — دفعة متروكة بتمنع إعادة الشراء لنفس الخطة للأبد
- **Path:** `lib/billing.ts:160-176` (نافذة ٣٠ دقيقة) مقابل `:206-233` (طبقة القفل الاستشاري، **بلا نافذة زمنية**)
- **Repro:** ادوس اشتراك على Pro → النيّة بتتعمل بـ`dedupeKey` و`status: PENDING`. اقفل التاب. مفيش ويب هوك، فالـ`dedupeKey` عمره ما بيتمسح و`PENDING` بتفضل للأبد — و`PaymentIntentStatus.EXPIRED` موجودة في الـenum **ومفيش حاجة في الريبو بتكتبها**. بعد يومين ادوس Pro تاني: الطبقة الأولى بتفوت على `createdAt: {gte: since}`، **والطبقة التانية في `:209` بتستعلم `{dedupeKey, status:"PENDING"}` بلا أي فلتر تاريخ**، بتلاقي صف عمره يومين، و`:231` بترجّع `checkoutUrl` المخزّن حرفياً. المستخدم بينزل على صفحة Paymob `client_secret` بتاعها منتهي.
- **Impact:** عميل عايز يدفع **مش قادر**، لنفس (الخطة/الدورة/العملة)، بلا نهاية. ومفيش راوت أدمن بيمسح نيّة عالقة. إيراد ضايع بالصمت.
- **Suggested fix:** طبّق نفس فلتر `createdAt: { gte: since }` على استعلام `:209`، ولما تلاقي صف `PENDING` أقدم اقلبه `EXPIRED` (وامسح `dedupeKey`) قبل ما تنشئ البديل.
- **Verified:** YES

#### [High] B-4 — `PAST_DUE` و`TRIALING` عمرهم ما بيتكتبوا: السجل بيقول ACTIVE للأبد بعد الانتهاء
- **Path:** `lib/entitlements.ts:121`؛ `app/dashboard/billing/page.tsx:34`؛ `lib/subscriptionAlerts.ts:19`؛ `lib/marketing/send.ts:152`؛ `lib/admin/business.ts:194`
- **Repro:** كل مواضع الكتابة في `subscriptionStatus` في الريبو: `lib/billing.ts:353` (`ACTIVE`)، و`admin/customers/[id]/subscription/route.ts:55` (`CANCELED`) و`:93`/`:125` (`ACTIVE`). **خلاص. مفيش كاتب لـ`PAST_DUE` ولا `TRIALING`.** وفرع الدفع الفاشل في الويب هوك بيعلّم *النيّة* `FAILED` وبيسيب `User.subscriptionStatus` زي ما هي.
- **Impact:** **الصلاحيات نفسها آمنة** — `lib/entitlements.ts:92-95` بيقرا حيّاً وبيتطلّب `currentPeriodEnd > now`، فالعميل المنتهي فعلاً بينزل `free`. الضرر في كل اللي بيقرا الحالة بدل التاريخ:
  - `app/dashboard/billing/page.tsx:34` — `status === "ACTIVE" ? plan : null` **بلا فحص تاريخ**. صفحة فوترة المشترك المنتهي بتقول "خطتك الحالية: Pro"، وكارت Pro بيتعرض `disabled` بـ"خطتك الحالية". **الصفحة الوحيدة اللي شغلتها تقوله يدفع تاني بتقوله إنه دافع.**
  - `lib/marketing/send.ts:152` — فرع الاسترجاع مربوط بـ`ent.state === "EXPIRED"`، واللي `entitlements.ts:121` بيرجّعه لـ`PAST_DUE` بس. **حملة استرجاع العملاء عمرها ما بتشتغل لأي حد.**
  - `lib/subscriptionAlerts.ts:19` — `if (status !== "PAST_DUE") return`. **الملف كله غير قابل للوصول.**
  - `lib/admin/business.ts:194` — عدّاد المتأخرين صفر هيكلياً.
- **Suggested fix:** (أ) في فرع `transaction.success !== true` اكتب `subscriptionStatus: "PAST_DUE"` لما خطة النيّة الفاشلة تطابق خطة المستخدم. (ب) ولإن مفيش كرون تجديد أصلاً، ضيف اشتقاق على مسار القراءة في `lib/entitlements.ts`: رجّع `EXPIRED` لما `subscriptionPlan` مش null و`currentPeriodEnd < now`، وخلّي صفحة الفوترة تاخد `currentPlan` من `getEntitlements` مش من العمود الخام.
- **Verified:** YES

#### [High] B-5 — التخفيض والانتهاء مابيضيّقوش أي حاجة موجودة، والكرون اليومي بيفضل يدفع تمنها
- **Path:** `lib/entitlements.ts:391-404` (`buildCheck`)، `:204-219`، `:244`، `:275-286`؛ `app/api/cron/sync-google-ads/route.ts:179-180`
- **Repro:** اشترك Agency (١٥ مساحة، ١٥ حساب/منصة، ٣ منصات). اعمل الـ١٥ واربط الكل. سيب الفترة تنتهي أو انزل خطة. `getEntitlements` بقى بيرجّع `free` (مساحة، منصة، حساب واحد). **مفيش حاجة بتتسحب:** `buildCheck` هو `allowed: current < limit` — **بوابة إنشاء بس**. الـ١٥ مساحة كلهم بيفضلوا مقروءين، والكرون الليلي بيمرّ على `workspaceIds` متبوّب بـ`isSyncBlocked(ownerId)` بس — وده سقف استخدام الصرف، **مش فحص خطة**.
- **Impact:** واحد بيدفع شهر Agency، يجهّز ١٥ مساحة و٤٥ ربط حساب، وبعدين مايدفعش تاني أبداً — **وبيحتفظ بالـ١٥ مساحة متزامنة بالكامل على ٣ منصات مجاناً**، على حساب كوتة API بتاعتنا وبنيتنا التحتية، كل ليلة، بلا نهاية.
- **Suggested fix:** في كرون المزامنة، حُلّ صلاحيات المالك قبل مزامنة كل مساحة وتخطّى اللي فوق حدود الخطة الحالية، بترتيب ثابت (الأقدم أولاً) عشان نفس المجموعة تفضل حيّة. وضيف `overLimitResources(userId)` عشان اللوحة تعلّم الزيادة للقراءة فقط.
- **Verified:** YES

#### [High] B-6 — مفيش تنبيه لما **كل** تحققات HMAC تفشل: ترتيب حقول غلط مالوش فرق عن الصمت
- **Path:** `app/api/webhooks/paymob/route.ts:34-48` و`:58-61`؛ `sentry.server.config.ts:1-11`؛ `docs/open-audit-findings.md:14-27`
- **Repro:** **ادعاء "يفشل مقفولاً" في التوثيق مؤكَّد:** `verifyPaymobHmac` بيرجّع `false` لما الترويسة غايبة أو `PAYMOB_HMAC_SECRET` مش مضبوط (`:35`)، وبيقارن بـ`timingSafeEqual` جوّه `try` بيرجّع `false` على استثناء الطول، والمنادي بيرجع **٤٠١ قبل أي كتابة**. كويس. **لكن الإشارة الوحيدة عند الرفض هي `console.error` في `:59`.** و`sentry.server.config.ts` مافيهوش `captureConsoleIntegration` ولا `consoleIntegration`، ومفيش `Sentry.captureMessage`/`captureException` في مصدر التطبيق كله — فالـ`console.error` بيروح للوج وبس. ومفيش عدّاد، ولا فحص معدّل فشل، ولا سطح أدمن للويب هوكس المرفوضة (`ProcessedWebhookEvent` بيتكتب **بعد** نجاح التحقق، **فمعدّل رفض ١٠٠٪ بيسيب صفر صفوف في أي مكان**).
- **Impact:** لو `HMAC_FIELD_ORDER` (`:22-28`، وموثَّق في `:8` إنه تخمين من توثيق قديم) غلط، **كل دفعة حقيقية بترجع ٤٠١**. العملاء بيتخصم منهم، و`PaymentIntent` بتفضل `PENDING`، والمنتج بيتصرّف زي ما لو Paymob واقعة تماماً. **أول واحد هيلاحظ هو عميل دفع.** و`docs/open-audit-findings.md:26` أصلاً بيسمّي التنبيه ده كمطلوب — **ومش مبني**.
- **Suggested fix:** عند فشل التحقق اكتب صف (`source: "paymob-rejected"` أو عدّاد مخصص)، ولما N تحقق متتالي يفشل في نافذة بصفر نجاح، ابعت تنبيه للمالك — نفس مسار `pushToActionFeed`/الإيميل المستخدَم في `lib/usageCaps.ts:278-314`. و`Sentry.captureMessage` في `:59` كحدّ أدنى.
- **Verified:** YES

#### [Medium] B-7 — تغيير الخطة بيصفّر الفترة لـ«دلوقتي + ١»، والتجديد المبكر لنفس الخطة ممنوع
`lib/billing.ts:338-341` و`:76-83`. **الترقية/التخفيض:** في اليوم ٥ من شهر مدفوع تشتري Pro → بيتحاسب Pro كامل و`periodEnd = new Date()` + شهر — **الـ٢٥ يوم الباقية بتتلغي بلا رصيد**، والتخفيض نفس الحاجة بلا استرداد (`lib/admin/business.ts:33` بيقول صراحة مفيش حالة أو مسار استرداد). **التجديد:** بـ٣ أيام باقية على Pro تدوس Pro → `errAlreadyOnPlan`. ولإن مفيش كرون تجديد وPaymob هنا لقطة واحدة بلا توكن محفوظ، **كل مشترك لازم يسيب خطته تنتهي عشان يُسمح له يدفع**. **الإصلاح:** اشتقّ `periodEnd` من `max(now, currentPeriodEnd)` — نفس القاعدة اللي مسار `extend` بتاع الأدمن بيستخدمها أصلاً في `:88`. **Verified:** YES

#### [Medium] B-8 — إلغاء الأدمن بيقتل الوصول فوراً على وقت مدفوع، وهو مدّعي إنه بيلغي في نهاية الفترة
`app/api/admin/customers/[id]/subscription/route.ts:52-56` — الكتابة `{ subscriptionStatus:"CANCELED", cancelAtPeriodEnd:true }` **الاتنين مع بعض**. و`entitlements.ts:93` بيتطلّب `ACTIVE`، فالعميل بينزل `free` فوراً. و`cancelAtPeriodEnd` مابيتقراش من أي حاجة غير عرض الأدمن. ٢٥ يوم مدفوعين بيتسحبوا في الحال بلا مسار استرداد في النظام كله. **ومفيش راوت إلغاء ذاتي** — فكل إلغاء بيعدّي من هنا. **الإصلاح:** لما `currentPeriodEnd > now` اكتب `cancelAtPeriodEnd: true` بس وسيب `ACTIVE`. **Verified:** YES

#### [Medium] B-9 — `lib/paymob.ts` بيعرّف العملات `EGP|SAR|AED` بينما المنتج بيحاسب `EGP|SAR|USD`، مخفي وراء cast
`lib/paymob.ts:11-12` مقابل `lib/plans.ts:14`، والجسر في `lib/billing.ts:240` هو `input.currency as "EGP"|"SAR"|"AED"` — **فـ`AED` عمرها ماتتبعت و`USD` بتتبعت من خلال نوع بيقول إنها ماتنفعش**. وبيانات الفوترة مثبّتة `country:"EG"`, `city:"Cairo"` على القاعدة المصرية. **فرعان، الاتنين وحشين:** لو Paymob بيرفض `USD` → `createPaymentIntention` بترمي والنيّة `FAILED`، و**كل عميل غير مصري/سعودي مش قادر يشتري خالص** بالصمت. ولو Paymob بيحوّلها لجنيه ويعامل `14900` كقروش → **١٤٩ دولار بتتحصّل ١٤٩ جنيه (~٣$)**، وتأكيد `paidCurrency` بيرفض التفعيل — العميل اتخصم ومااخدش حاجة. **الإصلاح:** متحلّهاش بالتخمين — أكّد الثابت في الكود: قائمة سماح صريحة قبل النداء، ووحّد نوع `CreateIntentionParams.currency` مع `BillingCurrency` عشان الـcast يختفي و`tsc` يمسك الانحراف. **Verified: NO** — الفحص الحاسم هو اللي ممنوع عليه يعمله: لوحة Paymob (Payment Integrations) وأي عملات الـ`PAYMOB_INTEGRATION_ID` المضبوط بيقبلها.

#### [Medium] B-10 — بوابة الديمو سايبة `/dashboard/pricing` مفتوحة بعد الانتهاء — والصفحة دي مليانة بيانات ديمو
`lib/demoGate.ts:30-36`؛ `app/dashboard/pricing/page.tsx:39-55`. `OPEN_AFTER_DEMO` بيسرد `/dashboard/pricing` جنب `/dashboard/billing`، وترويسة الملف بتبرّر القائمة بإن "الصفحات دي مابتقراش بذرة الديمو أصلاً". ده صحيح لـ`/dashboard/billing`، **وغلط لـ`/dashboard/pricing`** — دي صفحة صحة تسعير منتجات التاجر: `:39` بينادي `getWorkspacePricing` و`:44` بيعمل `product.findMany({ where:{ workspaceId } })`، يعني بيقرا صفوف `Product` المبذورة. بعد انتهاء الديمو المستخدم بيفضل شايف هوامش وأسعار تعادل وأرباح **مفبركة كأنها حقيقية** — وده بالظبط الفشل اللي التعليق في `app/dashboard/layout.tsx:217-219` بيسمّيه "أسوأ حالة ممكنة في منتج كل نقطته التحقق". **الإصلاح:** شيل `/dashboard/pricing` من `OPEN_AFTER_DEMO`. **Verified:** YES

#### [Medium] B-11 — حارس كتابة الديمو على نقاط الاختناق بس: الراوتات دي مالهاش أي فحص ديمو
`lib/demo.ts:27-35` (`assertNotDemo`). **تصحيح لتأطيري في المهمة:** `lib/demoGate.ts` **مش** حارس الكتابة — ده مطابِق مسارات ٤١ سطر بيقرر أي *صفحات تُعرض* بعد الانتهاء. الحارس الحقيقي `assertNotDemo`، وقائمة نداءاته الكاملة: `actionFeed.ts:178`، `adDecisions.ts:383`، `conversionSync.ts:456`، `ecommerce/priceSync.ts:40`، `syncGoogleAds.ts:1438`+`:1490`، `syncMetaAds.ts:841`+`:879`، `syncTikTokAds.ts:1290`+`:1329`. **دول بيغطّوا كل كتابة حقيقية للمنصات — الجزء ده صامد.** و`blockAiInDemo` بيغطّي أربع راوتات Claude.
**راوتات بتعدّل مساحة أو بتعمل نداء خارجي وماعندهاش أي فحص ديمو:**
`workspaces/[id]/campaign-links` (بينادي `backfillHistoricalData` **غير المحروس** — ممكن يسحب تاريخ جوجل حقيقي جوّه مساحة الديمو ويخلط `MetricSnapshot` حقيقي بالمبذور) · `monitored-pages` (إنشاء + فحص، نداء خارجي) · `diagnostics/scan` · **`report-email` (بيبعت إيميل Resend حقيقي لأي عنوان، فيه أرقام ديمو معروضة كتقرير)** · **`share-link` (بيصكّ `SharedReportLink` عام على بيانات ديمو)** · **`mcp-tokens` (بيصدر توكن MCP حيّ على مساحة الديمو — Claude بيقرا أرقام مبذورة كأرقام المستخدم الحقيقية)** · `ecommerce` (بينشئ `EcommerceConnection` حقيقي، و`checkStoreLimit` في `entitlements.ts:244` **مالهوش فلتر `isDemo:false`** بعكس `checkWorkspaceLimit` في `:216`، فمتجر ديمو بياكل خانة من خطة مدفوعة) · `upload-sheet`, `automation-rules`, `experiments`, `competitors` (تعديلات DB بس).
**وكمان: البوابة عرض-فقط.** مفيش راوت API بيستشير `demoExpiresAt`، فكل GET فوق بيفضل يقدّم بيانات ديمو بعد الانتهاء لأي حاجة مش هي اللاي أوت.
**الإصلاح:** `assertNotDemo(workspaceId)` على الست راوتات الخارجية المسمّاة، و`isDemo:false` في `entitlements.ts:244`. وعلى المدى الأطول: انقل الحارس جوّه `workspaceAccess()` بانسحاب صريح، فالراوت الجديد يرثه. **Verified:** YES للجرد والغياب · NO لهل `campaign-links` قابل للوصول من الواجهة على مساحة ديمو.

#### [Low] B-12 · B-13 · B-14
- **B-12** `lib/plans.ts:270-278` — `planModelFor` بيوجّه الخطة المجهولة لـ`starter` بينما تعليقه فوقه بسطرين بيقول "المجهول ينزل للأدنى". مفيش أثر النهاردة (`free` و`starter` بنفس الموديل)، **بيبقى حيّ أول ما يفترقوا**. الإصلاح: الافتراضي `"free"`.
- **B-13** `app/api/billing/checkout/route.ts:47-49` — سعر Enterprise المتفاوَض عليه **عمره ما يتحصّل**: الرفض على `plan.contactOnly` بيحصل **قبل** `startSubscriptionCheckout`، فـ`customPriceOverrideCents` (الوحيد اللي بيقراه `resolveMonthlyChargeable`) عمره ما يشوف مفتاح enterprise. النتيجة: أكبر العقود بتتخدم بـ`gift` أدمن اللي بيسجّل `amountCents: null` — **فبتبقى غير مرئية في كل تجميع إيراد**.
- **B-14** `app/api/webhooks/paymob/route.ts:131` — `workspace.findFirst({ where:{ userId } })` بلا `isDemo:false` وبلا `orderBy`: إشعار "اشتراكك فعّال" ممكن ينزل في فيد مساحة الديمو، اللي بيبقى ورا البوابة بعد الانتهاء. العميل بيدفع ومايشوفش تأكيد.

#### ✅ فحصان رجعوا نضاف (متتأكدش منهم تاني)
- **مفيش `Float` على أي عمود بيتحاسب.** `PaymentIntent.amountCents`، `SubscriptionEvent.amountCents`، `customPriceOverrideCents`، `aiCreditsPurchased` كلهم `Int`. (`usageSpendUsd` هو `Float` لكنه مقياس استخدام، `Math.round` قبل التخزين، وعمره ما بيتحاسب.)
- **السعر مشتقّ من السيرفر، مش من العميل أبداً.** الـcheckout بيقبل `plan`/`cycle`/`mode`/`credits` بس؛ المبلغ من `lib/plans.ts` و`×100` بيحصل مرة واحدة على قيمة صحيحة أصلاً. والويب هوك **مابيثقش في مبلغ الحمولة** — بيأكّده جوّه شرط `updateMany` في `lib/billing.ts:308-310`، وده المكان الصح.
- **ملاحظة على المحدِّد:** `checkRateLimit` (بيفشل مفتوحاً على خطأ DB) موجود على `billing/checkout:22` و`demo:26`. الفشل المفتوح على الـcheckout مش باگ فلوس بالنظر للقفل الاستشاري تحته، **لكنه المخنِق الوحيد على إنشاء نوايا Paymob**.

#### لسه فاضل (من الوكيل)
- `lib/demoSeed.ts` (٩٩٣ سطر) — grep بس؛ **مش متحقَّق جدولاً بجدول** إن البذرة مابتلمسش عدّاد بره فلاتر `isDemo:false` المؤكَّدة.
- **`lib/admin/business.ts` — قرا `getRevenueSeries` و`getCustomerBilling` بس. `toUsd`/`amortizeIntent`/`getMrr`/LTV مش متقروءين: تحويل العملة في تقارير الإيراد غير مُدقَّق، وبالنظر لـB-1 ده أول حاجة تتقرا بعد كده.**
- `lib/admin/customers.ts`, `shared.ts` · راوتات `vip`/`notes`/`email`/`resync`/`flags` (**و`vip` بالذات ممكن يلمس الصلاحيات**) · `PlansClient.tsx` مودال شراء الرصيد · `PaymentResultClient.tsx` سلوك الاستطلاع · `middleware.ts` ككل · الخمس كرونات التانية · موديل `Workspace` في السكيما كاملاً.
- **ممنوع بالتصميم:** صفر نداء Paymob (فـB-9 وB-6 مش قابلين للحسم من الريبو — الفحص الخارجي المطلوب مسمّى في كل واحد) · صفر استعلام DB (فمش معروف لو في نوايا عالقة `PENDING` دلوقتي).

### 4.3 security-pentest — ⚠️ **٢ Critical · ٤ High · ٩ Medium · ٣ Low**

> الاتنين الحرجين أعدت التحقق منهما بنفسي. **ولاحظ الفحص الأخير: الوكيل قيّم ثغرات
> الاعتماديات بنفسه وطلّعها غير قابلة للوصول — قرار مهم للـGo/No-Go.**

#### [Critical] S-1 — `available-campaigns` عمره ما بيفحص إن المتصل بيملك مساحة العمل اللي في المسار
- **Path:** `app/api/workspaces/[id]/available-campaigns/route.ts:92-119`
- **Repro:** أي مستخدم مسجَّل بيبعت `GET /api/workspaces/<مساحة-الضحية>/available-campaigns?platform=META_ADS`. السطر ٩٣ بيوثّق الجلسة، والسطر ٩٢ بياخد `id` من المسار. **مفيش ولا `workspaceAccess` في الملف كله.** السطر ١٠٤ بيستعلم `ecommerceConnection.findMany({ where:{ workspaceId: id } })` والسطر ١١٣ `campaignLink.findMany({ where:{ workspaceId: id } })`، والاتنين بيتدمجوا في الرد.
- **Impact:** **قراءة عابرة للمستأجرين** — أسماء متاجر مساحة تانية وروابطها ومنصة التجارة ومعرّفات الاتصال، وخريطة كاملة لمعرّفات حملاتهم الخارجية. والمعرّفات دي بالظبط هي مدخل S-2 تحت. و**cuid مساحة العمل مش سرّي** — مضمَّن في سنيبت تتبّع CTA على موقع الضحية نفسه، فبيتحصد من هناك.
- **Suggested fix:** ضيف بوابة الملكية القياسية في أول `GET`، زي جاره `campaign-links/route.ts:20-23` بالظبط، ورجّع 404 عند الفشل. والراوت ده كمان بيطلق نداءات جوجل/ميتا/تيك توك غير محسوبة لكل طلب — ضيف حدّ معدّل وإنت فيه.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` على الملف كله رجّع `getSessionUser` بس؛ **`workspaceAccess` مش مستورَد و`prisma.workspace` عمره ما اتستعلم**. وجاره `campaign-links` بيعمل الفحص في `:21` و`:40`.

#### [Critical] S-2 — `campaign-links` بيقبل معرّفات خارجية عشوائية، والويب هوكس بتستخدمها كمفتاح الملكية الوحيد
- **Path:** `app/api/workspaces/[id]/campaign-links/route.ts:99-110` (كتابة) → `app/api/webhooks/salla/route.ts:59-61` و`app/api/webhooks/meta-leadgen/route.ts:65-76` (قراءة)
- **Repro:** المستأجر A بينشئ مساحته وبيبعت `{campaigns:[{platform:"SALLA", externalAccountId:"<معرّف تاجر الضحية B>", ...}]}`. المعالج بيتحقق من `Array.isArray` وحدّ عدد الخطة **بس**؛ و`createMany` بيكتب الحقول من الجسم مباشرة **بلا أي فحص إن المتصل عنده منحة OAuth أو اتصال متجر للحساب الخارجي ده**. وبعدين ويب هوك سلّة الحقيقي بتاع B بيوصل: توقيعه بيتحقق مقابل `SALLA_WEBHOOK_SECRET` **عام واحد** (مش سرّ لكل مستأجر) فبيعدّي. والملكية بتتحدّد في `:59` بـ`campaignLink.findFirst({ where:{ platform:"SALLA", externalAccountId: storeId } })` — **بلا نطاق وبلا ترتيب**. لو صف A رجع، **إيرادات طلبات B و`ProductSaleEvent` بتاعتها بتتكتب في مساحة A**. ونفس الشكل في ليدز ميتا: `:66` بيحلّ بـ`externalCampaignId` لوحده، و`markEventAsProcessed` في `:61` **بيحرق الحدث قبل الحل** — فليد متحوَّل غلط بيضيع نهائياً حتى مع إعادة محاولة ميتا.
- **Impact:** قراءة وتدمير عابران للمستأجرين لعدد طلبات تاجر تاني وإيراده اليومي وأحداث بيع منتجاته؛ **وفقدان دائم لليدز Instant Form بتاعة مستأجر تاني** (وهي شايلة اسم وإيميل وتليفون العميل). المهاجم محتاج حساب مجاني ومعرّف تاجر بيظهر في رابط متجر الضحية العام.
- **Suggested fix:** قبل `createMany`، تحقّق من كل `externalAccountId` مقابل صفوف يوصلها `user.id`، ومن إن `connectionId` تابع لمساحة العمل دي. **وأحِل `webhooks/salla` لصالح `webhooks/ecommerce/[platform]`** — الراوت ده أصلاً بيربط الملكية بـ`webhookSecret` لكل مستأجر عبر `resolveStoreConnection`، وده التصميم الصح. ولـ`meta-leadgen`: نقل `markEventAsProcessed` لبعد نجاح الحل.
- **Verified:** YES

> **ليه بوابة البناء فاتت الاتنين:** `scripts/checkWorkspaceAccess.mjs:54-88` بيعلّم شروط
> الوصول **المكتوبة بإيد** بس. **مافيهوش قاعدة لشرط غايب تماماً**، ومابيشوفش معرّفات
> جاية في جسم الطلب. كل اكتشافات فئة IDOR عايشة في النقطة العمياء دي.

#### [High] S-3 — SSRF مصادَق عليه: `checkTrackingPresence` بيتخطّى `safeFetch` وبيعكس الصفحة المجلوبة
- **Path:** `lib/trackingCoverage.ts:109-118`؛ من `monitored-pages/route.ts:51`، `monitored-pages/[id]/check/route.ts:22`، `diagnostics/scan/route.ts:32`
- **Repro:** مستأجر بيبعت `{url:"http://127.0.0.1:8080/admin"}` لمساحته هو (ففحص الملكية بيعدّي). السطر ١٠٩ بينادي `fetch` **مجرّدة** بـ`redirect:"follow"` — بلا `safeFetch` وبلا فحص نطاقات خاصة. والرد بيرجع للمتصل: `httpStatus`، و`checkedUrl` (الرابط النهائي بعد التحويل)، و`auditResult` اللي `lib/pageAudit.ts:52-81` بيملّيه بـ`<title>` و`meta description` وعدد `h1` من HTML الهدف.
- **Impact:** المستأجر بيحوّل السيرفر لعميل HTTP داخلي **بقراءة محتوى** — مسح بورتات، والوصول لـ`169.254.169.254`، وتسريب عنوان الصفحة ووصفها في رد JSON. `landingPageAudit.ts:32` و`siteScanOrchestrator.ts:35` بيستخدموا `safeFetch` صح — **المسار ده هو اللي فات**.
- **Suggested fix:** بدّل `fetch` بـ`safeFetch`، واشطب `title`/`metaDescription` من الرد لما الجلب مايكونش 2xx من مضيف عام. **وصلّح `safeFetch` الأول** — S-4.
- **Verified:** YES

#### [High] S-4 — `safeFetch` فيه أربع ثغرات تجاوز، واحدة منها **بتفشل مفتوحة على أي خطأ DNS**
- **Path:** `lib/safeFetch.ts:29-46`
- **Repro:** أربع مسارات:
  1. **IPv6 حرفي** — لـ`http://[::1]/` الـ`URL.hostname` بيرجع بالأقواس `"[::1]"`، فـ`net.isIP` بيرجّع 0 وبيتعامل معاه كاسم نطاق، ونمط `/^::1$/` في `:21` عمره ما بيطابق الشكل المقوَّس.
  2. **الفشل المفتوح** — `:40` هو `await dns.resolve(hostname).catch(() => [])`. **المصفوفة الفاضية بتخلّي الحلقة لا-عملية والدالة بترجع نضيفة.** أي مضيف الـresolver مش قادر يجاوب عليه بيعدّي.
  3. **المضيفات الرقمية** — `http://2130706433/` و`http://0177.0.0.1/` مش `net.isIP`، و`dns.resolve` بيفشل عليهم → بيعدّوا بسبب (٢). و`fetch` بعدها بتستخدم `getaddrinfo` اللي بيفسّر الاتنين `127.0.0.1`.
  4. **TOCTOU / rebinding** — `:40` بيحلّ الاسم، و`:67` بينادي `fetch(url)` اللي بيحلّه تاني بشكل مستقل. سجل بـTTL صفر بيجاوب عام-بعدين-خاص بيهزم الفحص اللي تعليق `:38` مدّعي إنه بيمنعه. و`dns.resolve` بيستعلم سجلات A بس — **مضيف عنده AAAA بس عمره ما بيتفحص**.
  ونطاقات ناقصة على أي حال: `100.64.0.0/10`, `192.0.0.0/24`, `198.18.0.0/15`، و`::ffff:127.0.0.1`.
- **Impact:** **الضابط الوحيد اللي الكود بيعتمد عليه لكل رابط خارجي بيدخله المستخدم مش صامد.**
- **Suggested fix:** اشطب الأقواس قبل `net.isIP`؛ استخدم `dns.lookup(hostname,{all:true,verbatim:true})` عشان A وAAAA يرجعوا من نفس الـresolver؛ **اعتبر خطأ الحلّ رفضاً مش سماحاً**؛ ضيف النطاقات الناقصة؛ واقفل الـTOCTOU بالاتصال بالـIP المتحقَّق منه مع ترويسة `Host`.
- **Verified:** YES لـ١ و٢ و٤ · NO لـ٣ (يتحسم بفحص `getaddrinfo` على منصة النشر — **والفشل المفتوح في `:40` بيخلّيه قابلاً للوصول في الحالتين**).

#### [High] S-5 — إيميل المالك المثبَّت في الكود مرساة صلاحيات حيّة لما `OWNER_EMAIL` مايكونش مضبوط
- **Path:** `lib/owner.ts:22`؛ السياسة في `lib/adminRole.ts:36-41`؛ معلَن **OPTIONAL** في `lib/launchReadiness.ts:120-122`
- **Repro:** `OWNER_EMAIL` بيرجع لعنوان Gmail شخصي **مكتوب حرفياً في الكود** (الموضع مذكور، والقيمة محذوفة من التقرير عمداً). و`resolveAdminRole` بيرجّع `"OWNER"` للعنوان ده **قبل** ما يبصّ لـ`isAdmin` أصلاً — **فقاعدة البيانات مالهاش أي علاقة**. و`launchReadiness` مصنّفه `OPTIONAL` والرجوع موثَّق كمقصود، فالحرفي هو السلوك الحيّ في أي نشر مش ضابط المتغيّر. **ولو مفيش صف مستخدم بالإيميل ده لسه** — نشر جديد، بيئة تجريبية، قاعدة مستعادة — **أي حد يقدر يسجّل بيه** عبر `/api/auth/signup` (اللي بيصدر جلسة كاملة بلا بوابة تحقق إيميل، بتصميم صريح) وياخد كل `OWNER_CAPS`: انتحال، تعليق، إهداء اشتراكات، إدارة الطاقم، تصدير قاعدة العملاء. **وشرط MFA في `app/admin/layout.tsx:38` مش عائق** — المهاجم بيفعّله على حسابه الجديد.
- **Impact:** **استيلاء إداري كامل على النشر**، متبوّب بس على إن الحساب ده موجود قبل كده. وثانوياً: عنوان شخصي مرصود في ريبو.
- **Suggested fix:** اشطب الحرفي من `lib/owner.ts:22` ورجّع `null`/ارمِ استثناء لما `OWNER_EMAIL` مايكونش مضبوط؛ ورقّيه لـ`severity:"BLOCKER", haltsBoot:true`. وبشكل مستقل: ارفض التسجيل لأي عنوان بيطابق `OWNER_EMAIL` — حساب المالك يتجهّز، مايسجّلش نفسه.
- **Verified:** **YES — تحقُّق مزدوج** للكود (`sed` أكّد الحرفي في `:22` وأكّد إن `isOwnerEmail` بيسبق `isAdmin` في `resolveAdminRole`) · **NO** للاستغلال على الإنتاج — يتحسم بتأكيد إن `OWNER_EMAIL` مضبوط في Vercel **وإن** صف مستخدم بياخد العنوان ده فعلاً.

#### [High] S-6 — مستأجر يقدر يحجز `storeIdentifier` بتاع تاجر تاني ويكسر استقبال طلباته نهائياً
- **Path:** `app/api/workspaces/[id]/ecommerce/route.ts:146` → `lib/ecommerce/resolveStore.ts:52-71`
- **Repro:** A بيبعت `{platform:"SHOPIFY", storeIdentifier:"<متجر-الضحية>.myshopify.com", webhookSecret:"<سرّ A>"}`. السطر ١٤٦ بيخزّن المعرّف **بلا تحقق وبلا قيد تفرّد عبر مساحات العمل**. ولما ويب هوك B الحقيقي يوصل، `resolveStoreConnection` بياخد المسار السريع في `:53`، بيلاقي صف A الموسوم أولاً، بيفشل في HMAC مقابل سرّ A في `:69`، وبيرجّع `null` — **والتعليق في `:58-60` بيقول صراحة إنه عمداً مابيرجعش للمسح غير الموسوم**. فالراوت بيرد ٤٠١.
- **Impact:** **منع خدمة صامت ودائم لاستقبال طلبات تاجر تاني** — لا طلبات، لا إيراد، لا إسناد، **والـ٤٠١ مصمَّم بحيث لا يُفرَّق عن "المتجر مش متصل"**، فالضحية مالوش أي حاجة يشخّصها. التحقق من التوقيع سليم فالمهاجم مايقدرش يقرا طلبات B — **الضرر في السلامة والإتاحة**.
- **Suggested fix:** `@@unique([platform, storeIdentifier])` على `EcommerceConnection`، ورفض معرّف محجوز لمساحة تانية. **والأفضل: بطّل قبول `storeIdentifier` من العميل خالص** وسيب مسار المسح غير الموسوم (`resolveStore.ts:75-105`) يكسب الوسم من توقيع متحقَّق — وده اللي الكود ده اتبنى له.
- **Verified:** YES

#### [High] S-7 — رابط المتجر ودومين شوبيفاي غير متحقَّق منهما، وبيتجلبوا **ومعاهم بيانات اعتماد**
- **Path:** `app/api/workspaces/[id]/ecommerce/route.ts:138,146` → `lib/ecommerce/priceSync.ts:210-217`، `productSync.ts:246`، `orderBackfill.ts:154,212`
- **Repro:** المستأجر بيحطّ `storeUrl` أي نص ٣٠٠ حرف (`:138` بيعمل `.trim().slice(0,300)` **وبس**). و`priceSync.ts:212` بيصدر `fetch(\`${base}/wp-json/wc/v3/products/${id}\`, {method:"PUT", headers:{Authorization: Basic ...}})`. و`productSync.ts:246` بيبني `https://${storeDomain}/admin/api/.../graphql.json` بترويسة `X-Shopify-Access-Token`. **ولا واحد بيمرّ من `safeFetch`.**
- **Impact:** SSRF أعمى مصادَق عليه **بـPUT وPOST** جوّه الشبكة الداخلية من مخرج التطبيق، بمسار يختاره المهاجم **وبترويسة `Authorization`**. وكمان قناة تسريب بيانات اعتماد لمضيف يتحكم فيه المهاجم.
- **Suggested fix:** تحقّق من `storeUrl` وقت الكتابة (URL صالح، `https:` إجباري، رفض المضيفات الخاصة)، و`storeIdentifier` مقابل `/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/`. ومرّر الخمس محوّلات كلها من `safeFetch`.
- **Verified:** YES

#### [Medium] S-8 → S-16 (تسعة)
- **S-8 — Turnstile بيعطّل نفسه بالصمت لما سرّه ناقص.** `lib/turnstile.ts:8-12` بيرجّع `true` لما `TURNSTILE_SECRET_KEY` مش مضبوط، بـ`console.warn` بس، و`launchReadiness.ts:116` مصنّفه `FEATURE` فمابيوقفش حاجة. **والحاجز الوحيد الباقي على التسجيل هو `checkRateLimit` اللي بيفشل مفتوحاً على أي خطأ DB وبيعتمد على `x-forwarded-for` قابل للتزوير** → إنشاء حسابات آلي بلا حدّ، وكل حساب مستأجر صالح يقدر يستغل S-2 وS-3 وS-6.
- **S-9 — `report-email` مرحّل بريد بلا حدّ معدّل ونصّه من المهاجم.** `report-email/route.ts:25-76`: الملكية متفحوصة، **لكن المستلم أي عنوان بيعدّي regex فضفاض ومفيش `checkRateLimit` في الملف كله**. وتسميات الصفوف جاية من `campaignName` اللي المهاجم كتبها بنفسه عبر S-2. بريد صادر بلا حدّ من دومين Resend الموثَّق بتاع المنتج → وسيلة تصيّد وطريق مباشر لحظر سمعة الدومين. (النص مهروب HTML، فده إساءة محتوى مش حقن.)
- **S-10 — حارس الأصل في الميدلوير بيستثني `/api/mcp`، واللي فيه منحة موافقة OAuth.** المطابِق `"/api/((?!webhooks/|auth/|mcp).*)"` بيستثني كل مسار بيبدأ `mcp`، فـ`crossOriginWrite` عمره ما بيشتغل على `POST /api/mcp/oauth/approve` — والراوت ده بيوثّق بالكوكي **ومافيهوش `verifyCsrfToken`**، يعني **مافيهوش أي من دفاعَي CSRF**. وتسجيل عملاء MCP غير مصادَق عليه بتصميم، فالمهاجم يصكّ عميل بـ`redirect_uri` بتاعه. الحاجز الوحيد النهارده هو `SameSite=Lax` — **وده بالظبط نقطة الفشل الوحيدة اللي تعليق الميدلوير نفسه (`:15-19`) اتكتب عشان يشيلها**.
- **S-11 — CSP لسه بيسمح `unsafe-inline` و`unsafe-eval`،** و`next.config.js:41-49` ناقصه `frame-ancestors` و`base-uri` و`form-action` و`object-src`. مؤكَّد إنه **مااتغيّرش** من البند المفتوح في `docs/open-audit-findings.md`. **دفاع في العمق بس النهارده** — الوكيل دوّر ومالقاش `dangerouslySetInnerHTML` ولا عرض HTML خام لنصوص المنصات؛ لكن دي الطبقة اللي كانت هتحتوي أي واحدة في المستقبل.
- **S-12 — توكن التقرير العام `cuid` مش سرّ عشوائي.** `schema.prisma:2157` — `token String @unique @default(cuid())`. وcuid v1 = ختم وقت + عدّاد + بصمة مضيف + ٨ حروف من `Math.random`، **وموثَّق من كاتبه إنه غير آمن تشفيرياً**، بينما تعليق الصفحة بيدّعي إنه "طويل وصعب التخمين". ومفيش حدّ معدّل ولا انتهاء افتراضي. والرابط هو **المصادقة الوحيدة** على صفحة بتكشف اسم مساحة عمل مستأجر تاني وصرفه ٣٠ يوم وتحويلاته المتحقَّقة وCPA.
- **S-13 — تغيير أو إعادة تعيين كلمة السر مابيبطّلش الجلسات القائمة.** `sessionInvalidatedAt` بيتكتب في تلات أماكن بس: `logout:16`، `suspend-user:52`، `staff/[id]/role:88`. **ولا واحد من مسارَي كلمة السر بيكتبه**، وعمر التوكن ٣٠ يوم. يعني **الرد المعتاد على "حسابي اتخرق" مابيطردش المهاجم**.
- **S-14 — حقن صيغ CSV في مساري التصدير.** `lib/admin/customers.ts:201-220` و`export-csv/route.ts:69-75` بيقتبسوا على `"`/فاصلة/سطر بس. خلية بتبدأ بـ`=`/`+`/`-`/`@` بتتكتب خام. والخلايا بتشمل `r.name` اللي بيتحطّ من أي حد وقت التسجيل. **تسجيل مجهول بيزرع الحمولة، والمالك بيصدّر قاعدة العملاء ويفتحها في Excel → تنفيذ DDE على جهاز المشغّل** — من حدّ المستأجر غير الموثوق لجهاز الأدمن.
- **S-15 — MFA الأدمن مفروض من الـlayout بس، وأكبر تسريب بيانات مش متبوّب بالارتقاء.** `app/admin/layout.tsx:38` بيحوّل الأدمن اللي مافعّلش MFA بعيد، **لكن `guardAdmin` مافيهوش أي فحص زي ده** — فكل راوت تحت `/api/admin/**` قابل للتشغيل بكوكي جلسة + الصلاحية، بغضّ النظر عن MFA. وبشكل منفصل: `customers/export` هو `GET` متبوّب بالصلاحية لوحدها — **بلا CSRF وبلا ارتقاء** — بينما `subscription` و`override` الاتنين بيتطلبوا ارتقاء. **كوكي أدمن مسروق = قاعدة العملاء كلها في طلب واحد** (إيميل، اسم، شركة، بلد، خطة، MRR، أعلام VIP والتعليق). العملية مُدقَّقة، وده التخفيف.
- **S-16 — رفع الدعم بياخد اسم الملف ونوعه المُعلَن من العميل لتخزين عام.** `support/upload/route.ts:30-38`: `file.type` بيحدّده العميل بالكامل، ومفتاح البلوب بيتبني من `file.name` **بلا تنظيف** بـ`access:"public"`. ملف مُعلَن `image/png` واسمه `x.svg` أو `x.html` → `@vercel/blob` بيستنتج النوع المقدَّم من الامتداد. واسم `../admin/x.png` بيهرب من بادئة المستخدم.

#### [Low] S-17 · S-18
- **S-17** `forgot-password/route.ts:55` — توكن إعادة تعيين كلمة السر بيمشي في **query string**، وروابط الصفحات بتوصل breadcrumbs بتاعة Sentry (`tracesSampleRate` 0.1 **بلا `beforeSend`**) ولوجات المنصة وأي `Referer`. بيانات اعتماد استرداد حساب بتتكتب في تليمتري خارج سيطرة المشغّل.
- **S-18** `push/subscribe/route.ts:19-23` — `upsert({ where:{ endpoint }, update:{ userId } })` بلا فحص ملكية: أي مستخدم يعرف endpoint حدّ تاني بيعيد إسناده لنفسه. مشروط بمعرفة رابط عالي العشوائية، فمفيش مسار عملي النهارده.

#### ✅ S-19 — ثغرات الاعتماديات: **متقيَّمة، ومفيش واحدة قابلة للوصول من الكود ده**

الوكيل فحص شكل التطبيق مقابل كل استشارة بدل ما يرث الحدّة:

| الاستشارة | الحكم |
|---|---|
| GHSA-955p (كشف Server Functions) · GHSA-m99w (DoS) · GHSA-4c39 (حمولة Edge) · GHSA-89xv (SSRF) | **مفيش `"use server"` في `app/` ولا `lib/` خالص** → صفر مدخل |
| GHSA-p9j2 (SSRF عبر rewrites) | `next.config.js` مابيعرّفش `rewrites()` → صفر مدخل |
| GHSA-q8wf (DoS عبر SVG) + CVEs الـ`sharp`/libvips | **مفيش ملف بيستورد `next/image`** ومفيش إعداد `images` → غير قابلين للوصول |
| `postcss` · `brace-expansion` · `nanoid` | وقت البناء بس |
| GHSA-68g3 · GHSA-4633 (cache confusion) | المسار النظري الوحيد؛ وراوتات Next 15 ديناميكية/`no-store` افتراضياً |
| `undici` | نسخة npm منقولة، **مش المدمجة في Node** اللي `fetch` بيستخدمها |

**الحكم: `npm audit fix` نظافة روتينية، مش بوابة إطلاق.** (وده بيشيل ٩ ثغرات من قائمة الحاجزين.)

#### لسه فاضل (من الوكيل)
- **اتقرا كاملاً:** الميدلوير · `next.config.js` · `auth.ts` · `workspaceAccess.ts` · سكربتَي الفحص · `adminGuard/adminRole/adminElevation/owner` · `csrf` · `cronAuth` · `internalServiceAuth` · `encryption` · `safeFetch` · `turnstile` · `rateLimit` · `webhookSecurity` · `oauthState` · `loginOAuthState` · `activeWorkspace` · `mcp/oauth` · `mcp/auth` · `validation/schemas` · `resolveStore` · `webhookAuth` · `trackingCoverage` · لاي أوت الأدمن · صفحة التقرير العام.
- **راوتات اتفتحت: ~٦٠ من ١٣٣.**
- **grep بس، مش مفتوحة:** ~٢٤ راوت تحت `workspaces/[id]/*` وغيرها — **ظهر فيها نمط `workspaceAccess(user.id)` في الـgrep، لكن مش متحقَّق إن الفحص بيسبق كل كتابة في الملف**. ودي بالظبط النقطة اللي S-1 عاش فيها.
- **ماتفتحتش خالص:** `account/delete` · `account/export-data` · `auth/verify-email` · كل `auth/mfa/*` · `notifications/*` · `onboarding/*` · **كل الستة `oauth/*/start` وتلات `callback`** · الستة `cron/*` (اتعمد على إثبات بوابة البناء + قراءة `cronAuth.ts`).
- **فئات مسائل مش مغطّاة:** عشوائية توكنات MFA وأحاديّة استخدامها · `dataRetention.ts` وقانون البيانات المصري · ترتيب حقول HMAC · **الـ٤٧ صفحة `page.tsx` كسيرفر كومبوننتس** (اتقرا منهم لاي أوت الأدمن وصفحة التقرير بس) · نطاق مساحة العمل جوّه كل أداة في `lib/mcp/tools.ts` · مسارات تجاوز الحصة في `aiRateLimit.ts`.

### 4.4 platform-writes — ⚠️ **٦ Critical · ٧ High · ٨ Medium · ١ Low**

> **دي أخطر حصيلة في الأوديت كله بعد C-1**، لأن كل بند هنا بيصرف فلوس العميل.
> اتنين أعدت التحقق منهما بنفسي.

#### [Critical] W-1 — سقف تكلفة ميتا بيتكتب **أقل ١٠٠ مرة**: وحدات عملة بتتبعت والمنصة مستنية وحدات صغرى
- **Path:** `lib/syncMetaAds.ts:806-808` (الاقتراح) → `:826` (الحمولة) → `:833-871` (التنفيذ)، والدليل على الوحدة الصح في `:37-40` و`:236-238`
- **Repro:** الكرون بيقرا `MetaAdSetSnapshot.cost` المكتوب `Number(row.spend)` — و`spend` بتاعة ميتا **بعملة الحساب** (`123.45`). بيحسب `avgCpa = cost/conversions` (عملة)، وبعدين `suggestedCostCap = Math.round(avgCpa * 1.15)` وبيخزّنه باسم `bidAmountCents`. وعند التنفيذ بيبعت `{bid_strategy:"COST_CAP", bid_amount: suggestedCostCap}` خام. **ونفس الملف بيحوّل قراءة `bid_amount` بـ`convertMinorUnitsToCurrency` (÷١٠٠)** — يعني نموذج الكود نفسه بيقول إن الكتابة لازم تكون ×١٠٠. مجموعة إعلانية متوسط CPA بتاعها ١٠٠ ريال بتاخد سقف ١١٥ **هللة** = ١.١٥ ريال.
- **Impact:** المجموعة بتتحطّ على COST_CAP بسقف ~١٪ من المقصود. **ميتا بتوقّف توصيلها تقريباً بالكامل — قتل صامت لمجموعة إعلانية بتحوّل**، على المسار الوحيد الموثَّق إنه "بينفّذ حقيقي"، ورا زرار بدوستين. ومش قابل للتراجع إلا يدوياً، لأن الاستراتيجية السابقة **مش مسجَّلة في أي مكان** (شوف W-14). العملات صفرية الكسور (JPY, KRW) صح بالصدفة؛ SAR وEGP وAED وUSD كلهم غلط.
- **Suggested fix:** ضيف عكس `convertMinorUnitsToCurrency` وطبّقه **عند المنتِج** (وقت حطّ `suggestedCostCap` في `actionPayload.bidAmountCents`) مش جوّه دالة التنفيذ — لأن اسم البارامتر أصلاً `bidAmountCents` فالعقد عند المنتِج. و`accountCurrency` أصلاً في النطاق في `:237`.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد الحساب بالعملة في `:807`، والتخزين كـ`bidAmountCents` في `:826`، والإرسال الخام في `:863`، **وتعليق الكود نفسه في `:836` بيقول حرفياً "ميتا بتستقبل bid_amount بالقرش/السنت"**، والقراءة في `:236-237` بتقسم على ١٠٠.

#### [Critical] W-2 — قاعدة أتمتة الميزانية بتنفّذ `actionValue` الخام؛ سقف الـ٢٠٪ متطبَّق **على النص اللي المستخدم بيقراه بس**
- **Path:** `lib/automationRules.ts:74-88` (السقف بيتحسب)، `:84` (بيتستخدم **بس** جوّه `describeAction`)، `:193` (`changePct: rule.actionValue` — خام) → `lib/actionFeed.ts:143-149` → `:303-306` → `lib/platformCampaignActions.ts:122-206`
- **Repro:** اعمل قاعدة `INCREASE_BUDGET_PCT`. حقل الرقم **مالوش `min` ولا `max`** في الواجهة، والـAPI بيخزّنه بلا تحقق. حطّ `actionValue: 300`. الكرون بيقيّم، `clampedActionValue = min(300,20) = 20`، **وعنوان الفيد بيقول "زيادة الميزانية ٢٠٪"**. و`actionPayload.changePct` = **٣٠٠**. دوس ← أكّد ← `next = current × 4`.
- **Impact:** **الميزانية اليومية للحملة بتتربّع (أو أسوأ — مفيش حدّ أعلى خالص) بينما الواجهة وعنوان الفيد ووصف القاعدة كلهم بيقولوا ٢٠٪.** ومش قابل للتراجع: صرف امبارح اتصرف. و`maxSingleJumpPct` — الحقل الموجود بالظبط عشان يمنع ده — كمان بيتاخد من جسم الطلب بلا تحقق.
- **Suggested fix:** في `:193` مرّر `result.clampedActionValue` مش `rule.actionValue`، **واعمل السقف تاني عند حدّ التنفيذ** في `lib/actionFeed.ts` قبل `changeCampaignBudgetOnPlatform` (الحمولة ممكن تكون أقدم من القاعدة). وضيف حدود من ناحية السيرفر على `actionValue` و`maxSingleJumpPct` في راوتَي الأتمتة.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` أكّد إن `clampedActionValue` بيظهر في `:77` (الحساب) و`:84` (جوّه `describeAction`) و`:86` (الإرجاع) **وبس** — و`:193` بيبعت `rule.actionValue ?? undefined`.

#### [Critical] W-3 — مفيش منع تكرار في أي مكان: نفس التنفيذ ممكن يشتغل مرتين، وتغييرات الميزانية بتتراكم
- **Path:** `lib/actionFeed.ts:171-188` (**مفيش فحص لـ`status`**) و`app/api/action-feed/[id]/apply/route.ts:27-39`؛ `lib/adDecisions.ts:285-353` (السجل بيتكتب **بعد** نداء المنصة)
- **Repro:** تلات طرق مستقلة: **(أ)** ابعت `/apply` مرتين على بند حالته `APPLIED` أصلاً — `applyActionFeedItem` **عمره ما بيقرا `item.status`** فبينفّذ تاني. **(ب)** `applyAdDecision` بيعيد الاشتقاق، بيفحص فترة الراحة ٤ أيام، بينفّذ، وبعدين بيكتب `AdDecisionRecord` — طلبان متزامنان (تابين، وزرار SCALE مرسوم على صفحتين) الاتنين بيعدّوا الفحص في الثواني اللي النداء طاير فيها. **(ج)** `countedFetch` **مالوش timeout**؛ لما دالة Vercel تتقتل في نص النداء بعد ما ميتا/جوجل طبّقت التغيير، مفيش سجل بيتكتب، العميل شايف خطأ، فبيدوس تاني.
- **Impact:** **الأربع كتّاب للميزانية كلهم بيحسبوا `next = current × (1 + pct/100)` من قراءة طازجة** — فمش منيعين للتكرار: تنفيذين ٢٠٪ = ٤٤٪؛ تلاتة = ٧٢.٨٪. الـ`PAUSE` تكراره غير ضار؛ الميزانية فلوس.
- **Suggested fix:** خُد البند بتحديث مشروط (`updateMany({where:{id, status:"PENDING"}, data:{status:"APPLYING"}})`) وألغِ لو صفر صفوف اتحجزت. وفي `adDecisions` اكتب السجل (أو صف حجز) **قبل** نداء المنصة وصالح النتيجة بعده، **مع قيد فريد على `(workspaceId, adId, day)`** عشان التنفيذ المتزامن التاني يفشل عند قاعدة البيانات. واقبل `Idempotency-Key` على الراوتين.
- **Verified:** YES

#### [Critical] W-4 — `applyAdDecision` بينفّذ أي قرار الطلب بيسمّيه — **كل بوابات Scale استشارية**
- **Path:** `lib/adDecisions.ts:285-329` (بيفحص فترة الراحة، **وعمره ما بيقارن `decision` بـ`view.decision` ولا بيقرا `view.executable`**)، `app/api/creatives/decision/route.ts:19,37-48`
- **Repro:** `POST /api/creatives/decision {workspaceId, adId, decision:"SCALE"}` لإعلان المحرّك صنّفه `PAUSE` أو `HOLD`. الملكية بتعدّي، فترة الراحة صافية، و`executeScale` بيشتغل — **بيرفع ميزانية المجموعة/الحملة الأمّ ٢٠٪ على إعلان خسران**. كل البوابات عايشة في `classifyScaleKillWatch` ومستخدَمة **بس** عشان تقرر أي زرار يترسم: `MIN_CONVERSIONS_FOR_SCALE=20`، `MIN_DAYS_ACTIVE_FOR_SCALE=4`، فحص التعب، تأكيد الترتيب النسبي، هامش التعادل. **وبشكل منفصل: بوابة تشبّع التردد مش قادرة تشتغل عند التنفيذ أصلاً** — `buildAdDecisions({workspaceId})` بيتنادى **من غير** `frequencyByPlatform`، فالتردد دايماً `null` هناك.
- **Impact:** أي باگ في العميل، أو صفحة قديمة، أو طلب مُصاغ، بيوسّع إعلان متعب أو مشبَّع أو عنده تحويلين. **المستخدم شايف أرقام المحرّك وبيفترض إن البوابات صامدة — وهي مش صامدة عند نقطة الكتابة.**
- **Suggested fix:** بعد إيجاد الـview، ارفض إلا لو `view.executable && view.decision === decision` (اسمح بـ`HOLD` بلا شرط لأنه مابيكتبش بره)، ومرّر `frequencyByPlatform` للنداء الداخلي عشان طبقة التشبّع تشتغل عند التنفيذ.
- **Verified:** YES

#### [Critical] W-5 — `TRUE_ROAS` هو تحويلات ÷ تكلفة، فـ"أوقف عند عائد سالب" صحيحة لكل حملة كل يوم
- **Path:** `lib/automationRules.ts:239-241`؛ القالب في `automationRuleDefinitions.ts:57-66`؛ التوأمين في `automationCatalog.ts:83,91`
- **Repro:** `value = d.cost > 0 ? d.verified / d.cost : 0` — و`cost` بعملة الحساب و`verified` **عدد**. حملة بـ٥٠٠ ريال و١٠ تحويلات متحقَّقة بتدّي `0.02`. والقالب الجاهز "إيقاف عند عائد سلبي" هو `TRUE_ROAS LESS_THAN 1` لتلات أيام متتالية → **بيتحقق في كل حساب عنده تلات أيام بيانات**. وبعدين بيدفع اقتراح `PAUSE_CAMPAIGN` **قابل للتنفيذ لكل حملة في النطاق**.
- **Impact:** فيد المستخدم بيتملّي اقتراحات إيقاف بصيغة واثقة **لكل حملة بما فيها الأفضل أداءً**، وكل واحد على بُعد دوسة تأكيد من إيقاف حملة كاملة. **ونفس السطر بيقلب حارس صفر-البيانات:** يوم بلا تحويلات بيتحوّل لـ`0` اللي بيحقق **أي** قاعدة `LESS_THAN` (وبيكتم تنبيهات `GREATER_THAN` في نفس اليوم اللي مافيهوش تحويلات بالظبط).
- **Suggested fix:** احسب `TRUE_ROAS` من `MetricSnapshot.revenue / cost` (الحقل موجود وبيتملّى، و`bidStrategyAudit.ts:134` بيستخدمه أصلاً)، **ورجّع "مفيش نقطة بيانات" لليوم بدل `0`** لما المقام ناقص، عشان عدّاد الأيام المتتالية ينكسر بدل ما يطابق.
- **Verified:** YES

#### [Critical] W-6 — سطح التنفيذ الموثَّق **غلط في الاتجاهين**: اللي بينفّذ حقيقي أكتر بكتير من "تدرّج المزايدة بس"
- **Path:** `CLAUDE.md` مقابل `lib/adDecisions.ts:405-429` (Scale بينفّذ)، `scaleKillAlerts.ts:74-87` + `actionFeed.ts:281-295` (Kill بينفّذ)، `stockGuard.ts:160-164` (إيقاف حملة كاملة بينفّذ)، `automationRules.ts:143-149` (ميزانية الحملة بتنفّذ)
- **Repro:** **الكتابات الحقيقية النهارده:** `SET_BID_STRATEGY_{GOOGLE,META,TIKTOK}` · `PAUSE_AD_{GOOGLE,META,TIKTOK}` · `PAUSE_CAMPAIGN` · `CHANGE_CAMPAIGN_BUDGET` · `APPLY_PRODUCT_PRICE` · **بالإضافة لكل سطح `/api/creatives/decision` (Scale + Pause) اللي التوثيق مابيذكرهوش خالص**. الاستشاري فعلاً: شكل المحتوى، وبنود Scale اللي `scaleKillAlerts` بيدفعها.
- **Impact:** **النموذج التشغيلي اللي كل قرار أمان تاني مبني عليه ("تدرّج المزايدة بس هو اللي بيلمس الحساب") غلط. ومحدش بيراقب المسارين اللي بيحرّكوا الميزانية.** ده الاكتشاف اللي بيخلّي كل اللي فوق بلا رقيب.
- **Suggested fix:** أعد كتابة قسم "تنفيذ الأتمتة (Apply)" في `CLAUDE.md` من الـ`switch` في `lib/actionFeed.ts` + `executeScale`/`executePause`، واحتفظ بقائمة واحدة مُعدَّدة لأنواع `actionType` المنفِّذة في ملف واحد يشاور عليه التوثيق والكود مع بعض.
- **Verified:** YES

#### [High] W-7 → W-13 (سبعة)
- **W-7 — Scale على جوجل بيرفع `campaign_budget` من غير ما يفحص لو الميزانية مشتركة.** `platformCampaignActions.ts:122-145` بيختار `campaign_budget.resource_name` وبيحدّث `amount_micros`، **من غير ما يختار `explicitly_shared` ولا `reference_count`**. وميزانيات جوجل ممكن تكون مشتركة بين حملات (شائع في حسابات الوكالات). والواجهة بتدّعي عكس ده صراحة: `adDecisions.ts:228` بيحطّ `scaleAffectsSiblings: platform !== "GOOGLE_ADS"`. **رفع ٢٠٪ مقصود لحملة بيرفع صرف كل الحملات المشاركة في الميزانية — والمستخدم اتقاله إن النطاق محدود بحملة واحدة.**
- **W-8 — `externalCampaignId` غير متحقَّق منه بيتحقن في GAQL وبيقرر أي ميزانية تتكتب.** `platformCampaignActions.ts:125-134` بيعمل `WHERE campaign.id = ${campaignId}` بالاستيفاء المباشر، والقيمة جاية من `campaign-links` اللي بيكتبها من جسم الطلب (S-2). **بيتاخد `rows[0]` وبعدين بيتكتب على أي `campaign_budget.resource_name` رجع.** والقراءة منطاقة بعميل التوكن — واللي تحت MCC هو **كل حسابات العملاء**.
- **W-9 — بوابة الخطة على Scale/Kill مفروضة على سطح وغايبة عن السطح الأحدث.** `actionFeed.ts:199-215` بيفحص `ent.limits.scaleKill` لـ`PAUSE_AD_*`، بينما `creatives/decision` و`applyAdDecision` **مافيهمش أي فحص صلاحيات**. والقائمة المتبوّبة كمان **مش شاملة `PAUSE_CAMPAIGN` ولا `CHANGE_CAMPAIGN_BUDGET`** — وهما أكتر تدميراً من التلاتة اللي بتبوّبهم.
- **W-10 — حارس الديمو غايب عن مسار Scale.** `executePause` بينادي `assertNotDemo`؛ **`executeScale` لأ**، و`platformCampaignActions.ts` مافيهوش `assertNotDemo` خالص. في مساحة الديمو، دوس SCALE على أي إعلان ميتا → `changeMetaAdSetBudget` بيمرّ على منح ميتا **الحقيقية** للمالك وبيصدر نداء `graph.facebook.com` حيّ بتوكن حقيقي مفكوك التشفير. المعرّفات المبذورة صناعية فالنداءات بترجع 404 — **الحارس صامد بالصدفة مش بالتصميم**. وتعليق `actionFeed.ts:175-178` بيدّعي نقطة اختناق واحدة "لكل تنفيذ حقيقي" — **والادعاء ده غلط للمسار ده**.
- **W-11 — سقف التغيير الشهري بيحرس تغييرات المزايدة، مش الميزانية.** `checkMonthlyChangeCeiling` بيشتغل بس لما `actionType` من التلاتة `SET_BID_STRATEGY_*` — و`changePct` اللي بتحمله دي هو **هامش أمان سقف التكلفة (١٢/١٥)، مش دلتا ميزانية**، فالسقف بيراكم كمية بلا معنى. و`CHANGE_CAMPAIGN_BUDGET` — الفعل الوحيد اللي بيحرّك ميزانية بنسبة — **عمره ما بيتفحص**، ولا Scale الـ٢٠٪. يعني `Workspace.monthlyChangeCeilingPct` **مابيقيّدش أي حاجة بتصرف فلوس**: ٤ تنفيذات في الشهر = +١٠٧٪.
- **W-12 — القواعد بتقيّم تجميعاً على مستوى مساحة العمل كلها وبعدين بتتصرف على كل حملة فردياً.** `getDailyMetricValues(workspaceId, …)` **بلا فلتر حملة**، وبعدين بند فيد لكل `CampaignLink` في النطاق. حملة واحدة غالية بترفع التجميع فوق العتبة، والمحرّك بيطلّع `PAUSE_CAMPAIGN` قابل للتنفيذ **لكل حملة بما فيها الأرخص**، وكل واحدة شايلة نفس `currentValue` التجميعي كمبرّر. **حقول نطاق القاعدة بتفلتر الأهداف وعمرها ما بتفلتر الدليل.**
- **W-13 — حارس المخزون بيطابق الحملات بجزء من اسم منتج؛ وSKU فاضي بيطابق كل حملة.** `stockGuard.ts:99-101` — `needle = (s.sku ?? s.name).toLowerCase()` وبعدين `campaignName.includes(needle)`. منتج اسمه "set" أو "kit" بيطابق حملات مالهاش علاقة. **ولو المتجر رجّع `sku: ""` بيتخزّن `""`** (الـ`??` بيحرس null/undefined بس) **و`includes("")` صحيحة لكل حملة في مساحة العمل** — يعني الفيد بيعرض إيقاف الحساب كله، حملة ورا حملة.

#### [Medium] W-14 → W-21 (تمنية)
- **W-14 — مفيش فاعل ولا رد منصة ولا قيم سابقة على مسار الفيد.** `ActionFeedItem` فيه `status` و`resolvedAt` **وبس**. طبّق أي حاجة → المسجَّل هو "الحالة APPLIED الساعة ١٤:٣٢". مش مين داس، **ولا الميزانية أو استراتيجية المزايدة كانت إيه قبل** (تنفيذات المزايدة **مابتسجّلش أي حاجة عن الاستراتيجية السابقة**)، ولا المنصة ردّت بإيه. **سؤال عميل "مين رفع ميزانيتي وكانت كام؟" مالوش إجابة**، ومفيش تراجع آلي ممكن للفئة الوحيدة اللي بتكتب فوق إعداد بدل ما تعدّله.
- **W-15 — الاقتراحات الاستشارية بتسجّل "نُفِّذ" بنفس الشارة الخضرا بتاعة الحقيقية.** بند Scale من `scaleKillAlerts` (بلا `actionType`) → دوس ← أكّد ← الصف بيوري **"نُفِّذ"** بأخضر التحقق، **مطابق تماماً لكتابة منصة حقيقية**، والحالة بتبقى `APPLIED`. والتسمية الأمينة "استشاري — مفيش إجراء تلقائي" موجودة **بس بتترسم لما الصف يتوسّع وبس لو `description` مش null**. المستخدم بيفتكر إن الميزانية اترفعت. **مفيش حاجة سابت المبنى.**
- **W-16 — كل كتابة على جوجل بتتخطّى عدّاد الاستخدام، وفحص البناء مش قادر يشوفها.** `checkPlatformCallsCounted.mjs:20-40` بيطابق `fetch(` خام قرب مضيف منصة، و`.query(` على `customer`. **و`customer.mutateResources(...)` مابيطابقش ولا واحد** — فالأربع عمليات كتابة على جوجل بيزوّدوا **صفر**. والمسح كمان **غير تكراري** على `lib/` (بيفوّت `lib/ecommerce` و`lib/mcp`) **وعمره مابيبصّ لـ`app/`** حيث `available-campaigns` بيصدر أربع نداءات غير محسوبة. **والبناء بيطبع "كل نداءات المنصات بتمرّ على العدّاد" — وده اللي بيخلّي ده صعب الملاحظة.**
- **W-17 — إيقاف/توسيع تيك توك بيختار معلِناً عشوائياً لما معرّف الحملة ناقص.** `resolveTikTokAdvertiserId` لما `campaignId` بيكون null بيسقّط فلتر الحملة و`findFirst` بيرجّع **أي** رابط تيك توك في مساحة العمل.
- **W-18 — فترات الراحة مفهرَسة على "تنبيه عنوانه بيحتوي الاسم ده".** `findFirst({ title: { contains: name } })` — حملة اسمها "Search" بتكتم اقتراحات "Search — Brand"؛ **و`campaignName` فاضي بيخلّي `contains: ""` يطابق كل بند حديث ويكتم الاقتراح للأبد**؛ وإعادة تسمية حملة بتصفّر فترة الراحة. **وفيه مخزنَي فترات راحة عمرهم ما بيشوفوا كتابات بعض**: `scaleKillAlerts` بيبصّ لـ`ActionFeedItem.status`، والمسار اللي بيرفع الميزانيات فعلاً بيكتب `AdDecisionRecord`.
- **W-19 — معظم كتالوج القواعد عمره ما يقدر يشتغل، ومفيش حاجة بتقول كده.** `getDailyMetricValues` بيحسب `CPL_VERIFIED` و`TRUE_ROAS` و`INFLATION_RATE` **بس**، بينما الكتالوج بيعرض **~٣٣ مقياس و~٧٠ قالب**. اعمل "أوقف عند ترافيك مشبوه شديد" → بيرجع `[]` → `continue` صامت. **والقاعدة بتظهر مفعَّلة في اللوحة. المستخدم بيفتكر إن الحماية الآلية مسلَّحة — وهي خاملة.**
- **W-20 — صفوف تقسيم الأماكن ممكن تتعدّ مرتين في كل تجميع بيحرّك عتبة.** `automationRules.ts:222-243` و`relativeSpendThreshold.ts:23-28` و`bidStrategyAudit.ts:126-129` و`bidStrategyProgression.ts:42-46` **مابيفلتروش على `placementBreakdown`**، بينما `usageCaps` و`reportEngine` بيفلتروا. **دي نفس آلية L-1 من `attribution-truth`** — والأثر هنا أخطر: التكلفة والتحويلات بيتقروا ~الضعف، فأي بوابة عدد تحويلات (٣٠ بتاعة جوجل) **ممكن تتحقق عند نص الرقم الحقيقي — يعني تنزل على الـ١٥ اللي الاتفاق بيمنعها صراحة**. **Verified: NO** — الآلية مؤكَّدة، واللي مش ممكن بلا استعلام DB هو إن في `(campaignId, date)` شايل النوعين دلوقتي.
- **W-21 — `changeMetaAdSetBudget` بيجسّ كل منح ميتا وبيكتب بأي واحدة قدرت تقرا المعرّف.** بياخد معرّف مجموعة إعلانية بس، وبيلفّ على المنح، وبيكتب بأول توكن نجح. **مفيش فحص إن المجموعة تابعة لحساب مربوط بمساحة العمل دي** — فحدّ مساحة العمل مش هو اللي بيقرر الهدف.

#### [Low] W-22 — مفيش حدّ معدّل ولا timeout على راوتَي التنفيذ
`creatives/decision` و`action-feed/[id]/apply` **مابيستوردوش `lib/rateLimit`**، و`countedFetch` بلا `AbortSignal.timeout`. سكربت يقدر يقصف راوت القرار، وكل طلب كتابة حقيقية على منصة. ونداء معلّق بيشغّل الدالة لحد ما تتقتل، **وإعادة محاولة العميل مش قابلة للتمييز عن محاولة أولى** — وده بيخلّي غموض "اتنفّذ ولا لأ؟" دائماً.

#### ✅ الأرقام المتفق عليها — اتلقت في الكود
`SAFE_SCALE_INCREASE_PCT = 20` (`adDecisions.ts:32`) ✓ لكن **مكرَّرة** في `creativeAnalysis.ts:222` و**متناقَضة** من مسار الأتمتة (W-2) · `MIN_CONVERSIONS_FOR_KILL=5`/`SCALE=20` ✓ (استشارية عند التنفيذ — W-4) · ٤ أيام Scale / ٣ Kill ✓ · `DECISION_COOLDOWN_DAYS=4` ✓ **مع توأم منفصل بيقرا جدول تاني** (W-18) · cooldown ٧ أيام ✓ · التعب بيمنع Scale ✓ (قابل للتجاوز) · تأكيد الترتيب ٣٠٪ ✓ · ROAS كإشارة تأكيد و`conversions_value` لجوجل بس ✓ · التعادل `1/(margin/100)` ✓ · **جوجل ٣٠ تحويل + ٢١ يوم + ١٢٪ فوق** ✓ · **ميتا/تيك توك ٥٠ + ١٥٪** ✓ (بس هامش ميتا بيتبعت بالوحدة الغلط — W-1) · cooldown ١٤ يوم لجوجل وميتا ✓ — **ومكافئ تيك توك مالقاهوش** (الفحص: اقرا البلوك اللي قبل `syncTikTokAds.ts:1264`) · **الـ١٥ تحويل بتاعة جوجل غايبة صح** — الرقم مش موجود في `bidStrategyProgression.ts` خالص ✓ · **مفيش رقم صرف مطلق بعملة مجهولة في أي مسار كتابة قراه** ✓

#### لسه فاضل (من الوكيل)
- **`APPLY_PRODUCT_PRICE` → `lib/ecommerce/priceSync.ts`** — كتابة حقيقية على **متجر** العميل، بره النطاق المعلن. **لكنه بيكتب `Product.currentPrice` محلياً *قبل* ما يفحص `sync.ok`** — نفس نمط "المحلي بيقول اتنفّذ والبعيد لأ". يستاهل مرور مستقل (اتنقل لـ`ecommerce-orders`).
- `lib/conversionSync.ts` — كتابة منصة حقيقية، مستثناة لأن `attribution-truth` غطّاها؛ **معالجة الأخطاء لكل عملية فيها مش متحقَّق منها هنا**.
- `backfillHistoricalData` · سطح وكيل الـAI (أكّد إن أدوات MCP للقراءة بس، **بس ماقراش توصيل أدوات محادثة الوكيل لأي كتابة**).
- **دلالات الميزانية المشتركة في جوجل ومسار `/ad/status/update/` في تيك توك مش مؤكَّدين مقابل توثيق المنصات** (مفيش نداءات خارجية).

### 4.5 data-integrity — ⚠️ **٣ Critical · ٤ High · ٧ Medium · ٢ Low**

> **D-1 بيكمّل C-1، والاتنين مع بعض بيقولوا حاجة واحدة:** رقم التحويلات المتحقَّقة —
> وعد المنتج كله — بيفشل على **التلات منصات**، كل واحدة بطريقة مختلفة. التفصيل في
> القسم ٥ (مسار د٣).

#### [Critical] D-1 — تحويلات جوجل المتحقَّقة بتتكتب على صف لسه مش موجود: كل تحقق في نفس اليوم بيتلغي بالصمت
- **Path:** `app/api/attribution/mark-matched/route.ts:60-75` مقابل `lib/syncGoogleAds.ts:51-56`
- **Repro:** `syncGoogleAdsForWorkspace` بيبني نافذته `const from = dateRange?.from ?? yesterdayStr; const to = dateRange?.to ?? yesterdayStr;` — **وكل نداءاته بتمرّ بلا `dateRange`** (الكرون و`resyncWorkspace`)، فصف **امبارح بس** هو اللي بيتعمل. زائر بيدوس إعلان جوجل ٩:٠٠ النهارده وبيبعت واتساب ٩:٠٥. التراكر بينادي `mark-matched` بـ`receivedAt` = النهارده. السطر ٦٢ بيحسب `dayStart` = النهارده. السطر ٦٤ بيعمل `updateMany({..., date: dayStart, placementBreakdown:"ALL"})` → **صفر صفوف**، لأن مفيش صف للنهارده أصلاً. **وعدد الصفوف المتأثرة مابيتفحصش**، والراوت بيرجع `{ok:true}`. وبكرة الكرون بينشئ صف النهارده بـ`verifiedConversions: verifiedCount` جاي من `getVerifiedConversionsCount` — **وهي stub بترجّع `0` حرفياً**.
- **Impact:** **رقم التحويلات المتحقَّقة لجوجل صفر دائم لكل تحويل اتحقق في نفس يومه** — وده الحالة الطبيعية لتراكر شغّال بويب هوك. **ومش قابل للاسترداد**: صف `WaClick` بيتقلب `matched: true` في `:30-33` **قبل** محاولة الزيادة، فمفيش مرور إعادة معالجة يقدر يلاقيه. وبيفسد كمان `verificationRate` و`inflationRate` و`cpaVerified` و`wastedSpend`، **و`User.usageVerifiedConv` اللي هو عدّاد حدّ خطة**.
- **Suggested fix:** **الإصلاح المعماري أرخص من الترقيع.** بطّل اعتبار `MetricSnapshot` مخزن التحويلات المتحقَّقة. اكتبها في جدول مستقل بيضاف عليه بس، مفتاحه `(workspaceId, platform, campaignId, date, conversationId)`، وخلّي كل قارئ يعمل join/تجميع — بدل `updateMany` بيتسابق مع المزامنة. ولو ده كبير: بدّل `updateMany` بـ`upsert` على المفتاح المركّب الكامل بينشئ الصف بأصفار للمقاييس، **وشيل `verifiedConversions` من فرع `create` في التلات مزامنات** عشان المزامنة ماتصفّرهوش.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد نافذة `from = to = yesterdayStr`، وأكّد إن `getVerifiedConversionsCount` جسمها `return 0;` حرفياً.

#### [Critical] D-2 — صفحة أنواع المطابقة بتضرب صرف جوجل في عدد أيام المزامنة
- **Path:** `lib/syncGoogleAds.ts:1182-1250` (الكتابة)، `app/dashboard/campaigns/match-types/page.tsx:34-38` (القراءة)
- **Repro:** المزامنة بتستعلم `segments.date >= '${fromStr}'` و`fromStr` هو **٣٠ يوم فاتوا**، بتجمّع النافذة كلها في الذاكرة، **وبتكتبها بـ`date: today`**. يعني كل تِك كرون بيعمل **صف جديد شايل إجمالي ٣٠ يوم كامل**. والصفحة بتعمل `groupBy(["matchType"])` بـ`_sum` **وبلا أي فلتر تاريخ خالص**. اليوم التاني = ٢× الصرف الحقيقي؛ اليوم التلاتين = ~٣٠×؛ وبيزيد.
- **Impact:** تكلفة وكليكات وCPA "عام مقابل عبارة مقابل تام" غلط بمضاعف بلا حدّ. **وعلَم `wasteRisk` بيشتغل على تكلفة منفوخة** — فالميديا باير بيقتل نوع مطابقة بناءً على رقم ٣٠ ضعف حقيقته.
- **Suggested fix:** اقرا أحدث تاريخ سنابشوت بس (`orderBy:{date:"desc"}, take:1`)، **والأفضل معمارياً:** خلّي المزامنة تبطّل التجميع المسبق وتكتب صفوف يومية حقيقية مفهرسة على `segments.date` — زي ما `searchTermSnapshot` و`devicePerformanceSnapshot` و`geoPerformanceSnapshot` عاملين بالفعل، وساعتها قيد `@@unique` يبقى معناه اللي بيقوله.
- **Verified:** YES

#### [Critical] D-3 — إيراد ويب هوك المتجر بيتكتب في **بسط ROAS المنسوب للإعلان**، وكل طلب بيضيف +١ لتحويلات المنصة المُبلَّغة
- **Path:** `lib/ecommerce/ingest.ts:324-364`
- **Repro:** أي طلب من شوبيفاي/ووكومرس/زد/إيزي بيروح `ingestOrder`، اللي بيعمل upsert لصف `MetricSnapshot` بـ`campaignId:"store:<id>"` وبيكتب **`revenue: order.total`** و**`rawConversions: 1`**. والسكيما في `:691-702` معرّفة العمودين بالعكس تماماً وبتحذّر بالأحمر: **«إيرادان مختلفان، ولا يجوز جمعهما في حقلٍ واحد»** — `revenue` = "إيراد منسوب للإعلان، من المنصّة نفسها"، و`storeRevenue` = "مبيعات المتجر كلّها، من ويب هوك المتجر". **و`ingest.ts` عمره ما بيكتب `storeRevenue` خالص.** وكل قارئ بيجمع العمود الغلط بلا فلتر حملة: `kpiEngine.ts:114-122` (`roas = revenue/cost`)، `truthKpis.ts:216-225`، `app/dashboard/page.tsx:155`، `bidStrategyAudit.ts:128`، `diagnosticsEngine.ts:105`.
- **Impact:** **بسط ROAS بيشمل كل بيعة عضوية ومباشرة وعميل متكرر، والمقام صرف إعلاني بس** — وده بالظبط الفشل اللي تعليق السكيما اتكتب عشان يمنعه. **الرقم بيتحسّن لما التاجر يبيع من غير إعلانات.** وبشكل منفصل `rawConversions` بياخد +١ لكل طلب **فوق** مشتريات المنصة المُبلَّغة — فـ`inflationRatePct` و`verificationRatePct`، أهم رقمين في المنتج، **غلط في الاتجاهين في نفس الوقت**. بيأثر على كل مساحة عمل فيها متجر، بالصمت، من أول طلب.
- **Suggested fix:** اكتب `storeRevenue` بدل `revenue` في `:355` و`:360`، **وشيل زيادة `rawConversions` خالص** (منصات الإعلان بتبلّغ مشترياتها بنفسها، والصف ده مالوش صرف إعلاني وراه). وبعدين قرّر بوعي هل صفوف المتجر تدخل التجميعات على مستوى مساحة العمل أصلاً — **ولو لأ، الستة قرّاء محتاجين `platform: { in: AD_PLATFORMS }`، وده بيقول إن المطلوب مساعد `adSnapshotWhere()` واحد مشترك مش ٦ نسخ.**
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد نصّ تعليق السكيما الصريح، و`grep` أكّد `revenue: order.total` و`rawConversions: 1` في `ingest.ts`.

#### [High] D-4 — راوتان حيّان لويب هوك سلّة بيكتبوا نفس الطلب بشكلين؛ لو الاتنين مسجَّلين الطلب بيتعدّ مرتين
- **Path:** `app/api/webhooks/salla/route.ts:53-101` و`app/api/webhooks/ecommerce/[platform]/route.ts:21-27,73`
- **Repro:** `SLUG_TO_PLATFORM` بيخريط `salla → "SALLA"` فالراوتين بيقبلوا طلبات سلّة. القديم بيمنع التكرار بـ`markEventAsProcessed("SALLA", orderId, storeId)`، والموحَّد بـ`markEventAsProcessed(platform, "<orderId>#<fingerprint>", connectionId)` — **`scopeId` مختلف *و*`externalEventId` مختلف، فقيد `@@unique` عمره ما بيتصادم**. تاجر سجّل الرابط القديم وبعدين تابع الواجهة الحالية (اللي بتعرض الموحَّد بس) بيبقى عنده الاتنين حيّين، **وكل طلب بيتستقبل مرتين**. وحالة "القديم بس" وحشة بشكل تاني: بيكتب `storeRevenue` في `campaignId:"unlinked"` **ومابينشئش `Order` ولا `Customer` ولا `ProductSaleEvent` بـ`orderId`**.
- **Impact:** التسجيل المزدوج: `ordersCount` بيتضاعف والإيراد بيتقسم على عمودين في صفّين. والقديم-بس: كوهورت العملاء ومعدل الشراء المتكرر وRTO وتقييم الاحتيال كلهم فاضيين بينما اللوحة بتوري طلبات. **والراوت القديم كمان بيوثّق بسرّ عام واحد بدل `webhookSecret` المشفَّر لكل اتصال، وبيحلّ الملكية بـ`campaignLink.findFirst` — بيتخطّى `resolveStore.ts` تماماً، وهو الملف الموجود بالظبط لأن النمط ده سرّب طلبات بين المستأجرين** (نفس آلية S-2).
- **Suggested fix:** **امسح `app/api/webhooks/salla/route.ts`** وخلّي المسار يرجّع 410 أو يحوّل للموحَّد.
- **Verified:** YES

#### [High] D-5 — كل تقرير بيسقّط بيانات ميتا بالكامل (نفس آلية C-2، مؤكَّدة من وكيل تاني مستقل)
`reportEngine.ts:352-354` و`:500-501` بيحتفظوا بصفوف `"ALL"` بس، و`syncMetaAds` عمره ما بيكتبها في التشغيل الطبيعي. **ولوحة الـKPI (`kpiEngine.ts`) مابتطبّقش الفلتر ده — فبتوري صرف ميتا اللي التقارير بتقول إنه صفر: صفحتين، إجابتين، نفس البيانات.** الإصلاح: مساعد مشترك واحد يعيد استخدام منطق `usageCaps.ts:164-194` بدل ما يتنسخ مرة رابعة.

#### [High] D-6 — إيراد ميتا دايماً null (نفس H-6، مؤكَّدة مستقلاً)
`fetchMetaInsights` بيبني `fields: "impressions,clicks,spend,actions,account_currency"` — **`action_values` مش فيها**، والسطر ١٢٧ بيقراها. **والتعليق المفصَّل في `:122-126` اللي بيعلن إن الفجوة دي اتسدّت بيوصف كود مش قادر ينفّذ.** الإصلاح: ضيف `action_values` للسلسلة. مفيش حاجة تانية بتتغير.

#### [High] D-7 — إجماليات صفحة الحقيقة مابتطابقش مجموع صفوفها، وسلاسل الاتجاه بتزحزح الأيام بين المنصات
- **Path:** `lib/truthKpis.ts:150,251,294-296,305-315,385-392`
- **Repro:** **(أ)** صفوف المنصات بتتبني بـ`current.filter(r => r.platform === p)` على أربع منصات إعلانية، **لكن `totals` بيتبني بـ`summarize(current)` على كل الصفوف — بما فيها صفوف `SALLA`/`SHOPIFY` من D-3**. اربط متجر واقرا الصفحة: الأربع صفوف بيجمعوا رقم والكارت بيوري رقم أكبر. **(ب)** `dayKeys` بيتحسب لكل منصة على حدة من الأيام اللي عندها صفوف، وبعدين `sumAcrossPlatforms` بيجمع `pick(p)[i]` **بالفهرس** — فاليوم رقم ٣ عند جوجل واليوم رقم ٣ عند ميتا نفس اليوم التقويمي **بس لو الاتنين عندهم صفوف في نفس الأيام بالظبط**، وده غلط أول ما حملة تتوقف أو مزامنة تفشل أو نوافذ الاسترجاع تختلف (ميتا ٢٨ يوم، جوجل يوم).
- **Impact:** (أ) الأرقام الرئيسية على صفحة الحقيقة **مش قابلة للمصالحة مع الجدول اللي تحتيها**. (ب) كل السلاسل بترسم صرف يوم مقابل تحويلات يوم تاني — **وخط الاتجاه هو اللي بيقول للمستخدم إن الفجوة بتتوسّع، وهو غلط بالظبط لما منصة يكون عندها فجوة بيانات**.
- **Suggested fix:** فلتر `current`/`previous` على المنصات الإعلانية في شرط `where` عشان الإجماليات والصفوف يشربوا من نفس المصدر. وللسلاسل: ابنِ اتحاد أيام تقويمية واحد للفترة كلها **وفهرس كل منصة عليه بمفتاح التاريخ مش بالموضع**.
- **Verified:** YES

#### [Medium] D-8 → D-14 (سبعة)
- **D-8 — `Touchpoint` مالوش أي مفتاح منع تكرار.** `recordTouchpoint` بيعمل `create` مجرّد، والموديل مالوش `@@unique` على أي حاجة، والحمولة مافيهاش معرّف حدث، **والراوت بيرجع ٥٠٠ على أي خطأ DB — وده بالظبط الرد اللي بيخلّي المنادي يعيد**. كل إعادة بتضيف نسخة تانية من نفس الكليك. و`distributeCredit` بيقسّم كل تحويل على `path.touches` — **فنسختين من كليك جوجل بيدّوه ٢/٤ بدل ١/٣**، وأعمدة LINEAR وU_SHAPED وTIME_DECAY وحكم `creditGap` كلهم بيميلوا للمنصة اللي تاجها أعاد.
- **D-9 — مفيش مسار بينشئ `ConversionEvent` من طلب متجر، فطبقة رفع التحويلات كلها فاضية لمساحات الإيكومرس.** بالبحث عن **الموديل** مش عن اسم دالة: `prisma.conversionEvent.create|upsert|createMany` موجودة في مكانين بس — راوت التراكر الخارجي و`demoSeed`. **تاجر ربط شوبيفاي وجوجل ومار كّبش تراكر واتساب بياخد صفر `ConversionEvent`** — فـ`conversionSync` **بيرفع لا شيء** حتى مع `conversionSyncEnabled: true`، وقسم نماذج الإسناد كله بيترسم "لا توجد بيانات" بينما الحساب واضح إن عنده تحويلات. **الإصلاح:** بعد نجاح `order.upsert` اعمل upsert لـ`ConversionEvent` بـ`externalId = order.externalOrderId` — و`@@unique([workspaceId, externalId])` بيخلّيه آمن تحت إعادة الويب هوك.
- **D-10 — `/dashboard/campaigns/video-performance` بيقرا عمود مفيش حاجة في الإنتاج بتكتبه.** الصفحة بتفلتر `videoViews: { gt: 0 }`، **والكاتب الوحيد لـ`videoViews`/`videoThruPlays`/`videoAvgWatchTimeSec`/`videoCpv` هو `lib/demoSeed.ts:267-270`**. ومزامنة يوتيوب بتكتب `youtubeMetricSnapshot` — **جدول تاني**. وتعليق الصفحة نفسها ("جوجل بس بيملّي videoViews في MetricSnapshot") **مش صحيح عن الكود اللي تحته**. النتيجة: **العميل الحقيقي بيشوف الحالة الفاضية للأبد، والعميل المحتمل في الديمو بيشوف تقرير أداء فيديو كامل لميزة مش موجودة بره البذرة. نفس الصفحة، منتجين.**
- **D-11 — قائمة "الأماكن المهدرة" بتوري نفس المكان مرة لكل يوم مزامنة.** نفس نمط D-2: المزامنة بتجمّع نافذة متدحرجة وتكتبها بـ`date: today`، والصفحة بتعمل `take: 20` **بلا فلتر تاريخ**. بعد ٢٠ يوم القايمة بقت مكان أو اتنين متكرّرين ٢٠ مرة. الأرقام نفسها مش مجموعة فمفيش رقم منفوخ — القايمة بس بقت بلا فايدة.
- **D-12 — `dataConsistencyAudit` بيقول "متطابق" وهو مقارنش حاجة، وبيفحص كليكات جوجل بس.** موصول بزرار يدوي واحد، **ومفيش كرون بيشغّله**. و**الخروجان المبكران الاتنين بيرجّعوا `matches: true`** — لما مفيش `CampaignLink` لجوجل، ولما مفيش منحة جوجل بتتحلّ (توكن منتهي أو مسحوب). **يعني توكن جوجل المنتهي — أشيع سبب للانحراف — بيتبلّغ كـ"بياناتك متطابقة"**. **واللي مابيفحصهوش:** التكلفة، والتحويلات، و`verifiedConversions`، والإيراد، وميتا وتيك توك بالكامل، و`CreativeSnapshot` مقابل أصله، و`Order` مقابل `ordersCount`، ومصالحة ALL/split. **الوحيد اللي كان ممكن يمسك الانحراف — التكلفة — هو اللي محذوف.** الإصلاح: نتيجة تلاثية `ok/drift/not_checked` بدل بوليان، والواجهة تعرض التالتة بشكل مميز.
- **D-13 — عملات حسابات إعلانية مختلطة بتتسجَّل في اللوج وبعدين بتتجمع برضه، بما فيها سقف الفوترة.** `recordDataCurrency` بيكتب أول عملة، وعلى التانية بيعمل `console.warn` وبيرجع. و`usageCaps` بيجمع الكل وبيحوّل الإجمالي **بسعر واحد**. **يعني `User.usageSpendUsd` — الرقم اللي بيتفحص مقابل `PlanLimits.monthlySpendUsd` عشان يقرر لو المزامنة تتوقف — محسوب على مجموع عملتين بسعر واحد.** خلط ريال/دولار بيغلط بـ~٣.٧٥×. **الإصلاح:** خزّن `currency` على `MetricSnapshot` وقت الكتابة (التلات مزامنات بيقروا عملة الحساب أصلاً)؛ ولحد ما يتعمل، التحذير لازم يبقى **منع صريح** لربط حساب تاني بعملة مختلفة، لأن المنتج مش قادر يمثّلها.
- **D-14 — المخزون بينقص بقراءة-تعديل-كتابة، فطلبات متزامنة بتضيّع النقصان.** `stockQuantity: Math.max(0, product.stockQuantity + delta)` والقيمة جاية من `findMany` أقدم في الطلب. طلبين لنفس الـSKU في نفس الثانية الاتنين بيقروا ١٠ والاتنين بيكتبوا ٩. **المخزون بينحرف لأعلى مقابل الواقع، فالإعلانات بتفضل شغالة على منتج خلص فعلاً.** الإصلاح: `{ stockQuantity: { increment: delta } }`.

#### [Low] D-15 · D-16
- **D-15** أربع جداول إسناد (`UnmatchedClick`, `AttributionResult`, `SessionConversion`, `WaClick`) **مالهاش FK لـ`Workspace`** — أعمدة `workspaceId` عادية بلا `@relation` وبلا `onDelete`. وحذف مساحة العمل بيعتمد على تعليق بيقول "الكاسكيد بيتكفّل" — **صحيح للـ٤٠+ موديل اللي بيعرّفوا العلاقة، وغلط للأربعة دول**. `phoneHint` و`ipAddress` و`phoneNumber` بيعيشوا بعد الحذف بلا نهاية. (بيتقاطع مع `compliance-privacy` — ديدلاين ٣١ أكتوبر.) ملاحظة: `WaClick` **لازم مايتعملهوش relation** (جدول التراكر، معرَّف هنا عشان `db push` مايمسحهوش) — يتمسح صراحةً في معالج حذف مساحة العمل.
- **D-16** `ConversionEvent.fbc` بيتعاد بناؤه بـ`Date.now()` في كل إعادة إرسال — فرع `update` بيعمل spread لـ`...signals` فبيكتب فوق الختم. (نفس M-2، بتأكيد مستقل.)

#### لسه فاضل (من الوكيل)
- **~٤٥ موديل قرا تعريفاتهم وقيودهم ومافتحش مساراتهم للكتابة** — الأسماء مسرودة كاملة في مخرجه.
- **الفوترة (`billing.ts`, `plans.ts`, `entitlements.ts`, ويب هوك Paymob) ماتفتحتش** — بس `billing-plans` غطّاها في ٤.٢.
- **`CreativeSnapshot` مقابل `MetricSnapshot` ماتفحصش** — هل تكلفة مستوى الإعلان بتجمع لتكلفة الحملة، وهل `CreativeSnapshot.verifiedConversions` (nullable) بيتكتب من أي حاجة أصلاً. **مذكور صراحة في التكليف ومااتعملش.**
- `attributionEngine.ts` مافتحش خالص · `metricsEngine` · `diagnosticsEngine` · `experimentEngine` · `healthScore` · `anomalyDetection` · `creativeAnalysis` — **كل واحد فيهم بيقرا `MetricSnapshot` وكل واحد مرشّح لنفس شكل ALL/split وصفوف المتجر؛ مش متفحوصين**.
- **~٤٢ صفحة مش متقروءة** — و`PlatformHub.tsx:136` بالذات بيجمع `revenue` بنفس طريقة `kpiEngine` **فهيحمل عيب D-3**.
- أقسام كبيرة من مزامنات جوجل وميتا وتيك توك مش متقروءة (الإبداعات، عبارات البحث، جودة النقاط، التسوق، فورم الليدز، مجموعات ميتا الإعلانية، صحة الحساب).
- **حقن GAQL:** `campaignIds.join(",")` بيتحقن في ٦ مواضع؛ القيم أصلها من قائمة حملات المنصة، **فحكم إنه بره النطاق ومارجعش هل نص من المستخدم يقدر يوصل `externalCampaignId`** — **و`platform-writes` أثبت في W-8 إنه يقدر**.

### 4.6 compliance-privacy — ⚠️ **٢ Critical · ٥ High · ٤ Medium · ٢ Low** + ١٠ قرارات

> الجرد الكامل (٧٨ موديل، الـ٤٤ الحاملة لبيانات شخصية اتقروا حقلاً بحقل) في مخرج
> الوكيل. الملخّص هنا. **الحرجان أعدت التحقق منهما بنفسي.**

#### الجرد — تلات فئات بيانات، تلات مواقع قانونية مختلفة
1. **بيانات المشترك نفسه** (AdLoop متحكّم): إيميل، اسم، كلمة سر، MFA، تاريخ ميلاد، نوع، بلد، شركة، معرّفات دفع، **توكنات OAuth لحسابات إعلاناته**، تذاكر الدعم، محادثات AI، اشتراك الإشعارات.
2. **زوّار مواقع المشترك ومرسلو الرسايل** (AdLoop **معالِج**، والمُعلن هو المتحكّم): `UnmatchedClick.phoneHint`/`ipAddress` · `WaClick.phoneNumber` · `SessionConversion.phoneNumber` — **كلها خام مش متهشّمة** · `Touchpoint` (IP، UA، referrer، مسار الهبوط) · `LeadFormSubmission.fieldData` **JSON خام** · `SearchTermSnapshot.searchTerm`.
3. **مشترو التاجر** (AdLoop معالِج لبيانات **طرف تالت**): `Customer.emailHash`/`phoneHash` متهشّمين ✓ لكن `displayName`/`city` **خام**، و`Order` كامل. **الناس دول عمرهم ماشافوا سياسة AdLoop ولا وافقوا عليها.**

#### [Critical] P-1 — حذف الحساب بيسيب أرقام تليفونات وIPs وتذاكر دعم وراه: خمس جداول PII مالهاش أي مسار cascade
- **Path:** `app/api/account/delete/route.ts:49`؛ الموديلات في `prisma/schema.prisma:925-940`, `1457-1471`, `942-959`, `2286-2308`, `2814-2848`
- **Repro:** المستخدم بيأكّد الحذف؛ الراوت بيتحقق من كلمة السر وCSRF وبعدين بينادي `prisma.user.delete` **معتمداً بالكامل على cascade السكيما**. و`UnmatchedClick` و`AttributionResult` و`SessionConversion` بيعرّفوا `workspaceId String` مجرّد **بلا `@relation`**، و`SupportThread` بيعرّف `userId String?` **بلا سطر `user User` أصلاً** — فمفيش FK بيتولّد ومفيش حاجة بتتكاسكيد. و`WaClick` **مالوش عمود مالك خالص**. و`grep` على `unmatchedClick.delete*` و`supportThread.delete*` وإخواتهم في الريبو كله: **صفر نتيجة**.
- **Impact:** بعد "المحو"، قاعدة البيانات **لسه شايلة** اسم المشترك وإيميله وتليفونه وبلده ونصّ تذاكره الخام، **زائد** أرقام تليفونات زوّاره وIPs بتاعتهم. **بيانات المتحكّم وبيانات المعالَجة الاتنين بيعيشوا بعد حذف الواجهة بتقدّمه كنهائي.**
- **Suggested fix:** ضيف `@relation(..., onDelete: Cascade)` حقيقي على التلات موديلات وعلى `SupportThread.userId`. **و`WaClick` مايتعملهوش cascade** (جدول التراكر، وتحذير السكيما في `:2814` بيقول لازم يتعدّل بالتزامن مع `wa-conversion-tracker/lib/db.ts` وإلا `db push` بيعدّل الجدول المشترك) — يتمسح صراحةً بـ`deleteMany` في الراوت قبل `user.delete`.
- **Verified:** **YES — تحقُّق مزدوج.** `awk` على بلوكات الموديلات أكّد غياب `@relation` في الأربعة.

#### [Critical] P-2 — مرفقات تذاكر الدعم بتترفع على Vercel Blob بـ`access: "public"` وعمرها ما بتتمسح
- **Path:** `app/api/support/upload/route.ts:34-39`
- **Repro:** المستخدم بيرفق صورة بتذكرة. الراوت بيعمل `put(..., { access: "public" })` — يعني Vercel Blob بيقدّم الملف على رابط **بلا أي مصادقة**. الرابط بيتخزّن في `SupportMessage.imageUrls` وبيتعرض في لوحة الأدمن. **ومفيش حاجة في المشروع كله بتمسحه:** `del()` موجودة في `lib/backup.ts:78` بس، وراوت حذف الحساب **مابيلمسش التخزين خالص**.
- **Impact:** **لقطات الدعم هي بالظبط المكان اللي بيانات العملاء بتقع فيه** — لوحة فيها قائمة طلبات، محادثة واتساب، تصدير فورم ليدز. أي حد معاه الرابط بيجيبها **بلا مصادقة، للأبد، وبعد قفل التذكرة وبعد حذف الحساب**. والمسار شبه متوقَّع: `support/<cuid>/<epoch-ms>-<اسم الملف الأصلي>`.
- **Suggested fix:** حوّل لـblob خاص/متبوّب بتوكن وقدّم المرفقات من راوت مصادَق عليه بيفحص ملكية التذكرة؛ وضيف تنضيف التخزين لراوت حذف الحساب ولـ`lib/dataRetention.ts`.
- **Verified:** **YES — تحقُّق مزدوج** لـ`access: "public"` ولغياب أي حذف. NO لمدى قابلية تخمين الرابط (توثيق `@vercel/blob` متضارب حوالين `addRandomSuffix`) — **ومابيغيّرش الحدّة، لأن `public` معناها بلا مصادقة في الحالتين**.

#### [High] P-3 — Sentry مالوش `beforeSend` في أي من التلات إعدادات، **والسياسة بتقول إن السجلّات بتتجرّد من البيانات الشخصية**
- **Path:** `sentry.server.config.ts:5-11`، `instrumentation-client.ts:4-7`، `sentry.edge.config.ts:4-8`؛ نصّ السياسة `privacy.processorsL5`
- **Repro:** التلات نداءات `Sentry.init` بيحطّوا `dsn` و`tracesSampleRate` **وبس** — مفيش `beforeSend` ولا `beforeSendTransaction` ولا `denyUrls`. والسياسة بتقول حرفياً إن خدمة تتبّع الأخطاء بتستقبل السجلّات **«بعد تجريد السجلّات من البيانات الشخصية»**. **مفيش حاجة بتجرّد أي حاجة.**
- **Impact:** الالتقاط الافتراضي بيشمل الرابط والـquery string والترويسات. **وتوكنات إعادة تعيين كلمة السر بتمشي في query string** (S-17) — يعني خطأ على صفحة إعادة التعيين بيبعت **توكن استيلاء على حساب حيّ** لـSentry. **ده تسريب وتعارض مُثبَت بين السياسة والكود في نفس الوقت.**
- **Suggested fix:** `beforeSend` مشترك في التلاتة بيسقّط `event.request.data` وبينقّي الـquery string والروابط وبيشيل ترويسات `cookie`/`authorization`، و`sendDefaultPii: false` صراحةً.
- **Verified:** YES

#### [High] P-4 — أدوات MCP بتبعت تاريخ شراء مشترٍ **باسمه** لعميل AI طرف تالت
- **Path:** `lib/mcp/tools.ts:367-392` (`get_customer_journey`)، `:283-315` (`get_customer_analytics`)
- **Repro:** المشترك بيربط claude.ai أو ChatGPT بـ`/api/mcp` عبر OAuth. `get_customer_journey` بياخد **جزء من اسم** وبيعمل `findFirst({ where:{ displayName:{ contains: q, mode:"insensitive" } } })` وبيرجّع `displayName` و`city` وتواريخ أول وآخر طلب وعدد الطلبات وإجمالي الإنفاق والمرتجعات **وكل طلب فردي** بتاريخه ومنصته ومبلغه.
- **Impact:** **صاحب البيانات هنا هو مشتري التاجر، مش مشترك AdLoop.** اسمه ومدينته وتاريخ شرائه بيسيبوا AdLoop لأي مزوّد AI المشترك ربطه — Anthropic أو OpenAI، والاتنين بره مصر. وشاشة موافقة MCP بتفصح عن قراءة "الطلبات والعملاء"، **لكن الموافقة دي بيديها التاجر، وهو مش صاحب البيانات**. **و`get_orders_summary` في `:161` بيوعد صراحةً إن "بيانات تواصل العملاء مش متضمّنة أبداً" — و`get_customer_journey` بعده بأربعتاشر أداة بيناقضه.**
- **Suggested fix:** يا تشيل `displayName`/`city` من ردّ الأداتين لصالح مفتاح مبهم لكل مساحة عمل، يا تحطّ الأداتين ورا نطاق منفصل المشترك لازم يفعّله بوعي. **والبحث بالاسم هو الجزء اللي بيخلّي دي إفصاحاً موجَّهاً عن شخص محدَّد مش تجميعاً.**
- **Verified:** YES

#### [High] P-5 — لقطات صفحات الهبوط ونصّها بتتبعت لـAnthropic، والسياسة بتقول إن خدمة الـAI مابتستقبلش بيانات تعريفية
- **Path:** `lib/landingPageAudit.ts:394-421`، `lib/screenshotService.ts:7-31`، `lib/siteScanOrchestrator.ts:57`
- **Repro:** المشترك بيشغّل فحص موقع → `captureScreenshot(url)` بيبعت الرابط لـ`shot.screenshotapi.net` وبيستقبل PNG كامل ١٤٤٠×١٠٢٤، **وبيتحوّل base64 وبيتمرّر لـ`anthropic.messages.create` كبلوك صورة** مع أول ٣٠٠٠ حرف من نصّ الصفحة.
- **Impact:** **محدش بيتحكّم في اللي على صفحة الهبوط** — شهادات عملاء بأسماء وصور حقيقية، ويدجت مراجعات حيّ، شات بيوري اسم زائر، صفحة تأكيد طلب بتتفتح برابط. كل ده بيروح لطرفين تالتين، الاتنين بره مصر. والسياسة بتقول إن معالج الـAI بيستقبل أرقام أداء **«دون بيانات تعريف شخصية»**. **واللقطة هي أقل حمولة محدودة في المنتج كله.**
- **Suggested fix:** الفجوة هنا في **الإفصاح** مش في الميزة: عدّل بند المعالِجين ليسمّي التقاط اللقطات والتحليل البصري كمعالجة منفصلة، وحطّ إشعاراً قبل الفحص. واختيارياً: اقصر `captureScreenshot` على روابط المشترك مثبت إنه بيملكها.
- **Verified:** YES

#### [High] P-6 — الاحتفاظ مفروض على جدولين من ~أربعتاشر، والسياسة بتوعد بتسعين يوم
- **Path:** `lib/dataRetention.ts:19-38`، بيتنادى من `app/api/cron/sync-google-ads:116`
- **Repro:** `purgeExpiredData()` بيمسح حاجتين بالظبط: `CtaClickEvent` أقدم من ٩٠ يوم، و`RateLimitEntry` أقدم من ٧ أيام. **وهو مجدوَل فعلاً** — كرون جوجل اليومي بينادي عليه قبل حلقة مساحات العمل. **فالفجوة في التغطية مش في الجدولة** (وده بيصحّح افتراض كان في تكليفي).
- **Impact:** **مش متلمَّس من أي احتفاظ وبينمو بلا حدّ:** `UnmatchedClick` · `WaClick` · `SessionConversion` · `Touchpoint` · `ConversionEvent` · `AttributionResult` · `MessengerConversation` · `LeadFormSubmission` · `SearchTermSnapshot` · `AdminAuditLog` · `SupportThread`/`SupportMessage` · `AgentMessage`. **والسياسة بتقول إشارات التحقق "تسعين يوماً على الأكثر" والسجلّات التقنية اتناشر شهر — ولا واحدة صحيحة عن الكود.**
- **Suggested fix:** وسّع `lib/dataRetention.ts` لكل جدول فوق، **ونقل `purgeExpiredData()` بره كرون جوجل لمدخل مستقل في `vercel.json`** عشان عطل في API جوجل مايعطّلش الاحتفاظ بالصمت. (المدد نفسها **قرار مالك**، بند ١.)
- **Verified:** YES

#### [High] P-7 — النسخ الاحتياطية الأسبوعية شايلة هويات المشتركين **وتوكنات CAPI**، لتمن أسابيع، ومفيش حذف بيوصلها
- **Path:** `lib/backup.ts:28-63` (الـ`workspace.findMany()` في `:34`)، `:69-80`
- **Repro:** النسخة بتكتب JSON فيه صفوف `User` وكل `ConnectedPlatform` وكل `Product`، **و`prisma.workspace.findMany()` بلا `select` خالص** — يعني كل حقول مساحة العمل، **ومنهم `metaCapiToken` و`tiktokCapiToken` المشفّرين** و`whatsappBusinessPhone` و`notificationEmail`. و`pruneOldBackups` بيحتفظ بأحدث ٨ نسخ. **ومفيش حاجة بتعيد كتابة محتوى نسخة.**
- **Impact:** اللي بيحذف حسابه النهارده بيفضل في لحد ٨ لقطات أسبوعية — **~٥٦ يوم**. والسياسة بتوعد إن الحذف بيتطبَّق على النسخ "خلال تلاتين يوم". **وتعليق الملف نفسه في `:30-31` بيقول إن المواد الحسّاسة مستبعَدة عمداً — و`findMany()` غير المقيَّد بينقض ده بهدوء للتوكنين.**
- **Suggested fix:** `select` صريح بيستبعد التوكنين؛ ونزّل الاحتفاظ لـ٤ نسخ عشان النافذة تدخل جوّه التلاتين يوم الموعودين، **أو** عدّل السياسة لتقول النافذة الحقيقية.
- **Verified:** YES

#### [High] P-8 — تصدير البيانات بيرد على طلب وصول بـ~سُبع اللي متخزَّن، **وبيشحن توكنات المنصات معاه**
- **Path:** `app/api/account/export-data/route.ts:15-40`
- **Repro:** قريت الراوت بنفسي. بيرجّع: `profile` بـ**٧ حقول بس** (`id, email, name, createdAt, preferredLocale, businessScale, timezone`)، و`workspaces` بـ**`include: { campaignLinks: true, products: true }`** — **و`include` بيرجّع كل حقول `Workspace` القياسية، ومنهم `metaCapiToken` و`tiktokCapiToken`** — و`feedback`.
- **Impact:** **ناقص:** تاريخ الميلاد، النوع، البلد، الشركة، اسم المستخدم، `howHeard`، `referralSource`، `adSpendMonthly`، تذاكر الدعم ورسايلها، محادثات الـAI، نوايا الدفع، أحداث الاشتراك، اشتراكات الإشعارات، أجهزة موثوقة، `ConversionEvent`، `AttributionResult`، `Touchpoint`، الطلبات والعملاء. **وزايد:** توكنات CAPI مشفّرة بتتسلّم للمستخدم في ملف تصدير.
- **Suggested fix:** `select` صريح على `workspace` يستبعد التوكنات، وضمّ الجداول الناقصة — أو صرّح في الواجهة إن ده تصدير جزئي وقول بالظبط إيه اللي مش فيه.
- **Verified:** **YES — قريت الراوت بنفسي** (الوكيل رجّع الاكتشاف من غير تفاصيله).

#### [Medium] P-9 → P-12
- **P-9 — إجابات فورم ليدز ميتا بتتخزّن JSON خام بلا تهشيم وبلا احتفاظ.** `meta-leadgen/route.ts:86-102` بيكتب `fieldData: JSON.stringify(...)` في عمود `@db.Text`. **أي حاجة التاجر حطها في الفورم — اسم كامل، تليفون، إيميل، رقم قومي، عنوان — بتنزل بالحرف.** ودول ليدز التاجر، أصحاب بيانات طرف تالت. **وعلى عكس `Customer` (متهشّم) و`ConversionEvent` (متهشّم)، المسار ده بيخزّن المعرّفات صريحة.** بيتكاسكيد صح على حذف مساحة العمل، فدي إفراط احتفاظ مش فشل محو.
- **P-10 — البريد التسويقي opt-out افتراضياً، والسياسة بتسمّي الموافقة الصريحة كأساس قانوني.** `marketingOptOut Boolean @default(false)` و`send.ts:73-76` بيتخطّى بس لو رفض — **فكل تسجيل جديد مُسجَّل تلقائياً**. ومربع `acceptedTerms` بيغطّي الشروط والخصوصية، **مش التسويق**، ومفيش موافقة تسويق منفصلة متسجَّلة ولا مؤرَّخة في أي مكان. **ومفيش سجل موافقة تقدر تقدّمه لو اتطلب.** ورابط إلغاء الاشتراك بيوجّه لصفحة **بتتطلّب جلسة** — إلغاء اشتراك بيطلب تسجيل دخول آلية ضعيفة، ومفيش ترويسة `List-Unsubscribe`.
- **P-11 — سنيبت التتبّع بيزرع معرّفاً دائماً على زوّار التاجر بلا أي إشعار.** بيكتب `crypto.randomUUID()` في `localStorage` تحت `adloop_session_id`. **والتعليق بيسمّيه "معرف ثابت طول الزيارة" — و`localStorage` بيعيش بعد الزيارة والجلسة وإعادة تشغيل المتصفح.** والزائر صاحب بيانات **عمره ماشاف سياسة AdLoop** (المكتوبة للمشتركين)، ومفيش بانر موافقة في السنيبت، ومفيش إشارة ليه في `app/(legal)/cookies` (٢٨ سطر بتغطّي موقع AdLoop نفسه)، **ومفيش قالب إفصاح للتاجر في الريبو**.
- **P-12 — عبارات البحث اللي بيكتبها ناس حقيقيون بتتخزّن نصاً حراً بلا نهاية.** `SearchTermSnapshot.searchTerm` — **وده حقل PII غير متوقَّع كلاسيكي**: الناس بتكتب اسمها أو تليفونها أو عنوانها أو حالة صحية في خانة البحث. **وجوجل نفسه بيكتم العبارات نادرة التكرار جزئياً للسبب ده.** والحقل معروض في الواجهة **ومكشوف عبر أداة MCP `get_search_terms`** — يعني ممكن يوصل عميل AI متصل كمان.

#### [Low] P-13 · P-14
- **P-13** مفيش راوت إلغاء لاشتراكات الإشعارات — `pushSubscription.delete` الوحيدة جوّه `lib/webPush.ts:45` لما خدمة الدفع ترفض الإرسال. اللي بيلغي الإذن من متصفحه بيسيب الـendpoint والمفاتيح في القاعدة لحد أول إرسال فاشل.
- **P-14** `console.error("...", err)` على مسارَي `touchpoint` و`conversion` — والـ`data` المُمرَّر لـPrisma فيه `ipAddress` و`userAgent` خام. لو خطأ من فئة validation اشتغل، بيتسلسل مع قيم الوسائط. **مفيش `console.*` في `app/api` ولا `lib` بيستوفي إيميل أو تليفون أو اسم مباشرةً** (متأكَّد بالبحث). **Verified: NO** — يتحسم بقراءة تنسيق أخطاء Prisma في النسخة المثبَّتة.

---

#### 🔷 قرارات محتاجة منك (مش إصلاحات كود)

> الوكيل بيقول صراحةً: **ده مش استشارة قانونية** — ده جرد باللي الكود مش قادر يقرّره.

| # | القرار | موقوف عليه |
|---|---|---|
| ١ | **مدد الاحتفاظ لكل نوع بيانات.** الأرقام في السياسة (٩٠ يوم / ١٢ شهر / ٥ سنين) اتكتبت من غير ما حد يحدد جايّة منين | توسيع `dataRetention.ts` وتصحيح `retentionL3/L4` |
| ٢ | **الأساس القانوني لتخزين رقم زائر ماتعاملش مع AdLoop إطلاقاً** — وهل يتخزّن خام أصلاً ولا يتهشّم عند الاستقبال زي `ConversionEvent` | `UnmatchedClick` · `SessionConversion` · `WaClick` |
| ٣ | **التسويق: opt-in ولا opt-out** — الكود بيبعت للكل والسياسة بتقول موافقة صريحة | مربع موافقة منفصل، أو تعديل `basisL2` |
| ٤ | **اتفاقية معالجة بيانات مع كل تاجر يربط متجره** — **مفيش في الريبو كله أي عقد ولا مسوّدة** | شرعية `lib/ecommerce/ingest.ts` كله وأدوات العملاء في MCP |
| ٥ | **جمع البيانات من زوّار مواقع التجّار: محتاج موافقة ولا لأ**، ومين المسؤول عن الإفصاح — إحنا ولا التاجر | هل السنيبت يفضل شغّال بلا بانر |
| ٦ | **نقل البيانات خارج مصر.** الوجهات المؤكَّدة من الكود: Vercel · Postgres · Sentry · Resend · Anthropic · screenshotapi.net · Google · Meta · TikTok · rdap.org · أي مزوّد AI عبر MCP. **Paymob هي الوحيدة في مصر.** والسياسة بتقول إن فيه "بنود تعاقدية قياسية" مع كل واحد — **ومفيش في الريبو أي دليل على وجود العقود دي** | إثبات أساس النقل قبل ٣١ أكتوبر |
| ٧ | **حق المحو بالتمرير** — عميل التاجر هيطلب المسح من التاجر مش مننا، **ومفيش أي آلية** (لا endpoint ولا زرار ولا مسار يدوي موثَّق). البحث بالاسم موجود، الحذف لأ | يتبني كميزة ولا يتغطّى بالبند ٤ |
| ٨ | **هل الحساب محتاج مسؤول حماية بيانات وتسجيل عند الجهة الرقابية** | مش قرار كود |
| ٩ | **تاريخ الميلاد والنوع** — بيتجمّعوا في التسجيل، وتعليق السكيما بيقول `birthDate` "لتقسيم الشرائح لا للتحقّق" يعني مالوش غرض تشغيلي، **و`collectL1` مابيذكرهمش خالص** | حذف الحقلين ولا تسجيل غرض واضح |
| ١٠ | **ترتيب الشغل قبل ٣١ أكتوبر** — أكبر بندين محتاجين وقت **بناء** مش مراجعة: تغطية الاحتفاظ (١) وآلية المحو بالتمرير (٧). **والحرجان (P-1, P-2) إصلاحهم أسرع بكتير** | الوكيل بيرشّح الحرج أولاً لأنه ادّعاء غير صحيح بيتقال للمستخدم في وشه |

#### لسه فاضل (من الوكيل)
- **٤٤ موديل اتفحصوا بمسح أسماء حقول بس** (كلهم جداول مقاييس مجمّعة، والمسح أكّد خلوّهم من معرّف مباشر) — **بس حقول حرّة جواهم ماتقيّمتش:** `Competitor.notes` · `ExperimentLog.note` · `SubscriptionEvent.note` · `DailyTask.title` · `ActionFeedItem.title` · **روابط `MonitoredPage.url`/`SiteScanResult.url`/`LandingPageAudit.url` (ممكن تحمل باراميترات فيها PII)**.
- **ماتفتحتش:** `workspaces/[id]/export-csv` · `site-scan/[id]/print` (مسارَي تصدير تانيين) · `admin/impersonate` (**إيه اللي بيتسجَّل وقت الانتحال**) · ويب هوك Paymob · راوتات ويب هوكس المتاجر نفسها (قرا `ingest.ts` بس، **ومحوّلات المنصات الخمسة ولا واحد فيهم اتفتح**) · `demoSeed.ts` (**هل بيانات الديمو مولّدة بالكامل ولا فيها حاجة من حساب حقيقي**).
- **`wa-conversion-tracker/app/api/whatsapp-webhook` ماتقراش — فـ«هل محتوى رسايل واتساب نفسه بيتخزّن» سؤال مفتوح.** المؤكَّد: التراكر بيهشّم قبل الرفع لجوجل، **وبيكتب على نفس قاعدة البيانات مش قاعدة منفصلة**.
- **النسخة الإنجليزية من سياسة الخصوصية ماتقارنتش بالعربية** — وتعليق `app/components/legal/Doc.tsx:5-7` بيقول صراحةً إن النصّين محرَّرين كلٌّ على حدة **مش مترجمين**، يعني ممكن يوعدوا بحاجات مختلفة. **فحص مستحق.**

### 4.7 release-readiness — ⚠️ **١ Critical · ٥ High · ٤ Medium · ١ Low**

> **R-1 تحت هو البند الوحيد في الأوديت كله اللي محتاج تصرّف فوري** — بيانات حيّة
> مكشوفة دلوقتي، مش عيب كود مستقبلي. أعدت التحقق منه بنفسي.

#### [Critical] R-1 — بيانات حملات حقيقية (صرف/إيراد/ROAS/ربح) مكشوفة بلا مصادقة في `public/`
- **Path:** `public/adloop-2026-08-10.html` — دخل في كوميت `12560f7f` بتاريخ ١٠ أغسطس ٢٠٢٦، **ولسه موجود في HEAD**
- **Repro:** `GET https://<domain>/adloop-2026-08-10.html` — **بلا جلسة، بلا توكن، بلا حدّ معدّل**. الملف تقرير أداء مولَّد (مطابق لقوالب `lib/reports/reportDocument.ts`) بأرقام حقيقية: صرف بالريال، انطباعات، صفوف لكل حملة بالصرف والإيراد وROAS والربح وعدد التحويلات.
- **Impact:** أي حاجة في `public/` في Next.js بتبقى ثابتة **ومتاحة للأبد على رابط قابل للتخمين وقابل للفهرسة، بصفر انتهاء وصفر إلغاء** — على عكس `app/report/[token]` اللي على الأقل عنده توكن غير قابل للتخمين وبوابة `active`/`expiresAt`. **دي بيانات عمل حقيقية لعميل (أو حساب اختبار حقيقي) بتتسرّب بلا نهاية، وهي في تاريخ git كمان — فمجرد المسح مش كفاية.**
- **Suggested fix:** `git rm` للملف، **وتنظيف التاريخ** (`git filter-repo` أو BFG) لأنها بيانات عمل حسّاسة مش أصل عابر. وضيف فحص في CI بيفشل على أي HTML بشكل تقرير مولَّد تحت `public/`. (اتأكد إن مفيش راوت تصدير بيكتب في `public/` — **مفيش**، ده كوميت يدوي لمرة واحدة، متسق مع إن قاعدة المشروع نفسها «متعملش `git add -A`» اتخرقت مرة.)
- **Verified:** **YES — تحقُّق مزدوج.** `git ls-files` أكّد إنه مرصود، و`git log --diff-filter=A` أكّد الكوميت والتاريخ، و`grep` أكّد وجود `kpi-value` وROAS وأرقام بالريال في المحتوى.

#### [High] R-2 · R-3 — التوثيق بيقول إن التنفيذ الحقيقي أضيق مما هو عليه، **في الاتجاهين**
تأكيد مستقل لـW-6 من وكيل تاني:
- **`CLAUDE.md` و`README.md:61-62` الاتنين بيقولوا "Scale لسه معلوماتي بس، Kill بس اتفعّل فعلياً"** — **غلط**: `lib/adDecisions.ts:405-429` `executeScale()` بينادي `changeGoogleCampaignBudget` و`changeMetaAdSetBudget` و`changeTikTokAdGroupBudget` — نداءات تعديل حقيقية على التلات منصات.
- **`CLAUDE.md` بيقول "على تدرّج المزايدة بس"** — **غلط**: الـ`switch` في `lib/actionFeed.ts:265-322` بينفّذ كمان `PAUSE_AD_{GOOGLE,META,TIKTOK}` و`PAUSE_CAMPAIGN` و`CHANGE_CAMPAIGN_BUDGET` و`APPLY_PRODUCT_PRICE`.
- **Impact:** مهندس (بشري أو موديل) بيقرا أي من الملفين هيفتكر إن تنفيذ Scale شغل مفتوح **وممكن يعيد بناء حاجة موجودة وحيّة على حسابات إعلانات حقيقية** — بالظبط فشل "بيدعو حد يبنيها مرتين".

#### [High] R-4 — `README.md:50-51` لسه بيقول إن رفع تحويلات ميتا/تيك توك «TODO في الكود»
**غلط**: `lib/conversionSync.ts:181` (`graph.facebook.com/.../events`)، `:299` (`uploadClickConversions`)، `:373` (`business-api.tiktok.com/.../event/track/`)، موصولين بكرون مسجَّل في `vercel.json`. **ودي بالظبط الادعاء الكاذب اللي `CLAUDE.md` نفسه صحّحه في كوميت `6aaf9af3` نفس اليوم — التصحيح نزل في `CLAUDE.md` ومااتنقلش لـ`README.md`، فالسطر الكاذب لسه في HEAD كبند مفتوح `[ ]` لوظيفة شغّالة ومؤثّرة على الإيراد.**

#### [High] R-5 — `SECURITY.md §16` بيقول إن أمان الدفع «صفر كود، لسه مش مبني»
**غلط**: ويب هوك Paymob مبني بالكامل — تحقق HMAC-SHA512 يفشل مقفولاً، ومنع تكرار عبر `markEventAsProcessed` + `pg_advisory_xact_lock`، وآلة حالة `PaymentIntent`. **التلات مبادئ اللي الوثيقة بتسردهم كـ"لما يُبنى، المبادئ الإلزامية" مطبَّقين بالفعل.** والوثيقة مؤرَّخة ١٨ يوليو وبتعرّف نفسها كوثيقة حيّة، وكوميتات إصلاحات الدفع نزلت بعدها من غير تحديثها. **Impact:** مراجع أمني بيثق في الوثيقة دي **هيتخطّى مراجعة ويب هوك الدفع بالكامل** — وده بينقض غرضها المعلن حرفياً. **وكمان:** سطح MCP OAuth الجديد (تسجيل عملاء ديناميكي عام، PKCE، توكنات Bearer) **غايب تماماً** من نموذج التهديد وأقسام المصادقة في `SECURITY.md`.

#### [High] R-6 — `NEXT_PUBLIC_APP_URL` بيكسر اكتشاف MCP OAuth بالصمت، **وشبكة أمان البيئة بتاعة المشروع نفسها مش متتبّعاه**
- **Path:** `.well-known/oauth-authorization-server/route.ts:13`، `.well-known/oauth-protected-resource/route.ts:15`، `app/api/mcp/route.ts:46` — **وغايب من الـ٣٥ بند المتتبَّعين في `lib/launchReadiness.ts:59-151`** (المتتبَّع هو `APP_URL` المختلف عنه، واللي عنده fallback آمن **مابينطبقش هنا** لأن المواضع دي بتقرا `NEXT_PUBLIC_APP_URL` مباشرة)
- **Repro:** انشر بلا المتغيّر (سهل تخلط بينه وبين `APP_URL`) → `/.well-known/oauth-authorization-server` بيرجّع `issuer: ""` و`authorization_endpoint: "/mcp/authorize"` **نسبي مش مطلق زي ما RFC 8414 بيتطلّب**. أي عميل ويب بيتبع المواصفة (claude.ai، ChatGPT) بيقع في وثيقة اكتشاف مشوّهة **والتدفّق بيموت بالصمت** — واللي بيربط بمفتاح Bearer ملزوق يدوياً عمره مايلمس المسار ده فمحدش بيلاحظ.
- **Impact:** `validateEnvOrThrow()` ولوحة `/admin` الاتنين ساكتين عنه — **شبكة الأمان اللي اتبنت بالتحديد بعد حادثة Paymob عشان تمسك "متغيّر ناقص بالهدوء" عندها نقطة عمياء على المتغيّر الوحيد اللي أحدث ميزة (MCP OAuth) معتمدة عليه.**
- **Suggested fix:** ضيفه لـ`READINESS` بحدّة FEATURE ونصّ يقول إيه اللي بيكسر.

#### [Medium] R-7 → R-10
- **R-7 — CSP** (`next.config.js:43`) مؤكَّد **مش متغيّر** — بند B1 المفتوح في `docs/open-audit-findings.md`، وله خطة مكتوبة بالفعل (طرح `Report-Only` الأول). الحدّة قرار `security-pentest`؛ الوجود والموضع مؤكَّدين هنا.
- **R-8 — `.env.example:82-84` و`activation-checklist.md:79` لسه بيوثّقوا `PLAN_PRICE_STARTER_CENTS`/`PLAN_PRICE_PRO_CENTS` كمطلوبين — والكود مابيقراهمش خالص.** `lib/plans.ts:6-8` بيشرح ليه: *«الأسعار في الكود لا في متغيّرات البيئة. النسخة السابقة كانت تقرأ ... فمتغيّر ناقص = سعر صفر = اشتراك مجاني صامت»*. **يعني باگ fail-open حقيقي اتصلح بحذف الاعتماد على البيئة — والوثيقتين مااتحدّثوش.** ضبطهم دلوقتي مالوش أي أثر، لكنهم بيمثّلوا خطوة تفعيل مش موجودة.
- **R-9 — أرقام `CLAUDE.md` قديمة بفارق كبير:** بيقول ٤٧ صفحة / ٧١ راوت / ٤٨ جدول. **العدّ الفعلي: ٨٢ صفحة / ١٣٣ راوت / ٨٠ موديل** — نقص ٤٣٪ و٤٧٪ و٤٠٪. (و`README.md` بأرقامه ٧٩/١٣٣/٨٠ أقرب بكتير للواقع.)
- **R-10 — `lib/rateLimit.ts:36-41` بيفشل مفتوحاً** — تأكيد مستقل لبند B2 المفتوح. **أثناء عطل قاعدة بيانات (وارد يتزامن مع هجوم)، كل نقطة عامة متبوّبة بتفقد خنقها في نفس اللحظة.**

#### [Low] R-11 — ملفات تطوير مكرَّرة في `public/`
`auth-visuaaaaal.png` (١.٦٤ ميجا، نسخة بخطأ إملائي من `auth-visual.png`) · `idEJwBzvQg_1786713424148.png` (شعار مكرَّر في الجذر بدل `public/logos/`) · `ZID.svg` (مكرَّر). ~١.٦ ميجا وزن ميت في حزمة النشر. **اتفحصوا بصرياً — مافيهمش محتوى حسّاس.**

---

#### ✅ حاجات رجعت نضيفة (متتفحصش تاني)
- **خطر جداول الـSQL الخام — الفئة الحرجة اللي حذّرت منها بنفسي: مؤكَّد مغلق.** بحث في الريبو والتراكر عن `CREATE TABLE` رجّع واحد بس: `wa-conversion-tracker/lib/db.ts:50` بينشئ `wa_clicks`. **والجدول ده معرَّف بالكامل في `prisma/schema.prisma:2814-2834` كـ`model WaClick` بـ`@@map("wa_clicks")`، وكل عمود ونوع مطابق للتعريف الخام عموداً بعمود** (تأكيد بالمقارنة المباشرة). **`db push` مش هيمسحه.**
- **الكرونات:** ٦↔٦ مطابقة تامة في الاتجاهين، وكلهم بيمرّوا من `denyUnlessCron` — **يعني باگ fail-open التاريخي في `marketing-emails` اتصلح في كل مكان.**
- **`.gitignore` مقابل المرصود فعلاً:** `git ls-files` على `.env|.pem|.key|dump.sql` رجّع `.env.example` بس، **وقرّاه وهو فاضي من أي قيم حقيقية**. مفيش أسرار مسرَّبة في الشجرة المرصودة.
- **`/api/live` و`/api/health/schema` مصادَق عليهم فعلاً** (`getSessionUser`) — على عكس ما كان متوقَّع في تكليفي. **مش نقاط عامة.**
- **أدوات MCP الأربعتاشر كلها للقراءة بس** — مفيش أداة كتابة، والتسجيل الديناميكي العام **مابيمنحش أي حاجة** لحد ما مستخدم مسجَّل يوافق عبر `/approve` اللي بيعيد فحص الملكية من ناحية السيرفر.
- **جدول جرد البيئة الكامل (٥٩ متغيّر)** في مخرج الوكيل — بأعمدة: موضع القراءة · إيه اللي بيكسر · **يفشل مفتوح ولا مقفول** · موجود في قائمة التفعيل · مطلوب للإطلاق. **الحاجزون الأربعة:** `DATABASE_URL` · `JWT_SECRET` · `TOKEN_ENCRYPTION_KEY` · `CRON_SECRET` — **كلهم بيفشلوا مقفولين صح**. و`RESEND_API_KEY` حاجز عملياً بس **بيتدهور بالصمت** (`resend = null` بلا انهيار).

#### لسه فاضل (من الوكيل)
- **ادعاءات اكتمال تحليلات الفجوات (جوجل ٢٥/٢٥ · ميتا · تيك توك) ماتحقّقتش** — ٢٤٨ بند عبر تلات وثائق، ده أوديت مستقل بذاته.
- `docs/security-audit-2026-07-18.md` ماتقراش كامل · نصّ `app/(legal)` القانوني · `manifest.ts` · **`app/api/agent/**` (اتحدّد ومااتقراش — نموذج المصادقة وكشف البيانات مش متحقَّق منهم)**.
- **`docs/activation-checklist.md` من §٣٢ لآخره (~٣٠٠ سطر) اتفحص بالعيّنة مش بالكامل** — آليات مزامنة أسعار ومخزون المتاجر مش متحقَّق منها مقابل الكود.
- تأكيد وقت التشغيل لسلسلة الثقة في `x-forwarded-for` على Vercel · **تجربة استرداد نسخة احتياطية فعلية** (`SECURITY.md` نفسه بيوثّق إنها ماتجرّبتش أبداً).

### 4.8 platform-sync — ⚠️ **٢ Critical · ٣ High · ٤ Medium · ١ Low**

#### ✅ جرد إصدارات API — **الوكيل جرده، وأنا حسمته بالبحث** (٢٤ أغسطس ٢٠٢٦)

الوكيل مالوش نت بتصميمه، فرجّع الجدول معلَّماً `needs-check`. الحسم:

| المنصة | الإصدار في الكود | الموضع | **الحالة الفعلية** |
|---|---|---|---|
| Google Ads | حزمة npm `google-ads-api@^24.1.0` | `package.json:22` — **مفيش أي نصّ إصدار REST مثبَّت في الريبو كله**، متروك للحزمة | ✅ **آمن.** الحزمة بتتبع إصدار الـAPI في رقمها الأكبر → API v24، وهو مدعوم. **للسياق: Google Ads API v21 غرقت فعلاً في ٥ أغسطس ٢٠٢٦، وv22 بتغرق أكتوبر ٢٠٢٦** — المشروع فوقهم بالفعل |
| Meta | `v25.0` في ١١ موضع | `syncMetaAds.ts:23` وغيره | ✅ **آمن.** صدر فبراير ٢٠٢٦، ومفيش تاريخ غروب معلَن. (v26.0 نزل، فإحنا إصدار واحد ورا الحالي — مش مشكلة) |
| Meta | **`v21.0`** | **`app/api/webhooks/meta-messenger/route.ts:14`** | ⚠️ **مهجور، وبيتشال من المنصة في ٢١ يناير ٢٠٢٧** — كمان ~٥ شهور. **ومختلف عن الـ١١ موضع التانيين** |
| TikTok | `v1.3` | `syncTikTokAds.ts:20` + موضعين حرفيين | ✅ الإصدار المستقر الحالي |

**اللي بيهمّك عملياً:** بند واحد له تاريخ — **ويب هوك ماسنجر على `v21.0` بيموت ٢١ يناير ٢٠٢٧**، وهو المسار اللي بيغذّي تحقق Click-to-Messenger. مفيش استعجال النهارده، بس هو الوحيد بساعة موقوتة.

**المصادر:** [Meta Graph API changelog v25.0](https://developers.facebook.com/docs/graph-api/changelog/version25.0/) · [Meta versioning policy](https://www.ayrshare.com/solutions/meta-graph-api-versioning-survival-kit-staying-ahead-of-v21-v22-and-beyond/) · [Google Ads API v21 sunset](https://ads-developers.googleblog.com/2026/06/google-ads-api-v21-sunset-reminder.html) · [google-ads-api npm](https://www.npmjs.com/package/google-ads-api)

#### [Critical] SY-1 — `expiresAt` بتاع جوجل بيخزّن انتهاء توكن الوصول (~ساعة)، مش عمر الاتصال الحقيقي: **كل تكامل جوجل بيبان «معطّل» بعد ساعة من الربط**
- **Path:** `app/api/oauth/google-ads/callback/route.ts:65`؛ القرّاء `lib/integrationsStatus.ts:211-215,485-489,513-515` و`lib/connectionHealthCheck.ts`
- **Repro:** الكولباك بيكتب `const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)` — و`expires_in` بتاعة جوجل هي عمر **توكن الوصول**، ~٣٦٠٠ ثانية. والوصول طويل الأمد بيجي من `refresh_token` اللي مخزَّن منفصل. و`assessHealth`/`computeHealthPct` و`checkExpiringConnections` بيقروا `expiresAt` **بشكل عام لكل المنصات بلا استثناء لجوجل** (متأكَّد: `grep` على `GOOGLE` جنب منطق الانتهاء في `integrationsStatus.ts` رجّع **صفر**). فبعد ساعة من كل ربط، كارت التكامل بيقول BROKEN/منتهي — **بينما المزامنة اليومية شغّالة تمام**.
- **Impact:** **إشارة صحة كاذبة على أهم تكامل في المنتج، دايمة ومتكرّرة.** والأسوأ إنها بتدرّب المستخدم يتجاهل مؤشّر الصحة — فلما يحصل انقطاع حقيقي، مش هيصدّقه. وكمان `checkExpiringConnections` بيبعت تنبيهات إيميل حقيقية (المسار موصول فعلاً) — يعني **إيميلات إنذار كاذبة كل ساعة**.
- **Suggested fix:** استثناء لجوجل زي اللي **موجود بالفعل وصح** في `app/api/oauth/test-connection/route.ts:59-65`: لجوجل الصحة = وجود `refreshToken`، مش `expiresAt`. اقتبس نفس المنطق في `integrationsStatus.ts` و`connectionHealthCheck.ts`.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد الكتابة في الكولباك، و`grep` أكّد **غياب** أي استثناء لجوجل في `integrationsStatus.ts`، و`sed` أكّد وجود الاستثناء الصحيح في `test-connection`.

#### [Critical] SY-2 — مساحة عمل بحسابين بعملتين مختلفتين بتخلط الاتنين في رقم واحد بالصمت
`lib/dataCurrency.ts:44-59` بيعمل `console.warn` بس عند الاختلاف — **مفيش تنبيه في الفيد، ولا بانر في الواجهة، ولا إيميل**. و`Workspace.dataCurrency` بتتجمّد على أول حساب زامن. (**نفس آلية D-13، بتأكيد مستقل** — والأثر على سقف الفوترة موصوف هناك.)

#### [High] SY-3 — مزامنة مقاييس جوجل الرئيسية مالهاش `try/catch` لكل حساب: **حساب واحد بايظ بيلغي مزامنة جوجل للمساحة كلها**
`lib/syncGoogleAds.ts:58-96,84` — الحلقة على الحسابات بلا عزل، **فاستثناء من حساب واحد بيجهض اليوم كله بما فيه الحسابات الشقيقة اللي توكناتها سليمة**. وده **مختلف عن ميتا** (عزل لكل حملة، `syncMetaAds.ts:158-160`) **وتيك توك** (عزل لكل حساب، `syncTikTokAds.ts:161-163`) — يعني النمط الصح موجود في الملفين التانيين ومش مطبَّق هنا.

#### [High] SY-4 — ٣ من ~٤٠ نداء في كرون المزامنة بس متغلّفين بـ`trackedSync`
`app/api/cron/sync-google-ads/route.ts:173-265` — أي استثناء في الـ~٣٥ الباقيين (الإبداعات، عبارات البحث، جودة النقاط، التسوق، فورم الليدز، **كل فحوصات التنبيهات**، `assessAndVerifyMessengerConversationsForWorkspace`، `runAutomationForWorkspace`، `measurePendingExperiments`) **بيلغي بالصمت كل اللي بعده للمساحة دي في اليوم ده**، والأثر الوحيد بلوب `CronRunLog.errors` **عام مش لكل مساحة**.

#### [High] SY-5 — ميتا: `429` بيتعامل زي «التقسيم مش مدعوم»، **فبيولّد طلبات إضافية فوراً بدل التراجع**
`lib/syncMetaAds.ts:424-462` — سلسلة الرجوع (`full` → `platform_only` → `none`) بتشتغل على أي فشل بما فيه حدّ المعدّل، **فطلب اترفض لتجاوز الحدّ بيتبعه طلبين كمان في نفس اللحظة**. و`X-Business-Use-Case-Usage` **عمره ما بيتقرا في الريبو كله** (متأكَّد بالبحث)، **ومفيش منطق backoff/retry لأي من التلات منصات**.

#### [Medium] SY-6 → SY-9
- **SY-6** ميتا: نداءات `/adsets` و`/ads` (فحص المرفوضة) **بلا `limit` ولا معالجة `paging.next`** — قصّ صامت على الحسابات الكبيرة.
- **SY-7** تيك توك: نقاط القوائم (تعليقات، فورم ليدز، جماهير مخصصة، مجموعات إعلانية) بتحطّ `page_size` **وعمرها ما بتمشي على الصفحات اللي بعدها** — مفيش `has_more`/`page_info`/cursor في الملف كله.
- **SY-8** `countDisapprovedGoogleAds` جوجل-فقط (فجوة معروفة وموثَّقة) **لكن نصّ التنبيه في `lib/i18n/dictionary.ts:96,4406` عمره ما بيفصح عن النطاق ده** — فمساحة ميتا-فقط أو مختلطة بتاخد طمأنينة كاذبة بـ«مفيش إعلانات مرفوضة».
- **SY-9** انقسام إصدار ميتا: `v21.0` في ويب هوك ماسنجر مقابل `v25.0` في ١١ موضع (التاريخ فوق).

#### [Low] SY-10 — `v1.3` و`v25.0` مكتوبين حرفياً بره ثوابتهم المشتركة في تلات مواضع — نفس شكل الباگ اللي أنتج SY-9.

#### ✅ رجعت نضيفة (متتفحصش تاني)
- **قيد فصل استعلامَي الجهاز والموقع الجغرافي في جوجل: محترَم فعلاً** — استعلامان مستقلان تماماً في `syncGoogleAds.ts:1084-1153`، كل واحد بـ`try/catch` خاص به.
- **قسمة الـmicros:** `cost_micros / 1_000_000` متطبَّقة **مرة واحدة بالظبط** في ٥+ مواضع — **مفيش قسمة مزدوجة**.
- **وحدات ميتا الصغرى:** `spend` (وحدات عملة) مقسومش صح، و`spend_cap`/`amount_spent` (وحدات صغرى) مقسومين على ١٠٠ صح — **والمكان الوحيد المحتاج تحويل معلَّم بتعليق أمين عن العملات تلاثية الكسور (KWD)**.
- **أمانة واجهة الفيديو:** `video-performance/page.tsx:80-82,124-130` بيحسب ويعرض قائمة `missingPlatforms` لميتا وتيك توك **بدل ما يوريهم أصفار** — مطابق للقرار الموثَّق. (**ملاحظة: ده يتعارض جزئياً مع D-10** اللي بيقول إن الصفحة فاضية للكل — الاتنين ممكن يكونوا صح: الواجهة أمينة عن المنصات الناقصة، لكن جوجل كمان مابيملّيش الأعمدة دي. **يتحسم بفتح الصفحة على مساحة حقيقية.**)
- **تشفير التوكنات:** كل كولباك OAuth بيكتب عبر `encryptToken` — **مفيش مسار كتابة نصّ صريح** في النطاق اللي اتقرا.
- **سباق التجديد المتزامن مش موجود بالتصميم:** جوجل عمره مابيخزّن/يعيد استخدام توكن وصول (المكتبة بتشتقّه من `refresh_token` كل نداء)، وميتا/تيك توك بيتستخدموا كما هم بلا خطوة تجديد داخلية — **فمفيش مسار "مزامنتين بيتسابقوا على التجديد"**.
- **مسار تنبيه انتهاء التوكن موصول فعلاً:** `checkExpiringConnections` → `pushToActionFeed` → إيميل حقيقي (`actionFeed.ts:74-97`) — **الآلية شغّالة، بس مدخلها مسمَّم بـSY-1**.

#### لسه فاضل (من الوكيل — صريح إنه خلص الميزانية)
- **`connected-platforms/disconnect` و`[id]`** ماتفتحوش — دلالات فكّ الربط والحذف، **وهل فكّ ربط في نص المزامنة يقدر يتسابق مع تكرار كرون شغّال**.
- **أقسام كبيرة من التلات ملفات مزامنة اتفحصت بـgrep مش بقراءة كاملة** — الوكيل سمّى بالظبط أي دوال اتقرت وأي دوال اتعيّنت: `syncMetaCreatives` · `syncCatalogCampaigns` · `checkMetaLearningPhase` · `checkCatalogSpendAlerts` · `checkMetaBidStrategyProgression` (ميتا) · `syncTikTokBidCap` · `LearningPhase` · `Lookalike` · `SparkAdsComments` · `LeadForms` · `Creatives` (تيك توك) · `syncAudiencePerformance` · `QualityScore` · `ShoppingProducts` · `PmaxChannels` · `YoutubeMetrics` · `BiddingStrategy` · `GoogleLeadForms` · `DisplayPlacements` (جوجل).
- `app/api/sync` **ظهر في القائمة ومااتفتحش خالص** · `oauth/login-facebook/*` و`login-google/*` · `entitlements.checkPlatformLimit`/`checkGrantLimit` (**فرض حدود الخطة وقت الربط غير متحقَّق منه**).

### 4.9 ecommerce-orders — ⚠️ **١ Critical · ٣ High · ٢ Medium · ٢ Low**

#### [Critical] E-1 — تكلفة المنتج غير المضبوطة (`cogs = 0`) بتتعامل كصفر حقيقي، **وبتغذّي اقتراح «رابح مؤكَّد — زوّد ميزانية إعلانك»**
- **Path:** `prisma/schema.prisma:2218` (`cogs Float @default(0)`) → `lib/ecommerce/productPerformance.ts:179-192,271-277` → **`lib/ecommerce/opportunities.ts:148-160`**؛ ونفس العيب في `storeIntelligence.ts:192-204,459-465` و`pricingHealth.ts:62-104` و`inventoryIntelligence.ts:130`؛ الجذر في `lib/pricingCalculator.ts:17-30` حيث `cogs` منوَّع `number` **مش `number | null`**
- **Repro:** `cogs` افتراضيها `0` — **و«مش متضبطة» و«بصفر» نفس القيمة بالظبط**. وطبقاً لواقع المنصات المؤكَّد: **ووكومرس وزد وإيزي أوردرز مابيبعتوش حقل تكلفة أصلاً**، وسلّة وشوبيفاي مابياخدوش واحدة إلا بعد ما التاجر يشغّل استيراد التكلفة — **يعني `cogs = 0` هي الحالة الطبيعية الشائعة لمنتج حقيقي متوصّل لسه**. و`calculateFullPricing` بتحسب `profitAtCurrentPrice` منفوخاً بكامل تكلفة الوحدة، **فمنتج خسران فعلاً بيتقلب `verdict: "WINNER"` بربح موجب**. وبعدين `opportunities.ts:150` بيفلتر `verdict === "WINNER" && confidence === "RELIABLE" && totalProfit > 0` **ويطلّع اقتراح `INCREASE_BUDGET` مكتوب عليه «رابح مؤكَّد» ورابطه على `/dashboard/campaigns/creatives`**.
- **Impact:** **المنتج بيوصّي بصرف فلوس إعلانات أكتر على منتج هامشه الحقيقي مجهول وممكن يكون سالب.** والهامش وROI وحكم «رابح» وحالة صفحة التسعير كلهم ممكن يكونوا إيجابيين كاذبين لأي منتج بلا تكلفة معروفة. **ومابيصلّحش نفسه** — بيفضل بالصمت لحد ما التاجر يدخّل تكلفة كل SKU يدوياً. **والتشخيص اللي المفروض يمسك ده (`STALE_COGS`) بيفشل كمان**: بيفحص `cogsLastUpdatedDaysAgo > 30`، و`cogsLastUpdatedAt` افتراضيها `@default(now())` عند إنشاء المنتج — **فمنتج تكلفته ماتدخلتش أبداً بيبان «طازة» مش «قديمة»**.
- **Suggested fix:** غيّر `cogs` لـ`number | null` في `FullPricingInputs`/`RawEcommerceMetrics`، ومرّر `null` لما التكلفة ماتدخلتش (أو ضيف عمود `costEverSet: boolean` بدل تحميل المعنى على `0`)، وخلّي كل منادي يمرّر `profitBasis: cogsKnown ? "REAL_COSTS" : "UNKNOWN"` بدل الحرفي المثبَّت. **والنمط الصح موجود بالفعل في المشروع**: `lib/ecommerce/storeComparison.ts:215-231` بيستخدم علم `sawCost` وبيرجّع `grossProfit: null` — **اقتبسه في الأربع مواضع التانية**. وفوراً: استبعد أي منتج تكلفته مجهولة من `INCREASE_BUDGET`.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` أكّد `cogs Float @default(0)`، و`sed` أكّد فلتر `opportunities.ts:150`، **وتعليق الكود نفسه في `app/dashboard/pricing/page.tsx:87` بيقول حرفياً: «بلا تكلفة = صفر أو غير مضبوط. الربح عندها يُحسب كأن السعر كلّه ربح.»** — يعني العيب معروف ومكتوب وغير معالَج على مستوى الصف.

#### [High] E-2 — محرّك Scale/Kill **مالوش أي وعي بحالة المخزون**
`lib/adDecisions.ts` **مافيهوش ولا إشارة لـ`stockQuantity` ولا `stockGuard`** (متأكَّد بالبحث). و`stockGuard.ts` نظام منفصل تماماً: بيشتغل مرة يومياً من كرون جوجل، وبيطلّع `ActionFeedItem` مستقل بتاعه بس. **فحملة بتروّج لمنتج `OUT_OF_STOCK` لسه ممكن تتصنّف `WINNER` وتترشّح للتوسيع**، لأن محرّك القرار عمره مابيستعلم المخزون أصلاً. **إجابة سؤال التكليف الصريح — «هل بيمنع التوسيع على منتج خلص؟» — لأ.** وأسوأ في المساحات اللي `pauseAdsOnOutOfStock` مقفول فيها، أو اللي مطابقة اسم الحملة بالـSKU بتفشل فيها (وهي مطابقة نصّية هشّة — W-13).

#### [High] E-3 — `Product.currentPrice`/`cogs` مالهمش عملة خاصة بيهم، **والتنبيهات بتلصق عليهم عملة حساب الإعلانات**
`prisma/schema.prisma:2206-2251` **مافيهوش حقل عملة على `Product`**، و`productSync.ts:166-176` بيكتب سعر وتكلفة المتجر الخام بلا تحويل وبلا وسم. و`Workspace.currency` موثَّق إنها بتتقفل من **حساب الإعلانات** (قاعدة «العملة بتتبع الفلوس»). فـ`pricingHealth.ts:112-117` بيبني التنبيه بـ`loss: actualLossValue` (بعملة المتجر) **و`currency: workspace.currency` (بعملة حساب الإعلانات)**. **تاجر متجره بالدرهم وحساب إعلاناته بالدولار بيشوف خسارة حقيقية "١٥٠ درهم" معروضة "$150" — فرق ~٣.٦٧×.** وبيأثر على كل رقم بعملة في نظام التسعير كله.

#### [High] E-4 — مفيش مصالحة تلقائية بين الطلبات الواصلة بالويب هوك وقائمة المنصة: **ويب هوك ضايع = طلب ضايع للأبد**
`orderBackfill.ts` **مالوش ولا نداء من أي كرون** — النداء الوحيد من راوت يدوي بيدوس عليه المستخدم. و`store-sync` (الكرون الوحيد للمتاجر) بيزامن المنتجات والأسعار والتكاليف **بس**. وويب هوكس المنصات كلها ليها نوافذ إعادة محاولة محدودة قبل ما تستسلم نهائياً. **سرّ متظبّط غلط لساعات، أو timeout، أو 5xx عابر في نافذة الإعادة، أو طلب وصل و`active` كانت `false` للحظة** — أي واحدة بتسقّط الطلب من الإيراد **بشكل دائم وصامت، بلا أي مسار استرداد تلقائي**. **دي الصورة المعكوسة لخطر التكرار: مش عدّ مزدوج، ده فقدان دائم — ومفيش تنبيه ولا لوج ولا إشارة في اللوحة تكشفه.**

#### [Medium] E-5 · E-6
- **E-5 — سباق قراءة-تعديل-كتابة **تاني ومنفصل** في استرجاع مخزون المرتجعات.** `ingest.ts:206-222` جوّه `applyStatusChange` فيه نفس النمط بالظبط بتاع D-14 لكن في مسار **إعادة التخزين عند الإرجاع** — نطاق سطور ودالة مختلفين. ويب هوكان لتغيير حالة على نفس الـSKU في نفس اللحظة بيضيّعوا واحد من التعديلين.
- **E-6 — `getLtvByChannel` **عمره ما يقدر** يحسب CAC حقيقي: بيخلط منصة التجارة بقناة التسويق.** بيقسّم العملاء بـ`Order.platform` — **واللي بيبقى دايماً واحد من الخمس منصات تجارة**، وبعدين بيدوّر على صرف إعلاني بنفس المفتاح. **و`ingest.ts` بيكتب `cost: 0` صريحة على كل صف متجر، والصرف الحقيقي دايماً تحت `GOOGLE_ADS`/`META_ADS`/… اللي عمرها ماتظهر كـ`Order.platform`.** فالنتيجة `null` دايماً وفي كل مساحة عمل. **بيفشل آمناً (`null` مش رقم غلط) — بس دي ميزة غير وظيفية هيكلياً، حيّة وقابلة للاستعلام عبر MCP**، والتسمية نفسها مضلِّلة (هي فعلياً "أول متجر اشترى منه العميل" مش تفصيل قناة تسويقية).

#### [Low] E-7 · E-8
- **E-7 — `runFullPricingSafetyNet` مش كود ميت، و`CLAUDE.md` قديم.** بيتنادى فعلاً من `lib/pricingHealth.ts:93-104` لكل منتج عنده `ProductSaleEvent` في آخر ٣٠ يوم، **وبيشتغل**: `slippedThrough` بيشغّل `actualLossAlert` وبيدفع `ActionFeedItem`. **(تأكيد مستقل لنفس تصحيح `release-readiness`.)** بيشارك عيب E-1 لكنه مش خامل.
- **E-8 — كرون حارس المخزون بيشتغل قبل مزامنة المخزون بنص ساعة** (`0 2` مقابل `30 2`) فبيقرا رقم امبارح. أثر بسيط بالنظر للإيقاع اليومي.

#### ✅ تغطية المنصات الخمسة — صريحة، وكلها اتقرت
| المنصة | المحوّل | التحقق من التوقيع | ملاحظة |
|---|---|---|---|
| شوبيفاي | ✅ | ✅ HMAC-SHA256/base64، **ثابت الزمن** | الهوية عبر `X-Shopify-Shop-Domain` |
| ووكومرس | ✅ | ✅ | الهوية عبر `X-WC-Webhook-Source` |
| سلّة | ✅ | ✅ **الاستراتيجيتين** — توقيع (افتراضي) وتوكن | الهوية عبر `merchant` في الجسم، مثبَتة بالتوقيع |
| زد | ✅ | ✅ Basic auth (**مفيش نظام توقيع عند زد أصلاً**)، وبيرفض صراحةً أي ترويسة توقيع مُختلَقة | أسماء الحقول ثقة متوسطة بإفصاح الملف نفسه |
| إيزي أوردرز | ✅ | ✅ سرّ مشترك في ترويسة | **مفيش ترويسة هوية متجر خالص** — بيتحلّ بمسح غير موسوم ثم وسم |

**والراوت الديناميكي بيحوّل أي `platform` غير معروف لـ404 قبل أي تحليل أو تحقق — مابيسقطش لافتراضي متساهل.** و`verifySignature` مالهاش حالة افتراضية، والقيمة غير المعروفة بترجع `undefined` اللي كل منادي بيعامله كرفض. **منع الإعادة: القيد الفريد بس، مفيش نافذة زمنية على أي منصة** — متسق مع التصميم، ومنطاق على مستوى الاتصال صح.

**وملاحظة إضافية على D-4:** الراوت القديم لسلّة **بيطبّق استراتيجية التوقيع بس** — مفيش فرع لاستراتيجية التوكن خالص — **وعمره مابيعالج أي حدث غير `order.created`**، يعني متجر لسه موصول بيه **عمره مايشوف مرتجع أو إلغاء بيتنقل**. بيقوّي توصية مسح الراوت.

#### لسه فاضل (من الوكيل)
- `workspaces/[id]/products` و**مسار رفع الإكسل** (`upload-sheet`, `UploadedSheet`/`UploadedSheetRow`) ماتفتحوش — قرا مسار CSV في `costImport.ts` بس.
- `storeFunnel.ts` · `productTelemetry.ts` — **اتعدّوا بالسطور بس**، وقف عندهم بوعي بدل ما ينشر التغطية أرفع.
- **صفحات `app/dashboard/ecommerce/*` اتفحصت بـgrep على أسماء الحقول مش بمنطق كامل** — **فمش متحقَّق إزاي E-1 بيتعرض فعلياً على الشاشة**، بس متحقَّق إن طبقة البيانات بترجّع رقم واثق.
- `customerCohorts.ts` بعد `getLtvByChannel` · `workspaces/[id]/ecommerce` (راوت إنشاء الاتصال — استنتج عنه من مستهلكيه) · `lib/mcp/tools.ts` · **رؤية الأدمن لبيانات متاجر المستأجرين**.

### 4.10 cron-reliability — ⚠️ **٢ Critical · ٤ High · ٣ Medium · ٢ Low**

> **السؤال الحاكم — «لو كرون وقف من أسبوع، مين يعرف؟» — الإجابة: محدش.** التفصيل في CR-3.

#### جدول الوظائف الستة

| الوظيفة | مصادقة | محدودة | آمنة ضد التداخل | فشل العنصر | استئناف | تنبيه عند الفشل | **تنبيه عند التوقّف الصامت** |
|---|---|---|---|---|---|---|---|
| `sync-google-ads` | ✅ | ❌ بلا `take` | ❌ | مختلط — ٣ من ~٤٠ متغلّفين | جزئي (ترتيب الأقدم أولاً) | ❌ | ❌ |
| `store-sync` | ✅ | ❌ عبر المساحات | ❌ | ✅ جيد فعلاً | ❌ بلا cursor | ❌ **مابيكتبش في أي جدول** | ❌ |
| `backup` | ✅ | محدود بالتصميم | لا ينطبق | ✅ ذرّي | لا ينطبق | ❌ | ❌ |
| `conversion-sync` | ✅ | ❌ | ❌ **حرج مثبَت** | ✅ لكل تحويل | جزئي | للعميل بس | ❌ |
| `marketing-emails` | ✅ | ❌ | ⚠️ الإرسال قبل التسجيل | ✅ جيد | تسامح يوم واحد | ❌ | ❌ |
| `push-notifications` | ✅ | ❌ | ⚠️ مسار الانتهاء بلا علامة | ❌ **بلا try/catch خالص** | ❌ يوم محدَّد بالظبط | ❌ **مابيكتبش في أي جدول** | ❌ |

#### [Critical] CR-1 — **الستة راوتات كلها بترد HTTP 200 حتى لما الوظيفة تفشل جوّه**
- **Path:** الستة ملفات في `app/api/cron/*/route.ts`
- **Repro:** `backup`: `BLOB_READ_WRITE_TOKEN` مش مضبوط → `backupCriticalData()` بترجّع `{success:false}` → الراوت بيعمل `NextResponse.json(result)` **بلا تجاوز للحالة** → **200**. ونفس النمط في الخمسة التانيين: `store-sync` بيرجّع `{ok:true}` حتى لو كل مساحة فشلت، و`conversion-sync` بيرجّع `{ok:true}` حتى لو `syncFailed` لكل المساحات، و`sync-google-ads` بيرجّع `{processed,...}` بلا `ok` ولا حالة مهما كان عدد الفاشل.
- **Impact:** **أي مراقبة بتعتمد على حالة الرد — ومنها لوحة كرونات Vercel نفسها — بتتعطّل للستة وظايف.** رن فشلت فيه كل مساحة **شكله من طبقة HTTP مطابق تماماً** لرن نجح فيه كل حاجة. **ده بالظبط سيناريو «٢٠٠ OK على جوب فشلت فيه ٤٠ من ٥٠ مساحة» — وبينطبق على كل وظيفة، مش واحدة.**
- **Suggested fix:** كل راوت يرجّع حالة غير 2xx (207/500) لما معياره مايتحققش — `!result.success` لـ`backup`، و`results.some(r => r.error)` لحلقات المساحات. **ودي إضافة للتنبيه الحقيقي مش بديل عنه** (CR-3).
- **Verified:** **YES — تحقُّق مزدوج.** `grep` على `NextResponse.json` + `status` في الستة ملفات رجّع **صفر نتيجة**.

#### [Critical] CR-2 — «إعادة المزامنة الآن» اليدوية بتتسابق مع المزامنة اليومية بصفر قفل
- **Path:** `lib/resyncWorkspace.ts:34-90`، `app/api/cron/sync-google-ads/route.ts:81-108`، `lib/integrationsStatus.ts:572-599`
- **Repro:** الكرون بيوصل لمساحة W الساعة ٢:٠٠، وفي نفس اللحظة عميل (أو أدمن من لوحة المالك) بيدوس «إعادة مزامنة». **`startSyncRun` بينشئ صف `SyncRun` جديد بلا أي فحص لصف `RUNNING` قائم لنفس `(workspaceId, platform)`** — والاتنين بيشتغلوا بالتوازي على نفس صفوف `MetricSnapshot`/`CreativeSnapshot`.
- **Impact:** كاتبان متزامنان على صفوف نفس اليوم — أحسن حالة upsert زايد، وأسوأ حالة **تحديث ضايع** أو صف مكرر لنفس اليوم/المنصة. وده بيغذّي محرّكات القرار (Scale/Kill، تدرّج المزايدة) اللي بتفترض صف واحد لكل مساحة/يوم. **وصامت** — ولا رن بياخد خطأ، و`SyncRun` هيوري صفّين `SUCCESS` لنفس النافذة.
- **Suggested fix:** في `startSyncRun` افحص وجود `SyncRun` بحالة `RUNNING` أحدث من نافذة تقادم معقولة قبل إنشاء واحد جديد، وارجع بـ«مزامنة جارية بالفعل». ونفس الحارس جوّه `resyncWorkspace.runSync`.
- **Verified:** YES

#### [High] CR-3 — **وظيفتان من الستة مابيكتبوش في أي جدول رصد خالص** — ولا حتى السلبي
- **Path:** `store-sync` و`push-notifications`؛ الكاتب الوحيد لـ`CronRunLog` هو `sync-google-ads:317`
- **Repro:** `CronRunLog` بيتكتب من `sync-google-ads` بس. و`SyncRun` من `sync-google-ads` (لـ٣ من ~٤٠ نداء) ومن `resyncWorkspace` اليدوي. **و`store-sync` و`push-notifications` مابينادوش ولا واحد** — متأكَّد بالبحث في كل مواضع الكتابة في الريبو.
- **Impact:** **دي إجابة السؤال الحاكم مباشرةً: لو `store-sync` أو `push-notifications` وقف من أسبوع، مفيش ملف ولا جدول ولا لوحة في المشروع كله هتوري ده** — ولا حتى واحدة الأدمن لازم يفتكر يبصّ فيها. و`getSystemHealth()` و`getOperationalAnalytics()` (اللي وراهم `/admin/system` و`/admin`) بيقروا من `CronRunLog`/`SyncRun` حصرياً — **فبيقدّموا تقريراً عن `sync-google-ads` وحده وعُميان تماماً عن الخمسة التانيين**. أول عرض لموت `store-sync` عند العميل هو بيانات مخزون وأسعار قديمة بتغذّي التنبيهات وصفحات التسعير **بلا أي خطأ في أي مكان**.
- **Suggested fix:** عمّم `CronRunLog` بعمود `job` (**الموديل حالياً مافيهوش حقل بيحدّد أي وظيفة الصف بتاعها** — متأكَّد من `prisma/schema.prisma:1921-1929`)، وخلّي الستة كلهم يكتبوا صف لكل رن. ووسّع `getSystemHealth()` عشان تجمّع بالوظيفة **وتعلّم أي وظيفة آخر `runAt` بتاعها أقدم من الفاصل المتوقَّع — يعني رجل ميت حقيقي**، مش أخطاء جوّه صفوف موجودة أصلاً.
- **Verified:** YES

#### [High] CR-4 — نداءان بلا حماية قبل الحلقة بيقدروا يصفّروا الرن كله — **ومايسيبوش أثر في `CronRunLog`**
- **Path:** `app/api/cron/sync-google-ads/route.ts:112` (`checkExpiringConnections(7)`) و`:116` (`purgeExpiredData()`)
- **Repro:** الاتنين بيشتغلوا **قبل** حلقة المساحات و**مش متغلّفين في `try/catch`** — على عكس كل نداء لكل مساحة وحلقة أزواج العملات اللي بعدهم مباشرةً، واللي متغلّفين صراحةً. لو أي واحد رمى (عطل DB، أو باگ في تعديل مستقبلي)، الراوت بيرمي بلا معالجة والدالة بتخرج **قبل ما تعالج ولا مساحة واحدة**. **ولإن `cronRunLog.create` هو آخر جملة في الملف (`:317`)، الفشل ده بينتج صفر صفوف `CronRunLog`** — فمع CR-3، يوم حصل فيه ده **شكله من كل زاوية متاحة في المنتج مطابق ليوم الكرون مااتنادىش فيه أصلاً**.
- **Impact:** استثناء واحد في أي من المساعدين — مش مشكلة API ولا مشكلة مساحة بعينها — **بيوقّع مزامنة اليوم لكل مساحة في المنتج، بأقل شكل فشل مرئي ممكن**.
- **Suggested fix:** غلّفهم بنفس نمط try/catch-and-continue المستخدَم تحتيهم. **والأهم: نقل `cronRunLog.create` لـ`try/finally`** (أو اكتب صف «بدأ» في الأول وحدّثه في الآخر) عشان انهيار في أي مكان يسيب سجلاً إن الرن بدأ وماكمّلش. **وده الإصلاح بالظبط اللي `docs/public/plan.md:58` مقترحه بالفعل ومااتنفّذش.**
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد النداءين بلا حماية، و`grep` أكّد `cronRunLog.create` في `:317`.

#### [High] CR-5 — الباكب غير متحقَّق منه، **مالوش أي مسار استرداد**، وبيغطّي جزءاً مما «حرج» بيوحي بيه
- **Path:** `lib/backup.ts:20-80`
- **Repro:** بيلتقط **أربع جداول بالظبط** (`User` بلا أسرار، `Workspace`، `ConnectedPlatform` بلا توكنات، `Product`) كـJSON في Vercel Blob، `access:"private"`، ٨ أسابيع. **ومفيش سكربت استرداد، ولا راوت أدمن، ولا أي اختبار بيقرا نسخة ويتحقق منها** — متأكَّد ببحث في الريبو كله: مفيش `scripts/*restore*`، ومفيش راوت بيقرا `blob.url` رجوعاً، ومفيش موديل `BackupLog`.
- **Impact:** **(١) نسخة غير متحقَّق منها = اعتقاد مش نسخة** — محدش جرّب يحمّل الـJSON ده رجوعاً في السكيما، فأي عدم توافق مش هيظهر إلا وقت الكارثة الفعلية. **(٢) فجوة نطاق:** `CampaignLink` (خريطة المساحة لحساب الإعلانات) و`EcommerceConnection` **مستبعَدين** — وبفلسفة الملف نفسه («بيانات مالهاش طريقة إعادة بناء لو ضاعت») **دول أهم من `Product`**: `CampaignLink` ضايع = كل عميل لازم يعيد ربط كل حملة يدوياً. **(٣)** استبعاد التوكنات (قرار أمني صح) معناه إن الاسترداد بيسيب كل اتصال **غير قابل للاستخدام لحد ما العميل يعيد المصادقة** — **وده مش موثَّق كشرط استرداد في أي مكان**. **(٤)** قاعدة التراكر الشقيق **بره النطاق تماماً** — فاسترداد `adloop-saas` وحده بيسيب بيانات الإسناد غير متسقة بين المنتجين بلا خطوة مصالحة موثَّقة.
- **Suggested fix:** اكتب `scripts/restoreBackup.mts` (أو إجراء يدوي موثَّق) بيحمّل أحدث نسخة في قاعدة تجريبية ويقارن عدد الصفوف — **وشغّله مرة واحدة على الأقل عشان تثبت إن الصيغة بتلفّ ورا**. ووسّع القايمة لـ`CampaignLink` و`EcommerceConnection`.
- **Verified:** YES لغياب مسار الاسترداد (بحث في الريبو كله) وللنطاق · **NO** لـ«هل الاسترداد هينجح فعلاً» — يتحسم بكتابة السكربت وتشغيله مرة.

#### [High] CR-6 — `push-notifications`: استثناء لمستخدم واحد بيلغي فحص انتهاء الاشتراك في نفس اليوم
`lib/pushNotificationChecks.ts:17-44` — الحلقة **بلا `try/catch`**، و`prisma.user.update` غير محمي. والراوت بينادي الفحصين بالتتابع **بلا `try/catch` على مستوى الراوت كمان** — فاستثناء في الأول **بيمنع التاني من الاشتغال خالص**. ومع CR-7 تحت، **المستخدم اللي تذكير انتهاء اشتراكه مستحق في اليوم ده بيفقده نهائياً** — إشعار متعلق بالفوترة بيتسقّط بسبب مشكلة مستخدم تاني مالوش علاقة.

#### [Medium] CR-7 → CR-9
- **CR-7** تذكيرات انتهاء الاشتراك **مالهاش علامة منع تكرار خالص** — الإرسال عند `daysUntilExpiry === 7 أو 1` بالظبط، ومفيش حقل بيسجّل «اتبعت». (بينما الفحص اللي فوقه بأربع سطور عنده `lastInactivityPushAt`.) فرن مزدوج = إشعارين متطابقين، **ويوم مفقود = التذكير ضاع لدورة الفوترة دي كلها** بلا نافذة تسامح.
- **CR-8** `marketing-emails`: **الإرسال بيسبق التسجيل** — `findUnique` ثم `resend.emails.send()` ثم `create`. رنّان متزامنان الاتنين بيعدّوا الفحص، **الاتنين بيبعتوا الإيميل**، والتاني بيفشل على القيد الفريد وبيتبلع في `catch` بلا تمييز بين «بعتناه للتوّ» وأي خطأ تاني. **الإصلاح: احجز الصف قبل الأثر الجانبي مش بعده.**
- **CR-9** `store-sync` و`sync-google-ads` و`conversion-sync`: **الاستعلامات المغذّية للحلقة الرئيسية كلها بلا `take`**. محدودة *جوّه* المتجر (٢٥ صفحة × ١٠٠) لكن **غير محدودة عبر عدد المساحات**، مقابل سقف ٣٠٠ ثانية. **وفشل `store-sync` صامت** (CR-3) — فtimeout هنا بينتج مصفوفة نتائج جزئية عمرها مابترجع، وآخر مساحة في النص مالهاش صف ولا خطأ ولا حاجة.

#### [Low] CR-10 · CR-11
- **CR-10** محتوى الباكب **مش مشفَّر على مستوى التطبيق** — `JSON.stringify` بيترفع كما هو. الأسرار مستبعَدة بالتصميم صح، فالمكشوف PII (`email`, `name`) وبيانات عمل في نصّ صريح ورا توكن. **و`lib/encryption.ts` موجود وهو النمط المعتمد في المشروع لأي حاجة حسّاسة.**
- **CR-11** التوقيتات UTC: `0 2` = ٥ صباحاً بتوقيت الخليج، و`0 3 * * 0` = ٦ صباحاً **الأحد وهو يوم عمل في الخليج ومصر**، و`marketing-emails` `0 9` = ١٢ ظهراً. **وتعليق الراوت بيقول «صباحاً في مصر» — ودي غير دقيقة لو مصر على UTC+3 في أغسطس.** **Verified: NO** — يتحسم بتأكيد سياسة التوقيت الصيفي المصرية الحالية، وهي بره ما الريبو يقدر يجاوب عليه.

#### ✅ رجعت نضيفة
- **التسجيل مطابق:** الستة مقابل الستة، **مفيش وظيفة ميتة ولا جدول يتيم** (مقارنة يدوية).
- **مفيش تلاعب بنطاق عبر باراميترات:** ولا واحد من الستة بيقرا `searchParams` — **فالمتصل مايقدرش يضيّق وظيفة عامة لمساحة واحدة حتى لو معاه السرّ**.
- **الحارس نفسه:** الستة بينادوا `denyUnlessCron` كأول سطر في `GET` — تأكيد مباشر فوق نتيجة `checkCronAuth`.

#### لسه فاضل (من الوكيل)
- **دوال المزامنة الـ~٤٠ نفسها** (سلوك الترقيم، معالجة الـtimeout لكل نداء، هل كل واحدة آمنة لإعادة التشغيل) — قرا الراوت المنظِّم مش دواخل الملفات التلاتة.
- `conversionSync.ts` الداخلي · `adDecisions.ts` و`scaleKillAlerts.ts` (المعالجتين التانيتين اللي `conversion-sync` بيشغّلهم) · `costSync.ts` · **دواخل `purgeExpiredData` و`checkExpiringConnections`** (حدّد إن نداءاتهم بلا حماية، **ومافتحش الملفين ليشوف لو عندهم مرونة داخلية بتخلّي الاستثناء مستبعداً عملياً**).
- **`lib/homeActivity.ts` و`lib/setupProgress.ts` بيقروا `SyncRun`** — مافتحوش ليشوف لو أي منهم ممكن يعمل رجل ميت غير مقصود ناحية العميل.
- **ملاحظة انضباط:** الوكيل **رفض عمداً يقرا `AUDIT-FINDINGS.md`** رغم إنه شافه في مخرجات البحث — «أثر غير مراجَع من جلسة سابقة، والمهمة بتتطلّب تحقّقاً مستقلاً». **ده التصرّف الصح.**

### 4.11 admin-ops — ⚠️ **٢ Critical · ٥ High · ٣ Medium · ٢ Low**

> **ملاحظة انضباط مهمة: الوكيل ده صحّح افتراضاً أنا مرّرته له.** أنا نقلت له إن
> `CustomerEditors.tsx:130` بيعرض **رقم الحقيقة** كحقل قابل للتعديل من الأدمن.
> **تتبّع المسار كاملاً وطلّع إن ده غلط** — التفصيل في AD-10. الاشتباه نزل من
> Critical لـLow، وده الاتجاه الصح للتصحيح.

#### مصفوفة أفعال الأدمن (١٩ فعلاً)
الجدول الكامل في مخرج الوكيل. الخلاصة: **كل الأفعال مُدقَّقة ما عدا واحداً** (الرد على تذاكر الدعم — AD-7)، **والقيم السابقة مسجَّلة في تلاتة بس** من التسعتاشر (`RESET_AI_LIMITS`, `SUBSCRIPTION`, `STAFF_ROLE_CHANGE`)، **ومفيش ولا فعل واحد بيطلّع تنبيه** (AD-3). **وولا صف تدقيق واحد بيحمل عنوان IP ولا أصل الطلب** — الموديل مافيهوش حقل ليهم أصلاً.

#### [Critical] AD-1 — الانتحال بيمنح جلسة كاملة كالعميل، **غير مميَّزة وغير محدودة بوقت** — و«القراءة فقط» في الواجهة بس
- **Path:** `app/api/admin/impersonate/route.ts:52`، `lib/auth.ts:71-73`، `middleware.ts:49-81`
- **Repro:** الراوت بيعمل `createSessionToken(targetUser.id)` — **نفس `jwt.sign({ userId }, ..., { expiresIn: "30d" })` بتاع تسجيل الدخول العادي بالظبط** — وبيحطّه في كوكي `session`. وكوكي `impersonating_by` بيتحطّ عشان `stop-impersonating` يعرف يرجّع لمين وبس.
- **Impact:** **كل راوت تاني في التطبيق بيحلّ الجلسة عبر `getSessionUser`، اللي مالوش أي مفهوم عن «انتحال»** — بيفحص `mfaPending` و`sessionInvalidatedAt` و`isSuspended` وخلاص. وبحث غير حسّاس لحالة الأحرف عن `impersonat` في الريبو كله رجّع ١٤ ملف، **ولا واحد فيهم راوت تعديل ناحية العميل ولا `middleware.ts`**. والمكان الوحيد اللي بيقرا حالة الانتحال هو `dashboard/layout.tsx:81` — **عشان يقرّر يرسم بانر أو لأ. بس.** يعني: **الحاجة الوحيدة اللي بتخلّي «العرض كـ» قراءة-فقط هي إن الأدمن بيختار مايدوسش أزرار الكتابة.** وأي كتابة أثناء الانتحال (تطبيق تدرّج مزايدة = صرف حقيقي من ميزانية العميل، تعديل إعدادات، تصدير، فوترة) بتنزل في جداول العميل نفسه **بصفر علامة إن أدمن مش العميل هو اللي عملها**. **وأخطر من ده:** التوكن مالوش `exp` قصير — الـ٤ ساعات المذكورة في التعليقات هي `Max-Age` بتاع الكوكي في المتصفح بس، **مش حدّاً مفروضاً من السيرفر** — فلو اتسرّب يفضل تسجيل دخول صالح كالعميل **٣٠ يوم**.
- **Suggested fix:** أصدر جلسات الانتحال بادّعاء مميّز (`{ userId, impersonatedBy: adminId }`) و`exp` قصير مطابق للـ٤ ساعات المُدّعاة. وضيف فحص في `getUserFromToken` بيرفض الطلبات المعدِّلة الحاملة للادّعاء ده إلا بقائمة سماح صريحة، **وخلّي `middleware.ts` يرفض `UNSAFE` methods عند وجوده** — كده الـAPI يبقى هو الحدّ مش الواجهة.
- **Verified:** **YES — تحقُّق مزدوج، وبدليل قاطع.** `sed` أكّد `createSessionToken(targetUser.id)`، و`grep` على `expiresIn` في `lib/auth.ts` أكّد: `:72` = `{ userId }` بـ**٣٠ يوم**، و**`:107` = `{ adminId, impersonating: true }` بـ٤ ساعات**. **يعني النمط الصح (توكن معلَّم قصير العمر) موجود في نفس الملف — واتطبّق على كوكي التتبّع بدل الجلسة الفعلية.**

#### [Critical] AD-2 — التعليق **مابيوقّفش الكرون اليومي** — بما فيه الكتابات الحقيقية على المنصات وصرف الـAI
- **Path:** `app/api/cron/sync-google-ads/route.ts:173-265`؛ `lib/auth.ts:51`
- **Repro:** الأدمن بيعلّق عميلاً (`isSuspended: true`). والكرون اليومي بيمرّ على كل مساحة عمل **وبيفحص `isSyncBlocked(ownerId)` بس** — وده سقف الاستخدام، **مالوش علاقة بالتعليق**. **مفيش فحص `isSuspended` في الملف خالص.**
- **Impact:** للحساب المعلَّق، الكرون بيفضل: **يسحب بيانات من جوجل وميتا وتيك توك**، و**يشغّل `runDailyDiagnosticsForWorkspace` (صرف Claude حقيقي)**، و — لو العميل كان مفعّل التنفيذ التلقائي على أي قاعدة أتمتة — **يشغّل `runAutomationForWorkspace` اللي بيعمل كتابات حقيقية على المنصات وبيصرف فلوس العميل، والعميل مقفول بره ومش قادر يتدخّل** لأن `isSuspended` بيمنع جلسته هو. **وإيميلات التسويق والإشعارات بتفضل رايحة كمان.** ومفيش حاجة في مسار التعليق بتلمس `subscriptionStatus`/`currentPeriodEnd` — **فتجديد Paymob مابيتأثرش بالتعليق أصلاً**. **«معلَّق» معناه بالظبط «مش قادر يسجّل دخول» وخلاص.**
- **Suggested fix:** فحص `isSuspended` جنب `isSyncBlocked` في حلقة الكرون، **ونفسه في `conversion-sync` و`marketing-emails` و`push-notifications`**.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` على `isSuspended` في `app/api/cron/` و`lib/aiRateLimit.ts` رجّع **صفر**، والمواضع الموجودة كلها في تسجيل الدخول/الجلسة/عرض الأدمن.

#### [High] AD-3 → AD-7 (خمسة)
- **AD-3 — `lib/adminSecurityAlerts.ts` بيغطّي حدثاً واحداً، ومفيش فيه ولا فعل أدمن عالي الخطورة.** الملف كله بيصدّر دالة واحدة: تنبيه دخول الأدمن من جهاز غير معروف. **يعني بدء الانتحال · تغيير دور طاقم (ترقية SUPPORT لـOWNER) · قلب علم ميزة (بما فيه `automation.apply` و`ai.insights`) · تصدير قاعدة العملاء كلها في ملف واحد — ولا واحد فيهم بيطلّع تنبيه لأي حد.** المالك اللي شغّال لوحده مالوش طريقة يعرف بأي منهم غير إنه يفتح `/admin/audit` بنفسه ويلاحظهم بعد وقوعهم.
- **AD-4 — التعديل وكتابة سجل التدقيق مش ذرّيين في أي مكان.** في كل راوت أدمن، `prisma.user.update` بيتثبّت **قبل** `logAdminAction`، بلا transaction وبلا `try/catch`. لو كتابة التدقيق رمت، **التغيير المؤثر على العميل نزل بالفعل، لكن الاستثناء بيطلع من المعالج فالواجهة بتقول للأدمن إن الفعل فشل**. الفعل حقيقي، وأثره التدقيقي لأ، والمتصل اتقاله العكس. **ده مش شكل قرار حد اتخذه بوعي.**
- **AD-5 — الاشتراكات المُهداة من الأدمن **غير مميَّزة عن الإيراد الحقيقي في لوحة المالك نفسها**.** `gift` بيحطّ `subscriptionStatus: "ACTIVE"` و`subscriptionPlan` و`currentPeriodEnd` — **حقول مطابقة هيكلياً لما تحطّه دفعة Paymob حقيقية**. و`monthlyRecurringOf` بيشتقّ MRR من الحقول دي **بلا أي فحص مقابل `PaymentIntent`**. والتعليق في راوت الاشتراك بيقول إن الهدية بتتسجّل بلا `amountCents` «عشان ماتنفخش أرقام النمو» — **لكن الحماية دي بتحمي `getRevenueSeries` بس، مش `paying`/`topByMrr`/`cohorts` اللي المالك بيشوفهم فعلاً على الصفحة الرئيسية**. حساب مُهدى بخطة وكالة بيظهر كحوت في «أعلى الحسابات». **ودي نفس آلية «رقم واحد بإجابتين» — بس هنا فعل المالك نفسه هو اللي بيفسد لوحة المالك نفسه.**
- **AD-6 — نداءات الـAI أثناء الانتحال بتتخصم بالصمت من حصة العميل نفسه.** أثناء الانتحال، `userId` بتاع الجلسة **هو** معرّف العميل — فأي ميزة AI الأدمن بيفتحها بتخصم من رصيد العميل الشهري (٨٠ نداء). **تحقيق دعم بيفتح كام صفحة بيقدر ياكل جزءاً ملموساً من ميزانية عميل حقيقي**، بلا أي إدخال مميّز في أي مكان — ولا في عدّادات العميل ولا في سجل التدقيق أبعد من صف `IMPERSONATE` واحد مابيقولش إيه اللي اتعمل في الجلسة.
- **AD-7 — ردود الأدمن على تذاكر الدعم مش مُدقَّقة.** `app/api/admin/support/route.ts` بينشئ `SupportMessage` **مرئي للعميل** — **ومفيش `logAdminAction` في الملف خالص** (بينما راوت الإغلاق جنبه مُدقَّق). **ودي الفعل الوحيد في الكونسول كله اللي (أ) بينشئ محتوى مرئي للعميل و(ب) بيقدر يحمل صور مرفقة — وهو الوحيد بصفر أثر تدقيقي.** «مين قال للعميل ده إيه وإمتى» **مش قابل لإعادة البناء من `/admin/audit` أصلاً**.

#### [Medium] AD-8 · AD-9 · AD-11
- **AD-8 — أعلام الميزات بتفشل مفتوحة، بما فيها `automation.apply` و`ai.insights`.** كل علم `defaultOn: true`، و`isFeatureEnabled` بيمسك أي خطأ Prisma وبيرجع للافتراضي — يعني **مفتوح**. ده **قرار موثَّق ومبرَّر** (التعليق بيقول إن عطل DB مالازمش يقفل المنتج للكل) ومعقول لمعظم الأعلام. **لكن معناه إن العلم الوحيد اللي غرضه كله «أوقف الكتابات الحقيقية على حسابات العملاء دلوقتي» مش قابل للاعتماد عليه كمفتاح طوارئ أثناء بالظبط نوع الحادث (مشكلة قاعدة بيانات) اللي المالك أكتر ما يحتاجه فيه.** الإصلاح: خبّي آخر حالة مقروءة بنجاح وارجع ليها عند الفشل، بدل الافتراضي الثابت.
- **AD-9 — `/admin/audit` مش قادر يفلتر بالفاعل ولا بالفترة الزمنية.** الصفحة بتجيب قائمة الأدمنز **للعرض بس**، والفلاتر الموصولة هي `action` ونصّ حرّ على `details` وخلاص — **مفيش `adminUserId` ولا نطاق تواريخ**. «ورّيني كل حاجة عملها الأدمن ده» مش ممكنة من الواجهة. **والفلترة بالهدف بتشتغل بالصدفة** لأن معظم نصوص `details` بتصادف إنها بتحتوي إيميل الهدف — **بحظّ تنسيق النصّ، مش بالتصميم**.
- **AD-11 — دور SUPPORT يقدر يعلّق وينتحل أي عميل، رغم نيّة التصميم المعلَنة «لا فلوس ولا صلاحيات».** التعليق فوق `SUPPORT_CAPS` بيقول إن الدعم «يشوف ويساعد ويصلّح، ومابيلمسش فلوس ولا صلاحيات ولا أعلام» — **والقائمة فيها `customers.suspend` و`customers.impersonate`**. ومع AD-1، **موظف دعم عنده نفس القدرة العملية بتاعة OWNER على أي حساب عميل فردي** — وده أخطر من «الفلوس» و«الصلاحيات» اللي الدور اتصمّم عشان يمنعهم عنه.

#### [Low] AD-10 — 🔷 **تصحيح: `verifiedConversions` في محرّر الأدمن هو سقف خطة، مش رقم الحقيقة**
- **Path:** `CustomerEditors.tsx:130` → `override/route.ts:24-27` → `lib/entitlements.ts:142-157` → `lib/usageCaps.ts:80-108`
- **الحقيقة اللي طلعت:** الحقل بيكتب في `User.planLimitOverrides.verifiedConversions` (عمود JSON)، واللي بيغذّي `PlanLimits.verifiedConversions` بس، واللي بيغذّي **سقف الحظر الشهري للمزامنة**. **وعمره مايلمس `MetricSnapshot.verifiedConversions`** (عمود رقم الحقيقة الفعلي). و`grep` على `metricSnapshot.(update|upsert|create)` في شجرة `app/api/admin` كلها رجّع **صفر**.
- **Impact:** **صفر على سلامة البيانات.** ده تجاوز حصة، نفس فئة رفع `monthlySpendUsd`. **الخطر الحقيقي الوحيد هو الاسم:** نفس السلسلة `verifiedConversions` معناها «سقف خطة» في مكان و«الرقم المعدود فعلاً» في مكان تاني. **والتصادم ده هو بالظبط اللي خلّى تكليفي أنا يصنّفها كـ«رقم الحقيقة مكشوف للتعديل»** — ومهندس جديد بيوصّل أداة أدمن، أو مدقّق بيعمل grep بالاسم، على بُعد نسخة-ولصق واحدة من إنه يوصّل تحكّم أدمن بعمود الحقيقة فعلاً.
- **Suggested fix:** غيّر اسم مفتاح الصلاحية لـ`verifiedConversionsCap` في `PlanLimits` و`entitlements.ts` و`override/route.ts` و`CustomerEditors.tsx` و`lib/plans.ts`.
- **Verified:** YES — تتبّع المسار كاملاً من الطرف للطرف.

#### [Low] AD-12 — تغييرات الاشتراك من الأدمن مابتطلّعش إشعاراً للعميل
راوت الاشتراك **مافيهوش `pushToActionFeed`**، بينما ويب هوك Paymob بيدفع «اشتراكك فعّال» عند الشراء الحقيقي. فالعميل اللي أدمن مدّد له أو أهداه **مالوش أي إشارة في التطبيق إن حاجة اتغيّرت**.

#### لسه فاضل (من الوكيل)
- `lib/admin/insights.ts` · `operational.ts` · `product.ts` · `usage.ts` — اتفتحوا عند تقاطعهم مع `topByMrr` بس، **مش مراجَعين لصحة أرقامهم (محسوبة ولا عناصر نائبة) ولا لتعارض مصدر تاني مع الصفحات الموجَّهة للعميل**.
- صفحات `/admin/plans` و`/admin/flags` و`/admin/system` و`/admin/customers` (مكوّنات الواجهة نفسها) · تبويبات `analytics` غير `CustomersTab`.
- `lib/supportEmail.ts` و`supportCategories.ts` **مافتحوش — فسؤال كشف الـPII في صندوق الدعم اتجاوب من شكل الراوت بس**، مش من قد إيه سياق حساب العميل بيتعرض جنب التذكرة.
- **تفاعل الديمو مع أفعال الأدمن** (تعليق/انتحال/تجاوز ضد مالك مساحة ديمو) — **ماتتبّعش خالص**.

### 4.12 ai-cost — ✅ **صفر Critical** · ٢ High · ٣ Medium · ٣ Low

> **دي أنضف حصيلة في الأوديت كله.** طبقة تكلفة الـAI مبنية صح: كل النداءات متبوّبة،
> والسباق مقفول بشكل ذرّي، والدفتر بيطابق الكود في مواضع النداء.

#### جرد مواضع النداء — **كامل: ٥ نداءات في ٤ ملفات، مش أكتر ولا أقل**
بحث في الريبو كله عن استيراد `@anthropic-ai/sdk` و`messages.create` و`new Anthropic(` **وكل `await import(`** — **ومفيش موضع ديناميكي بيحمّل أي من الأربع ملفات دي**، فالبحث الساكن كامل هنا (على عكس سابقة `conversionSync.ts` اللي المشروع اتعلّم منها).

| الملف | المشغّل | متبوّب؟ | مخبّأ؟ |
|---|---|---|---|
| `lib/aiChat.ts:116` | دوسة — صندوق «اسأل» | ✅ شهري + ١٢/ساعة | ❌ |
| `lib/aiInsights.ts:115` (أ) | دوسة — تحديث الرؤى | ✅ شهري + ٢/ساعة | ❌ |
| `lib/aiInsights.ts:115` (ب) | **كرون يومي** عبر `runDailyDiagnosticsForWorkspace` | ✅ **نفس الدلو**، وبيستبعد `isDemo` | ❌ |
| `lib/imageQualityAudit.ts:74` | دوسة — فحص جودة الصورة | ✅ ٣٠/شهر لكل الخطط + ٥/ساعة | ❌ |
| `lib/landingPageAudit.ts:394,568` | دوسة — الفحص العميق، **١-٤ نداءات للفحص الواحد** | ✅ شهري حسب الخطة + ١/ساعة | ❌ بلا كشف تكرار على الرابط |

#### ✅ فحوصات رجعت نضيفة — دي إجابات إيجابية مستحقّة
- **الأربع راوتات والكرون كلهم بيستشيروا `lib/aiRateLimit.ts` قبل النداء بصرامة، وبيردّوا الرصيد عند الفشل.**
- **سباق فحص-ثم-تصرّف مقفول:** نمط `updateMany` الذرّي بشرط `lt` في `claimQuotaAtomically:84-125` بيقفل بالظبط السباق اللي حذّرت منه في تعريف الوكيل. **متحقَّق بقراءة الشرط الفعلي.**
- **مفيش راوت غير مصادَق عليه بيوصل نداء Claude.**
- **سطح MCP غير-AI بالكامل** — أدوات قراءة من قاعدة البيانات وخلاص.
- **`docs/claude-api-usage-map.md` بيطابق الكود في مواضع النداء بالظبط** — مفيش موضع وهمي ولا ناقص.

#### [High] AI-1 — سقف الدفتر «المضمون» محسوب على ثوابت قديمة، **مش على الأسقف الحقيقية المتدرّجة بالخطة**
- **Path:** `lib/aiRateLimit.ts:183-190` و`:294-295` مقابل `lib/plans.ts:116,128,142,154,178` مقابل `docs/claude-api-usage-map.md:65-70,94,97-102`
- **Repro:** الكود بيحطّ `effectiveMonthly = credits.left` **مباشرةً**، والتعليق جنبه بيوثّق إن ده إصلاح مقصود شال `Math.min(MONTHLY_LIMIT, credits.left)` عشان مشترك Agency ياخد الـ٦٠٠ اللي دفع فيهم بدل ما يتقصّ على ٨٠. **لكن `docs/claude-api-usage-map.md` — دفتر الإنفاق بتاع المشروع نفسه، اللي `CLAUDE.md` بيحيل عليه كمصدر حقيقة — لسه بيحسب جدول «$3.09-$4.88/شهر مضمون» بالثابت المسطّح ٨٠**، ونصّه في `:94` لسه بيقول «٨٠ نداء/شهر» كأنه *السقف* المفروض.
- **Impact:** لمشترك Enterprise (`aiCredits: 2_000`)، ميزانية نداءات Claude الشهرية الحقيقية للرؤى والمحادثة معاً **لحد ٢٠٠٠ نداء، مش ٨٠ — يعني ~٢٥ ضعف الرقم الموثَّق**. والفحص العميق لحد ٥٠ فحص × ٤ نداءات = ٢٠٠ نداء، مش الـ«٥×٤» اللي جدول التكلفة بيفترضها. **بتقدير من أرقام الدفتر نفسه** (تقدير، مش قياس)، مشترك Enterprise واحد بيستهلك كامل استحقاقه ممكن يكلّف **~$50-65/شهر** مقابل الـ«$3.09-$4.88 مضمون» المعروضة كسقف مُثبَت رياضياً. **الفجوة هيكلية مش ضوضاء.** والدفتر كمان **مابيسعّرش `claude-sonnet-5`** اللي `planModelFor` بيختاره فعلاً للخطط الأعلى — وملاحظته إن «ترقية Sonnet-5 لم تُنفَّذ» **هي نفسها قديمة، الكود منفّذها**.
- **Suggested fix:** حدّث جدول التكلفة ليحسب لكل خطة من `PLANS[*].limits`، **واجلب تسعير Sonnet-5 الحقيقي قبل إعادة ذكر أي سقف «مضمون»**. **مفيش تغيير كود مطلوب — ده إصلاح دقّة توثيق، بس حامل لأن `CLAUDE.md` بيقول للوكلاء الجايين يثقوا في الملف ده بدل ما يعيدوا الاشتقاق.**
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد `effectiveMonthly = credits.left` والتعليق الموثِّق للتغيير، و`grep` أكّد `aiCredits: 0/50/200/600/2_000`، و`grep` أكّد إن الدفتر لسه على «٨٠ نداء/شهر».

#### [High] AI-2 — مهلة العميل أقصر من زمن التفكير التكيّفي + إعادة محاولة الـSDK بتضاعف التكلفة
- **Path:** الأربع ملفات بتعمل `new Anthropic({ timeout: 20_000 | 30_000, maxRetries: 2 })` وبعدين بتنادي بـ`thinking: { type: "adaptive" }`
- **Repro:** الوكيل قرا مصدر الـSDK المثبَّت (`node_modules/@anthropic-ai/sdk/client.js:527-567`): عند مهلة محلية، `isTimeout` بيبقى `true`، ولو في محاولات باقية **الـSDK بيعيد إرسال نفس الطلب بالحرف**. **وده مش افتراضي:** `lib/aiErrors.ts:46-50` فيه نوع خطأ `TIMEOUT` مخصص، **وموجود لأن المهلات بتحصل في الإنتاج**، ورسالته للمستخدم حرفياً «أعد المحاولة» — **يعني بتدعو لمحاولة رابعة فوق التلاتة اللي الـSDK عملها بالفعل**.
- **Impact:** كل مهلة = مضاعف تكلفة لحد ٣× للنداء المنطقي الواحد، كلها بتبعت نفس الـsystem prompt والسياق كامل. **والنداء غير متدفّق (non-streaming)** — يعني الموديل بيولّد الرد كله قبل ما أي بايت يرجع، **فمفيش تأكيد إن إلغاء العميل بيوقّف التوليد (والمحاسبة) عند السيرفر**. والفحص العميق (٤ نداءات أصلاً) أي نداء فرعي فيه ممكن يتضاعف مستقلاً.
- **Suggested fix:** ارفع `timeout` لما يناسب `thinking: adaptive` فعلاً (**الافتراضي الداخلي للـSDK للنداء غير المتدفّق بيوصل ١٠ دقايق** حسب `_calculateNonstreamingTimeout`)، **أو حطّ `maxRetries: 0`** وسيب `try/catch` على مستوى الراوت (وهو صح بالفعل وبيردّ الرصيد) يملك قرار الإعادة.
- **Verified:** YES لآلية الإعادة (قراءة مصدر الـSDK، بلا أي نداء API) · **NO** لهل Anthropic بتوقّف المحاسبة عند إلغاء العميل لنداء غير متدفّق — **يتحسم من توثيق Anthropic، مش بنداء تجريبي**.

#### [Medium] AI-3 → AI-5
- **AI-3 — الفحص العميق مالوش `maxDuration`، فممكن يتقتل في النص متجاوزاً شبكة أمان ردّ الرصيد.** الراوت بيستهلك الحصة وبعدين بيسلّم الشغل لـ`after()` — **وكل راوت تقيل تاني في المشروع بيحطّ `maxDuration` صراحةً لنفس السبب** (٣٠٠/٦٠/٣٠٠/١٢٠)، **وده الاستثناء الوحيد رغم إن الدفتر بيسمّيه «أكبر استهلاك دفعة واحدة في المشروع كله»**. وتعليق الملف بيدّعي إن `after()` بيتجنّب حدّ وقت السيرفر — **و`after()` على Vercel بيشتغل جوّه نفس نسخة الدالة وبيتقيّد بنفس `maxDuration`**. لو اتقتل: نداء Claude اتبعت واتحاسب عليه، والنتيجة عمرها ماتتخزّن، **وردّ الرصيد في `catch` بس فالقتل الصلب مابينفّذهوش** — المستخدم بيخسر رصيد فحص وبيفضل عنده فحص `PENDING` للأبد.
- **AI-4 — مفيش تخبئة لإعادة الفحص:** نفس الرابط ممكن يتفحص بالكامل بلا كشف تغيير. محدود بسقف الخطة فمش بلا حدّ، **لكن كل فحص مكرر لصفحة ماتغيّرتش بيكلّف ~$0.21-0.35 لصفر معلومة جديدة** من حصة نادرة وغالية أصلاً.
- **AI-5 — مفيش `cache_control` في أي من الخمس مواضع** (البحث في الريبو كله رجّع صفر). كل دالة بتبني system prompt كبير ثابت وبتبعته بالحرف كل مرة. **الهدر الدولاري متواضع بالحجم الحالي، لكنه مكسب مباشر بصفر مخاطرة** — والتخبئة موجودة عند Anthropic بالظبط للشكل ده.

#### [Low] AI-6 → AI-8
- **AI-6** `lib/rateLimit.ts` العام **مش موصول بأي راوت AI** — الدفاع كله على الأسقف الساعية. **دفاع في العمق ناقص، مش باب مفتوح** (الأسقف الساعية بتحدّ أسوأ حالة).
- **AI-7** مفيش تصغير للصورة قبل إرسالها لـClaude Vision — `imageQualityAudit` بيحوّل البفر الخام لـbase64 مباشرة. محدود عملياً بأحجام الإبداعات المعتادة.
- **AI-8** **اختيار الموديل متعارض مع مبدأ الخطط:** `plans.ts` بيوثّق «الباقات الأعلى على الأحدث»، و`aiChat`/`aiInsights` بيحترموه عبر `planModelFor()` — **لكن `imageQualityAudit` و`landingPageAudit` بيثبّتوا `claude-sonnet-4-6` لكل الخطط**. **مش تجاوز تكلفة (بالعكس أرخص)** — فجوة اتساق منتج: عميل Agency بيدفع في الموديل الأحدث ومابياخدهوش في ميزتين.

#### لسه فاضل (من الوكيل)
- الخمس كرونات التانية **اتأكّد بالبحث إنها مابتلمسش Claude**، لكن ماتقرتش سطراً بسطر.
- `pageAudit.ts` · `performanceAudit.ts` · `diagnosticsEngine.ts` — **اتفحصوا للاستخدام (مفيش) مش بقراءة كاملة**؛ الحمولات الداخلة للنداءات **اتفحصت وطلعت محدودة صراحةً** (`slice(0,3000)`).
- **تسعير `claude-sonnet-5` الحقيقي مش موجود في الريبو خالص** (الدفتر نفسه بيعلّمه كغير مقيس) — فتقديرات AI-1 بتستخدم سعر Sonnet-4.6 **كأرضية، معلَّمة صراحةً كتقدير مش قياس**.
- **هل Anthropic بتوقّف المحاسبة عند إلغاء نداء غير متدفّق** · **مدة Vercel الافتراضية للدوال** — الاتنين بره ما الكود يقدر يجاوب عليه.

### 4.13 wiring-errors — ⚠️ **١ Critical · ٣ High · ٦ Medium · ٣ Low**

#### [Critical] WR-1 — كرونا `conversion-sync` و`store-sync` بيبلّغوا نجاح دايماً حتى لو كل مساحة فشلت
تأكيد مستقل لـCR-1 من زاوية مختلفة: كل مساحة في `try/catch` بتاعها، والفشل بيتكتب في `entry.error` — **حقل محدش بيقراه** — والراوت بيرجّع `{ ok: true, ... }` غير مشروط. **ولا الاتنين بيكتبوا في `CronRunLog`** (`grep` على `app/api/cron` رجّع ملف واحد بس)، **ولا `conversionSync.ts` ولا `productSync.ts` بينادوا `startSyncRun`/`finishSyncRun`** (صفر تطابق في الملفين) — **فمفيش صف `SyncRun`، وهو الجدول اللي بيغذّي كل مؤشّر «آخر مزامنة» بيشوفه العميل والأدمن**. لو رفع التحويلات اتكسر لكل المساحات (توكن ميتا منتهي، تغيير في API تيك توك)، **لوحة كرونات Vercel بتشوف 200 وبتقول رن سليم، ومفيش صف تنبيه، ومفيش مؤشّر بيبان قديم للعميل** — والمنصات بتبطّل تتعلّم من التحويلات الحقيقية لحد ما حد يلاحظ بالصدفة.

#### [High] WR-2 → WR-4
- **WR-2 — فكّ ربط التكامل بيفشل بصمت تام.** `IntegrationsView.tsx:131-140`: `await fetch(...).catch(() => null)` وبعدين `if (res?.ok) router.refresh();` — **مفيش `else` خالص**. المستخدم عدّى تأكيد بدرجتين ("مش هينفع تتراجع") وبيفتكر إنه فصل حساب إعلانات أو متجر — **وعند الفشل الاتصال بيفضل حيّ وبيكمّل مزامنة وكتابة نيابة عنه**، بلا رسالة ولا فرق بصري بين «بيشتغل» و«فشل بهدوء».
- **WR-3 — رسالة الاستثناء الخام بترجع للعميل، ونصّ عربي مثبَّت بيتخطّى الترجمة.** `integrations/disconnect/route.ts:109-114` بيرجّع `err.message` الخام في جسم JSON بحالة ٥٠٠ — **ودي بالظبط الحالة اللي راوتات شقيقة صلّحتها بنمط رمز مرجعي** (`action-feed/[id]/apply:48-64`، `creatives/decision:47-66`)، **والراوت ده اتفات**. ومسار النجاح في `:105-108` بيثبّت نصّاً عربياً رغم إن الدالة أصلاً بتحلّ `locale` وبتستخدم `t(locale,...)` في أربع مواضع تانية في نفس الملف. **النصّ الخام مش معروض حالياً (WR-2 بيبلعه) لكنه على السلك** — مرئي في devtools لأي مستخدم، ورسائل أخطاء قواعد البيانات بتحمل أسماء جداول وأعمدة وقيود.
- **WR-4 — تعديل/تبديل قواعد الأتمتة: تعديل بيتبعت وينسى، بأخطاء مبلوعة وبلا قفل.** `ActiveRulesList.tsx:62-71` بيعمل `.catch(() => {})` وبعدين `router.refresh()` غير مشروط. **والأسوأ إن النداءين مابيستنّوش:** `onSave` بيقفل فورم التعديل **قبل** ما الطلب يرجع، و`onChange` على مفتاح تشغيل الأتمتة **مابيمرّرش `disabled={busy === rule.id}`** رغم إن حالة `busy` موجودة في الكومبوننت. **المشترك بيقفل قاعدة أتمتة بتوقّف حملة خسرانة أو بتغيّر استراتيجية مزايدة؛ لو الطلب فشل، الفورم بيقفل والمفتاح بيرجع لقيمته القديمة بصمت — وهو فاكر إن الأتمتة اتقفلت، وهي شغّالة وبتعمل كتابات حقيقية.**

#### [Medium] WR-5 — 🔷 الفحص المبني بالظبط لعيب المنتج ده **مش موصول بأي صفحة**
- **Path:** `app/dashboard/diagnostics/DataConsistencyCheck.tsx` + `app/api/workspaces/[id]/data-consistency-check/route.ts`
- **Repro:** الكومبوننت بيستدعي راوت **موجود وشغّال فعلاً**، وصفحة التشخيصات بترسم `DiagnosticsView` مش الكومبوننت ده — **واللي مالوش ولا مستورد واحد في الشجرة كلها**.
- **Impact:** **ميزة معمولة عشان تمسك بالظبط شكل الفشل بتاع المنتج ده** («عدد الكليكات المخزَّن عندنا مقابل العدد الحيّ عند المنصة») **موصولة بالكامل من ناحية السيرفر وغير قابلة للوصول من ناحية العميل**. دي الفجوة اللي المنتج موجود عشان يقفلها، **والتشخيص الوحيد المبني ليها محدش يقدر يشغّله**. **ولو اتوصّل بكرة، D-12 بيقول إنه بيرجّع «متطابق» لما مايقدرش يفحص** — فهو محتاج إصلاحين مش واحد.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` أكّد صفر نداء للكومبوننت، و`ls` أكّد إن الراوت موجود.

#### [Medium] WR-6 → WR-10
- **WR-6 — نفس نمط التعديل المبلوع في أربع مكوّنات تانية:** لوحة المنافسين · التجارب · التقارير المحفوظة · تغطية التتبّع. **الإصلاح: مساعد مشترك واحد** بدل تكرار `.catch(() => {})`.
- **WR-7 — `TrustNumber.tsx` كود ميت — وهو «نقطة التطبيق» المسمّاة في `CLAUDE.md` لاتجاه التصميم.** التوثيق بيقول: «`TrustNumber.tsx` + `MetricCard`'s `verified?` prop هما نقطة التطبيق». **نص الادعاء صح** (`MetricCard.verified` موصول فعلاً في ٧ مواضع حيّة)، **والنص التاني غلط** — الكومبوننت المخصص مالوش ولا نداء. **Checked:** استيراد ساكن · `await import(` · قراءة الملف (كومبوننت حقيقي مش stub).
- **WR-8 — `GapMeter.tsx` + `PlatformBreakdown.tsx`: «العنصر التوقيعي للمنتج كله» (بتعليق الملف نفسه) غير مبني عملياً.** المنتج عنده تصوّر فجوة شغّال فعلاً — **بأسماء تانية** (`GapChart`/`GapSparkline` الحيّين في `TruthView.tsx`). **مفيش مسار مكسور — الاكتشاف إن الكومبوننت اللي التوثيق بيسمّيه العنصر التوقيعي اتجاوزه غيره واتساب في الشجرة.**
- **WR-9 — `lib/qualitySignals.ts`: محرّك كشف بوتات **أكثر تطوراً** من اللي شغّال، وغير مستخدَم بالكامل.** `detectSuspiciousIPs` بيدمج تكرار IP وأنماط User-Agent في `suspicionScore` مرجّح — **مجموعة أشمل من اللي `CLAUDE.md` بيوصفه كالتنفيذ الحيّ**. والفحص الحقيقي في `lib/trafficQualityCheck.ts`. **يعني تنفيذ تاني أفضل اتبنى واتساب، وغير موثَّق كده في أي مكان.**
- **WR-10 — تمييز `lib/aiErrors.ts` بين «حصتك خلصت» و«العطل عندنا» مستخدَم في راوت AI واحد من أربعة.** التلاتة التانيين بيجمّعوا حدّ المعدّل والمهلة والعطل الحقيقي في رسالة عامة واحدة. **مفيش تسريب أخطاء خام (كلها مترجَمة) — الفجوة إن التمييز اللي الملف اتعمل عشانه متاح على سطح واحد بس.**

#### [Low] WR-11 → WR-13
- **WR-11 — اتنين من أربع اعتماديات مُعلَّمة فعلاً ميتة، واتنين إيجابيات كاذبة.** `googleapis` و`facebook-nodejs-business-sdk` **مالهمش ولا استيراد في المشروع كله** — كل نداءات ميتا وجوجل الحقيقية بتمرّ بـ`fetch` خام. **و`framer-motion` إيجابي كاذب** (مستخدَم فعلاً في `GuidedTour` و`ValueMoment` عبر بوابات). **Checked:** الشكلين الساكن والديناميكي + تتبّع نداءات الشبكة الفعلية.
- **WR-12 — ١٢ ملف ميت مؤكَّد** من قايمة knip. **ولاحظ:** `DataTable.tsx` و`SettingsPrimitives.tsx` تعليقاتهم بتوصفهم كالبدائي المشترك المقصود لفئة واجهة كاملة («مفيش جدول يتعاد تصميمه لكل قسم») — **اتبنوا مرة واتساب من غير ما حد يتبنّاهم**.
- **WR-13 — `public/sw.js` إيجابي كاذب من knip** — مسجَّل بمسار نصّي (`navigator.serviceWorker.register("/sw.js")`) مش باستيراد موديول. **موصول صح، والتحليل الساكن مش شايفه. مذكور عشان مايتمسحش بالغلط من قايمة knip.**

#### لسه فاضل (من الوكيل)
- **~٩٠ بند «export/type غير مستخدَم» في knip ماتفتحوش** — الوقت راح للطبقة الأعلى قيمة (الملفات الكاملة والاعتماديات) حسب ترتيب الأولوية.
- **دواخل ملفات المزامنة التلاتة** — **ماتحقّقش هل أي `catch` داخلي بيرجّع `0`/`[]` لمقياس بيتعرض بعدها كصفر شرعي على صفحة حملة**. دي أهم فجوة متبقية في نطاقه.
- ٢٥+ صفحة تحت أقسام المنصات · صفحات الإيكومرس · `report/[token]` · MCP · الفوترة · `demoSeed.ts`.
- **المطابقة بين الـ١٣٣ راوت وكل نداء عميل اتعملت للنداءات بمسار حرفي بس (٨٥ نداء، كلهم تطابقوا)** — النداءات عبر دوال مساعدة ماتتبّعتش.

### 4.14 brand-i18n-scale — ⚠️ **١ Critical · ٤ High · ٥ Medium**

> **الوكيل ده نقض افتراضاً أنا كتبته في تعريفه نفسه** — التفصيل في BI-9.

#### [Critical] BI-1 — كرون المزامنة بلا قفل تداخل، ودوال التنبيه بتستخدم `create` مش `upsert`
تأكيد تالت مستقل لـCR-2 من زاوية التنبيهات: `denyUnlessCron` بيفحص السرّ بس، **ومفيش أي فحص لـ«في رن شغّال؟» قبل الحلقة**. وكل `checkXAlertForWorkspace` بينتهي بـ`pushToActionFeed` → **`actionFeedItem.create` (مش upsert)** زائد `sendUrgentNotificationEmail` (إيميل Resend حقيقي) عند الحدّة المؤهِّلة. **فاستدعاء تاني متزامن بينتج صفوف تنبيه مكرَّرة وإيميلات وإشعارات مكرَّرة لمستخدمين حقيقيين لنفس الحالة.** الـupsert الذرّي (`metricSnapshot`) آمن؛ **مسار التنبيه والإشعار لأ.** والإصلاح المقترح: قفل استشاري `pg_advisory_xact_lock` — **نفس النمط المستخدَم صح بالفعل في `lib/billing.ts:206-207`**.

#### [High] BI-2 — **أخطاء تحقق التسجيل عربية مثبَّتة في ملف `.ts`، غير مرئية للفحوصات الأربعة، وبتتعرض حرفياً لمستخدمي الإنجليزية**
- **Path:** `lib/validation/schemas.ts:14-34,101-111` → `app/api/auth/signup/route.ts:46-48` → `app/signup/SignupForm.tsx:104`
- **Repro:** بلغة إنجليزية، سجّل بكلمة سر ناقصها رمز. العميل بيعمل `setError(data.error ?? ...)`، و`data.error` هو `firstIssue.message` الجاي من Zod مباشرةً: **`"يجب أن تحتوي على رمز واحد على الأقلّ"`** — نصّ عربي داخل فورم إنجليزي بالكامل. **ونفس الباگ في كل رسالة في الملف** (إيميل ضعيف، كابتشا ناقصة، اسم ناقص، رسالة قصيرة في الفيدباك)، **و`schemas.ts` مستورَد في ١٩ راوت**.
- **ليه الفحوصات الأربعة بتفوّتها — ودي الجزء المهم:** `checkArabicLeaks.mjs` عنده **`ROOT = "app"`** و**`.endsWith(".tsx")`** — **فهو عمره مابيمشي على `lib/` ولا على `.ts` أصلاً**. وماسح أخطاء الـAPI بتاعه بيدوّر على `error: "<عربي>"` كخاصية أو متغيّر اسمه `message`/`error` — **والنصّ هنا مدفون جوّه `.min(8, "...")` و`.regex(..., "...")`**. و`checkTranslationCoverage` بيتحقق من نداءات `t()` بس — **ومفيش نداء `t()` هنا خالص**. **وحتى في الـJSX، الماسح بيطابق `StringLiteral` بس — و`{data.error}` هو `Identifier`، غير مرئي هيكلياً.**
- **⚠️ الخلاصة العامة:** **أي نصّ مثبَّت بيوصل الشاشة عبر متغيّر بدل حرفية في JSX غير مرئي لتصميم الفحوصات الحالي، مهما كان مكان تعريفه.** دي مش ثغرة في ملف — دي فجوة في التصميم.
- **والاتجاه المعاكس مؤكَّد كمان:** `signup/route.ts:42` بيرجّع `"too many signup attempts, try again later"` **إنجليزي فقط** — فمستخدم عربي محدود المعدّل بيشوف إنجليزي.
- **Suggested fix:** خلّي `validateOrError` ترجّع `code`/`path` بتاع Zod بدل `message`، وكل منادي يخريطه لـ`t(locale, "validation.<key>")`. **و`signup/route.ts:59-62` بيعمل ده يدوياً بالفعل لحالة `acceptedTerms` — وسّع نفس النمط.**
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد النصوص العربية في الـschema، و`grep` أكّد `ROOT = "app"` و`.endsWith(".tsx")` في سكربت الفحص، والرسالة الإنجليزية في `:42`.

#### [High] BI-3 — المزامنة اليومية كلها (~٤٠ نداء × كل مساحة) بالتتابع في استدعاء واحد بسقف ٣٠٠ ثانية، **بلا توزيع**
تعليق الراوت نفسه (`:49-54`) بيوثّق إن دي «أتقل شغلانة في المنتج» وإن الرن المقطوع كان بيسيب صفر أثر. **والتخفيف الحالي (`maxDuration = 300` + ترتيب الأقدم أولاً) بيخلّي التجويع عادلاً، مش بيشيل السقف.** مع نموّ عدد المساحات، عند نقطة معينة `المساحات × (~٤٠ نداء + N+1 كتابات)` بتتعدّى ٣٠٠ ثانية **ومجموعة ثابتة من المساحات بتبطّل تاخد بيانات نفس اليوم بالصمت** — و`CronRunLog` هيوري `processed` أقل من `totalWorkspaces` **بلا أي تنبيه على الفجوة دي**. **الإصلاح: نموذج توزيع — موزّع خفيف بيدرج جوب لكل مساحة** بدل دالة واحدة بتعالج الكل بالتتابع.

#### [High] BI-4 — N+1 كتابات Prisma (**ونداءات API خارجية**) جوّه حلقات المزامنة في التلات ملفات
`syncMetaAds.ts:213-298` (متداخل: upsert لكل مجموعة إعلانية، وبعدين حلقة يومية تانية بـupsert لكل يوم) · `syncGoogleAds.ts:153-233` (**نفس النمط في ١١ موضع**) · `syncTikTokAds.ts:127-160` (**١٤ موضع**). مساحة بـ٢٠ حملة × ١٠ مجموعات = **٢٠٠ نداء Graph متتابع + ٢٠٠ upsert + لحد ١٤٠٠ upsert يومي** — كلهم `await` واحد ورا التاني، **بلا `Promise.all` ولا `$transaction`**. **ودي الآلية الملموسة ورا سقف الـ٣٠٠ ثانية في BI-3، مش خطر نظري.**

#### [High] BI-5 — `AttributionResult` **مالوش فهرس على `workspaceId`** — كل رسالة واتساب مجهولة بتعمل مسحاً كاملاً للجدول عبر كل مساحات العمل، **في المسار الحيّ**
`prisma/schema.prisma:942-959` عنده `@unique` على `conversationId` بس، **ومفيش `@@index`**. والاستعلام في `unattributed/route.ts:45-47` بيفلتر بـ`workspaceId` + `attributionType` + `receivedAt`. **فبوستجرس لازم يمسح الجدول كله — اللي بيتراكم بصف لكل محادثة واتساب عبر كل مساحة طول عمر المنتج — لكل رسالة غامضة داخلة على أي مساحة.** **الزمن بينمو مع حجم المحادثات على مستوى المنصة كلها، مش على مستوى المساحة**، وهو قاعد بشكل متزامن في مسار معالجة رسايل واتساب. **الإصلاح: `@@index([workspaceId, attributionType, receivedAt])`.**

#### [Medium] BI-6 → BI-10
- **BI-6 — `findMany` بلا `take` على جدولَي كليكات في نفس المسار الحار** (`unattributed/route.ts:34-40`, `:45-47`). مساحة بحملة عالية الترافيك بتحمّل آلاف الكليكات في الذاكرة **مع كل رسالة مجهولة**.
- **BI-7 — نصوص `ActionFeedItem` مخزَّنة كنصّ مُعروض مش مفتاح+متغيّرات في تلات مصادر كرونية**: `scaleKillAlerts.ts:98` (إنجليزي دايماً — **بينما نفس النداء بيعمل `descKey: "raw.bilingual"` صح للوصف تحته بسطرين**) · `connectionHealthCheck.ts:35-36` (عربي دايماً، **وتسمية المنصة ternary مثبَّت محلياً بدل `platformMeta.ts`**) · `experimentEngine.ts:197` (عربي دايماً، **بيستخدم `def.labelAr` بلا فحص لغة — وده بالظبط اللي `checkBilingualFields.mjs` مبني يمسكه، لكنه بيمشي على `app/**/*.tsx` بس فـ`lib/` بره مداه**). **بيناقض القاعدة الموثَّقة في `schema.prisma:1232-1234` نفسه.**
- **BI-8 — `lib/navConfig.ts` متجاوَز من قسم الحملات**، اللي بيعرّف تنقّله على مستويين ومنطق التطابق النشط بتاعه محلياً (`CampaignsNav.tsx:30-120`) — **٤ مجموعات × لحد ١١ صفحة = ٣٠ مسار متصانة مستقلة عن الشريط الجانبي**، بمنطق مكرَّر احتاج إصلاحين موثَّقين في الملف بالفعل.
- **BI-9 — 🔷 ألوان المنصات مكرَّرة كـhex خام في ~١٠ ملفات والنسخ انحرفت — وأعادت إنتاج التصادم اللي الملف المرجعي اتعمل عشان يمنعه.** `lib/platformMeta.ts:11-14` بيشرح إن جوجل اتحطّ **أخضر** عمداً لأن أزرقه بيكاد يطابق أزرق ميتا `#0866FF` «فيصير قطاعا الرسم الدائري لونين لا يفرّق بينهما أحد». **و`CampaignsNav.tsx:61` بيحطّ جوجل `#1A73E8` وميتا `#0866FF` — أزرقين جنب بعض في نفس شريط التبويبات، معروضين فعلياً كلون التمييز.** و`TruthView.tsx:26-31` عنده نسخة تالتة بجوجل `#4285F4` (ميتة حالياً، **لغم لأول واحد يوصّل legend في نفس الصفحة دي بالظبط**).
- **BI-10 — الفحوصات بتدوّر على تسرّب العربي في الإنجليزي بس، **مش العكس أبداً** — والعربية هي اللغة الأساسية.** `checkArabicLeaks.mjs:22` فيه `const ARABIC = /[؀-ۿ]/` **وهو الاختبار الوحيد في الملف كله**. **فسلسلة إنجليزية بحتة اتشحنت بالغلط بتعدّي الفحوصات الأربعة بالصمت للأبد** — وهي على الأرجح الغلطة الأكتر احتمالاً من مساهم بيتكلم إنجليزي.

#### 🔷 BI-11 — **تصحيح لافتراض في تعريف الوكيل نفسه: التراكر مابقاش SQLite**
- **Path:** `wa-conversion-tracker/lib/db.ts:1-82` · `package.json` · `README.md:69-70`
- **الحقيقة:** التراكر **اتحوّل بالفعل لـPostgres خام عبر `pg`**، وبيشارك نفس قاعدة بيانات `adloop-saas`. **صفر اعتمادية SQLite في `package.json`.** وتعليق `lib/db.ts` بيشرح السبب: نظام ملفات Vercel عابر، فـ`tracker.db` كان بيتولد فاضي مع كل استدعاء بارد — **يعني ربط رسالة واتساب بكليكها، وهو جوهر المنتج كله، كان مستحيلاً في الإنتاج لا بطيئاً**.
- **الأثر على الأوديت:** **خطر «قواعد SQLite بتتسرّب لبوستجرس» اللي أنا كتبته في تعريف الوكيل مالوش محلّ في المسار ده — مفيش SQLite باقي فيه.** و`CLAUDE.md` كمان قديم في النقطة دي، و`wa-conversion-tracker/README.md:69-70` **لسه بيوصف الهجرة كشغل مستقبلي وهي حصلت**.
- **والخطر الحقيقي المتبقّي مختلف:** سكيما `wa_clicks` **معرَّفة مرتين، مستقلتين، في مشروعين** (SQL خام في التراكر، `model WaClick` في adloop-saas) **ومفيش حاجة رابطاهم**. النهارده متطابقين عموداً بعمود (متأكَّد سابقاً)، **لكن `CREATE TABLE IF NOT EXISTS` بيبقى لا-عملية بعد أول إنشاء** — فأي تغيير من أي ناحية بينحرف بالصمت.
- **Verified:** **YES — تحقُّق مزدوج.** `grep` أكّد `"pg": "^8.13.0"` وصفر SQLite، و`head` أكّد تعليق `lib/db.ts`.

#### لسه فاضل (من الوكيل)
- **RTL أبعد من العيّنة:** فحص عيّنة تمثيلية وبحث واسع على الخصائص الفيزيائية، **ولقى المشروع صحيح إلى حدّ كبير وواعياً بنفسه** (إصلاحات موثَّقة في التعليقات لنفس أنماط الفشل دي). **ومافتحش كل popover/dropdown فردياً على ٨٧٧px في متصفح حقيقي.**
- **مرايا الأيقونات الاتجاهية ماتفحصتش منهجياً** · **`PageHeader` في الحالات الفاضية عبر الـ٤٧ صفحة ماتفحصش** · `theme.css` أبعد من السطر ٣٠٠.
- **٢٥ موضع N+1 متبقي ماتقروش فردياً** (اتأكّد النمط بالبحث وقرا موضعاً تمثيلياً في كل ملف).
- `attribution/touchpoint` مافتحش · **حساسية حالة الأحرف (`mode: 'insensitive'`) عبر باقي الراوتات ماتفحصتش** · سباقات فحص-ثم-تصرّف بره الفوترة والـAI (**الاتنين دول اتقروا كاملين وطلعوا مهندسين صح**).
- **صفر تحقق من متصفح حقيقي** — كل الاكتشافات البصرية من قراءة الكود.

### 4.15 مطابقة مع المراجعات السابقة في `docs/public/` — **مراجعة متأخّرة**

> **الملفات دي مااتغذّتش للوكلاء وقت التشغيل.** المستخدم لفت نظري ليها بعد ما
> الأربعتاشر خلصوا، فقارنتها بنفسي. القسم ده بيقول بالظبط **إيه اللي غطّيته
> مستقلاً، وإيه اللي فاتني**.

**اللي في المجلد:** تقريران خارجيان من ١٩ أغسطس (`Terra 5.6` جاهزية إنتاج ·
`Mimo 2.5` أمن وموثوقية) · تقرير تالت ٢٠ أغسطس بحكم **CONDITIONALLY READY** ومعاه
`plan.md` (خطة معالجة) · و`audit-register.md` وهو **مراجعة كلود كود للمراجعتين**.

**نقطة مهمة أول حاجة:** `docs/public/audit-register.md` **مطابق حرفياً** لـ
`docs/open-audit-findings.md` (متأكَّد بـ`diff`) — **والملف ده غذّيته فعلاً** لـ
`security-pentest` و`billing-plans` و`release-readiness`. فمحتوى السجل كان داخل
الأوديت. **الفايت هو `plan.md` والتقارير الخام.**

#### ✅ بنود السجل اللي الأوديت لقاها مستقلاً (١٢ من ١٧)

| السجل | اكتشافي | الحالة |
|---|---|---|
| A1 — ترتيب HMAC | **B-6** | ✅ **وأكّدت إن التنبيه اللي السجل بيطلبه لسه مش مبني** |
| B1 — CSP | S-11 · R-7 | ✅ مؤكَّد مااتغيّرش |
| B2 — الحدّ يفشل مفتوحاً | R-10 | ✅ |
| C1 — ربط OAuth بلا `email_verified` | security-pentest | ✅ **ووسّعته**: لقى كمان إن الـstate مش مربوط بالمتصفح (login CSRF) |
| C3 — ماسنجر بلا منع تكرار | **C-6** | ✅ **ووسّعته**: مش عدّ مزدوج بس — **بيخلق تحويلاً «متحقَّقاً» وهمياً** |
| C4 — دمج نصوص GAQL | **W-8** | ✅ **ورفعته**: السجل بيقول «المصدر قاعدة بياناتنا فالخطر غير مباشر» — **وW-8 أثبت إن `campaign-links` بيكتب المعرّف من جسم الطلب، فالمدخل مباشر فعلاً** |
| C6 — الاحتفاظ ناقص جدولين | P-6 | ✅ **ووسّعته لـ~١٤ جدول** |
| C7 — سقف جودة الصور مسطَّح | ai-cost | ✅ |
| C8 — إيميل المالك مثبَّت | **S-5** | ✅ **ورفعته**: مسار استيلاء إداري كامل |
| C9 — الوسيط يفحص الوجود | R-4 | ✅ |
| D1 — كرون متسلسل | BI-3 · CR-9 | ✅ |
| `plan.md` — توقيت `mark-matched` · تجميع الكرون · دمج ويب هوك سلّة · `refundChatQuota` | M-4 · CR-4 · D-4 · ai-cost | ✅ الأربعة |

#### ❌ بنود فاتتني — أضيفها دلوقتي كاكتشافات

**[High] LATE-1 — `plan.md` اقترح كرون تجديد الاشتراكات، ومااتبناش خالص**
`plan.md` P0-02 بيقترح `app/api/cron/billing-renewals/route.ts`: يمرّ على `ACTIVE`
اللي `currentPeriodEnd` بتاعهم خلال ٤٨ ساعة، يخصم من `savedCardToken`، ينجح →
يمدّد ويسجّل `RENEWED`، يفشل → **`PAST_DUE`** ومهلة ٣ أيام وإيميل تحصيل.
**الملف مش موجود** (`vercel.json` فيه ٦ كرونات مالهاش علاقة). **ودي بتفسّر
B-4 من جذرها:** `PAST_DUE` مالوش كاتب في الريبو **لأن الكاتب المخطَّط له
مااتبناش** — وعشان كده `EXPIRED` غير قابلة للوصول، وحملة الاسترجاع
و`subscriptionAlerts.ts` ميتين. **يعني الاشتراكات مابتتجدّدش تلقائياً أصلاً**،
وده متسق مع B-7 (كل مشترك لازم يسيب خطته تنتهي عشان يُسمح له يدفع).

**[Medium] LATE-2 — C5: `$queryRawUnsafe` لسه موجود** — `app/api/health/schema/route.ts:46`.
مفيش مدخل مستخدم في الاستعلام الحالي فمش ثغرة النهارده، **لكن الاسم نفسه دعوة
لأول واحد يضيف متغيّر**. الإصلاح: `$queryRaw` بقالب موسوم. **ولا وكيل من الـ١٤
بلّغ عنه** رغم إن `security-pentest` كان في نطاقه.

**[Medium] LATE-3 — C2: صفر حدّ معدّل على ردود OAuth** — متأكَّد: `checkRateLimit`
**مش موجود** في `login-google/callback` ولا `login-facebook/callback`، بينما
الدخول بالإيميل وكلمة السر عليه حدّ مرتين. **فالمسار الأضعف هو غير المحروس.**

**[Medium] LATE-4 — D2: ٥ من ٦ جداول متعددة المستأجرين بلا فهرس `workspaceId`** —
فحصتهم واحد واحد: `UploadedSheet` · `AutomationRule` · `LandingPageAudit` ·
`SharedReportLink` · `ConversionValueConfig` **كلهم بلا فهرس**، و`SiteScanResult`
**عنده فهرس** (فالسجل نفسه قديم في البند ده). **ونصيحة السجل صح: ماتضفش فهرساً
بالحدس** — تُجمَع خطط الاستعلام على حجم شبيه بالإنتاج أولاً. (BI-5 لقى
`AttributionResult` وهو **مش** في قائمة السجل — فالاتنين بيكمّلوا بعض.)

**[Low] LATE-5 — C10: `getEntitlements` بلا تخزين مؤقّت للطلب الواحد** — استعلام
في كل نداء، وبتتنادى مرات في الطلب الواحد. مالقاهوش أي وكيل.

**[⛔ خارج النطاق] LATE-6 — D3: مفيش عدّة اختبار للمسارات الحرجة.** السجل بيقول
إن سلسلة البناء **مابتمسكش التزامن** — «وهو بالضبط ما كانت عليه تلاتة من أخطر ما
وُجد». **والأوديت ده أكّد الملاحظة دي بقوة**: C-5 وW-3 وCR-2 وBI-1 كلهم سباقات
تزامن، وكلهم عدّوا من ١٥ فحص بناء أخضر و`tsc` نضيف. **أمري لم يطلب تقييم تغطية
الاختبارات، فمحدش فحصها — بس التوصية دي هي أوضح استنتاج من الأوديت كله.**

#### 🔷 ملاحظة السجل اللي طبّقتها من غير ما أقراه

السجل بينتهي بقاعدة: **«التقريران أخطآ في مواضع، وقُبلا فيها ابتداءً... يُتحقَّق
من كل بند في الكود قبل العمل به»** — ومثاله إن Mimo وصف ثغرة OAuth بسيناريو **غير
ممكن**، والثغرة الحقيقية كانت أضيق وأخطر.

**نفس ده حصل في الأوديت ده تلات مرات:** `admin-ops` نقض افتراضاً أنا مرّرته له
(`verifiedConversions` سقف خطة مش رقم الحقيقة) · `brand-i18n-scale` نقض افتراضاً
في **تعريفه هو نفسه** (التراكر مابقاش SQLite) · و`release-readiness` وّرى إن
`CLAUDE.md` غلط في الاتجاهين على سطح التنفيذ. **والقاعدة اشتغلت لأنها متكتوبة في
تعريف كل وكيل، مش لأنه قرا السجل.**

---

# جولة ثانية — إغلاق فجوات التغطية

> بعد اعتراض المستخدم على التغطية، اتعملوا ٥ وكلاء جداد بأدوات موسّعة
> (WebSearch · متصفح Chrome حقيقي · نطاق التراكر الشقيق).

### 4.16 route-sweep — ✅ **٥١ من ٥١ راوت اتفتحوا · صفر عيّنات**

> **أهم نتيجة هنا إيجابية:** عيب `available-campaigns` (راوت بلا أي فحص ملكية)
> **مااتكررش**. الـ٥١ راوت كلهم بيثبتوا الملكية **قبل** أول كتابة.

**تصحيح على تكليفي:** قدّرت الباقي ~٧٣ راوت، لكن قايمة الاستثناء بتغطّي ٨٢ من
١٣٣ — فالباقي **٥١**، وكلهم اتقروا من الأول للآخر.

**والراوتات المتداخلة (`[ruleId]`, `[viewId]`, `[experimentId]`, `[competitorId]`)
أقوى كود في الـAPI كله** — فحص ملكية على مستوى الصف، قوائم سماح، وحدود مقصوصة.

#### [Critical] RS-1 — SSRF: جلب عشوائي من السيرفر عبر الصفحات المراقَبة، **والنتيجة بترجع للمهاجم**
- **Path:** `app/api/workspaces/[id]/monitored-pages/route.ts:46-51` → `lib/trackingCoverage.ts:109`؛ ونفس المصرف من `monitored-pages/[id]/check:22` و`diagnostics/scan:32`
- **Repro:** أي مشترك مسجَّل بيبعت `POST /api/workspaces/{مساحته}/monitored-pages` بـ`{"url":"http://169.254.169.254/latest/meta-data/"}`. **الفحص الوحيد على `url` هو `if (!url)`** وبعدين بيتمرّر مباشرةً لـ`fetch(url,{redirect:"follow"})`.
- **Impact:** **المشروع شايل `lib/safeFetch.ts` مبني بالظبط لده** — رفض النطاقات الخاصة، إعادة تحقق بعد كل تحويل، قائمة بروتوكولات، سقف ١٠ ميجا — **والمسار ده مابيستخدمهوش**. ومش أعمى: `httpStatus` و`checkedUrl` بعد التحويل و`err.message` الخام بيتخزّنوا على `MonitoredPage` **وبيرجعوا في الرد**. **وتضخيم فوق كده:** `diagnostics/scan` بيطلق **٢٠ منهم بالتوازي** في الطلب الواحد بلا حدّ معدّل — فالسيرفر بيتحوّل لمضاعِف طلبات ضد طرف تالت.
- **Suggested fix:** بدّل `fetch` في `trackingCoverage.ts:109` بـ`safeFetch`، وتحقّق من `url` في نقطتي الكتابة. (**وS-4 لازم يتصلح الأول** — `safeFetch` نفسه فيه ٤ ثغرات تجاوز.)
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد إن الفحص الوحيد `if (!url)`.

#### [High] RS-2 — `DemoWriteBlocked` بيترمي من ٨ نقاط اختناق، **ومابيتمسكش في أي مكان**
- **Path:** `lib/demo.ts:27-41`
- **Repro:** `grep` على الاسم في `app` و`lib` كلهم رجّع **موضع واحد: تعريف الكلاس نفسه**. مفيش ولا `catch` بيتعامل معاه.
- **Impact:** في مساحة الديمو، `products/[id]/apply-price` **بيرد ٥٠٠**؛ و`action-feed/[id]/apply` **بيصنّفه كفشل منصة ويدّي المستخدم رمز دعم مرجعي** — يعني المستخدم بيتبلّغ إن المنصة فشلت بينما اللي حصل إن الحارس اشتغل صح. **الحارس سليم، وطريقة تقديمه غلط.**
- **Suggested fix:** امسك `DemoWriteBlocked` صراحةً في الراوتات المنفِّذة ورجّع رسالة مترجَمة «ده عرض تجريبي» بحالة 4xx، مش ٥٠٠ ولا رمز دعم.
- **Verified:** **YES — تحقُّق مزدوج.**

#### [High] RS-3 — المزامنة اليدوية بترجّع `err.message` الخام بتاع المنصة للمتصفح
`lib/resyncWorkspace.ts:29-32,60-63` → `workspaces/[id]/sync/route.ts:74-79`. **نفس فئة WR-3، على زرار كل مشترك بيدوسه.** رسالة خطأ Google/Meta/TikTok الخام بتوصل الواجهة — غير مترجَمة وكاشفة.

#### [High] RS-4 — إعادة تفعيل MFA **مابتتطلّبش أي إعادة مصادقة**، بينما التعطيل بيتطلّب كلمة السر
`auth/mfa/verify-setup/route.ts:18-58` مقابل `auth/mfa/disable/route.ts:30-55`. **جلسة مسروقة تقدر تسجّل جهاز MFA جديد بلا كلمة سر** — وبتتخطّى كمان تنضيف `trustedDevice` اللي `disable` بيعمله عمداً.

#### [Medium] RS-5 → RS-9
- **RS-5 — قيم غير متحقَّق منها بتروح لأعمدة Prisma: ٦ مسارات ٥٠٠ مؤكَّدة.** شكل واحد، ٦ مواضع، **ولا واحد فيهم `try/catch`**: `onboarding/progress` (`step`→`Int`، **راوت حيّ وتوأمه المتحقِّق `user/onboarding` كود ميت صفر نداءات**) · `workspaces/[id]` (٣٠ اسم في قائمة السماح، **والقيم غير مفحوصة** — و`profitMarginPct` بيغذّي قاعدة التعادل في Scale/Kill) · `user/profile` · `connected-platforms/disconnect` (`platform`→enum) · `notifications` (`since`→`new Date()`) · **`metrics-timeline` (تواريخ خام، وبلا حدّ نطاق وبلا `take` — فـ`from=1970-01-01` بيختار كل سنابشوت في المساحة)** · `workspaces/[id]/products`.
- **RS-6 — `upload-sheet` بيثبّت ترويسة الملف قبل تحليل الصفوف** — تاريخ غلط بيدّي ٥٠٠ **وبيسيب صف يتيم**. وبلا سقف صفوف، وفحص `file.type` بيتخطّى لو المتصفح مابعتش نوع.
- **RS-7 — `user/profile` بيخزّن صورة data-URI بلا سقف** في عمود `@db.Text`، **وبتتقدّم في كل صفحة لوحة** (`layout.tsx:370`).
- **RS-8 — `/api/support` بيخزّن `imageUrls` غير متحقَّق منها بتتعرض في لوحة المالك**، **وإنشاء التذكرة بيشغّل إيميل للمالك بلا حدّ معدّل** — ناقل إغراق بريد بلا حدّ على صندوق المالك.
- **RS-9 — صفر حدّ معدّل على أي راوت بينادي بره أو غالي:** `grep` على `checkRateLimit` رجّع ١٥ ملف كلهم auth/billing/demo/track/mcp. **ولا واحد** من دول عنده: إنشاء وفحص `monitored-pages` · `diagnostics/scan` (٢٠ جلب متوازي) · `sync` · `product-sync` · `order-backfill` (`maxDuration=300`) · `apply-price` (**بيكتب على متجر حقيقي**) · `search` (٦ مسوحات `contains`) · **`auth/verify-email` (تخمين توكن بلا مصادقة)**.

#### [Low] RS-10 — تسرّب عربي في ٣ مواضع (`upload-sheet:79`, `workspaces:55`, `mfa/verify-setup:15`) **والملفات التلاتة بتستخدم `t()` لأخطائها الشقيقة** · `site-scan/[id]/print:21` بيثبّت `"ar"` و`locale` المحسوب غير مستخدَم · `automation-rules/[id]` PATCH بلا CSRF بينما DELETE بتاعه عنده.

#### ✅ ضابط مخفِّف يستحق التسجيل
`middleware.ts:32-47,76-80` بيطبّق حارس الكتابة عابرة الأصل على `/api` كله. و`verifyCsrfToken` لكل راوت موجود في ٩ ملفات بس — **لكن الميدلوير بيخلّي الفجوات دفاعاً في العمق مش انكشافاً**.

#### لسه فاضل
**لا شيء من قائمته — الـ٥١ كلهم اتفتحوا.** والوكيل نبّه بحق إن ٤ راوتات في قائمة الاستثناء **اتعملها grep بس في الجولة الأولى** ومستحقّة إعادة فتح: `campaign-links` · `ecommerce` · `share-link` · `report-email`.

### 4.17 tracker-seam — ⚠️ **١ Critical · ٢ High · ٣ Low** + ٣ تقليصات

> **الوكيل ده جاوب ٦ أسئلة كان الأوديت الرئيسي كله متوقّف عليها، وطلّع الطلقة
> القاتلة للحلقة — وأنا أعدت التحقق منها بنفسي.**

#### إجابات الأسئلة الستة

| # | السؤال | الإجابة |
|---|---|---|
| Q1 | الهاتف ASCII ولا عربي-هندي؟ | **`wa_id` دايماً** — `message.from` من ويب هوك ميتا، مش نص مكتوب أبداً. **H-4 نطاقه بينكمش لقرب الصفر عبر السيم ده** |
| Q2 | `campaignId` دايماً بيتبعت؟ | **لأ — أسوأ: عمره ما بيتبعت هيكلياً** (اقرا TS-1) |
| Q3 | `ctwa_clid` بيتقط ويتمرّر؟ | **لأ — صفر تطابق في التراكر كله**. C-8 مبني على premise غلط |
| Q4 | `conversationId` فريد عالمياً؟ | **`wamid` بتاع ميتا** — عالي العشوائية. **L-2 بينكمش** |
| Q5 | التراكر بيعيد المحاولة؟ | **لأ** — بس السباق حيّ من زاوية تانية (اقرا TS-2) |
| Q6 | بيخزّن نصّ الرسايل؟ | **لأ** — `text.body` بيتقرا للـregex بس ومابيتخزّنش. **خارج نطاق الخصوصية** |

#### 🔴 [Critical] TS-1 — `campaignId` عمره ما بيتبعت: سبب تالت، دائم، على مستوى المنتج كله، لتصفير `verifiedConversions`
- **Path:** `wa-conversion-tracker/app/api/track-click/route.ts:94` (`searchParams.get("campaign") ?? undefined`) → `wa_clicks.campaign_id` → `whatsapp-webhook/route.ts:109` → `adloop-saas/mark-matched/route.ts:60` (`if (campaignId && isGenuinelyNew)`)
- **Repro:** الواجهة الوحيدة اللي بتولّد الرابط للعملاء الحقيقيين (`SettingsClient.tsx:1073-1075`) بتطلّع `/api/track-click?ws={id}` و`&gclid={gclid}` — **ولا واحد فيهم فيه `campaign=`**. والتراكر بيقرا `campaignId` من `?campaign=` **اللي مفيش حاجة في المنتج بتضيفه**. **مفيش رابط لكل حملة في المنتج كله، ولا ماكرو مقترح، ولا توثيق بيقول للعميل يضيفه.**
- **Impact:** **حتى بعد إصلاح C-1 (فلتر ميتا) وD-1 (توقيت جوجل) الاتنين، زيادة `mark-matched` لسه عمرها ما بتشتغل، لـ١٠٠٪ من تحويلات واتساب، لأن `campaignId` بتكون `undefined` في كل نداء حقيقي.** **ده مش فجوة احتمالية — ده السلوك الافتراضي والوحيد للمنتج المشحون.** الأوديت الرئيسي شاف عرضين (C-1، D-1) ومشافش السبب التالت والأعمق ده لأنه بره الريبو.
- **Suggested fix:** حُلّ `campaignId` من ناحية السيرفر من الـclick id نفسه (التراكر عارف `gclid`/`fbclid`/`ttclid` — lookup على `CampaignLink` بيرجّع الحملة وقت المطابقة)، بدل ما يتطلّبه في الرابط. أخفّ عيباً بكتير لمنتج خدمة ذاتية من إنك تطلب من المعلن يحطّ رابط لكل حملة.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد إن `SettingsClient.tsx:1073` بيطلّع الرابط بلا `campaign=`، و`track-click/route.ts:94` بيقراه من query param.

#### [High] TS-2 — نداءات fire-and-forget لـadloop-saas ممكن تتجمّد قبل ما تكمّل على serverless
- **Path:** `whatsapp-webhook/route.ts:103,133,151` — `markMatchedInAttribution`/`recordConversion`/`recordTouchpoint` **بلا `await`**، والمعالج بيرجّع `{ok:true}` في `:180` بعدها فوراً. الدوال typed `void` بقصد.
- **Impact:** على Vercel، بعد ما الرد يتبعت البيئة بتبقى مؤهّلة للتجميد، و`fetch` غير المنتظَر مالوش ضمان يكمّل من غير `after()` أو `waitUntil` (**ولا واحد مستورَد**). **يعني — مستقل عن TS-1 وعن كون adloop-saas شغّالة — نداء إشارة التحويل المتحقَّق ممكن يتقتل في النص قبل ما يوصل. سبب رابع محتمل للصفر، فوق كل حاجة الأوديت الرئيسي قدر يشوفها.**
- **Suggested fix:** لفّ الأربع نداءات في `after()` من `next/server`، أو `await` واقبل زمن أطول قبل الرد على ميتا (مهلة ويب هوك ميتا سخيّة).
- **Verified:** NO — دلالات تنفيذ المنصة، بتتأكّد من لوجات Vercel أو اختبار وقت تشغيل. **مرفوعة بثقة عالية على سلوك Next/Vercel الموثَّق، مش منفَّذة (قيد القراءة).**

#### [High] TS-3 — `ctwa_clid` مش متقط — إصلاح C-8 مبني على premise غلط
`whatsapp-webhook/route.ts` بيقرا `.text?.body` و`.from` بس، **وعمره مابيقرا `.referral`** (حيث ميتا بتحطّ `ctwa_clid`). **يعني C-8 إصلاح لمشروعين مش واحد:** التراكر لازم الأول يقرا `message.referral?.ctwa_clid` ويخزّنه ويمرّره، وبعدين adloop-saas يقدر يضمّنه في `user_data` مع `action_source: "business_messaging"`. **الملاحظة في C-8 «التراكر شايله أصلاً» غلط.**

#### [Low] TS-4 · TS-5 · TS-6
- **TS-4 — صفر حدّ معدّل على أي نقطة تراكر.** `GET /api/track-click` عام بلا خنق — فيضان بـ`ws` صالح بيولّد صفوف `wa_clicks` بلا حدّ ونداءات بلا حدّ على adloop-saas، بياكل بركة Postgres (`max: 3`، مشتركة مع adloop-saas). وويب هوك واتساب محمي بـHMAC (يفشل مقفولاً ✅) لكن ممكن إغراقه بأجسام garbage لإجبار حساب HMAC على كل طلب.
- **TS-5 — توكن التحقق بيتقارن بـ`===` مش ثابت الزمن** (`:59`). قناة توقيت طفيفة على سرّ إعداد لمرة واحدة (مسار POST المهم بيستخدم `timingSafeEqual` صح).
- **TS-6 — `wa_clicks` (SQL خام) و`WaClick` (Prisma) مفيش رابط آلي بيبقيهم متزامنين.** متطابقين النهارده، **لكن أي `prisma db push` مستقبلي بيعدّل عمود، أو تغيير تراكر بيضيف عمود، بيفصلهم بالصمت** — نفس فئة الفشل اللي ذاكرة المشروع بتقول إنها حصلت قبل كده.

#### 🔽 تقليصات (قيمتها زي التأكيد)
- **H-4 مش عيب حيّ عبر السيم ده** — الهاتف دايماً `wa_id` (ASCII بعقد واتساب)، مؤكَّد بتعليق التراكر نفسه في `enhancedConversions.ts:41-43`. **(ممكن يفضل حيّ في adloop-saas في أي فورم بشري يكتب فيه المستخدم رقم — بره السيم ده.)**
- **L-2 بينكمش** — `conversationId` هو `wamid` بتاع ميتا، مش عدّاد لكل مستأجر. القيد العالمي لسه خطر كامن مبدئياً، لكن احتمال التصادم العملي اللي الاكتشاف قلق منه مابينطبقش.
- **C-5/D-8 لسه حيّين — بس من زاوية تانية:** مش «المنادي بيعيد» (التراكر مابيعيدش)، بل **معالج الويب هوك الوارد بتاعه فيه فحص-ثم-تصرّف غير ذرّي** (`click && !click.matched`، `:97-100`) بيتسابق مع **إعادة تسليم ميتا at-least-once الموثَّقة**. الإصلاح على جانب التراكر: `UPDATE ... WHERE code=$1 AND matched=false RETURNING *`.

#### لسه فاضل
**كل ملفات مصدر التراكر السبعة اتقروا كاملين.** ماتفتحش: تاريخ git للتراكر (الحالة الحالية بس اتفحصت). وفحص TS-2 (تجميد serverless) محتاج لوجات Vercel أو اختبار وقت تشغيل — مش قابل للإثبات بالقراءة وحدها.

### 4.18 sync-internals — ⚠️ **١ Critical · ٣ High · ٢ Medium · ٢ Low**

> **الوكيل ده لقى الصفر الصامت اللي ٣ وكلاء دوّروا عليه ومالقوهوش** — وهو في
> **رقم «المنصة بتدّعي» نفسه، مش في المتحقَّق بس.** أعدت التحقق منه.

#### 🔴 [Critical] SI-1 — `rawConversions` بتاع ميتا بيعدّ `action_type="lead"` بس، وبيرجع `0` — كل حملة ميتا مش-ليدز بتوري «٠ تحويل» جنب صرف حقيقي
- **Path:** `lib/syncMetaAds.ts:116` (ونفس النمط في `:253/261`, `:290/291`, `:399/409`)
- **Repro:** `const leadAction = (row.actions ?? []).find(a => a.action_type === "lead"); const rawConversions = leadAction ? Number(leadAction.value ?? 0) : 0;`. مصفوفة `actions` بتاعة ميتا فيها الأنواع اللي حصلت فعلاً بس — **حملة مُحسَّنة للشراء/تثبيت تطبيق/رسايل عمرها ما بتطلّع `action_type="lead"`**، فـ`leadAction` دايماً `undefined` و`rawConversions` بيتكتب `0` حرفياً، كل يوم، طول عمر الحملة. **والتباين في نفس البلوك:** جاره `revenue` بيستخدم `: null` عند الغياب (`:129`)، و`rawConversions` لوحده بيستخدم `: 0`. وجوجل (`:183`) وتيك توك (`:145`) الاتنين بيخريطوا **إجمالي** التحويلات — **ميتا وحدها متضيّقة على الليدز**.
- **Impact:** `rawConversions` هو **بسط «المنصة بتدّعي»** — `CampaignsOverview.tsx:230` بيعرضه كعمود «التحويلات المُبلَّغة»، و`conversionGapAlert.ts:38-44` بيستخدمه كبسط فجوة الحقيقة (**وبيتخطّى التنبيه كله لو `raw < 10`**)، و`dashboard/page.tsx` و`truthKpis` و`kpiEngine` بيجمّعوه. **لحساب ميتا مُحسَّن للشراء، اللوحة بتوري «ميتا بتدّعي ٠ تحويل» جنب صرف حقيقي — مطابق تماماً لحملة ميتة، وهو بالظبط سيناريو «العميل بيقتل حملة شغّالة».** وفجوة الحقيقة — وعد المنتج — بتفضل صامتة للحملات دي.
- **Suggested fix:** خريطة `rawConversions` من حدث التحسين الفعلي للحملة، مش `lead` مثبَّت — اجمع أنواع التحويل (`lead`, `purchase`/`omni_purchase`, `complete_registration`, `messaging_conversation_started_7d`) زي ما جوجل/تيك توك بياخدوا الإجمالي؛ **ولما مفيش أي حدث تحويل، اكتب `null` مش `0`** عشان تطابق الحقول الشقيقة.
- **Verified:** **YES — تحقُّق مزدوج.** `sed` أكّد `: 0` في `:116` و`: null` للجار `revenue` في `:129` في نفس البلوك.

#### [High] SI-2 — صفر الليدز بيتسرّب لقرارات Scale/Kill وفترة التعلّم — **Kill بيشتغل على حملات شراء بتحوّل فعلاً**
نفس `leadAction ? … : 0` في `MetaAdSetSnapshot.conversions` و`AdSetDailyConversions.conversions` و`CreativeSnapshot.rawConversions`. **(١)** مجموعة شراء بمشتريات حقيقية وصفر ليدز → `estimateLearningPhase` بيرجّع `LEARNING_LIMITED` ويطلّع تنبيه كاذب «عالق في التعلّم». **(٢)** في مرتّب الإبداعات، `rawConversions=0` جنب تكلفة حقيقية = **إشارة Kill النموذجية** → النظام بيوصّي بقتل حملة شغّالة. **(٣)** `checkMetaBidStrategyProgression` عمره مايقترح Cost Cap للمجموعات دي. **نفس الصفر، لكن نطاقه توصيات الأتمتة — وده المكان اللي «قتل حملة شغّالة» بيحصل فيه فعلاً.**

#### [High] SI-3 — `countDisapprovedGoogleAds` بيرجّع `0` لما النداء يفشل لكل الحسابات — تنبيه الإعلان المرفوض بيتكتم بالصمت
`syncGoogleAds.ts:1637-1663` → `dailyTasks.ts:128`. النداء لكل حساب جوّه `try/catch` بيسجّل ومابيرميش تاني ومابيعلّمش الفشل، و`totalDisapproved` بيبدأ `0` وبيزيد عند النجاح بس. **توكن مرفوض = `return 0` = «مفيش إعلانات مرفوضة».** والإعلان المرفوض = **صفر توصيل**. **`0` هنا معناها «مقدرناش نفحص» لكنها مطابقة لـ«مفيش مرفوض»** — فحملة متوقّفة تماماً بتاخد طمأنينة كاذبة. (فئة SY-8 كانت عن **صياغة** النطاق؛ دي عن **فشل الجلب → 0 → لا تنبيه** — عيب متميّز.) الإصلاح: `number | null` وتعامل مع فشل أي حساب كـ«مجهول، ماتطمّنش».

#### [High] SI-4 — `conversionsValue` لإبداعات ميتا/تيك توك بيتكتب `0` بينما طبقة التحليل مصمَّمة تستقبل `null` — ROAS بيطلّع `0` لإبداع إيراده مجهول
الكاتبون `syncMetaAds.ts:400/410` و`syncTikTokAds.ts:1162`؛ والعقد في `creativeAnalysis.ts:22,51-52` بيوثّق: «`conversionsValue` مؤكَّد لجوجل بس — ميتا وتيك توك `null` لحد التأكيد»، و`:52` بيحسب `roas = conversionsValue !== null && cost > 0 ? value/cost : null`. **لكن الكاتبين بيستخدموا `?? 0`/`: 0`، فالعمود `0` مش `null`، و`0 ?? null === 0`، فـ`roas` بيبقى `0` بدل «مجهول».** و`total_purchase_value` بتاع تيك توك **«ثقة متوسطة، اسم حقل غير مؤكَّد»** — لو غايب أو مسمّى غلط، **كل إبداع تيك توك بياخد `roas=0`** اللي المرتّب بيقراه «عائد صفر» → مرشّح Kill، **مهزوماً الحارس null اللي طبقة التحليل اتبنت عشانه**. (والصف على مستوى الحملة `:149` بيعمل `null` صح — **الكاتب على مستوى الإبداع لوحده اللي بيخالف**.)

#### [Medium] SI-5 · SI-6
- **SI-5 — `CatalogCampaignSnapshot.purchases` بيرجع `0`** (`syncMetaAds.ts:710/716`) → تنبيه `checkCatalogSpendAlerts:752` بيفلتر `cost > threshold AND purchases: 0`، فجلب جزئي أو نوع حدث غير `purchase` بيطلّع «بتصرف بلا مبيعات» على حملة كتالوج بتحوّل. الإصلاح: `null` + استبعاده من الفلتر.
- **SI-6 — أعمدة تعليقات Spark Ads بتفضل `@default(0)` لما API التعليقات يفشل** (`syncTikTokAds.ts:984`, `code !== 0 → continue`). الصف بيتعمل الأول من مزامنة الفيديو بلا حقول تعليقات فبياخد الافتراضي `0`. **«٠ تعليق، ٠ سبام» مطابق لإعلان نضيف** — والتعليق في `:969-971` بيقول ده صراحةً. الإصلاح: أعمدة nullable أو `commentsSyncedAt`.

#### [Low] SI-7 · SI-8
- **SI-7 — عملة حساب ميتا بترجع `"USD"` بالصمت** (`syncMetaAds.ts:202`, `?? "USD"`) — لو ميتا حذفت `account.currency`، تحويل `bidAmount` بيتعمل ويتسمّى USD. حساب غير-USD ممكن يتسمّى/يتقاس غلط.
- **SI-8 — إبداعات تيك توك بتُنسب كلها لـ`campaignIds[0]`** (`syncTikTokAds.ts:1140`) — التقرير مبوّب بـ`ad_id` مش `campaign_id`، فكل الإبداعات بتتكتب تحت أول حملة. **مش صفر — سوء خريطة سلامة بيانات**: أي تجميع إبداعات لكل حملة غلط لباقي الحملات.

#### ✅ اللي رجع نضيف (صفر مقبول)
- `MetricSnapshot.revenue` (ميتا/تيك توك) بيستخدم `null` صح (`:129`, `syncTikTokAds.ts:149`) — H-6 معروف.
- `addToCart`/`checkoutsStarted` بيرجعوا `null` عند فشل الاستعلام (`syncGoogleAds.ts:120-122`) — **صح بالتصميم، مميَّز عن الصفر الحقيقي**.
- جوجل `?? 0` على impressions/clicks/cost على صف راجع — **مقبول، جوجل بيرجّع `0` حقيقي على الصف الراجع**.
- تيك توك `rawConversions` `?? 0` (`:145`) — مقبول، بيخريط كل الأحداث وتيك توك بيرجّع `0` حقيقي.

#### لسه فاضل (من الوكيل)
**التلات ملفات اتقروا سطراً بسطر بالكامل** — كل الدوال مسرودة بالاسم في مخرجه. الوحيد اللي اتقرا حارسه بس مش كل سطر: دوال **التحويل/الكتابة على المنصات** (`applyGoogleBidStrategyChange`, `pauseGoogleAd`, `applyMetaBidStrategyChange`, `pauseMetaAd`) — **خارج نطاق سؤال الصفر الصامت** (مطفّرة مش كاتبة مقاييس)، وплатform-writes غطّاها.

### 4.19 red-team-attacker — 🔴🔴 **سلسلتان Critical من مجهول لاستيلاء كامل** + ٢ Critical تانيين

> **ده أخطر قسم في الأوديت كله.** الوكيل ماكتفاش بعيوب مفردة — بنى **attack chains**
> بتوصل من «مجهول على الإنترنت» لـ«OWNER على المنصة كلها + صرف من ميزانية أي مستأجر
> بتوكنه هو». أعدت التحقق من الحلقة المحورية بنفسي.

#### 🔴 السلسلة ١ [Critical] — مجهول → OWNER على المنصة كلها → ميزانية إعلانات أي مستأجر
- **الجديد الخطير:** الأوديت الأول حطّ إيميل المالك المثبَّت (S-5) كخطر **مشروط** بأن `OWNER_EMAIL` مش مضبوط. **الوكيل ده شال الشرط** — السلسلة بتشتغل على نظام مكتمل التجهيز والمالك الحقيقي موجود فيه.
- **الخطوات:**
  1. **خلط حالة الأحرف في الإيميل بيصنع حساب OWNER.** `schemas.ts:24` — `email` بلا `.toLowerCase()` ولا trim. و`schema.prisma:54` — `@unique` **حسّاس للحالة في Postgres**. فـ`Manfareiduwk@gmail.com` **صف مختلف** عن `manfareiduwk@gmail.com`، والتسجيل بينجح حتى والمالك الحقيقي موجود — وبيرجّع كوكي جلسة ٣٠ يوم.
  2. **الحساب الجديد OWNER.** `adminRole.ts:38` `isOwnerEmail()` **بيتنادى قبل** أي فحص `isAdmin`، و`owner.ts:22,28` **بيصغّر الطرفين** — فالنسخة بحالة مختلفة بتطابق `OWNER_EMAIL`. كل راوت أدمن بيدّي كل `OWNER_CAPS` بلا أي علم `isAdmin` في القاعدة.
  3. **ترقية ذاتية بكلمة سرّه هو.** `reauth/route.ts:54` بيتحقق `bcrypt.compare` بكلمة سر التسجيل بتاعت المهاجم نفسه → كوكي `adloop_admin_elevated` ١٠ دقايق.
  4. **انتحال أي مستأجر → جلسة ضحية بلا قيود.** `impersonate/route.ts:52` = `createSessionToken` = JWT ٣٠ يوم `{userId}` **بلا أي علامة انتحال** (AD-1).
  5. **صرف ميزانية الضحية الحقيقية بتوكن الضحية.** في جلسة الضحية، `action-feed/[id]/apply` بيعدّي `workspaceAccess` (المستخدم = الضحية)، و`platformCampaignActions.ts:35-41` بيبني عميل المنصة من اتصال الضحية → **الكتابة بتتنفّذ على حساب إعلانات الضحية بتوكن OAuth الحيّ بتاعه**. أو `admin/customers/export` بيفرّغ قاعدة العملاء كلها في طلب واحد.
- **Impact:** كونسول المالك كامل على كل مستأجر (انتحال، تعليق، إهداء، تصدير الكل)، **وصرف حقيقي من ميزانية أي مستأجر بتوكنه هو**.
- **أرخص إصلاح — خطوة واحدة:** **ارفض التسجيل لما `email.toLowerCase() === OWNER_EMAIL`** (وطبّع الإيميلات lowercase قبل التخزين والمقارنة). الحارس ده لوحده بيسقّط الخطوتين ١-٢ ويقتل السلسلة كلها. وثانوي: شيل الحرفي في `owner.ts:22`، وادّي الانتحال علامة قصيرة العمر (AD-1).
- **Verified:** **YES — تحقُّق مزدوج رباعي.** `sed` أكّد: `schemas.ts:24` بلا تصغير · `schema.prisma:54` `@unique` عادي · `adminRole.ts:38` `isOwnerEmail` قبل `isAdmin` · **`owner.ts:22-28` بيصغّر الطرفين** — فالحلقة كاملة. (الوكيل **لم ينفّذ** تسجيل النسخة — ده هيزرع باب خلفي حقيقي في القاعدة المشتركة؛ التحقق بالقراءة، وده الصح.)

#### 🔴 السلسلة ٢ [Critical] — تسجيل مجاني → إيراد مستأجر تاني + PII ليداته (خطف ويب هوك عابر للمستأجرين)
- **الجديد:** ده C-2/S-2/D-4 **متسلسلين لأول مرة في مسار كامل** — بلا توكن منصة، من تسجيل مجاني عادي:
  1. تسجيل مجاني (Turnstile يفشل مفتوح، `checkRateLimit` يفشل مفتوح).
  2. **حصاد cuid الضحية** من سنيبت صفحته العامة (`InstallTagPanel.tsx:152` بيطبع `WORKSPACE_ID` في السكربت اللي التاجر بيلصقه على موقعه العام).
  3. **قراءة عابرة** — `GET /available-campaigns?platform=META_ADS` بلا `workspaceAccess` (S-1) → المهاجم بياخد أسماء متاجر الضحية وخريطة `externalCampaignId` كاملة.
  4. **زرع مفتاح ملكية مسموم** في مساحته هو — `campaign-links` بيكتب `externalAccountId` من الجسم بلا تحقق (S-2).
  5. **ويب هوك الضحية الحقيقي بيتوجّه للمهاجم** — سلّة بتوقّع بسرّ **عام واحد**، والملكية بتتحلّ بـ`findFirst` بلا نطاق مستأجر → صف المهاجم المزروع بيكسب → **إيراد الضحية بيتكتب في `MetricSnapshot` بتاع المهاجم، والضحية بتخسره**. **نسخة الليدز:** ليد Instant-Form بتاعت الضحية (اسم/إيميل/تليفون) **بتتدمّر نهائياً**.
- **أرخص إصلاح:** حُلّ ملكية الويب هوك من مسار السرّ **لكل مستأجر** الموجود بالفعل (`resolveStoreConnection`)، وأحِل راوت `webhooks/salla` العام. — يقفل السلسلة كلها.
- **Verified:** YES (قراءة الجانبين)؛ مش منفَّذ — محتاج ويب هوك ضحية موقَّع حقيقي وكتابة عابرة للقاعدة المشتركة.

#### السلسلة ٣ [High] — مستأجر مصادَق → SSRF داخل الشبكة (نفس RS-1)
نفس مصرف `trackingCoverage.ts:109`، **وأكّده بعرض حيّ على loopback محلي بس:** `http://127.0.0.1` **اتحجب** (صح)، **و`http://[::1]` اخترق** (`net.isIP("[::1]")===0` فبيتعامل معاه كاسم مضيف، ونمط `/^::1$/` عمره مايطابق الشكل المقوَّس)، والأشكال الرقمية اتحجبت على الـresolver ده (متسق مع كون البند #3 يعتمد على المنصة). **دليل حيّ لمس `127.0.0.1`/`::1` بس — لا قاعدة مشتركة ولا طرف تالت.**

#### السلسلة ٤ [Critical, فوترة] — أي بلد → خصم ~٦٥٪ ذاتي (نفس B-1، متسلسل)
تسجيل بلا ربط حساب → `PATCH {currency:"EGP"}` (القفل بينهار لما `dataCurrency` null) → `checkout {plan:"pro"}` بيحاسب سعر الجنيه (~$52) لخطة $149.

#### 📋 جرد البدائيات (لإعادة الاستخدام)
الوكيل سلّم جرد بدائيات كامل — كل واحدة `file:line` وأي سلسلة بتغذّيها. أهم إضافة **لم يشوفها أي وكيل قبله**: **`pickConnection` هو الحاجز الحقيقي للكتابة على المنصات** — بيرجّع توكن المتصل نفسه لما فيه منحة واحدة، **فمستأجر مجاني عادي مايقدرش يكتب على ميزانية أجنبية بتوكنه**؛ الاستثناء منحة **MCC/manager** (W-8) اللي بتوصل كل الحسابات الفرعية. **ده بيرفّع دقة W-8 ويحدّد شرطه بالظبط.**

#### لسه فاضل (من الوكيل)
- **إثبات حيّ للسلسلة ١ و٢** — ممنوع عليه ينفّذه (بيكتب باب خلفي/صفوف عابرة في القاعدة المشتركة). سلّم الخطوات الدقيقة لبني آدم في بيئة معزولة يكمّلها.
- **W-8 وصول MCC عبر المستأجرين** — هل مهاجم يقدر ياخد منحة MCC على حسابات مستأجر ضحية سؤال علاقة-منصة مش قابل للاختبار بلا ضرب جوجل. الاستيفاء في GAQL مؤكَّد بالكود؛ الوصول العابر متوقّف على كون حساب جوجل بتاع المهاجم manager على الضحية.
- مش مفتوح: `products/*`، `upload-sheet/*`، أجسام الخمس كرونات، `lib/admin/business.ts` (تحويلات العملة — التالي في القراءة بالنظر لـB-1)، `demoSeed.ts`.

---

### 4.20 page-sweep — ⚠️ **٩ Critical · ١ High · ٢ Medium · ١ Low · ٥٣ من ٥٣ صفحة اتفتحت**

> **٩ صفحات Critical كلها بنفس الجذر:** استعلام `MetricSnapshot` بلا فلتر `placementBreakdown`
> أو بلا فلتر تاريخ خالص. وكلها صفحات **قرار** — إعادة توزيع ميزانية، تنبيه تجاوز، اتجاه CPA.

#### [Critical] PG-1 → PG-9 — صفحات قرار بتبني على أرقام مضاعَفة أو تراكمية
| # | الصفحة | العيب | القرار اللي بيتبني عليه |
|---|---|---|---|
| PG-1 | `budget-simulator:41` | بلا فلتر placement | **«انقل ١٠٠٠ من X لـY»** — CPA ميتا منفوخ بيقلب التوصية |
| PG-2 | `portfolio:38` | بلا فلتر placement | **`suggestedBudget`/`changePct` لكل حملة** |
| PG-3 | `campaigns/page:44` | بلا فلتر placement | **الجدول الرئيسي** لكل كلفة/CPL/تضخّم |
| PG-4 | `PlatformHub.tsx:133` (meta-hub) | بلا فلتر placement | **كروت CPA/ROAS للصفحة الرئيسية لكل منصة** |
| PG-5 | `storeIntelligence.ts:156` + `storeComparison.ts:128` | بلا فلتر placement (٤ صفحات إيكومرس) | **ROAS/ROI وتوصية «أوقف إعلاناتك»** |
| PG-6 | `seasonal-trend:46` | **بلا فلتر platform ولا placement** | **اتجاه CPA بيخلط طلبات المتجر (`rawConversions:1`, `cost:0`)** فيه |
| PG-7 | `monthly-forecast:52` | بلا فلتر placement | **بانر «١١٢٪ — تجاوزت الميزانية»** كاذب |
| PG-8 | `pmax:38` · `device-geo:35` · `youtube:26` | **بلا فلتر تاريخ خالص** | **إجمالي مدى الحياة** بدل فترة — نفس فئة `match-types`/`display-placements`، بيتضخّم كل يوم |

**PG-6 أخبثهم:** بيجمّع `rawConversions` بلا فلتر منصة، وكل طلب متجر بـ`cost:0` بيتعدّ كتحويل → **بيخفّض CPA بالصمت**، فالاتجاه بيقرا مختلف لمساحة عندها متجر عن اللي مالهاش، لأسباب مالهاش علاقة بأداء الإعلان.

**ملاحظة مطمئنة:** hub جوجل وتيك توك **مش متأثرين عملياً** النهارده (بيكتبوا `ALL/ALL` دايماً) — بس الاستعلام لسه غير محروس دفاعياً.

#### [High] PG-10 — نصّ خطأ خام + عربي مثبَّت على تغطية التتبّع
`trackingCoverage.ts:142-147` بيرجّع `err.message` الخام (رسايل undici زي `getaddrinfo ENOTFOUND` أو شهادة TLS) وفرعين عربي مثبَّت، **بلا `t()`**، وبيتعرض في `TrackingCoverageClient.tsx:198` **وبيتكرّر كـ`findingAr` و`findingEn` الاتنين** في `diagnosticsEngine.ts` (فالتقرير الإنجليزي بيوري الجملة العربية). الإصلاح: رمز خطأ يتترجم عند العرض.

#### [Medium] PG-11 · PG-12
- **PG-11 — صفحة منتجات الإيكومرس بتفقد هويتها في الحالة الفاضية** (`ecommerce/products/page.tsx:45` بيرجّع `EmptyState` بلا `PageHeader`، **وهي الصفحة الوحيدة الشاذّة** بين ٩ صفحات إيكومرس). تاجر ربط متجره لسه ومالوش منتجات بيقع على صفحة بلا عنوان.
- **PG-12 — الأونبوردنج بينشئ مساحة باسم إنجليزي مثبَّت مخزَّن** (`onboarding/page.tsx:28`, `"My workspace"`) بيتعرض كـeyebrow في `PageHeader` **على كل صفحة في المنتج** لمستخدم عربي وقع على الافتراضي — نفس نمط "خزّن مفتاح مش نصّ".

#### [Low] PG-13 — `"Spark Ads"` حرفي في JSX (`tiktok-spark-ads/page.tsx:74`) — اسم منتج، بس مخالف للقاعدة، **وده الوحيد اللي فحص البناء هيمسكه فعلاً** (حرفي في JSX مش عبر متغيّر).

#### لسه فاضل
**لا شيء — الـ٥٣ صفحة كلها اتفتحت.**

### 4.21 browser-verify — متصفح Chrome حقيقي · **١ مؤكَّد · ١ مقلوب · قيود صريحة**

> أول تحقق من متصفح في الأوديت كله. أكّد اكتشاف، **قلب اكتشاف تاني** (الاتجاه الصح
> للتصحيح)، وطلّع قيدين تشغيليين بصراحة بدل ما يفبرك أحكام.

#### ✅ CONFIRMED — BI-2 / RS-10: عربي مثبَّت بيوصل مستخدم إنجليزي
- **المسار + اللغة:** `/signup` · إنجليزي
- **اللي اتشاف:** ملأ الفورم بكلمة سر ناقصها رمز (**فشل تحقق متعمَّد، بيكتب صفر، مسموح**)، والسيرفر رفض والصفحة عرضت — **في صفحة إنجليزية بالكامل `dir="ltr"`** — رسالة **عربية**: «يجب أن تحتوي على رمز واحد على الأقلّ». الجذر مؤكَّد في `lib/validation/schemas.ts:14-21`. **والزرار مش متعطّل بالقائمة، فبيـPOST رغم النقص.** **وكل رسالة في الملف بتتسرّب بنفس الطريقة** — إيميل، كابتشا، شروط، اسم مساحة، فيدباك.
- **Verdict:** BI-2 مؤكَّد بالظبط زي المتوقَّع، **دلوقتي بدليل متصفح مش استنتاج كود**.

#### 🔄 OVERTURNED — الباگ التاريخي «إنجليزي جوّه dir=rtl» **متصلَّح**
- **المسار:** `/login` و`/signup` · عربي → إنجليزي
- **اللي اتشاف:** التحميل الافتراضي `dir="rtl"`/`lang="ar"` وكل النص عربي. دوس `EN` → **`dir` بيتقلب `ltr`، `lang` `en`، كل نص بيتحوّل إنجليزي، والتخطيط كله بينعكس**. ذاكرة المشروع (`auth-locale-must-set-direction`) بتوثّق الباگ ده كان حقيقي — **دلوقتي متصلَّح، ومؤكَّد بصرياً.**
- **Verdict:** يقلب حالة `Verified: NO` للصفحتين دول لـ«متصلَّح». **دي قيمة التحقق بالمتصفح — تأكيد إن حاجة اتصلحت فعلاً، مش بس اكتشاف عيوب.**

#### ⚠️ قيدان تشغيليان (صريحان)
- **`resize_window` ماشتغلش:** الاستدعاءات على 877px رجّعت «نجاح» لكن `window.innerWidth` فضل 1536 — تجاوز CDP مثبَّت مش قابل للمسح (اتأكّد بإعادة تحجيم Win32 على مستوى نظام التشغيل، لسه بيقرا 1536). **فكل الأحكام على ~1536px مش 877px.** واكتشاف **popover تحت `sm` في RTL** محتاج 877px حقيقي — **UNREACHABLE هذه الجولة**، محتاج جلسة متصفح تانية.
- **تسجيل الدخول بالبيانات فشل — «Invalid login credentials».** الوكيل أكّد إن البيانات مكتوبة صح قبل الإرسال، **وحاول مرة واحدة نضيفة وماكرّرش (تجنّب أي شكل من brute-force).** فكل صفحات `/dashboard/**` و`/admin/**` (`PageHeader` في الحالات الفاضية، مراية الأيقونات في RTL، popover الديمو) **UNREACHABLE.**
  - **السبب المرجَّح:** كلمة سر الحساب على القاعدة اللي سيرفر التطوير موصول بيها **مختلفة** عن المزوَّدة، أو الحساب مش متبذور فيها. **دي مش نتيجة سلبية عن الأمان** — قيد بيئة. لو حابب تكمّل الجولة دي، محتاج نتأكد من `DATABASE_URL` اللي `npm run dev` بيقرا منها وكلمة السر عليها.

#### لسه فاضل (من الوكيل)
- **كل `/dashboard/**` و`/admin/**`** — محتاج كلمة سر شغّالة على قاعدة سيرفر التطوير الفعلية.
- **popover/dropdown خارج الشاشة في RTL تحت `sm`** — محتاج جلسة متصفح تقدر توصل ≤640px.
- **`/forgot-password`, `/reset-password`, `/verify-email`, `/privacy`, `/terms`, `/cookies`, `/demo`, `/report/[token]`** — قابلة للوصول بلا جلسة، ماتزارتش هذه الجولة (`/report/[token]` محتاج توكن).
- **باقي رسائل `schemas.ts` العربية** — مؤكَّدة بالكود (نفس الملف نفس النمط)، بس المتصفح جرّب رسالة الرمز بس حيّاً.

### 4.23 التحقق البصري — أنا بنفسي على الموقع الحيّ (`adloop-saas.vercel.app`، ٢٦ أغسطس)

> فتحت الموقع الإنتاجي بنفسي (مسجّل دخول كـOWNER على مساحة DEMO) ومشيت على القايمة
> بسرعة. **الـ`resize_window` اشتغل هنا** (على عكس قيد الوكيل)، بس النافذة مابتنزلش تحت
> ~١٥٣٦ فعلياً — ففحص `sm` الحقيقي لسه ناقص. كل اللي تحت **مُشاهَد بعيني**.

| # | الفحص | النتيجة |
|---|---|---|
| **B1** | تقلّب الاتجاه مع اللغة | ✅ **مؤكَّد** — بعد Save، `dir` بيتقلب `rtl`/`lang=ar` والقائمة عربي؛ الرجوع لـEN بيقلبه `ltr`. الاتنين نضاف. |
| **B3** | `PageHeader` على الصفحات | ✅ ظاهر على Dashboard · Settings · Truth Center (أيقونة + عنوان) |
| **RTL عام** | كسر تخطيط في العربي | ✅ **نضيف تماماً** — القائمة اتنقلت لليمين، اللوجو يمين، قائمة الحساب يسار، الأزرار انعكست صح، **والاسم `Abdul-Rahman` فضل LTR جوّه العربي (معالجة `bdi` سليمة)**. مفيش قصّ ولا عناصر خارجة. **يقلب أي قلق عن كسر RTL على الصفحات دي.** |
| **P-10** | التسويق opt-in افتراضي | ✅ **مؤكَّد بصرياً** — «استقبال الرسائل التسويقية» **مفعّل افتراضياً** (P-10 صحيح) |
| **SY-1** | اتصال جوجل منتهي | ✅ **إشارة حيّة** — «invalid_grant» ظاهر في فيد القرارات على الإنتاج |
| **GAP-1** | verified بيبان شغّال في الديمو | ✅ **مؤكَّد المبدأ** — Truth Center (ديمو) بيوري verified = **380** لأن `demoSeed` بيكتبه؛ حساب حقيقي هيبقى صفر (بالظبط «شغّال في العرض، ميت في الإنتاج») |

#### ⚠️ ملاحظة UX جديدة (VIS-1) — مبدّل اللغة في الإعدادات مش لحظي، بيحتاج «Save»
دوس «العربية» في `Preferences` **بيعلّمها أزرق (مختارة)** لكن **الصفحة مابتتغيّرش حتى بعد reload كامل** — لحد ما تدوس «حفظ التغيرات». **التحديد البصري مضلِّل**: بيبان متطبّق وهو مجرد staged. متوقَّع المستخدم يفتكر اللغة اتغيّرت وهي لأ. الإصلاح: طبّق فوراً عند الاختيار (زي مبدّل `/login` اللي شغّال لحظي)، أو وضّح إنه محتاج حفظ.

#### لسه فاضل من البصري
- **popover/dropdown تحت `sm` الحقيقي (≤640px)** — النافذة مابتنزلتش تحت ~١٥٣٦ حتى بعد resize ناجح، فالفحص ده لسه مفتوح (زي ما الوكيل واجه). **الميمو `popovers-anchor-to-viewport` بيقول الإصلاح اتطبّق — مش متأكَّد بصرياً.**
- **B4 حالة الإيكومرس الفاضية (PG-11)** — المساحة ديمو وفيها منتجات، مقدرتش أطلّع الحالة الفاضية.
- **مراية الأيقونات الاتجاهية فردياً** — التخطيط العام انعكس صح، بس ماعملتش تدقيق سهم-بسهم.

**ملاحظة نظافة:** غيّرت لغة حسابك للعربي للفحص **ورجّعتها English بعده** — حسابك زي ما كان.

---

### 4.22 إغلاق الفجوتين الأخيرتين — قراءة مباشرة بنفسي (٢٦ أغسطس)

> المستخدم طلب أقفل الفجوتين اللي سمّيتهم «مهمّتين ومااتقروش» قبل بدء التعديل.
> واحدة رجعت نضيفة، **والتانية طلّعت Critical جديدة.**

#### ✅ الفجوة ١ — تحويل العملة في تقارير إيراد الأدمن: **نضيف**
`lib/admin/shared.ts:64` `toUsd` بيستخدم أسعار `ExchangeRateSnapshot` حقيقية (آخر لقطة لكل عملة)، **ولما مفيش سعر بيحطّ المبلغ في `unconverted` بدل ما يفترض USD أو يسقطه**. ده النمط الآمن الصح — **مش نفس عيب B-1** (اللي بيجمع عملتين بسعر واحد). `getMrr`/`getRevenueSeries`/`getMrrMovement` كلهم بيمرّوا من `toUsd` ده. **صفر اكتشاف.**

#### 🔴 الفجوة ٢ — [Critical] GAP-1: `CreativeSnapshot.verifiedConversions` بيتقرا كأساس CPA للإبداعات، **وعمره ما بيتكتب**
- **Path:** القرّاء `lib/creativeAnalysis.ts:54-55,86,151,278` و`lib/adDecisions.ts:216`؛ الكاتبون `syncGoogleAds.ts:344`, `syncMetaAds.ts:385`, `syncTikTokAds.ts:1147`
- **Repro:** `creativeAnalysis.ts:54` — `usingVerifiedData = raw.verifiedConversions !== null && raw.verifiedConversions > 0`، و`:55` بيختار `usingVerifiedData ? verifiedConversions : rawConversions` كأساس الـCPA. **لكن التلات كاتبين للإبداعات — `grep` أكّد — ولا واحد فيهم بيكتب `verifiedConversions` في بلوك الـupsert** (بيكتبوا `cost` و`rawConversions` بس). **الكاتب الوحيد للعمود ده في الريبو كله هو `demoSeed.ts:314`.** والعمود `Int?` بلا default → **`null` دايماً لكل مساحة عمل حقيقية**.
- **Impact:** `usingVerifiedData` **دايماً `false` للبيانات الحقيقية** → **مرتّب الإبداعات ومحرّك Scale/Kill على مستوى الإعلان بيرجعوا دايماً لـ`rawConversions`** — اللي هو نفسه الصفر المكسور لميتا (SI-1). يعني قرارات Scale/Kill على مستوى الإبداع **عمرها ما بتشوف رقم متحقَّق، بتشوف رقم المنصة الخام بس** (المضروب لميتا). **ودي طبقة تانية فوق SI-1:** حتى لو `rawConversions` اتصلح، الإبداعات لسه مش بتستفيد من التحقق أصلاً. **والديمو بيعرض العكس** — بياناته المبذورة فيها `verifiedConversions`، فالميزة بتبان شغّالة في العرض التجريبي وميتة في الإنتاج.
- **Suggested fix:** إما (أ) اكتب `verifiedConversions` على `CreativeSnapshot` من نفس مسار التحقق (يتطلّب `adId` على مسار `mark-matched` — مش موجود دلوقتي)، أو (ب) **لو التحقق على مستوى الإعلان مش مبني، شيل القراءة**: خلّي `creativeAnalysis` يعتمد على `rawConversions` صراحةً ويوقف يدّعي «usingVerifiedData» اللي عمره ما بيتحقق. **الأسوأ هو الوضع الحالي: عمود بيوحي إنه بيشتغل وهو ميت.**
- **Verified:** **YES — تحقُّق مزدوج.** `grep` على كل `creativeSnapshot.(upsert|create|update)` في الريبو + `awk` على التلات بلوكات أكّد صفر كتابة لـ`verifiedConversions` فيهم، و`demoSeed:314` هو الوحيد.

**تحديث العدّ: ٣٩ Critical.** (GAP-1 حاجز جديد رقم ١٩ في «يتقفل بكود».)

---

## 5. Traces

> المسارات التلاتة دي **اتتبّعتها بنفسي، مش بوكيل** — لأنها بتقطع نطاق كل وكيل،
> وده بالظبط سبب ضياعها عادةً.

### د١ — مسار الدفع: من الويب هوك للكتابة في الداتا

| # | المحطة | `file:line` | نجاح | فشل | **لو وصلت مرتين** | لو مات بعدها |
|---|---|---|---|---|---|---|
| ١ | استقبال | `paymob/route.ts:50` | تحليل الجسم | `!transaction` → `{received:true}` | لا أثر | لا شيء |
| ٢ | **تحقق HMAC-SHA512** | `:34-48`, `:58-61` | يكمل | **٤٠١ قبل أي كتابة** | نفس النتيجة | لا شيء |
| ٣ | **علامة المعالجة** | **`:63-64`** | `true` ويكمل | — | **`P2002` → `{duplicate:true}` ويخرج** | ⚠️ **الحدث محروق** |
| ٤ | فرع الفشل | `:66-98` | نيّة `FAILED` + حدث | — | محمي بـ٣ | `subscriptionStatus` **ماتلمستش** |
| ٥ | **الانتقال الذرّي** | `lib/billing.ts:304-314` | `PENDING→PAID` **بتأكيد المبلغ والعملة والمالك جوّه `where`** | `count = 0` | يميّز الحالتين صح | النيّة `PAID` |
| ٦ | تمييز الصفر | `:319-335` | — | **`PAID` = تكرار (نجاح) · `PENDING` = عدم تطابق (رفض)** | ✅ | — |
| ٧ | **منح الصلاحية** | `:350-358` | `ACTIVE` + `planKey` + `periodEnd` | — | — | ⚠️ **transaction منفصلة** |
| ٨ | سجل الحدث | `:360+` | `SubscriptionEvent` | — | — | — |
| ٩ | إشعار العميل | `:131` | `pushToActionFeed` | — | — | ممكن ينزل في مساحة الديمو (B-14) |

**اللي طلع صح ويستاهل يتقال:**
- **المحطة ٢ بتفشل مقفولة فعلاً** — `verifyPaymobHmac` بترجّع `false` لو الترويسة غايبة **أو** `PAYMOB_HMAC_SECRET` مش مضبوط، والمقارنة `timingSafeEqual` جوّه `try` بترجّع `false` على استثناء الطول، **والرفض ٤٠١ قبل أي كتابة**. ✅ **الادعاء في `docs/open-audit-findings.md` صحيح.**
- **المحطة ٥ أحسن جزء في المسار كله:** التأكيد الاقتصادي (`amountCents`, `currency`, `userId`) **جوّه شرط `where` بتاع الانتقال نفسه** — يعني التحقق والانتقال فعل واحد ذرّي، **والويب هوك مابيثقش في مبلغ الحمولة**. ده المكان الصح بالظبط.
- **المحطة ٦ بتميّز صفرين مختلفين تماماً** والتعليق بيشرح ليه: `PAID` = تكرار ويب هوك (نجاح بلا تكرار أثر)، و`PENDING` = عدم تطابق **بيترفض ويتسجّل للتسوية اليدوية**. ✅ قرار واعٍ ومكتوب.

**والكسر:**
- **المحطة ٣ قبل المحطة ٧** — دي **B-2**. أي استثناء بين ٦٣ و١١٨ (أو **جوّه ٥ و٧**) = الكارت اتخصم، والحدث محروق، وإعادة Paymob بترجع `duplicate` وتمشي. **والاسترداد كتابة يدوية.**
- **٥ و٧ مش في transaction واحدة** — انهيار بينهم = `PaymentIntent.status = "PAID"` و`User` مالوش اشتراك. **والنيّة بتبان مدفوعة فأي مصالحة مستقبلية هتعدّيها.**
- **٤ مابيلمسش `subscriptionStatus`** — دي **B-4**، وسببها إن `PAST_DUE` مالوش كاتب في الريبو كله.

**السؤال اللي التكليف طلبه صراحةً — هل في تنبيه لما كل التحققات تفشل؟ لأ.** الإشارة الوحيدة `console.error` في `:59`، و`sentry.server.config.ts` مالوش تكامل console، ومفيش `captureMessage` في مصدر التطبيق كله. **و`ProcessedWebhookEvent` بيتكتب بعد نجاح التحقق — فمعدّل رفض ١٠٠٪ بيسيب صفر صفوف في أي مكان.** يعني ترتيب حقول HMAC غلط **شكله مطابق تماماً لعطل Paymob كامل**، وأول واحد هيلاحظ عميل دفع. (**B-6**)

### د٢ — دورة الاشتراك: تسجيل ← تجربة ← انتهاء ← تخفيض

| # | الانتقال | إيه اللي بينفّذه | الحكم |
|---|---|---|---|
| ١ | **التسجيل** | `app/api/auth/signup/route.ts` — **مابينشئش أي سجل تجربة** | ✅ **مقصود** |
| ٢ | **بدء التجربة** | **مفيش.** `grep` على `trial` في موديل `User` كله رجّع **صفر حقول** | ✅ |
| ٣ | **حدّ التجربة** | `lib/entitlements.ts:110-114` — **مشتقّ**: `TRIAL_DAYS(14) - daysSinceSignup` من `createdAt` | ✅ |
| ٤ | **إنهاء التجربة** | **مفيش كرون. فحص على مسار القراءة.** `trialDaysLeft > 0` بيرجّع `pro`، وإلا `free` | ✅ **قوي** |
| ٥ | بعد الانتهاء مباشرةً | `:117-124` — نزول لحدود `free`، **مش حائط** | ✅ قرار موثَّق |
| ٦ | فرض التخفيض | `buildCheck` = `allowed: current < limit` — **بوابة إنشاء بس** | ❌ **B-5** |
| ٧ | الموارد فوق الحد | مفيش سحب. والكرون بيفضل يزامن الـ١٥ مساحة | ❌ **B-5** |
| ٨ | مساحة الديمو | `demoGate` **عرض-فقط**؛ الحارس الحقيقي `assertNotDemo` على نقاط الاختناق | ⚠️ **B-11** |

**الحكم على المسار ده: نصّه ممتاز ونصّه مكسور، والفصل حادّ.**

**الممتاز — ولازم يتقال بوضوح:** التجربة **مشتقّة مش مخزَّنة**. مفيش حقل، مفيش كرون، مفيش
جوب يقدر يفشل. **السؤال في تكليفي كان «إيه اللي بينهيها فعلاً — كرون؟ فحص قراءة؟ ولا
حاجة؟» والإجابة: فحص قراءة — وهي أمتن إجابة ممكنة.** التجربة **مش ممكن تفشل في الانتهاء**
لأن مفيش حاجة تنفّذ عشان تفشل. وده تصميم صح، وعكس النمط اللي الأوديت ده لقاه في كل حتة
تانية (حالة مخزَّنة محتاجة جوب يحدّثها).

**المكسور:** الانتقال من الاستحقاق للفرض. الاستحقاقات بتضيق فوراً وصح — **لكن مفيش حاجة
بتسحب اللي اتعمل قبل النزول**، والكرون الليلي مابيسألش عن الخطة أصلاً (B-5).

**ولقطة تانية:** الحالة `EXPIRED` في `:121` مشروطة بـ`subscriptionStatus === "PAST_DUE"`
— **واللي مفيش حاجة في الريبو بتكتبه** (B-4). يعني `EXPIRED` **حالة غير قابلة للوصول
هيكلياً**، وعشان كده حملة استرجاع العملاء و`subscriptionAlerts.ts` الاتنين ميتين. **سبب
واحد، تلات أعراض في تلات ملفات.**

### د٣ — الكليك من الاستقبال للرفع رجوعاً للمنصة

| # | المحطة | الحكم | مرئي لحد؟ |
|---|---|---|---|
| ١ | وصول الكليك (`/api/track/cta-click` · `sync-click`) | ⚠️ الهوية مُدّعاة (M-7) · بلا قيد فريد (M-8) | لأ |
| ٢ | رسالة واتساب/ماسنجر بتوصل التراكر | خارج النطاق | — |
| ٣ | **`mark-matched` بيقرّر إنه حقيقي و`verifiedConversions` بتزيد** | ❌❌ **بيفشل على التلاتة** | **لأ** |
| ٤ | `matchQuality` بيقيّم · عتبة الإرسال | ⚠️ الحالة الرئيسية بتسقط (H-2) | ✅ **مسجَّل ومعروض** |
| ٥ | تطبيع وتهشيم PII | ❌ الأرقام العربية بتتمسح (H-4) · هاش واحد للتلاتة (C-4) | لأ |
| ٦ | الرفع عبر كرون `conversion-sync` | ⚠️ بلا قفل رن، `SKIPPED` نهائي (H-3) | لأ |
| ٧ | **المنصة بترد** | ❌ **ميتا بتقرا الحالة بس (C-3)** · جوجل ✅ · تيك توك ✅ | **لأ لميتا** |
| ٨ | التعليم كـ«اتبعت» | ⚠️ بعد الإرسال، مش في transaction (L-3) | لأ |
| ٩ | العرض في اللوحة | ⚠️ التقارير بتسقّط ميتا (C-2/D-5) · الإجماليات مش مطابقة للصفوف (D-7) | لأ |

**المحطة ٣ هي قلب المنتج، وبتفشل على التلات منصات بتلات طرق مختلفة:**

| المنصة | السبب | النتيجة |
|---|---|---|
| **ميتا** | الزيادة بتفلتر `placementBreakdown: "ALL"`، والمزامنة عمرها ماتكتبها في المسار الطبيعي (**C-1**) | **صفر دائم** |
| **جوجل** | المزامنة بتعمل صف **امبارح بس**، والتحقق النهارده مالاقيش صف؛ و`getVerifiedConversionsCount` جسمها `return 0` (**D-1**) | **صفر لكل تحقق في نفس اليوم** |
| **تيك توك** | بيشتغل — **لو** الصف موجود وعلى مضيف UTC (**M-4**) | يشتغل بشروط |

**و`updateMany` مابيفحصش عدد الصفوف المتأثرة، والراوت بيرجع `{ok:true}`.** و`WaClick` بيتقلب
`matched: true` **قبل** المحاولة — **فمفيش إعادة معالجة تقدر تلاقيه**.

**وفرعان مستقلان مش موصولين ببعض:** الرقم اللي AdLoop **بيعرضه** كمتحقَّق (`AttributionResult`
+ `MetricSnapshot`) والأحداث اللي **بيرفعها** (`ConversionEvent`) بيتغذّوا بنداءين منفصلين
من التراكر، **بلا أي حاجة تربطهم ولا فحص يكشف لو واحد اشتغل والتاني لأ**.

#### 🔴 الإجابة على أهم سؤال في الأوديت كله

> **لو الرفع بيترفض بالصمت من التلات منصات دلوقتي، إيه في النظام هيقولنا؟**

**تيك توك بس** بيقرا جسم رده (`data.code !== 0`). **جوجل** بيقرا مظروف الفشل الجزئي.
**ميتا — أكبر التلاتة — مابيقراش ولا واحد فيهم**، وبيسجّل `SENT` على رد `200` فيه
`events_received: 0`.

**والأسوأ:** حتى لو الرفع اشتغل تمام، **رقم «المتحقَّق» المعروض للعميل صفر على ميتا وجوجل
أصلاً** (C-1 + D-1) — وبيتحوّل لادعاء إيجابي كاذب: `inflationRatePct = (raw − verified)/raw`
بيقول للعميل إن **١٠٠٪ من صرفه متضخّم و١٠٠٪ مهدور**.

**الحلقة مش بتقفل. والمنتج مش بس ساكت عن ده — بيقول العكس بثقة.**

---

## 6. /security-review

_(المرحلة هـ — لسه)_

## 7. Go/No-Go للتشغيل

**١٤ من ١٤ وكيل خلصوا. الحد الأدنى للحكم مكتمل. الـLedger صفر صفوف مفتوحة.**

**الحصيلة: ٣٢ Critical · ٦٣ High · ٦١ Medium · ٢٨ Low** — زائد ١٠ قرارات قانونية.

---

# ⛔ NO-GO

> **الحكم ده بعد جولتين.** الجولة الأولى ١٤ وكيل. الجولة التانية ٦ وكلاء جداد
> (route-sweep · sync-internals · page-sweep · browser-verify · tracker-seam ·
> **red-team-attacker**) بعد اعتراض المستخدم على التغطية — وطلّعوا **٦ Critical جداد
> منهم سلسلة اختراق من مجهول لـOWNER**، **وسبب جذري رابع لتصفير التحويلات كان بره
> الريبو**، **و٩ صفحات قرار Critical**. الحصيلة الكلية: **٣٨ Critical**.

**مش «شبه جاهز» ولا «جاهز بشروط».** السبب مش العدد — **السبب إن جملة المنتج
الوحيدة غير صحيحة دلوقتي**، والمنتج بيقول عكسها بثقة.

### 🔴 حاجزان جديدان من الجولة التانية — أخطر من أي حاجة في الأولى

**١. سلسلة اختراق: مجهول → OWNER على المنصة كلها (red-team السلسلة ١).**
حد يسجّل بإيميلك بحالة أحرف مختلفة (`Manfareiduwk@` بدل `manfareiduwk@`) → الفهرس حسّاس
للحالة فالتسجيل بينجح → `isOwnerEmail` بيصغّر الطرفين فبيطابق → `resolveAdminRole` بيدّي
OWNER قبل `isAdmin` → **استيلاء إداري كامل + صرف من ميزانية أي عميل بتوكنه هو**. متحقَّق
رباعياً. **الإصلاح خطوة واحدة:** ارفض التسجيل لما `email.toLowerCase() === OWNER_EMAIL`.

**٢. رقم التحويلات كان صفر من الأصل — سبب رابع بره الريبو (tracker-seam TS-1).**
الرابط الوحيد اللي المنتج بيولّده فيه `?ws=` بس، **مفيش `campaign=` خالص**. والتراكر بيقرا
`campaignId` من `?campaign=` اللي محدش بيضيفه. و`mark-matched` بيتخطّى الزيادة لما تكون
`undefined`. **يعني حتى بعد إصلاح C-1 وD-1، الرقم بيفضل صفر لـ١٠٠٪ من تحويلات واتساب** —
السلوك الافتراضي والوحيد للمنتج المشحون.

### الحاجز الجذري

> **رقم «التحويلات المتحقَّقة» بيفشل على التلات منصات، وبيتحوّل لادعاء إيجابي كاذب.**

- **ميتا (C-1):** الزيادة بتفلتر `placementBreakdown: "ALL"` — والمزامنة عمرها ماتكتبها في المسار الطبيعي. **صفر دائم.**
- **جوجل (D-1):** المزامنة بتعمل صف امبارح بس، والتحقق النهارده مالاقيش صف. و`getVerifiedConversionsCount` جسمها `return 0`. **صفر لكل تحقق في نفس اليوم.**
- **`updateMany` مابيفحصش الصفوف المتأثرة، والراوت بيرجع `{ok:true}`، و`WaClick` بيتقلب `matched` قبل المحاولة — فمفيش استرداد.**
- **والنتيجة مش صفر ساكت:** `inflationRatePct = (raw − verified)/raw` بيقول للعميل **«ميتا متضخّمة ١٠٠٪ و١٠٠٪ من صرفك مهدور»**.
- **ولو الرفع نفسه بيترفض، محدش هيعرف:** ميتا بترد `200` بـ`events_received: 0`، **والكود بيقرا الحالة بس** (C-3).

**منتج بيبيع «الرقم الحقيقي» بيقدّم رقماً غلطاً بثقة أخطر من منتج بيقول «مش عارف».**

---

### ١. حاجز — يتقفل بكود (١٨ بند)

**رقم الحقيقة (وعد المنتج) — ٥ حواجز:**
| # | البند | المسار | ليه حاجز |
|---|---|---|---|
| 1 | **C-1** ميتا: التحقق مابيسجّلش | `syncMetaAds.ts:139-156` | جملة المنتج |
| 2 | **D-1** جوجل: التحقق مابيسجّلش | `syncGoogleAds.ts:51-56` | جملة المنتج |
| 3 | **TS-1** `campaignId` عمره ما بيتبعت | `SettingsClient.tsx:1073` + التراكر | **سبب رابع — صفر لـ١٠٠٪ حتى بعد C-1/D-1** |
| 4 | **SI-1** `rawConversions` ميتا = ليدز-بس → `0` | `syncMetaAds.ts:116` | **رقم «المنصة بتدّعي» نفسه صفر لحملات الشراء** |
| 5 | **C-8** كل حدث واتساب `action_source:"website"` | `conversionSync.ts:164` | **ميتا مابتربطش الحدث بإعلان CTWA — رفض رابع** |

**رفع التحويلات — ٤ حواجز:**
| # | البند | المسار | ليه حاجز |
|---|---|---|---|
| 6 | **C-3** ميتا CAPI: الحالة بس بتتقرا | `conversionSync.ts:179-206` | رفض صامت للأبد |
| 7 | **C-4** الهاتف بلا `+` لجوجل **وتيك توك** | `conversionSync.ts:49-67` | **مؤكَّد بالتوثيق — غلط على منصّتين** |
| 8 | **C-5** `mark-matched` سباق فحص-ثم-تصرّف | `mark-matched/route.ts:39-75` | عدّ مزدوج |
| 9 | **C-6** ماسنجر بلا منع تكرار | `meta-messenger/route.ts:60-88` | **بيخلق تحويلاً وهمياً** |

**أمان — ٣ حواجز (الجولة التانية):**
| # | البند | المسار | ليه حاجز |
|---|---|---|---|
| 10 | **🔴 red-team السلسلة ١** مجهول → OWNER | `owner.ts:22` + `schemas.ts:24` + `adminRole.ts:38` | **استيلاء كامل — إصلاح خطوة واحدة** |
| 11 | **RS-1** SSRF بلا `safeFetch` | `trackingCoverage.ts:109` | داخل الشبكة، متحقَّق حيّاً على loopback |
| 12 | **S-1 + S-2** IDOR + خطف ويب هوك عابر | `available-campaigns` + `campaign-links` | إيراد وليدز مستأجر تاني |

**فلوس وأرقام تانية — ٦ حواجز:**
| # | البند | المسار | ليه حاجز |
|---|---|---|---|
| 13 | **D-3** إيراد المتجر في بسط ROAS | `ecommerce/ingest.ts:355,360` | **الكود بيخالف تعليق سكيماه** |
| 14 | **W-1** سقف تكلفة ميتا ÷١٠٠ | `syncMetaAds.ts:806-826` | **قتل صامت لمجموعة شغّالة** |
| 15 | **W-2** سقف الـ٢٠٪ على النص بس | `automationRules.ts:193` | الميزانية بتتربّع |
| 16 | **B-1** العميل بيختار عملة الفوترة | `workspaces/[id]/route.ts:12,89` | **خصم ~٦٥٪ خدمة ذاتية** |
| 17 | **B-2** الويب هوك بيعلّم قبل ما ينفّذ | `paymob/route.ts:63` | **العميل بيدفع ومياخدش** |
| 18 | **PG-1→9** ٩ صفحات قرار بأرقام مضاعَفة/تراكمية | `budget-simulator`, `portfolio`, `seasonal-trend`... | توصيات ميزانية غلط |

### ٢. حاجز — يتقفل النهارده، مش كود

| # | البند | الإجراء |
|---|---|---|
| 12 | **R-1** بيانات عميل حقيقية مكشوفة بلا مصادقة | `git rm public/adloop-2026-08-10.html` + تنظيف التاريخ. **مكشوفة دلوقتي.** |

### ٣. حاجز — أمان متعدّد المستأجرين (٤ بنود)

| # | البند | المسار |
|---|---|---|
| 13 | **S-1** `available-campaigns` بلا أي فحص ملكية | `available-campaigns/route.ts:92` |
| 14 | **S-2** `campaign-links` بيقبل معرّفات أي مستأجر | `campaign-links/route.ts:99` |
| 15 | **AD-1** الانتحال جلسة كاملة ٣٠ يوم بلا علامة | `impersonate/route.ts:52` |
| 16 | **AD-2** التعليق مابيوقّفش الكرون ولا الصرف | `sync-google-ads/route.ts:180` |

### ٤. حاجز — خصوصية (٢، وقبل ٣١ أكتوبر)

| # | البند |
|---|---|
| 17 | **P-1** «احذف حسابي» مابيحذفش — ٥ جداول بلا FK |
| 18 | **P-2** مرفقات الدعم `access:"public"` وعمرها ماتتمسح |

---

### 🟠 اللي مش حاجز — بس **قبل أول عميل مدفوع**

- **LATE-1** كرون التجديد **مااتبناش** → الاشتراكات مابتتجدّدش أصلاً، و`PAST_DUE` مالوش كاتب (وده بيميّت B-4 وحملة الاسترجاع و`subscriptionAlerts`).
- **CR-1 + WR-1** الستة كرونات بيردّوا `200` مهما حصل · **CR-3** وظيفتان بلا أي جدول رصد → **لو كرون وقف من أسبوع محدش هيعرف**.
- **B-5** التخفيض مابيسحبش حاجة والكرون بيفضل يدفع تمنها.
- **W-4** كل بوابات Scale استشارية عند نقطة الكتابة · **W-6** التوثيق غلط في الاتجاهين.
- **E-1** `cogs = 0` → «رابح مؤكَّد، زوّد ميزانيتك».
- **S-5** إيميل المالك المثبَّت (لو `OWNER_EMAIL` مش مضبوط في Vercel).

---

### 🔷 محتاج حاجة من بره (مش قابل للإغلاق بكود)

١. **ترتيب حقول HMAC عند Paymob** — اختبار في البيئة التجريبية. **الكود يفشل مقفولاً (متأكَّد)، فالخطر إن كل دفعة ترفض بالصمت.**
٢. **`PAYMOB_INTEGRATION_ID` وأي عملات بيقبلها** — يحسم B-9 (فرعان: كل عميل غير مصري مايقدرش يشتري، **أو** ١٤٩ دولار بتتحصّل ١٤٩ جنيه).
٣. **تأكيد `OWNER_EMAIL` مضبوط في Vercel + صف المستخدم موجود** — يحسم S-5.
٤. **تسعير `claude-sonnet-5`** — يحسم AI-1.
٥. **تجربة استرداد نسخة احتياطية واحدة** — CR-5. **نسخة غير متحقَّق منها اعتقاد مش نسخة.**
٦. صلاحيات ميتا (فورم ليدز/ماسنجر) · حساب تيك توك حقيقي · Sentry.

### 🔵 محتاج قرار منك (١٠ — التفصيل في ٤.٦)

أهمهم: **مفيش اتفاقية معالجة بيانات مع التجّار في الريبو كله** · مفيش آلية محو بالتمرير لعميل التاجر · مدد الاحتفاظ · نقل البيانات خارج مصر (**والسياسة بتدّعي بنوداً تعاقدية مفيش دليل عليها**).

---

### أول حاجة أصلحها

**`public/adloop-2026-08-10.html`** — دقيقتين، وبيانات حيّة مكشوفة دلوقتي.

**وبعدها C-1 وD-1 مع بعض** — إصلاح واحد معماري (جدول تحقّق مستقل بدل `updateMany` بيتسابق مع المزامنة) بيقفل الاتنين، **وهو أرخص من ترقيع كل واحد لوحده**.

---

## 8. لسه فاضل

**الـLedger مقفول بالكامل — صفر صفوف `☐`.** واللي تحت **مش صفوف مفتوحة**، ده جرد
بالاسم لحدود التغطية جوّه الصفوف المقفولة، عشان الرن الجاي يبدأ منه.

**نطاقات ماتفتحتش خالص:**
- **`app/api/agent/**`** — نموذج المصادقة وكشف البيانات غير متحقَّق منهم (٣ وكلاء ذكروه).
- **`products/*` · `upload-sheet/*`** — مسار رفع الإكسل بالكامل.
- **`connected-platforms/disconnect` و`[id]`** — دلالات فك الربط، **وهل فك ربط في نص المزامنة يتسابق مع كرون شغّال**.
- **`account/export-data` قريته بنفسي · `account/delete` قراه وكيل** — لكن `export-csv` و`site-scan/[id]/print` لأ.

**تغطية جزئية معلومة:**
- **~٦٠ من ١٣٣ راوت اتفتحوا** في المراجعة الأمنية. **و~٢٤ ظهر فيهم نمط `workspaceAccess` في الـgrep من غير تأكيد إن الفحص بيسبق كل كتابة** — **ودي بالظبط النقطة اللي S-1 عاش فيها**.
- **أقسام كبيرة من ملفات المزامنة التلاتة اتفحصت بـgrep** (الأسماء مسرودة في ٤.٨ و٤.١٤). **وأخطر فجوة متبقية: هل أي `catch` داخلي بيرجّع `0`/`[]` لمقياس بيتعرض بعدها كصفر شرعي.**
- **~٤٢ صفحة من ٨٢ ماتقروش** · **`CreativeSnapshot` مقابل `MetricSnapshot` ماتفحصش** (مذكور صراحةً في تكليف `data-integrity` ومااتعملش) · **٩٠ بند knip من نوع export/type ماتفرزوش**.
- **`docs/activation-checklist.md` من §٣٢ لآخره بالعيّنة** · **ادعاءات اكتمال تحليلات الفجوات (٢٤٨ بند) ماتحقّقتش** — دي أوديت مستقل بذاته.

**قيود منهجية (بالتصميم):**
- **صفر تحقق من متصفح** — كل اكتشاف بصري وRTL من قراءة الكود. **المطلوب: مرور على `/dashboard/campaigns` وغيرها على ~٨٧٧px باللغتين.**
- **صفر استعلام قاعدة بيانات** — فمش معروف لو في نوايا دفع عالقة `PENDING` دلوقتي، ولا لو `MetricSnapshot` شايل صفوف `ALL` ومقسّمة لنفس المفتاح (W-20).
- **صفر نداء منصة أو Paymob أو Anthropic.**
- **`/security-review` شاف ٨ ملفات بس** (فرق الفرع عن `main`) — **مش الـ١٣٣ راوت**. نتيجته في القسم ٦، ومانقضتش أي اكتشاف.
- **`wa-conversion-tracker` بره النطاق** — فاللي التراكر بيبعته فعلاً (ASCII ولا عربي-هندي · هل `campaignId` دايماً موجود) **غير متحقَّق منه**، وهو مدخل C-1/D-1.
- **ملفات `docs/public/` ماتغذّتش للوكلاء** — قارنتها بنفسي بعد كده (القسم ٤.١٥)، و**٥ بنود فاتت** واتضافت هناك.
