# AdLoop — SaaS مقارنة أداء الإعلانات بالـ "تحويل الحقيقي"

## الفكرة في جملة واحدة
مش أداة تجميع بيانات ("كل الأرقام في مكان واحد") — دي حاجة موجودة (Supermetrics،
Whatagraph). القيمة الحقيقية: **مقارنة CPL/ROAS بناءً على محادثات واتساب/ماسنجر
متحقق منها فعلياً، مش على "dashboard conversions" اللي المنصات بتضخّمها.**

## الحالة الحالية (محدّثة)
المنتج مكتمل من ناحية الأساسيات بالكامل - مش MVP في مرحلة بناء، منتج شغال:
- **Auth حقيقي** كامل (تسجيل دخول/خروج، MFA، تسجيل بجوجل/فيسبوك مباشرة
  مع سحب الاسم والصورة، CSRF، rate limiting)
- **OAuth حقيقي** لجوجل وميتا وتيك توك (ربط حسابات إعلانات حقيقية)
- **90 صفحة**، **156 API endpoint**، **88 جدول قاعدة بيانات**، **7 كرونات**
  (معدودة من الشجرة في ٤ سبتمبر ٢٠٢٦؛ الأرقام السابقة هنا كانت ٧٩/١٣٣/٨٠)
  - راجع تفاصيل كل قرار في `CLAUDE.md`

## البنية (مبسّطة - النماذج الكاملة في `prisma/schema.prisma`)

```
User — تسجيل دخول (إيميل/باسورد أو Google/Facebook مباشرة)
 └── ConnectedPlatform — ربط Google Ads/Meta/TikTok
 └── Workspace (واحدة أو أكثر لكل مشترك) — عزل كامل لكل عميل
      ├── CampaignLink — الكامبينز المحددة من كل منصة
      ├── MetricSnapshot — بيانات يومية (raw + verified conversions)
      ├── CreativeSnapshot — أداء الإعلان الفردي (Scale/Kill/Watch)
      ├── UnmatchedClick / AttributionResult — محرك الإسناد
      ├── MessengerConversation — تحقق جودة ليدز ماسنجر
      └── ConversionValueConfig — لحساب ROAS/ROI حقيقي
```

## قلب المنتج: `lib/metricsEngine.ts` + `lib/creativeAnalysis.ts`
- `computeMetrics()` - cplRaw/cplVerified/inflationRate/roas لكل منصة
- `classifyScaleKillWatch()` - قرار Scale/Kill/Watch حقيقي على مستوى الإعلان الفردي
- `applyModeledAttribution()` - دمج الاحتمالي مع المؤكد (متصلة بصفحة التقارير)

## الربط بمشروع تتبع الواتساب/الماسنجر
`wa-conversion-tracker` (مشروع منفصل، **بيشارك نفس قاعدة Postgres - مش
SQLite؛ ومفيهوش Prisma أصلاً، بيكلّم القاعدة بـ`pg` خام**) **متصل فعلياً** بـ adloop-saas
عبر `/api/attribution/*` - أي تحقق حقيقي (كود واتساب أو محادثة ماسنجر) بيزوّد
`MetricSnapshot.verifiedConversions` مباشرة. الماسنجر نفسه مبني **جوه**
adloop-saas (`/api/webhooks/meta-messenger`) - قرار معماري مقصود، مش
مشروع منفصل زي الواتساب، لأنه محتاج وصول مباشر لبيانات Postgres نفسها.

## Backlog حقيقي محدّث (اتأكد منه بالكود فعلياً، مش تخمين)

> **مراجعة ٤ سبتمبر ٢٠٢٦:** ستّةُ بنودٍ هنا كانت مكتوبةً «مش مبنيّة» وهي
> مبنيّة. والعنوانُ ده بيقول «اتأكد منه بالكود فعلياً» - فالدرسُ إنّ
> **الجملة دي نفسها بتشيخ**: التأكّدُ حصل يومَها وما اتكرّرش. أيُّ بندٍ
> هنا يتقفل، يتشطب هنا في نفس الكوميت.

- [x] **MCP Server ("Ask Claude about your data")** — مبنيّ: خادم JSON-RPC على
      `/api/mcp` بأربع عشرة أداة قراءة، ومصادقة بمفتاح في ترويسة **أو** OAuth 2.1
      (اكتشاف RFC 9728 و8414، تسجيل ديناميكيّ RFC 7591، PKCE S256، شاشة موافقة).
      **غير مُختبَر حيّاً** مع claude.ai أو ChatGPT بعد.
