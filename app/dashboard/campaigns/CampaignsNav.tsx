"use client";

// app/dashboard/campaigns/CampaignsNav.tsx
//
// تنقّل أقسام الحملات - **تبويبات لا أربع بطاقات مفتوحة معاً.**
//
// المسار: خمسة وعشرون رابطاً في صفّ واحد بلا تصنيف ← أربع بطاقات لكلّ
// منصّة ← تبويبات. وكلّ خطوة حلّت المشكلة التي قبلها وأبقت واحدة:
// البطاقات صنّفت الروابط لكنّها أبقت **تسعة وعشرين رابطاً معروضاً في وقت
// واحد**. مَن يبحث عن صفحة تيك توك يقرأ أحد عشر رابط جوجل وسبعة لميتا في
// طريقه إليها.
//
// التبويب يعرض ما طُلب وحده - و«كلّ شيء يتبع ما يتبعه» كما طلب المالك:
// روابط المنصّة داخل تبويبها، والمشترك بين المنصّات في تبويبه.
//
// **الحالة في العنوان (`#tab`) لا في `useState` وحده:** مَن يفتح صفحة
// تيك توك ثمّ يعود بزرّ الرجوع يجب أن يجد تبويب تيك توك مفتوحاً، لا أن
// يبدأ من أوّل تبويب في كلّ مرّة.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface NavSection {
  id: string;
  labelKey?: string;
  labelRaw?: string;
  platform?: string;
  color: string;
  links: Array<{ href: string; key: string }>;
}

// المفاتيح لا النصوص: القسم يُترجَم كاملاً مع لغة الواجهة. الأسماء التجارية
// (Google / Meta / TikTok / Spark Ads) تبقى كما هي في اللغتين عمداً.
const SECTIONS: NavSection[] = [
  {
    id: "cross",
    labelKey: "crossPlatform",
    color: "var(--accent)",
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
    id: "google",
    labelRaw: "Google",
    platform: "GOOGLE_ADS",
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
    id: "meta",
    labelRaw: "Meta",
    platform: "META_ADS",
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
    id: "tiktok",
    labelRaw: "TikTok",
    platform: "TIKTOK_ADS",
    color: "#FE2C55",
    links: [
      { href: "/dashboard/campaigns/tiktok-hub", key: "tiktokHub" },
      { href: "/dashboard/campaigns/tiktok-hook-rate", key: "hookRate" },
      { href: "/dashboard/campaigns/tiktok-fatigue", key: "tiktokFatigue" },
      { href: "/dashboard/campaigns/tiktok-spark-ads", key: "sparkAds" },
    ],
  },
];

/** التبويب الذي يقع فيه المسار الحاليّ - فمن يقف داخل صفحة يجدها مفتوحة */
function sectionForPath(pathname: string): string | null {
  return SECTIONS.find((s) => s.links.some((l) => pathname.startsWith(l.href)))?.id ?? null;
}

export function CampaignsNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [active, setActive] = useState<string>(() => sectionForPath(pathname) ?? "cross");

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="mb-8">
      {/* شريط التبويبات: قابل للتمرير أفقياً على الهاتف بدل أن ينكسر سطرين
          غير متساويين - أربعة تبويبات لا تسع عرض ٣٧٥ بكسل. */}
      <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto border-b border-border">
        {SECTIONS.map((s) => {
          const on = s.id === section.id;
          const label = s.labelRaw ?? t(locale, `campNav.${s.labelKey}`);
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              aria-pressed={on}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                on ? "text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
              }`}
              style={on ? { borderBottomColor: s.color } : undefined}
            >
              {s.platform ? (
                <PlatformLogo platform={s.platform} size={14} />
              ) : (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
              )}
              {label}
              <span className="chip bg-surface-raised font-mono text-text-faint">{s.links.length}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2" style={{ ["--pc" as string]: section.color } as React.CSSProperties}>
        {section.links.map((link) => {
          const on = pathname.startsWith(link.href);
          return (
            <a
              key={link.href}
              href={link.href}
              className={`btn btn-sm card-shadow ${
                on
                  ? "btn-primary"
                  : "btn-secondary hover:border-[var(--pc)]"
              }`}
            >
              {t(locale, `campNav.${link.key}`)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
