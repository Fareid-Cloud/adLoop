// lib/performanceAudit.ts
//
// نفس الأداة الرسمية اللي أي مطور محترف بيستخدمها - Google PageSpeed
// Insights API (مبنية على Lighthouse). مجانية فعلياً حتى 25,000 طلب/يوم
// بمفتاح Google Cloud عادي (اتأكدت بالبحث)، مش تقريب أو محاكاة.

export interface PerformanceAuditResult {
  performanceScore: number; // 0-100
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  coreWebVitals: {
    lcp: number | null; // Largest Contentful Paint - بالثانية
    cls: number | null; // Cumulative Layout Shift - بدون وحدة
    fcp: number | null; // First Contentful Paint - بالثانية
    tbt: number | null; // Total Blocking Time - بالميلي ثانية
  };
  topOpportunities: string[]; // أهم 5 توصيات تحسين من Lighthouse نفسه، مش مُولّدة بالذكاء الاصطناعي
}

export async function auditPagePerformance(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<PerformanceAuditResult | null> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  try {
    const params = new URLSearchParams({
      url,
      strategy,
      category: "performance",
    });
    // بنضيف كل الفئات - أداء، SEO، إتاحة، أفضل الممارسات - في استدعاء واحد
    params.append("category", "seo");
    params.append("category", "accessibility");
    params.append("category", "best-practices");
    if (apiKey) params.set("key", apiKey);

    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`
    );

    if (!res.ok) {
      console.error(`فشل فحص الأداء: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const categories = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;

    return {
      performanceScore: Math.round((categories?.performance?.score ?? 0) * 100),
      seoScore: Math.round((categories?.seo?.score ?? 0) * 100),
      accessibilityScore: Math.round((categories?.accessibility?.score ?? 0) * 100),
      bestPracticesScore: Math.round((categories?.["best-practices"]?.score ?? 0) * 100),
      coreWebVitals: {
        lcp: audits?.["largest-contentful-paint"]?.numericValue
          ? Math.round(audits["largest-contentful-paint"].numericValue) / 1000
          : null,
        cls: audits?.["cumulative-layout-shift"]?.numericValue ?? null,
        fcp: audits?.["first-contentful-paint"]?.numericValue
          ? Math.round(audits["first-contentful-paint"].numericValue) / 1000
          : null,
        tbt: audits?.["total-blocking-time"]?.numericValue ?? null,
      },
      // بناخد أهم 5 فرص تحسين حقيقية من Lighthouse نفسه (مرتّبة حسب توفير
      // الوقت المحتمل)، مش نص عام - ده أدق جزء في الفحص كله لأنه من جوجل مباشرة
      topOpportunities: Object.values(audits ?? {})
        .filter((a: any) => a.details?.type === "opportunity" && a.score !== null && a.score < 0.9)
        .sort((a: any, b: any) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
        .slice(0, 5)
        .map((a: any) => a.title),
    };
  } catch (err) {
    console.error("فشل فحص الأداء:", err);
    return null;
  }
}
