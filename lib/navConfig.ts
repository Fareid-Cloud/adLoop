// lib/navConfig.ts
//
// مصدر حقيقة واحد لبنية التنقّل - أي قسم ممكن يكون عنده children
// اختيارية (قاعدة عامة، مش مخصوصة لـ"الحملات" بس).

export interface NavChild {
  /** يُستدعى فيه نموذج لغوي - راجع NavItem.usesAi */
  usesAi?: boolean;
  href: string;
  /** منصة هذا العنصر - العناصر المتداخلة تظهر فقط داخل قسم منصتها */
  platform?: string;
  /** عنصر فرعي داخل منصة (يُزاح ويظهر عند الدخول إلى تلك المنصة فقط) */
  nested?: boolean;
  /**
   * لا يظهر إلّا لمساحةٍ فيها أكثر من قناة بيع.
   *
   * صفحةُ مقارنةٍ بقناةٍ واحدة تعرض نفسها فارغةً وتشرح أنّها لا تعمل -
   * رابطٌ دائمٌ إلى لا شيء يعلّم المستخدم تجاهل القائمة.
   */
  needsTwoStores?: boolean;
  labelAr: string;
  labelEn: string;
}

export interface NavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  iconName: string;
  children?: NavChild[];
  /**
   * **يُستدعى فيه نموذج لغوي فعلاً.** ثلاثة أقسام فقط تفعل: الرؤى
   * (`aiInsights.ts`)، وفحص جودة الصور (`imageQualityAudit.ts`)، والفحص
   * العميق للموقع (`landingPageAudit.ts`).
   *
   * التسعير والتقارير والقرارات تعمل بقواعد ثابتة صفر AI - وسمها بـ«AI»
   * ليس تجميلاً تسويقياً بل ادّعاء يكتشفه المستخدم في أول استخدام، فيشكّ
   * في بقية ما نقوله. والعلامة هنا تفيد عكسياً أيضاً: القسم الموسوم يستهلك
   * من رصيده الشهري، وغير الموسوم لا يستهلك.
   */
  usesAi?: boolean;
}

