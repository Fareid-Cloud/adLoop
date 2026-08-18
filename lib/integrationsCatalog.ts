// lib/integrationsCatalog.ts
//
// فهرس التكاملات - مصدر حقيقة واحد لما هو مبنيّ فعلاً وما هو قادم.
//
// قاعدة صارمة: `status: "LIVE"` تعني أن الربط يعمل من طرفنا إلى آخره. أي
// تكامل لم يُبنَ بعد يبقى "SOON" ويُعرض باهتاً غير قابل للضغط. الادّعاء
// بتكامل غير موجود ليس مبالغة تسويقية - هو وعد يكتشف المستخدم كذبه في
// أول ضغطة، فيفقد الثقة في بقية الأرقام أيضاً.
//
// بلا استيراد - يُستخدم في الخادم وفي مكوّنات العميل معاً.

export type IntegrationCategory = "AD_PLATFORM" | "ECOMMERCE" | "ANALYTICS" | "SHIPPING" | "MESSAGING";

export type IntegrationStatus = "LIVE" | "SOON";

export interface IntegrationDef {
  key: string;
  /** المنصة في قاعدة البيانات - null للتكاملات التي لا تملك سجلاً بعد */
  platform: string | null;
  /** مفتاح الشعار في PlatformLogo - يغطّي ما لا سجلّ له في القاعدة */
  logoKey: string;
  name: string;
  nameAr: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** ماذا يضيف هذا التكامل فعلاً - لا وصف تسويقي عامّ */
  valueAr: string;
  valueEn: string;
  /** مسار بدء الربط */
  connectPath?: string;
  /** اللون المعتمد للعلامة - يُستخدم في خلفية الأيقونة الهادئة فقط */
  color: string;
}

export const INTEGRATION_CATEGORIES: Array<{
  key: IntegrationCategory;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}> = [
  {
    key: "AD_PLATFORM",
    labelAr: "منصّات الإعلان",
    labelEn: "Ad platforms",
    descriptionAr: "مصدر الإنفاق والأرقام المُعلَنة التي نقيس الحقيقة مقابلها.",
    descriptionEn: "Where the spend and the reported numbers come from — what we measure the truth against.",
  },
  {
    key: "ECOMMERCE",
    labelAr: "المتاجر",
    labelEn: "Stores",
    descriptionAr: "مصدر الطلب المؤكَّد والإيراد الحقيقي - بدونه يبقى «التحقّق» ناقصاً.",
    descriptionEn: "The source of confirmed orders and real revenue — without it, verification stays incomplete.",
  },
  {
    key: "MESSAGING",
    labelAr: "المحادثات",
    labelEn: "Conversations",
    descriptionAr: "الرسالة الحقيقية هي أقوى دليل تحقّق نملكه.",
    descriptionEn: "A real message is the strongest proof of conversion we have.",
  },
  {
    key: "ANALYTICS",
    labelAr: "التحليلات",
    labelEn: "Analytics",
    descriptionAr: "مصادر سلوك إضافية تُثري الرحلة ولا تحلّ محلّ التحقّق.",
    descriptionEn: "Extra behaviour sources that enrich the journey without replacing verification.",
  },
  {
    key: "SHIPPING",
    labelAr: "الشحن",
    labelEn: "Shipping",
    descriptionAr: "التسليم الفعلي مقابل الطلب - يكشف المرتجعات قبل أن تُحتسب أرباحاً.",
    descriptionEn: "Actual delivery against the order — it surfaces returns before they are counted as profit.",
  },
];

