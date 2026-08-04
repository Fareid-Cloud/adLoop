// app/dashboard/campaigns/CampaignsNav.tsx
//
// كانت خمسة وعشرين رابطاً في صفّ واحد بلا تصنيف. قُسّمت إلى كروت لكل منصة
// بهويتها اللونية (جوجل/ميتا/تيك توك) - لا شعار حقيقي (محميّ بحقوق ملكية)،
// لكن لون العلامة الرسمي كإشارة بصرية واضحة، وتأثير hover بنفس اللون.

import { t, type Locale } from "@/lib/i18n/dictionary";

// المفاتيح لا النصوص: القسم يُترجَم كاملاً مع لغة الواجهة. الأسماء التجارية
// (Google / Meta / TikTok / Spark Ads) تبقى كما هي في اللغتين عمداً.
const SECTIONS: Array<{ labelKey?: string; labelRaw?: string; color?: string; links: Array<{ href: string; key: string }> }> = [
  {
    labelKey: "crossPlatform",
    links: [
      { href: "/dashboard/campaigns/attribution-engine", key: "attributionEngine" },
      { href: "/dashboard/campaigns/attribution-path", key: "attributionPath" },
      { href: "/dashboard/campaigns/budget-simulator", key: "budgetSimulator" },
      { href: "/dashboard/campaigns/monthly-forecast", key: "monthlyForecast" },
      { href: "/dashboard/campaigns/creatives", key: "creatives" },
      { href: "/dashboard/campaigns/video-performance", key: "videoPerformance" },
      { href: "/dashboard/campaigns/lead-forms", key: "leadForms" },
    ],
  },
  {
    labelRaw: "Google",
    color: "#1A73E8",
    links: [
      { href: "/dashboard/campaigns/google-hub", key: "googleHub" },
      { href: "/dashboard/campaigns/quality-score", key: "qualityScore" },
      { href: "/dashboard/campaigns/shopping", key: "shopping" },
      { href: "/dashboard/campaigns/pmax", key: "pmax" },
      { href: "/dashboard/campaigns/youtube", key: "youtube" },
      { href: "/dashboard/campaigns/device-geo", key: "deviceGeo" },
      { href: "/dashboard/campaigns/match-types", key: "matchTypes" },
      { href: "/dashboard/campaigns/display-placements", key: "displayPlacements" },
      { href: "/dashboard/campaigns/search-terms", key: "searchTerms" },
      { href: "/dashboard/campaigns/portfolio", key: "portfolio" },
      { href: "/dashboard/campaigns/audience", key: "audience" },
    ],
  },
  {
    labelRaw: "Meta",
    color: "#0866FF",
    links: [
      { href: "/dashboard/campaigns/meta-hub", key: "metaHub" },
      { href: "/dashboard/campaigns/placements", key: "placements" },
      { href: "/dashboard/campaigns/competitor-ads", key: "competitorAds" },
      { href: "/dashboard/campaigns/content-formats", key: "contentFormats" },
      { href: "/dashboard/campaigns/catalog-ads", key: "catalogAds" },
      { href: "/dashboard/campaigns/seasonal-trend", key: "seasonalTrend" },
      { href: "/dashboard/campaigns/learning-phase", key: "learningPhase" },
    ],
  },
  {
    labelRaw: "TikTok",
    color: "#FE2C55",
    links: [
      { href: "/dashboard/campaigns/tiktok-hub", key: "tiktokHub" },
      { href: "/dashboard/campaigns/tiktok-hook-rate", key: "hookRate" },
      { href: "/dashboard/campaigns/tiktok-fatigue", key: "tiktokFatigue" },
      { href: "/dashboard/campaigns/tiktok-spark-ads", key: "sparkAds" },
    ],
  },
];

export function CampaignsNav({ locale = "ar" }: { locale?: Locale }) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      {SECTIONS.map((section) => {
        const label = section.labelRaw ?? t(locale, `campNav.${section.labelKey}`);
        return (
          <div
            key={label}
            className="card pad-md"
            style={{ ["--pc" as string]: section.color ?? "#3A4150" } as React.CSSProperties}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="h-4 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: section.color ?? "var(--text-faint)" }}
              />
              <span className="text-sm font-semibold text-text-primary">{label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {section.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="btn btn-secondary btn-sm card-shadow hover:border-[var(--pc)]"
                >
                  {t(locale, `campNav.${link.key}`)}
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
