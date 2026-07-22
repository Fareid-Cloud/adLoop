// lib/navConfig.ts
//
// مصدر حقيقة واحد لبنية التنقّل - أي قسم ممكن يكون عنده children
// اختيارية (قاعدة عامة، مش مخصوصة لـ"الحملات" بس).

export interface NavChild {
  href: string;
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
        children: [
          { href: "/dashboard/campaigns", labelAr: "نظرة شاملة", labelEn: "Overview" },
          { href: "/dashboard/campaigns/google-hub", labelAr: "جوجل", labelEn: "Google" },
          { href: "/dashboard/campaigns/video-performance", labelAr: "أداء الفيديو", labelEn: "Video Performance" },
          { href: "/dashboard/campaigns/meta-hub", labelAr: "ميتا", labelEn: "Meta" },
          { href: "/dashboard/campaigns/tiktok-hub", labelAr: "تيك توك", labelEn: "TikTok" },
        ],
      },
      { href: "/dashboard/pricing", labelAr: "التسعير", labelEn: "Pricing", iconName: "Tag" },
      { href: "/dashboard/site-scan", labelAr: "فحص الموقع", labelEn: "Site Scan", iconName: "ScanSearch" },
      { href: "/dashboard/diagnostics", labelAr: "التشخيص", labelEn: "Diagnostics", iconName: "Stethoscope" },
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
      { href: "/dashboard/settings", labelAr: "الإعدادات", labelEn: "Settings", iconName: "SettingsIcon" },
      { href: "/dashboard/billing", labelAr: "الاشتراك", labelEn: "Billing", iconName: "CreditCard" },
    ],
  },
];