export const INTEGRATIONS: IntegrationDef[] = [
  // ==== منصّات الإعلان ====
  {
    key: "google_ads",
    logoKey: "GOOGLE_ADS",
    platform: "GOOGLE_ADS",
    name: "Google Ads",
    nameAr: "جوجل",
    category: "AD_PLATFORM",
    status: "LIVE",
    valueAr: "الحملات والمصطلحات والإعلانات الفردية، ورفع التحويلات المتحقّقة إليها.",
    valueEn: "Campaigns, search terms and individual ads — plus uploading verified conversions back to it.",
    connectPath: "/api/oauth/google-ads/start",
    color: "#1A73E8",
  },
  {
    key: "meta_ads",
    logoKey: "META_ADS",
    platform: "META_ADS",
    name: "Meta Ads",
    nameAr: "ميتا",
    category: "AD_PLATFORM",
    status: "LIVE",
    valueAr: "فيسبوك وإنستجرام بتفصيل الأماكن، ورفع التحويلات عبر Conversions API.",
    valueEn: "Facebook and Instagram with placement detail, plus conversion upload via the Conversions API.",
    connectPath: "/api/oauth/meta/start",
    color: "#0866FF",
  },
  {
    key: "tiktok_ads",
    logoKey: "TIKTOK_ADS",
    platform: "TIKTOK_ADS",
    name: "TikTok Ads",
    nameAr: "تيك توك",
    category: "AD_PLATFORM",
    status: "LIVE",
    valueAr: "الحملات وSpark Ads وكشف الترافيك المشبوه، ورفع الأحداث عبر Events API.",
    valueEn: "Campaigns, Spark Ads and suspicious-traffic detection, plus event upload via the Events API.",
    connectPath: "/api/oauth/tiktok/start",
    color: "#FE2C55",
  },
  {
    key: "snapchat_ads",
    logoKey: "SNAPCHAT_ADS",
    platform: "SNAPCHAT_ADS",
    name: "Snapchat Ads",
    nameAr: "سناب شات",
    category: "AD_PLATFORM",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#FFFC00",
  },
  {
    key: "x_ads",
    logoKey: "X_ADS",
    platform: null,
    name: "X (Twitter) Ads",
    nameAr: "إكس",
    category: "AD_PLATFORM",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#000000",
  },
  {
    key: "linkedin_ads",
    logoKey: "LINKEDIN_ADS",
    platform: null,
    name: "LinkedIn Ads",
    nameAr: "لينكدإن",
    category: "AD_PLATFORM",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#0A66C2",
  },

  // ==== المتاجر ====
  {
    key: "salla",
    logoKey: "SALLA",
    platform: "SALLA",
    name: "Salla",
    nameAr: "سلة",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد والمرتجعات ومزامنة الأسعار - أدقّ مصدر تحقّق لدينا.",
    valueEn: "Orders, revenue, returns and price sync — our most accurate source of verification.",
    connectPath: "/dashboard/integrations",
    color: "#00C48C",
  },
  {
    key: "shopify",
    logoKey: "SHOPIFY",
    platform: "SHOPIFY",
    name: "Shopify",
    nameAr: "شوبيفاي",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد ومزامنة الأسعار.",
    valueEn: "Orders, revenue and price sync.",
    connectPath: "/dashboard/integrations",
    color: "#95BF47",
  },
  {
    key: "zid",
    logoKey: "ZID",
    platform: "ZID",
    name: "Zid",
    nameAr: "زد",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد.",
    valueEn: "Orders and revenue.",
    connectPath: "/dashboard/integrations",
    color: "#5D3EBC",
  },
  {
    key: "woocommerce",
    logoKey: "WOOCOMMERCE",
    platform: "WOOCOMMERCE",
    name: "WooCommerce",
    nameAr: "ووكومرس",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد عبر مفتاح وسرّ API.",
    valueEn: "Orders and revenue via API key and secret.",
    connectPath: "/dashboard/integrations",
    color: "#96588A",
  },
  {
    key: "easy_orders",
    logoKey: "EASY_ORDERS",
    platform: "EASY_ORDERS",
    name: "Easy Orders",
    nameAr: "إيزي أوردرز",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والدفع عند الاستلام - مهمّ للسوق المصري تحديداً.",
    valueEn: "Orders and cash on delivery — particularly important for the Egyptian market.",
    connectPath: "/dashboard/integrations",
    color: "#FF6B35",
  },

  // ==== المحادثات ====
  {
    key: "whatsapp",
    logoKey: "WHATSAPP",
    platform: null,
    name: "WhatsApp Business",
    nameAr: "واتساب",
    category: "MESSAGING",
    status: "LIVE",
    valueAr: "الرسالة الحقيقية التي تحوّل «نقرة» إلى «عميل مؤكَّد».",
    valueEn: "The real message that turns a click into a confirmed customer.",
    connectPath: "/dashboard/integrations",
    color: "#25D366",
  },
  {
    key: "messenger",
    logoKey: "MESSENGER",
    platform: null,
    name: "Messenger",
    nameAr: "ماسنجر",
    category: "MESSAGING",
    status: "LIVE",
    valueAr: "محادثات Click-to-Messenger مع تمييز الضغط بالخطأ عن التواصل الحقيقي.",
    valueEn: "Click-to-Messenger conversations, telling an accidental tap apart from a genuine enquiry.",
    connectPath: "/dashboard/integrations",
    color: "#0084FF",
  },

  // ==== التحليلات ====
  {
    key: "ga4",
    logoKey: "GA4",
    platform: null,
    name: "Google Analytics 4",
    nameAr: "جوجل أناليتكس",
    category: "ANALYTICS",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#E8710A",
  },
  {
    key: "clarity",
    logoKey: "CLARITY",
    platform: null,
    name: "Microsoft Clarity",
    nameAr: "كلاريتي",
    category: "ANALYTICS",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#0078D4",
  },

  // ==== الشحن ====
  {
    key: "bosta",
    logoKey: "BOSTA",
    platform: null,
    name: "Bosta",
    nameAr: "بوسطة",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#E30613",
  },
  {
    key: "aramex",
    logoKey: "ARAMEX",
    platform: null,
    name: "Aramex",
    nameAr: "أرامكس",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#E4002B",
  },
  {
    key: "mylerz",
    logoKey: "MYLERZ",
    platform: null,
    name: "Mylerz",
    nameAr: "مايلرز",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#00A9E0",
  },
  {
    key: "smsa",
    logoKey: "SMSA",
    platform: null,
    name: "SMSA Express",
    nameAr: "سمسا",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    valueEn: "Not built yet.",
    color: "#003D7C",
  },
];

export function integrationByPlatform(platform: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.platform === platform);
}

export function integrationByKey(key: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.key === key);
}
