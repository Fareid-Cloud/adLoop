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
  name: string;
  nameAr: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** ماذا يضيف هذا التكامل فعلاً - لا وصف تسويقي عامّ */
  valueAr: string;
  /** مسار بدء الربط */
  connectPath?: string;
  /** اللون المعتمد للعلامة - يُستخدم في خلفية الأيقونة الهادئة فقط */
  color: string;
}

export const INTEGRATION_CATEGORIES: Array<{
  key: IntegrationCategory;
  labelAr: string;
  descriptionAr: string;
}> = [
  {
    key: "AD_PLATFORM",
    labelAr: "منصّات الإعلان",
    descriptionAr: "مصدر الإنفاق والأرقام المُعلَنة التي نقيس الحقيقة مقابلها.",
  },
  {
    key: "ECOMMERCE",
    labelAr: "المتاجر",
    descriptionAr: "مصدر الطلب المؤكَّد والإيراد الحقيقي - بدونه يبقى «التحقّق» ناقصاً.",
  },
  {
    key: "MESSAGING",
    labelAr: "المحادثات",
    descriptionAr: "الرسالة الحقيقية هي أقوى دليل تحقّق نملكه.",
  },
  {
    key: "ANALYTICS",
    labelAr: "التحليلات",
    descriptionAr: "مصادر سلوك إضافية تُثري الرحلة ولا تحلّ محلّ التحقّق.",
  },
  {
    key: "SHIPPING",
    labelAr: "الشحن",
    descriptionAr: "التسليم الفعلي مقابل الطلب - يكشف المرتجعات قبل أن تُحتسب أرباحاً.",
  },
];

export const INTEGRATIONS: IntegrationDef[] = [
  // ==== منصّات الإعلان ====
  {
    key: "google_ads",
    platform: "GOOGLE_ADS",
    name: "Google Ads",
    nameAr: "جوجل",
    category: "AD_PLATFORM",
    status: "LIVE",
    valueAr: "الحملات والمصطلحات والإعلانات الفردية، ورفع التحويلات المتحقّقة إليها.",
    connectPath: "/api/oauth/google/start",
    color: "#4285F4",
  },
  {
    key: "meta_ads",
    platform: "META_ADS",
    name: "Meta Ads",
    nameAr: "ميتا",
    category: "AD_PLATFORM",
    status: "LIVE",
    valueAr: "فيسبوك وإنستجرام بتفصيل الأماكن، ورفع التحويلات عبر Conversions API.",
    connectPath: "/api/oauth/meta/start",
    color: "#0866FF",
  },
  {
    key: "tiktok_ads",
    platform: "TIKTOK_ADS",
    name: "TikTok Ads",
    nameAr: "تيك توك",
    category: "AD_PLATFORM",
    status: "LIVE",
    valueAr: "الحملات وSpark Ads وكشف الترافيك المشبوه، ورفع الأحداث عبر Events API.",
    connectPath: "/api/oauth/tiktok/start",
    color: "#FE2C55",
  },
  {
    key: "snapchat_ads",
    platform: "SNAPCHAT_ADS",
    name: "Snapchat Ads",
    nameAr: "سناب شات",
    category: "AD_PLATFORM",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#FFFC00",
  },
  {
    key: "x_ads",
    platform: null,
    name: "X (Twitter) Ads",
    nameAr: "إكس",
    category: "AD_PLATFORM",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#000000",
  },
  {
    key: "linkedin_ads",
    platform: null,
    name: "LinkedIn Ads",
    nameAr: "لينكدإن",
    category: "AD_PLATFORM",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#0A66C2",
  },

  // ==== المتاجر ====
  {
    key: "salla",
    platform: "SALLA",
    name: "Salla",
    nameAr: "سلة",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد والمرتجعات ومزامنة الأسعار - أدقّ مصدر تحقّق لدينا.",
    connectPath: "/dashboard/integrations",
    color: "#00C48C",
  },
  {
    key: "shopify",
    platform: "SHOPIFY",
    name: "Shopify",
    nameAr: "شوبيفاي",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد ومزامنة الأسعار.",
    connectPath: "/dashboard/integrations",
    color: "#95BF47",
  },
  {
    key: "zid",
    platform: "ZID",
    name: "Zid",
    nameAr: "زد",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد.",
    connectPath: "/dashboard/integrations",
    color: "#5D3EBC",
  },
  {
    key: "woocommerce",
    platform: "WOOCOMMERCE",
    name: "WooCommerce",
    nameAr: "ووكومرس",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والإيراد عبر مفتاح وسرّ API.",
    connectPath: "/dashboard/integrations",
    color: "#96588A",
  },
  {
    key: "easy_orders",
    platform: "EASY_ORDERS",
    name: "Easy Orders",
    nameAr: "إيزي أوردرز",
    category: "ECOMMERCE",
    status: "LIVE",
    valueAr: "الطلبات والدفع عند الاستلام - مهمّ للسوق المصري تحديداً.",
    connectPath: "/dashboard/integrations",
    color: "#FF6B35",
  },

  // ==== المحادثات ====
  {
    key: "whatsapp",
    platform: null,
    name: "WhatsApp Business",
    nameAr: "واتساب",
    category: "MESSAGING",
    status: "LIVE",
    valueAr: "الرسالة الحقيقية التي تحوّل «نقرة» إلى «عميل مؤكَّد».",
    connectPath: "/dashboard/integrations",
    color: "#25D366",
  },
  {
    key: "messenger",
    platform: null,
    name: "Messenger",
    nameAr: "ماسنجر",
    category: "MESSAGING",
    status: "LIVE",
    valueAr: "محادثات Click-to-Messenger مع تمييز الضغط بالخطأ عن التواصل الحقيقي.",
    connectPath: "/dashboard/integrations",
    color: "#0084FF",
  },

  // ==== التحليلات ====
  {
    key: "ga4",
    platform: null,
    name: "Google Analytics 4",
    nameAr: "جوجل أناليتكس",
    category: "ANALYTICS",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#E8710A",
  },
  {
    key: "clarity",
    platform: null,
    name: "Microsoft Clarity",
    nameAr: "كلاريتي",
    category: "ANALYTICS",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#0078D4",
  },

  // ==== الشحن ====
  {
    key: "bosta",
    platform: null,
    name: "Bosta",
    nameAr: "بوسطة",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#E30613",
  },
  {
    key: "aramex",
    platform: null,
    name: "Aramex",
    nameAr: "أرامكس",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#E4002B",
  },
  {
    key: "mylerz",
    platform: null,
    name: "Mylerz",
    nameAr: "مايلرز",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#00A9E0",
  },
  {
    key: "smsa",
    platform: null,
    name: "SMSA Express",
    nameAr: "سمسا",
    category: "SHIPPING",
    status: "SOON",
    valueAr: "لم يُبنَ الربط بعد.",
    color: "#003D7C",
  },
];

export function integrationByPlatform(platform: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.platform === platform);
}

export function integrationByKey(key: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.key === key);
}
