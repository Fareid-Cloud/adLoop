// lib/navConfig.ts
//
// مصدر حقيقة واحد لبنية التنقّل - أي قسم ممكن يكون عنده children
// اختيارية (قاعدة عامة، مش مخصوصة لـ"الحملات" بس).

export interface NavChild {
  href: string;
  /** منصة هذا العنصر - العناصر المتداخلة تظهر فقط داخل قسم منصتها */
  platform?: string;
  /** عنصر فرعي داخل منصة (يُزاح ويظهر عند الدخول إلى تلك المنصة فقط) */
  nested?: boolean;
  labelAr: string;
  labelEn: string;
}

export interface NavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  iconName: string;
  children?: NavChild[];
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/dashboard", labelAr: "لمحة", labelEn: "Glance", iconName: "LayoutDashboard" }],
  },
  {
    label: "التحليل",
    items: [
      {
        href: "/dashboard/campaigns",
        labelAr: "الحملات",
        labelEn: "Campaigns",
        iconName: "Megaphone",
        // صفحات كل منصة تظهر مباشرةً في القائمة الجانبية عند الدخول إليها،
        // بدل الاضطرار إلى العودة لصفحة الحملات لاختيار تحليل آخر.
        children: [
          { href: "/dashboard/campaigns", labelAr: "نظرة شاملة", labelEn: "Overview" },

          { href: "/dashboard/campaigns/google-hub", labelAr: "جوجل", labelEn: "Google", platform: "GOOGLE_ADS" },
          { href: "/dashboard/campaigns/search-terms", labelAr: "مصطلحات البحث", labelEn: "Search Terms", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/quality-score", labelAr: "درجة الجودة", labelEn: "Quality Score", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/shopping", labelAr: "التسوّق", labelEn: "Shopping", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/display-placements", labelAr: "أماكن الظهور", labelEn: "Placements", platform: "GOOGLE_ADS", nested: true },
          { href: "/dashboard/campaigns/video-performance", labelAr: "أداء الفيديو", labelEn: "Video", platform: "GOOGLE_ADS", nested: true },

          { href: "/dashboard/campaigns/meta-hub", labelAr: "ميتا", labelEn: "Meta", platform: "META_ADS" },
          { href: "/dashboard/campaigns/placements", labelAr: "فيسبوك وإنستجرام", labelEn: "FB / IG", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/content-formats", labelAr: "شكل المحتوى", labelEn: "Content Formats", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/catalog-ads", labelAr: "الإعلانات الديناميكية", labelEn: "Catalog Ads", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/competitor-ads", labelAr: "إعلانات المنافسين", labelEn: "Competitor Ads", platform: "META_ADS", nested: true },
          { href: "/dashboard/campaigns/learning-phase", labelAr: "فترة التعلّم", labelEn: "Learning Phase", platform: "META_ADS", nested: true },

          { href: "/dashboard/campaigns/tiktok-hub", labelAr: "تيك توك", labelEn: "TikTok", platform: "TIKTOK_ADS" },
          { href: "/dashboard/campaigns/tiktok-hook-rate", labelAr: "معدل الخطّاف", labelEn: "Hook Rate", platform: "TIKTOK_ADS", nested: true },
          { href: "/dashboard/campaigns/tiktok-fatigue", labelAr: "تعب الفيديو", labelEn: "Video Fatigue", platform: "TIKTOK_ADS", nested: true },
          { href: "/dashboard/campaigns/tiktok-spark-ads", labelAr: "Spark Ads", labelEn: "Spark Ads", platform: "TIKTOK_ADS", nested: true },
        ],
      },
      { href: "/dashboard/truth", labelAr: "الحقيقة", labelEn: "Truth", iconName: "ShieldCheck" },
      { href: "/dashboard/pricing", labelAr: "التسعير", labelEn: "Pricing", iconName: "Tag" },
      { href: "/dashboard/ecommerce", labelAr: "التجارة الإلكترونية", labelEn: "Ecommerce", iconName: "ShoppingBag" },
      { href: "/dashboard/site-scan", labelAr: "فحص الموقع", labelEn: "Site Scan", iconName: "ScanSearch" },
      {
        href: "/dashboard/diagnostics", labelAr: "التشخيص", labelEn: "Diagnostics", iconName: "Stethoscope",
        children: [
          { href: "/dashboard/diagnostics", labelAr: "نظرة شاملة", labelEn: "Overview" },
          { href: "/dashboard/diagnostics/tracking-coverage", labelAr: "تغطية التتبع", labelEn: "Tracking Coverage" },
        ],
      },
    ],
  },
  {
    label: "التنفيذ",
    items: [
      { href: "/dashboard/actions", labelAr: "القرارات", labelEn: "Actions", iconName: "ListChecks" },
      { href: "/dashboard/experiments", labelAr: "التجارب", labelEn: "Experiments", iconName: "FlaskConical" },
      { href: "/dashboard/automation", labelAr: "التشغيل الذكي", labelEn: "Autopilot", iconName: "Bot" },
    ],
  },
  {
    label: null,
    items: [
      { href: "/dashboard/reports", labelAr: "التقارير", labelEn: "Reports", iconName: "FileBarChart" },
      { href: "/dashboard/integrations", labelAr: "التكاملات", labelEn: "Integrations", iconName: "Plug" },
      { href: "/dashboard/settings", labelAr: "الإعدادات", labelEn: "Settings", iconName: "SettingsIcon" },
      { href: "/dashboard/billing", labelAr: "الاشتراك", labelEn: "Billing", iconName: "CreditCard" },
    ],
  },
];
