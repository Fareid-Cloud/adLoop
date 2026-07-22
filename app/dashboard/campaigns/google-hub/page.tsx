// app/dashboard/campaigns/google-hub/page.tsx
import { PlatformHub } from "../PlatformHub";

export default function GoogleHubPage() {
  return (
    <PlatformHub
      platform="GOOGLE_ADS"
      platformLabel="جوجل"
      deepDiveLinks={[
        { href: "/dashboard/campaigns/quality-score", label: "جودة الإعلان" },
        { href: "/dashboard/campaigns/video-performance", label: "أداء الفيديو" },
        { href: "/dashboard/campaigns/shopping", label: "منتجات Shopping" },
        { href: "/dashboard/campaigns/pmax", label: "قنوات Performance Max" },
        { href: "/dashboard/campaigns/youtube", label: "أداء يوتيوب" },
        { href: "/dashboard/campaigns/device-geo", label: "الجهاز والموقع" },
        { href: "/dashboard/campaigns/match-types", label: "أنواع المطابقة" },
        { href: "/dashboard/campaigns/display-placements", label: "أماكن ظهور الشبكة" },
        { href: "/dashboard/campaigns/search-terms", label: "مصطلحات مهدرة" },
        { href: "/dashboard/campaigns/portfolio", label: "توزيع المحفظة" },
        { href: "/dashboard/campaigns/audience", label: "الجمهور" },
      ]}
    />
  );
}
