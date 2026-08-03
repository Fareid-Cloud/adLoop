// app/dashboard/campaigns/google-hub/page.tsx
import { PlatformHub } from "../PlatformHub";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

export default async function GoogleHubPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  return (
    <PlatformHub
      platform="GOOGLE_ADS"
      platformLabel={platformLabel(locale, "GOOGLE_ADS")}
      deepDiveLinks={[
        { href: "/dashboard/campaigns/quality-score", label: t(locale, "campNav.qualityScore") },
        { href: "/dashboard/campaigns/shopping", label: t(locale, "campNav.shopping") },
        { href: "/dashboard/campaigns/pmax", label: t(locale, "campNav.pmax") },
        { href: "/dashboard/campaigns/youtube", label: t(locale, "campNav.youtube") },
        { href: "/dashboard/campaigns/device-geo", label: t(locale, "campNav.deviceGeo") },
        { href: "/dashboard/campaigns/match-types", label: t(locale, "campNav.matchTypes") },
        { href: "/dashboard/campaigns/display-placements", label: t(locale, "campNav.displayPlacements") },
        { href: "/dashboard/campaigns/search-terms", label: t(locale, "campNav.searchTerms") },
        { href: "/dashboard/campaigns/portfolio", label: t(locale, "campNav.portfolio") },
        { href: "/dashboard/campaigns/audience", label: t(locale, "campNav.audience") },
      ]}
    />
  );
}
