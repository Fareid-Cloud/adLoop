// lib/launchReadiness.ts
//
// **إعدادٌ ناقص لازم يبان قبل النشر، مش بعد أول عميل يشتكي.**
//
// 🔴 الملفّ ده اتولد من واقعة حقيقية متسجّلة في قاعدة البيانات: خمس
// محاولات دفع في ١ أغسطس ٢٠٢٦، كلّها `FAILED`، والسبب المحفوظ في
// `PaymentIntent.failureReason` هو `401 Authentication credentials were
// not provided` - يعني مفاتيح Paymob ما كانتش مضبوطة. مافيش حاجة في
// المنتج كانت بتقول كده؛ الطريقة الوحيدة لمعرفته كانت استعلام يدويّ على
// جدول النوايا بعد الفشل.
//
// و`lib/envCheck.ts` كان المفروض يغطّي ده. هو **بيتنده فعلاً** وقت
// الإقلاع من `instrumentation.ts`، بس كان بيفحص خمسة متغيّرات من تسعةٍ
// وأربعين - فمفاتيح Paymob كلّها كانت بره الفحص.
//
// (وللأمانة: أنا نفسي كتبت هنا أوّل مرّة إنّه "كود ميّت" لأنّ الـgrep بتاعي
// كان على `app lib scripts` بس، و`instrumentation.ts` في الجذر. نطاق
// البحث الناقص بيدّي نتيجةً واثقةً وغلط.)
//
// القائمة هنا **مغلقة ومشتقّة من الكود** (grep على `process.env.`)، مش من
// الذاكرة ولا من `.env.example`. وكلّ بند بيقول **إيه اللي بيقف** لو ناقص -
// لأنّ "متغيّر ناقص" مش معلومة، و"العملاء مش هيقدروا يدفعوا" معلومة.
//
// **مافيش قيمة سرٍّ بتتقرا ولا بتترجع من هنا أبداً** - "مضبوط/ناقص" بس.
// اللوحة دي لصاحب المنتج، ومع كده عرض السرّ على شاشة مالوش أي داعٍ.

/** خطورة الغياب - مرتّبة بالأثر لا بالمكوّن */
export type ReadinessSeverity =
  /** المنتج ما بيشتغلش، أو بيشتغل بثغرة */
  | "BLOCKER"
  /** المنتج شغّال بس مافيش فلوس بتدخل - مانع نشرٍ لمنتجٍ مدفوع */
  | "REVENUE"
  /** ميزةٌ بعينها بتقف بالكامل، والباقي شغّال */
  | "FEATURE"
  /** تحسينٌ أو تكاملٌ ثانويّ - النشر يصحّ بدونه */
  | "OPTIONAL";

export interface ReadinessItem {
  key: string;
  group: string;
  severity: ReadinessSeverity;
  /** إيه اللي بيقف لو ناقص - بالعربي الواضح، مش اسم الوحدة */
  breaks: string;
  /** بديلٌ مدمج في الكود يخلّي الغياب غير قاتل */
  fallback?: string;
  /**
   * غيابه بيمنع الخادم من الإقلاع أصلاً (`validateEnvOrThrow` بترمي).
   *
   * ⚠️ **مقصورة على اللي المنتج بلاه مايردّش على أي طلب.** الفرق بينها
   * وبين `BLOCKER` مقصود: `RESEND_API_KEY` مثلاً بيوقّف التسجيل الجديد
   * بالكامل (فهو BLOCKER بحق)، لكن كلّ مشترك قائم بيفضل شغّال عادي -
   * ووقف الموقع كلّه بسببه بيحوّل عطلاً جزئياً لانقطاعٍ تامّ صنعناه بإيدينا.
   */
  haltsBoot?: true;
}