export interface NavGroup {
  /** عنوان المجموعة - ثنائي اللغة مثل بقية العناصر. كان نصاً عربياً
   *  واحداً، فيظهر بالعربية حتى في الواجهة الإنجليزية */
  labelAr: string | null;
  labelEn: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelAr: null,
    labelEn: null,
    items: [{ href: "/dashboard", labelAr: "الرئيسية", labelEn: "Home", iconName: "House" }],
  },
  {
    labelAr: "التحليل",
    labelEn: "Analyze",
    items: [
      {
        href: "/dashboard/campaigns",
        labelAr: "الحملات",
        labelEn: "Campaigns",
        iconName: "Megaphone",
        // مربّع السؤال يعيش هنا، وهو نداء Claude حقيقيّ يُخصم من الرصيد -
        // فالشارة تقول أين يُصرَف الرصيد قبل أن يُصرَف، لا بعده.
        usesAi: true,
        // صفحات كل منصة تظهر مباشرةً في القائمة الجانبية عند الدخول إليها،
        // بدل الاضطرار إلى العودة لصفحة الحملات لاختيار تحليل آخر.
        children: [
          { href: "/dashboard/campaigns", labelAr: "ملخّص الأداء", labelEn: "Overview" },
          // تقارن الفيديو على المنصّات الثلاث، فليست تابعة لجوجل
          { href: "/dashboard/campaigns/video-performance", labelAr: "أداء الفيديو", labelEn: "Video" },

          { href: "/dashboard/campaigns/google-hub", labelAr: "جوجل", labelEn: "Google", platform: "GOOGLE_ADS" },
          { href: "/dashboard/campaigns/search-terms", labelAr: "عبارات البحث", labelEn: "Search Terms", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/quality-score", labelAr: "نقاط الجودة", labelEn: "Quality Score", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/shopping", labelAr: "التسوّق", labelEn: "Shopping", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/display-placements", labelAr: "مواضع الإعلان", labelEn: "Placements", platform: "GOOGLE_ADS", nested: true },

          { href: "/dashboard/campaigns/meta-hub", labelAr: "ميتا", labelEn: "Meta", platform: "META_ADS" },
          { href: "/dashboard/campaigns/placements", labelAr: "فيسبوك وإنستغرام", labelEn: "FB / IG", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/content-formats", labelAr: "أنواع الإعلانات", labelEn: "Ad Formats", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/catalog-ads", labelAr: "إعلانات الكتالوج", labelEn: "Catalog Ads", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/competitor-ads", labelAr: "إعلانات المنافسين", labelEn: "Competitor Ads", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/learning-phase", labelAr: "مرحلة التعلّم", labelEn: "Learning Phase", platform: "META_ADS", nested: true },

          { href: "/dashboard/campaigns/tiktok-hub", labelAr: "تيك توك", labelEn: "TikTok", platform: "TIKTOK_ADS" },
          { href: "/dashboard/campaigns/tiktok-hook-rate", labelAr: "نسبة الجذب", labelEn: "Hook Rate", platform: "TIKTOK_ADS", nested: true },
          { href: "/dashboard/campaigns/tiktok-fatigue", labelAr: "إجهاد الإعلان", labelEn: "Ad Fatigue", platform: "TIKTOK_ADS", nested: true },
          { href: "/dashboard/campaigns/tiktok-spark-ads", labelAr: "Spark Ads", labelEn: "Spark Ads", platform: "TIKTOK_ADS", nested: true },
        ],
      },
      // بلا `usesAi`: مركز الحقيقة يقارن المُعلَن بالمتحقَّق بحسابٍ ثابت لا
      // بنموذج لغويّ. شارةٌ هنا كانت تَعِد بذكاءٍ لا يعمل في الصفحة.
      { href: "/dashboard/truth", labelAr: "مركز الحقيقة", labelEn: "Truth Center", iconName: "ShieldCheck" },
      {
        // الترتيب يتبع طريقة تفكير صاحب المتجر لا نوع البيانات: يبدأ بالوضع
        // العام، ثم أين يذهب المال، ثم ما يبيعه، ثم كيف يسعّره، ثم ما لديه،
        // ثم من يشتري، ثم كيف تصل الطلبات، ثم ما يفعله بعد ذلك.
        href: "/dashboard/ecommerce", labelAr: "متجري الإلكتروني", labelEn: "My Store", iconName: "ShoppingBag", usesAi: true,
        children: [
          { href: "/dashboard/ecommerce", labelAr: "ملخّص المتجر", labelEn: "Overview" },
          { href: "/dashboard/ecommerce/stores", labelAr: "نزال المتاجر", labelEn: "Store Showdown", needsTwoStores: true },
          { href: "/dashboard/ecommerce/profit", labelAr: "الأرباح", labelEn: "Profit" },
          { href: "/dashboard/ecommerce/products", labelAr: "المنتجات", labelEn: "Products" },
          { href: "/dashboard/ecommerce/pricing-intelligence", labelAr: "فرص التسعير", labelEn: "Pricing" },
          { href: "/dashboard/ecommerce/inventory", labelAr: "المخزون", labelEn: "Inventory" },
          { href: "/dashboard/ecommerce/customers", labelAr: "العملاء", labelEn: "Customers" },
          { href: "/dashboard/ecommerce/orders", labelAr: "الطلبات", labelEn: "Orders" },
          { href: "/dashboard/ecommerce/opportunities", labelAr: "فرص النمو", labelEn: "Opportunities" },
          { href: "/dashboard/ecommerce/ai-insights", labelAr: "رؤى وتوصيات", labelEn: "Insights", usesAi: true },
          { href: "/dashboard/ecommerce/reports", labelAr: "التقارير", labelEn: "Reports" },
        ],
      },
      { href: "/dashboard/pricing", labelAr: "التسعير", labelEn: "Pricing", iconName: "Tag" },
      { href: "/dashboard/site-scan", labelAr: "فحص الموقع", labelEn: "Site Scan", iconName: "ScanSearch", usesAi: true },
      {
        href: "/dashboard/diagnostics", labelAr: "صحة الحساب", labelEn: "Account Health", iconName: "Stethoscope",
        children: [
          { href: "/dashboard/diagnostics", labelAr: "ملخّص الأداء", labelEn: "Overview" },
          { href: "/dashboard/diagnostics/tracking-coverage", labelAr: "تغطية التتبّع", labelEn: "Tracking Coverage" },
        ],
      },
    ],
  },
  {
    labelAr: "التنفيذ",
    labelEn: "Act",
    items: [
      { href: "/dashboard/agent", labelAr: "وكيل AdLoop", labelEn: "AdLoop Agent", iconName: "Sparkles", usesAi: true },
      { href: "/dashboard/actions", labelAr: "القرارات", labelEn: "Actions", iconName: "ListChecks" },
      { href: "/dashboard/experiments", labelAr: "الاختبارات", labelEn: "Experiments", iconName: "FlaskConical" },
      { href: "/dashboard/automation", labelAr: "الأتمتة", labelEn: "Automation", iconName: "Bot" },
    ],
  },
  {
    // مجموعة بعنوان بدل مجموعة بلا اسم: أربعة عناصر إدارية معلّقة في
    // آخر القائمة بلا ترويسة تبدو بقايا لا قسماً.
    labelAr: "الإدارة",
    labelEn: "Manage",
    items: [
      { href: "/dashboard/reports", labelAr: "التقارير", labelEn: "Reports", iconName: "FileBarChart" },
      { href: "/dashboard/integrations", labelAr: "ربط المنصات", labelEn: "Integrations", iconName: "Plug" },
      // قسمٌ بذاته لا صفحةٌ داخل ربط المنصّات: تلك شبكةُ مصادرٍ نسحب منها،
      // وهذا قناةٌ يقرأ منها ذكاءُ المشترك - جيرانٌ في الفكرة لا في الشجرة.
      { href: "/dashboard/mcp", labelAr: "MCP", labelEn: "MCP", iconName: "Sparkles" },
      { href: "/dashboard/billing", labelAr: "الاشتراك والباقة", labelEn: "Billing & Plan", iconName: "CreditCard" },
      { href: "/dashboard/settings", labelAr: "الإعدادات", labelEn: "Settings", iconName: "SettingsIcon" },
    ],
  },
];

/** معرّف عنصر التنقّل الذي تستهدفه الجولة التعريفية.
 *
 * 🔴 **مصدرٌ واحد لأنّ النسختين افترقتا فعلاً.** كان الشريط يولّد المعرّف
 * بـ`href.replace(/\//g, "-")` فينتج `tour-nav--dashboard`، والجولةُ تبحث
 * عن `#tour-nav-/dashboard` مكتوباً بيد - فلا تجد شيئاً أبداً. والأسوأ أنّ
 * الشرطة المائلة غيرُ صالحة في محدّد CSS، فـ`querySelector` يرمي
 * `SyntaxError` بدل أن يعود فارغاً: أوّلُ خطوةٍ في الجولة تُسقط الصفحة. */
export function navItemId(href: string): string {
  return `nav-${href.replace(/\//g, "-")}`;
}
