// app/dashboard/campaigns/CampaignsNav.tsx
//
// كانت 25 رابط في صف واحد من غير تصنيف. اتقسّمت لكروت لكل منصة بهويتها
// اللونية (جوجل/ميتا/تيك توك) - مش لوجو حقيقي (محمي بحقوق ملكية)، لكن
// لون العلامة الرسمي كإشارة بصرية واضحة، وتأثير hover بنفس اللون.

const SECTIONS: Array<{ label: string; color?: string; links: Array<{ href: string; label: string }> }> = [
  {
    label: "نظرة شاملة عبر المنصات",
    links: [
      { href: "/dashboard/campaigns/attribution-engine", label: "محرك الإسناد الذكي" },
      { href: "/dashboard/campaigns/attribution-path", label: "مسار العميل" },
      { href: "/dashboard/campaigns/budget-simulator", label: "محاكاة نقل الميزانية" },
      { href: "/dashboard/campaigns/monthly-forecast", label: "التوقّع الشهري" },
      { href: "/dashboard/campaigns/creatives", label: "أداء الإعلانات الفردية" },
      { href: "/dashboard/campaigns/lead-forms", label: "فورم المنصات الداخلي" },
    ],
  },
  {
    label: "Google",
    color: "#4285F4",
    links: [
      { href: "/dashboard/campaigns/google-hub", label: "الرئيسية — مقارنة إعلانات Google" },
      { href: "/dashboard/campaigns/quality-score", label: "جودة الإعلان" },
      { href: "/dashboard/campaigns/video-performance", label: "أداء الفيديو" },
      { href: "/dashboard/campaigns/shopping", label: "منتجات Shopping" },
      { href: "/dashboard/campaigns/pmax", label: "قنوات Performance Max" },
      { href: "/dashboard/campaigns/youtube", label: "أداء YouTube" },
      { href: "/dashboard/campaigns/device-geo", label: "الجهاز والموقع" },
      { href: "/dashboard/campaigns/match-types", label: "أنواع المطابقة" },
      { href: "/dashboard/campaigns/display-placements", label: "أماكن ظهور الشبكة" },
      { href: "/dashboard/campaigns/search-terms", label: "مصطلحات مهدرة" },
      { href: "/dashboard/campaigns/portfolio", label: "توزيع المحفظة" },
      { href: "/dashboard/campaigns/audience", label: "الجمهور" },
    ],
  },
  {
    label: "Meta",
    color: "#0866FF",
    links: [
      { href: "/dashboard/campaigns/meta-hub", label: "الرئيسية — مقارنة إعلانات Meta" },
      { href: "/dashboard/campaigns/placements", label: "Facebook / Instagram والأماكن" },
      { href: "/dashboard/campaigns/competitor-ads", label: "مكتبة إعلانات المنافسين" },
      { href: "/dashboard/campaigns/content-formats", label: "شكل المحتوى (Reels / Story)" },
      { href: "/dashboard/campaigns/catalog-ads", label: "الإعلانات الديناميكية" },
      { href: "/dashboard/campaigns/seasonal-trend", label: "اتجاه التكلفة الشهري" },
      { href: "/dashboard/campaigns/learning-phase", label: "فترة التعلّم" },
    ],
  },
  {
    label: "TikTok",
    color: "#FE2C55",
    links: [
      { href: "/dashboard/campaigns/tiktok-hub", label: "الرئيسية — مقارنة إعلانات TikTok" },
      { href: "/dashboard/campaigns/tiktok-hook-rate", label: "معدل الخطّاف" },
      { href: "/dashboard/campaigns/tiktok-fatigue", label: "تعب الفيديو" },
      { href: "/dashboard/campaigns/tiktok-spark-ads", label: "Spark Ads" },
    ],
  },
];

export function CampaignsNav() {
  return (
    <div className="mb-8 flex flex-col gap-3">
      {SECTIONS.map((section) => (
        <div
          key={section.label}
          className="rounded-2xl card-shadow border border-border bg-surface p-4"
          style={{ ["--pc" as string]: section.color ?? "#3A4150" } as React.CSSProperties}
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className="h-4 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: section.color ?? "var(--text-faint)" }}
            />
            <span className="text-sm font-semibold text-text-primary">{section.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {section.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg card-shadow border border-border bg-surface-raised px-3 py-1.5 text-xs text-text-muted no-underline transition-colors hover:border-[var(--pc)] hover:text-text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