// ملاحظة على `NEXT_PUBLIC_*`: بتتحقن وقت البناء، فقراءتها هنا على الخادم
// بتعكس اللي اتبني فعلاً - وده المطلوب بالظبط.
export const READINESS: readonly ReadinessItem[] = [
  // ==================== الأساس ====================
  { key: "DATABASE_URL", group: "Core", severity: "BLOCKER", haltsBoot: true,
    breaks: "No page loads at all. The entire product is down." },
  { key: "JWT_SECRET", group: "Core", severity: "BLOCKER", haltsBoot: true,
    breaks: "No login and no sessions — nobody can reach their account." },
  { key: "TOKEN_ENCRYPTION_KEY", group: "Core", severity: "BLOCKER",
    breaks: "Connecting any ad account throws — Google/Meta tokens cannot be stored at all." },
  { key: "CRON_SECRET", group: "Core", severity: "BLOCKER",
    breaks: "Every scheduled job stops: daily sync, conversion upload, emails, backups." },
  { key: "APP_URL", group: "Core", severity: "FEATURE",
    breaks: "OAuth return links and email links can be generated wrong.",
    fallback: "Falls back to VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL." },

  // ==================== الفلوس ====================
  { key: "PAYMOB_SECRET_KEY", group: "Payments", severity: "REVENUE",
    breaks: "Checkout fails with 401 before reaching Paymob — no money arrives. This is exactly what happened to the five recorded attempts." },
  { key: "PAYMOB_PUBLIC_KEY", group: "Payments", severity: "REVENUE",
    breaks: "The unified checkout page never opens for the customer." },
  { key: "PAYMOB_INTEGRATION_ID", group: "Payments", severity: "REVENUE",
    breaks: "Paymob rejects the payment intention." },
  { key: "PAYMOB_HMAC_SECRET", group: "Payments", severity: "REVENUE",
    breaks: "The worst one: the customer pays, the webhook is rejected, the subscription never activates — money taken, nothing delivered." },

  // ==================== منصّات الإعلانات ====================
  { key: "GOOGLE_ADS_CLIENT_ID", group: "Google", severity: "FEATURE",
    breaks: "All Google account linking — the most complete platform in the product (25/25)." },
  { key: "GOOGLE_ADS_CLIENT_SECRET", group: "Google", severity: "FEATURE",
    breaks: "Same as above — Google OAuth cannot complete." },
  { key: "GOOGLE_ADS_DEVELOPER_TOKEN", group: "Google", severity: "FEATURE",
    breaks: "Every Google Ads API call is rejected even when OAuth succeeded." },
  { key: "META_APP_ID", group: "Meta", severity: "FEATURE",
    breaks: "Facebook/Instagram linking, and conversion upload to Meta CAPI." },
  { key: "META_APP_SECRET", group: "Meta", severity: "FEATURE",
    breaks: "Same as above." },
  { key: "TIKTOK_APP_ID", group: "TikTok", severity: "FEATURE",
    breaks: "TikTok linking and conversion upload to the Events API." },
  { key: "TIKTOK_APP_SECRET", group: "TikTok", severity: "FEATURE",
    breaks: "Same as above." },

  // ==================== الإيميل ====================
  { key: "RESEND_API_KEY", group: "Email", severity: "BLOCKER",
    breaks: "No email is sent at all: verification, password reset, two-factor codes, reports, alerts. A new signup stalls at the verification step." },
  { key: "NOTIFICATION_FROM_EMAIL", group: "Email", severity: "FEATURE",
    breaks: "The sender address — mail may be rejected or land in spam." },
  { key: "SUPPORT_INBOX_EMAIL", group: "Email", severity: "OPTIONAL",
    breaks: "New support messages do not reach your inbox (they still appear in the panel)." },

  // ==================== الذكاء الاصطناعي ====================
  { key: "ANTHROPIC_API_KEY", group: "AI", severity: "FEATURE",
    breaks: "Every AI feature: insights, image quality checks, deep page scan, chat." },

  // ==================== التخزين والنسخ ====================
  { key: "BLOB_READ_WRITE_TOKEN", group: "Storage", severity: "FEATURE",
    breaks: "Support attachments and the nightly backup — both skip silently." },

  // ==================== الحماية ====================
  { key: "TURNSTILE_SECRET_KEY", group: "Security", severity: "FEATURE",
    breaks: "Signup has no bot protection — open to automated account creation." },
  { key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", group: "Security", severity: "FEATURE",
    breaks: "Same as above — the browser-side half." },
  { key: "OWNER_EMAIL", group: "Security", severity: "OPTIONAL",
    breaks: "Identifies the panel owner.",
    fallback: "A built-in value in lib/owner.ts keeps the panel reachable." },
  { key: "INTERNAL_SERVICE_SECRET", group: "Security", severity: "FEATURE",
    breaks: "The WhatsApp tracker cannot call the product — the attribution engine stops." },

  // ==================== الويب هوك ====================
  // 🔴 **`SALLA_WEBHOOK_SECRET` اتشال من هنا، وده مش تنظيف.**
  //
  // كان بيتعرض كنقصٍ دائم لا يُسَدّ: أسرارُ المتاجر الخمسة كلُّها **لكلّ
  // مساحة عمل** في `EcommerceConnection.webhookSecret` مشفَّرةً، ومفيش
  // متغيّرُ بيئةٍ لأيٍّ منها. فالصفُّ ده كان بيقول لصاحب المنتج إنّ سلّة
  // معطّلة وهي شغّالة - **وشاشةُ جاهزيةٍ بتكذب في بندٍ واحد بتفقد ثقتَها
  // في البنود كلّها**، وهو أسوأ من غيابها.
  { key: "META_WEBHOOK_VERIFY_TOKEN", group: "Webhooks", severity: "FEATURE",
    breaks: "The Meta lead-form subscription cannot complete." },
  { key: "META_MESSENGER_VERIFY_TOKEN", group: "Webhooks", severity: "FEATURE",
    breaks: "Verified Messenger conversions — one of only two real verification sources." },

  // ==================== إشعارات الموبايل ====================
  { key: "VAPID_PUBLIC_KEY", group: "Push", severity: "OPTIONAL",
    breaks: "Browser and mobile push notifications." },
  { key: "VAPID_PRIVATE_KEY", group: "Push", severity: "OPTIONAL",
    breaks: "Same as above." },
  // الثالثُ إلزاميّ في معيار Web Push: مفتاحان بلا عنوان تواصلٍ يُرفضان
  // عند بعض المزوّدين، فغيابُه يوقف الإشعارات كما يوقفها غيابُ المفتاح.
  { key: "VAPID_CONTACT_EMAIL", group: "Push", severity: "OPTIONAL",
    breaks: "Push providers reject a subscription whose VAPID block has no contact address." },

  // ==================== تكاملات ثانوية ====================
  { key: "GOOGLE_PAGESPEED_API_KEY", group: "Secondary", severity: "OPTIONAL",
    breaks: "Landing-page speed measurement inside the deep scan." },
  { key: "SCREENSHOT_API_KEY", group: "Secondary", severity: "OPTIONAL",
    breaks: "Competitor page screenshots." },
  // 🔴 **الأسرارُ كانت غائبةً والمعرّفاتُ وحدها مفحوصة.** فحصُ نصفِ زوجٍ
  // لا يفحص شيئاً: `GOOGLE_LOGIN_CLIENT_ID` مضبوطٌ و`..._SECRET` ناقص
  // يعطي شاشةً خضراء وتسجيلَ دخولٍ يفشل عند آخر خطوة - وهي أسوأُ صورةٍ
  // للعطل، لأنّ الشاشةَ التي وُجدت لتكشفه هي التي تخفيه.
  { key: "GOOGLE_LOGIN_CLIENT_ID", group: "Secondary", severity: "OPTIONAL",
    breaks: "Sign in with Google. Email and password login is unaffected." },
  { key: "GOOGLE_LOGIN_CLIENT_SECRET", group: "Secondary", severity: "OPTIONAL",
    breaks: "Sign in with Google fails at the token exchange, after the user has already approved." },
  { key: "META_LOGIN_APP_ID", group: "Secondary", severity: "OPTIONAL",
    breaks: "Sign in with Facebook. Same note as above." },
  { key: "META_LOGIN_APP_SECRET", group: "Secondary", severity: "OPTIONAL",
    breaks: "Sign in with Facebook fails at the token exchange, after approval." },
  { key: "NEXT_PUBLIC_TRACKER_BASE_URL", group: "Secondary", severity: "OPTIONAL",
    breaks: "The WhatsApp tracking link never appears in the customer settings." },

  // ==================== ما كان يقرؤه الكود بلا صفٍّ هنا ====================
  //
  // 🔴 الملفُّ يقول عن نفسه إنّ قائمته **«مغلقة ومشتقّة من الكود»** - ولم
  // تكن. جردٌ بـgrep على `app` و`lib` أعطى نحو خمسين متغيّراً، والقائمة
  // تغطّي أربعةً وثلاثين. والغيابُ هنا ليس نقصَ توثيق: هذه الشاشةُ هي
  // الجوابُ على «هل نحن جاهزون؟»، فما لا تراه تعلنه جاهزاً بالسكوت.
  { key: "NEXT_PUBLIC_APP_URL", group: "Core", severity: "FEATURE",
    breaks: "Client-side links (tracking snippet, share URLs) point at the wrong origin.",
    fallback: "Server code reads APP_URL instead; only browser-built URLs are affected." },
  { key: "DATABASE_URL_UNPOOLED", group: "Core", severity: "FEATURE",
    breaks: "Schema push at build time uses the pooled connection and can fail mid-deploy.",
    fallback: "db-push-safe also accepts DIRECT_URL or POSTGRES_URL_NON_POOLING." },

  { key: "PAYMOB_MOTO_INTEGRATION_ID", group: "Payments", severity: "OPTIONAL",
    breaks: "Renewals cannot charge a saved card — every renewal needs the customer to pay by hand.",
    fallback: "Renewal falls back to the manual path; nothing fails silently." },

  { key: "CLAUDE_COST_PER_MTOK_USD", group: "AI", severity: "OPTIONAL",
    breaks: "Usage dashboards show token volume but state that cost needs configuring — no figure is guessed." },

  { key: "SENTRY_DSN", group: "Monitoring", severity: "OPTIONAL",
    breaks: "Server errors are not reported anywhere — a crash is only found when a customer says so." },
  { key: "NEXT_PUBLIC_SENTRY_DSN", group: "Monitoring", severity: "OPTIONAL",
    breaks: "Browser errors go unreported — the half of failures the server never sees." },
  { key: "SENTRY_ORG", group: "Monitoring", severity: "OPTIONAL",
    breaks: "Source maps are not uploaded, so stack traces stay minified and unreadable.",
    fallback: "Its absence also skips Sentry's build wrapper entirely, which protects the build from OOM." },
  { key: "SENTRY_PROJECT", group: "Monitoring", severity: "OPTIONAL",
    breaks: "Same as SENTRY_ORG — the upload target is incomplete." },

  { key: "SUPPORT_WHATSAPP_NUMBER", group: "Support", severity: "OPTIONAL",
    breaks: "The WhatsApp support button is not rendered at all." },
  { key: "NEXT_PUBLIC_BRAND_LOGO_URL", group: "Brand", severity: "OPTIONAL",
    breaks: "Every email goes out with no logo — the header renders empty." },
  { key: "NEXT_PUBLIC_SOCIAL_FACEBOOK", group: "Brand", severity: "OPTIONAL",
    breaks: "The email footer's social links are omitted." },
  { key: "NEXT_PUBLIC_SOCIAL_INSTAGRAM", group: "Brand", severity: "OPTIONAL",
    breaks: "Same as above." },
  { key: "NEXT_PUBLIC_SOCIAL_LINKEDIN", group: "Brand", severity: "OPTIONAL",
    breaks: "Same as above." },
  { key: "NEXT_PUBLIC_SOCIAL_TIKTOK", group: "Brand", severity: "OPTIONAL",
    breaks: "Same as above." },
  { key: "PUSH_INACTIVITY_THRESHOLD_HOURS", group: "Push", severity: "OPTIONAL",
    breaks: "The inactivity nudge uses its built-in threshold instead of yours." },
] as const;

