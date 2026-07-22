// app/dashboard/campaigns/meta-hub/page.tsx
import { PlatformHub } from "../PlatformHub";

export default function MetaHubPage() {
  return (
    <PlatformHub
      platform="META_ADS"
      platformLabel="ميتا"
      deepDiveLinks={[
        { href: "/dashboard/campaigns/placements", label: "فيسبوك/إنستجرام والأماكن" },
        { href: "/dashboard/campaigns/competitor-ads", label: "مكتبة إعلانات المنافسين" },
        { href: "/dashboard/campaigns/content-formats", label: "شكل المحتوى (ريلز/ستوري)" },
        { href: "/dashboard/campaigns/catalog-ads", label: "الإعلانات الديناميكية" },
        { href: "/dashboard/campaigns/seasonal-trend", label: "اتجاه التكلفة الشهري" },
        { href: "/dashboard/campaigns/learning-phase", label: "فترة التعلّم" },
      ]}
    />
  );
}