- [x] **Multi-user لنفس الـ Workspace** — اتبنى. مقاعدُ اطّلاعٍ وتنفيذ
      بحدودٍ لكلّ باقة، وأربعةُ فلاتر وصولٍ في `lib/workspaceAccess.ts`،
      وبوّابةُ بناءٍ بتمنع أيّ مسارِ كتابةٍ يستعمل فلترَ القراءة.
- [x] **ويب هوك المتاجر — الخمسة مبنيّة**: شوبيفاي وسلّة وزد وووكومرس
      وإيزي أوردرز، كلُّهم على `/api/webhooks/ecommerce/[platform]`،
      و`scripts/checkWebhookAuth.mjs` بيختبر توقيعَ الخمسة في كلّ بناء.
      (السطر ده كان بيقول «سلة بس» - وده بقى غلط.)
- [x] **رفع التحويل رجوعاً للمنصة** (Offline Conversion) — **مبنيّ للتلاتة**
      في `lib/conversionSync.ts`: Meta CAPI و TikTok Events API وGoogle
      `uploadClickConversions`، بكرون `/api/cron/conversion-sync` اليوميّ.
      🔴 **الاسمان `sendMetaConversion`/`sendTikTokConversion` مش موجودين**
      لأنّ التنفيذ اسمُه غيرُ كده - وده الغلطُ اللي خلّى السطر ده يفضل
      مكتوباً «TODO» في تلات ملفّات. **grep على اسمٍ متوقَّعٍ مش دليلَ غياب.**
- [x] ~~`comparePlatforms()`~~ ✅ اتوصّلت - جملة المقارنة التلقائية في الصفحة الرئيسية
- [x] ~~`explainRoasGap`/`computeEcommerceMetrics`~~ ✅ اتوصّلوا - صفحة التسعير
- [x] ~~`runFullPricingSafetyNet`~~ ✅ اتوصّلت - `ProductSaleEvent` جديد + SKU على المنتج، مبيعات حقيقية من سلة
- [x] ~~`videoMetrics.ts` بالكامل orphaned~~ ✅ اتوصّلت - صفحة `/dashboard/campaigns/video-performance` جديدة (جوجل بس عنده بيانات فعلياً - صادق عن ده في الصفحة نفسها)
- [x] ~~`checkMonthlyChangeCeiling`~~ ✅ اتوصّلت - حاجز أمان حقيقي قبل أي تنفيذ تغيير مزايدة
- [ ] **دوال معزولة تانية أصغر** (`compareMetric`, `computeRealResponseTimeMinutes`,
      `countGenuineLeads`, `detectCreativeFatigue`, `getMultiTouchRate`,
      `resolvePeriodComparison`, `resolveSessionConversion`, `auditFullCatalogPricing`)
      - لُقطت في مراجعة شاملة، مش كلها اتفحصت بعمق واحدة واحدة لسه
- [x] **Scale الحقيقي** — بينفّذ فعلاً عبر `POST /api/creatives/decision`
      (بيرفع ميزانيةَ الأب)، مش معلوماتيّاً زي ما كان مكتوب هنا. وعشان كده
      بوّاباتُ `classifyScaleKillWatch` بقت مُلزِمةً **عند نقطة الكتابة**
      لا عند رسم الزرار. المرجعُ الوحيد لأيّ نداءٍ حقيقيّ:
      `lib/executingActions.ts`.
- [x] **نظام مساعدة داخل المنتج** — مركزُ مساعدةٍ بـ٥١ مقالاً في ١٠ أقسام
      ببحثٍ، مربوطٌ بودجت الدعم (سؤالٌ بيلاقي إجابته قبل ما يفتح تذكرة).
- [ ] **AI Forecast** - توقع أداء مستقبلي لكل Workspace لوحده، معلَّم "beta"
- [ ] **Attribution Explorer** - واجهة استكشاف تفاعلية لمحرك التوزيع الاحتمالي
- [ ] **Competitor Monitor** - مخصص لخطة دفع أعلى لاحقاً
- [ ] **خدمة Puppeteer/Browserless** - تحويل التقارير لـPDF بمتصفح حقيقي
      (بديل عن مكتبات PDF التقليدية اللي مش بتدعم عربي/RTL بشكل موثوق)
- [ ] **تيك توك شوب** - مؤجّلة بقرار المستخدم (مش أولوية لعملائه الحاليين)
- [ ] **GA4 integration** - مؤجّلة، محتاجة جلسة تخصيص منفصلة
- [ ] **Simple/Complex Mode toggle** - مؤجّلة، بس لو استخدام حقيقي أثبت
      إن التعقيد مشكلة فعلاً للمستخدمين المبتدئين