export interface ReadinessResult {
  item: ReadinessItem;
  configured: boolean;
}

export interface ReadinessReport {
  results: ReadinessResult[];
  missing: ReadinessResult[];
  /** المجموعات اللي فيها نقص، مرتّبة بالخطورة */
  countsBySeverity: Record<ReadinessSeverity, number>;
  /** جاهز للنشر = مافيش BLOCKER ولا REVENUE ناقص */
  readyToLaunch: boolean;
}

const SEVERITY_ORDER: Record<ReadinessSeverity, number> = {
  BLOCKER: 0, REVENUE: 1, FEATURE: 2, OPTIONAL: 3,
};

/**
 * الحالة الحالية. بتقرا `process.env` بس - **مافيش أي نداء خارجي**، فرخيصة
 * بما يكفي إنها تتحسب مع كلّ فتحة للصفحة.
 *
 * ⚠️ حدٌّ صريح: "مضبوط" معناه إنّ المتغيّر ليه قيمة، **مش إنّ القيمة صحيحة**.
 * مفتاح Paymob غلط بيعدّي من هنا ويفشل عند أول دفعة. الفحص ده بيمسك
 * الغياب، والتأكّد من الصحّة محتاج نداءً حقيقياً للمزوّد.
 */
export function checkReadiness(): ReadinessReport {
  const results = READINESS.map((item) => ({
    item,
    // القيمة الفاضية زي الغائبة تماماً - متغيّرٌ مضبوط على "" بيفشل بنفس
    // الشكل، وبيبقى أصعب في التشخيص لأنّه "موجود".
    configured: !!process.env[item.key]?.trim(),
  }));

  const missing = results
    .filter((r) => !r.configured)
    .sort((a, b) => SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity]);

  const countsBySeverity: Record<ReadinessSeverity, number> = {
    BLOCKER: 0, REVENUE: 0, FEATURE: 0, OPTIONAL: 0,
  };
  for (const m of missing) countsBySeverity[m.item.severity]++;

  return {
    results,
    missing,
    countsBySeverity,
    readyToLaunch: countsBySeverity.BLOCKER === 0 && countsBySeverity.REVENUE === 0,
  };
}
