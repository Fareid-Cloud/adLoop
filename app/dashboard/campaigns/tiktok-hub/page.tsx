// app/dashboard/campaigns/tiktok-hub/page.tsx
import { PlatformHub } from "../PlatformHub";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

export default async function TikTokHubPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  return (
    <PlatformHub
      platform="TIKTOK_ADS"
      platformLabel={platformLabel(locale, "TIKTOK_ADS")}
      deepDiveLinks={[
        { href: "/dashboard/campaigns/tiktok-hook-rate", label: t(locale, "campNav.hookRate") },
        { href: "/dashboard/campaigns/tiktok-fatigue", label: t(locale, "campNav.tiktokFatigue") },
        { href: "/dashboard/campaigns/tiktok-spark-ads", label: t(locale, "campNav.sparkAds") },
      ]}
    />
  );
}
