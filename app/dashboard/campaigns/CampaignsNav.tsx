// app/dashboard/campaigns/CampaignsNav.tsx
//
// كانت 25 رابط في صف واحد من غير أي تصنيف - غير قابلة للاستخدام فعلياً.
// اتقسّمت هنا لـ4 مجموعات منطقية بنفس الطريقة اللي ميديا باير بيفكر
// بيها: "نظرة شاملة" الأول (عبر كل المنصات)، وبعدين كل منصة في قسمها.

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
    label: "جوجل",
    color: "#4285F4",
    links: [
      { href: "/dashboard/campaigns/google-hub", label: "🏠 الرئيسية - مقارنة إعلانات جوجل" },
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
    ],
  },
  {
    label: "ميتا",
    color: "#0866FF",
    links: [
      { href: "/dashboard/campaigns/meta-hub", label: "🏠 الرئيسية - مقارنة إعلانات ميتا" },
      { href: "/dashboard/campaigns/placements", label: "فيسبوك/إنستجرام والأماكن" },
      { href: "/dashboard/campaigns/competitor-ads", label: "مكتبة إعلانات المنافسين" },
      { href: "/dashboard/campaigns/content-formats", label: "شكل المحتوى (ريلز/ستوري)" },
      { href: "/dashboard/campaigns/catalog-ads", label: "الإعلانات الديناميكية" },
      { href: "/dashboard/campaigns/seasonal-trend", label: "اتجاه التكلفة الشهري" },
      { href: "/dashboard/campaigns/learning-phase", label: "فترة التعلّم" },
    ],
  },
  {
    label: "تيك توك",
    color: "#FE2C55",
    links: [
      { href: "/dashboard/campaigns/tiktok-hub", label: "🏠 الرئيسية - مقارنة إعلانات تيك توك" },
      { href: "/dashboard/campaigns/tiktok-hook-rate", label: "معدل الخطّاف" },
      { href: "/dashboard/campaigns/tiktok-fatigue", label: "تعب الفيديو" },
      { href: "/dashboard/campaigns/tiktok-spark-ads", label: "Spark Ads" },
    ],
  },
];

export function CampaignsNav() {
  return (
    <div className="mb-8 flex flex-col gap-4">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-faint">
            {section.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: section.color }} />}
            {section.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {section.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full bg-surface px-3.5 py-1.5 text-xs text-text-muted no-underline hover:bg-surface-raised hover:text-text-primary"
              >
                {link.label} ←
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
