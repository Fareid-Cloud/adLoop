// app/dashboard/campaigns/tiktok-hub/page.tsx
import { PlatformHub } from "../PlatformHub";

export default function TikTokHubPage() {
  return (
    <PlatformHub
      platform="TIKTOK_ADS"
      platformLabel="تيك توك"
      deepDiveLinks={[
        { href: "/dashboard/campaigns/tiktok-hook-rate", label: "معدل الخطّاف" },
        { href: "/dashboard/campaigns/tiktok-fatigue", label: "تعب الفيديو" },
        { href: "/dashboard/campaigns/tiktok-spark-ads", label: "Spark Ads" },
      ]}
    />
  );
}
