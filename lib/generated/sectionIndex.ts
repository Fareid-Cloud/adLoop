// هذا الملفّ مُولَّد. لا يُحرَّر بيد.
// المصدر: scripts/generateSectionIndex.mjs - يقرأ عناوين h2/h3 من صفحات
// لوحة التحكّم في كلّ بناء، فلا يتخلّف الفهرس عن الكود.

/** عنوان قسمٍ داخل صفحة: مفتاح ترجمته، والصفحة التي يسكنها. */
export type SectionEntry = { key: string; href: string };

export const SECTION_INDEX: SectionEntry[] = [
  { key: "autoPage.addNew", href: "/dashboard/automation" },
  { key: "campPages.shopNoConv", href: "/dashboard/campaigns/shopping" },
  { key: "campPages.shopRejected", href: "/dashboard/campaigns/shopping" },
  { key: "campPages.title", href: "/dashboard/campaigns" },
  { key: "cogs.title", href: "/dashboard/pricing" },
  { key: "common.recommendedActions", href: "/dashboard/ecommerce" },
  { key: "competitors.quickTitle", href: "/dashboard/campaigns/competitor-ads" },
  { key: "focus.breakdownTitle", href: "/dashboard/pricing" },
  { key: "homePanels.afterActivation", href: "/dashboard" },
  { key: "homePanels.connectedPlatforms", href: "/dashboard" },
  { key: "homePanels.recentActivity", href: "/dashboard" },
  { key: "homePanels.support", href: "/dashboard" },
  { key: "mcp.heroTitle", href: "/dashboard/mcp" },
  { key: "plans.buyCredits", href: "/dashboard/billing" },
  { key: "productsPage.allProducts", href: "/dashboard/ecommerce" },
  { key: "productsPage.losingProducts", href: "/dashboard/ecommerce" },
  { key: "productsPage.winner", href: "/dashboard/ecommerce" },
  { key: "reports.builderTitle", href: "/dashboard/reports" },
  { key: "reports.emailTitle", href: "/dashboard/reports" },
  { key: "reports.emptyTitle", href: "/dashboard/reports" },
  { key: "reports.resultTitle", href: "/dashboard/reports" },
  { key: "reports.savedTitle", href: "/dashboard/reports" },
  { key: "reports.saveView", href: "/dashboard/reports" },
  { key: "reports.summaryTitle", href: "/dashboard/reports" },
  { key: "reports.vComparison", href: "/dashboard/reports" },
  { key: "reports.vConfidence", href: "/dashboard/reports" },
  { key: "reports.vInsights", href: "/dashboard/reports" },
  { key: "reports.vOverTime", href: "/dashboard/reports" },
  { key: "reports.vRecentChanges", href: "/dashboard/reports" },
  { key: "reports.vRecommendation", href: "/dashboard/reports" },
  { key: "reports.vScoreboard", href: "/dashboard/reports" },
  { key: "storeReports.limits", href: "/dashboard/ecommerce/reports" },
  { key: "storeReports.metrics", href: "/dashboard/ecommerce/reports" },
  { key: "storeReports.summary", href: "/dashboard/ecommerce/reports" },
  { key: "storeReports.topProducts", href: "/dashboard/ecommerce/reports" },
  { key: "storeReports.topRecs", href: "/dashboard/ecommerce/reports" },
  { key: "storeReports.whereMoney", href: "/dashboard/ecommerce/reports" },
  { key: "tagInstall.title", href: "/dashboard/diagnostics/tracking-coverage" },
];
