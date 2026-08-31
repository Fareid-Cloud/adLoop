// app/dashboard/campaigns/meta-hub/page.tsx
import { PlatformHub } from "../PlatformHub";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

export default async function MetaHubPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  return (
    <PlatformHub
      platform="META_ADS"
      platformLabel={platformLabel(locale, "META_ADS")}
      deepDiveLinks={[
        { href: "/dashboard/campaigns/placements", label: t(locale, "campNav.placements") },
        { href: "/dashboard/campaigns/competitor-ads", label: t(locale, "campNav.competitorAds") },
        { href: "/dashboard/campaigns/content-formats", label: t(locale, "campNav.contentFormats") },
        { href: "/dashboard/campaigns/catalog-ads", label: t(locale, "campNav.catalogAds") },
        { href: "/dashboard/campaigns/seasonal-trend", label: t(locale, "campNav.seasonalTrend") },
        { href: "/dashboard/campaigns/learning-phase", label: t(locale, "campNav.learningPhase") },
      ]}
    />
  );
}
