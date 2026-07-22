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
- **47 صفحة داشبورد**، **71 API endpoint**، **48 جدول قاعدة بيانات**
  (~24,600 سطر كود) - راجع تفاصيل كل قرار في `CLAUDE.md`

## البنية (مبسّطة - النماذج الكاملة في `prisma/schema.prisma`)

```
User — تسجيل دخول (إيميل/باسورد أو Google/Facebook مباشرة)
 └── ConnectedPlatform — ربط Google Ads/Meta/TikTok
 └── Workspace ("Thawabet", "Tamkeen", ...) — عزل كامل لكل عميل
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
`wa-conversion-tracker` (مشروع منفصل، SQLite) **متصل فعلياً** بـ adloop-saas
عبر `/api/attribution/*` - أي تحقق حقيقي (كود واتساب أو محادثة ماسنجر) بيزوّد
`MetricSnapshot.verifiedConversions` مباشرة. الماسنجر نفسه مبني **جوه**
adloop-saas (`/api/webhooks/meta-messenger`) - قرار معماري مقصود، مش
مشروع منفصل زي الواتساب، لأنه محتاج وصول مباشر لبيانات Postgres نفسها.

## Backlog حقيقي محدّث (اتأكد منه بالكود فعلياً، مش تخمين)

- [ ] **MCP Server ("Ask Claude about your data")** — مفيش أي بداية بناء لسه
- [ ] Multi-user لنفس الـ Workspace (قرار واعٍ، مش مطلوب حالياً)
- [ ] **Shopify + Easy Orders webhooks** - سلة بس مبنية فعلاً (تأكدت بالفحص المباشر - كان فيه مجلد فاضي لShopify اتلبّس بالغلط كإنه مبني في مراجعة سابقة)
- [ ] **رفع التحويل رجوعاً للمنصة** (Offline Conversion) لغير جوجل -
      `sendMetaConversion`/`sendTikTokConversion` لسه TODO في الكود نفسه
- [x] ~~`comparePlatforms()`~~ ✅ اتوصّلت - جملة المقارنة التلقائية في الصفحة الرئيسية
- [x] ~~`explainRoasGap`/`computeEcommerceMetrics`~~ ✅ اتوصّلوا - صفحة التسعير
- [x] ~~`runFullPricingSafetyNet`~~ ✅ اتوصّلت - `ProductSaleEvent` جديد + SKU على المنتج، مبيعات حقيقية من سلة
- [x] ~~`videoMetrics.ts` بالكامل orphaned~~ ✅ اتوصّلت - صفحة `/dashboard/campaigns/video-performance` جديدة (جوجل بس عنده بيانات فعلياً - صادق عن ده في الصفحة نفسها)
- [x] ~~`checkMonthlyChangeCeiling`~~ ✅ اتوصّلت - حاجز أمان حقيقي قبل أي تنفيذ تغيير مزايدة
- [ ] **دوال معزولة تانية أصغر** (`compareMetric`, `computeRealResponseTimeMinutes`,
      `countGenuineLeads`, `detectCreativeFatigue`, `getMultiTouchRate`,
      `resolvePeriodComparison`, `resolveSessionConversion`, `auditFullCatalogPricing`)
      - لُقطت في مراجعة شاملة، مش كلها اتفحصت بعمق واحدة واحدة لسه
- [ ] **Scale الحقيقي** (تنفيذ زيادة ميزانية فعلي عند المنصة) - لسه معلوماتي
      بس، Kill (إيقاف إعلان) بس اتفعّل فعلياً
- [ ] **نظام مساعدة (Help) مبرمج داخل المنتج** - contextual، مش صفحة أسئلة شائعة ثابتة
- [ ] **AI Forecast** - توقع أداء مستقبلي لكل Workspace لوحده، معلَّم "beta"
- [ ] **Attribution Explorer** - واجهة استكشاف تفاعلية لمحرك التوزيع الاحتمالي
- [ ] **Competitor Monitor** - مخصص لخطة دفع أعلى لاحقاً
- [ ] **خدمة Puppeteer/Browserless** - تحويل التقارير لـPDF بمتصفح حقيقي
      (بديل عن مكتبات PDF التقليدية اللي مش بتدعم عربي/RTL بشكل موثوق)
- [ ] **تيك توك شوب** - مؤجّلة بقرار المستخدم (مش أولوية لعملائه الحاليين)
- [ ] **GA4 integration** - مؤجّلة، محتاجة جلسة تخصيص منفصلة
- [ ] **Simple/Complex Mode toggle** - مؤجّلة، بس لو استخدام حقيقي أثبت
      إن التعقيد مشكلة فعلاً للمستخدمين المبتدئين
