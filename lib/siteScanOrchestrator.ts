// lib/siteScanOrchestrator.ts
//
// بيجمع كل مصادر البيانات التلاتة (تقني، بصري بالذكاء الاصطناعي، أداء
// حقيقي من PageSpeed) في تقرير واحد مترابط، مع إمكانية مقارنته بمنافس.
// ده "المايسترو" اللي بيشغّل كل المحركات المبنية بدري مع بعض، مش محرك
// جديد من الصفر.

import { auditTechnicalSEO, auditDomainTrust, auditVisualAndCopy, synthesizeAuditReport } from "@/lib/landingPageAudit";
import { captureScreenshot } from "@/lib/screenshotService";
import { auditPagePerformance, PerformanceAuditResult } from "@/lib/performanceAudit";
import { safeFetch } from "@/lib/safeFetch";
import { Locale } from "@/lib/i18n/dictionary";

export interface SinglePageScanResult {
  url: string;
  technicalSEO: Awaited<ReturnType<typeof auditTechnicalSEO>>;
  domainTrust: Awaited<ReturnType<typeof auditDomainTrust>>;
  visual: Awaited<ReturnType<typeof auditVisualAndCopy>> | null; // null لو الصورة فشلت
  performance: PerformanceAuditResult | null; // null لو PageSpeed فشل
  overallScore: number;
}

export interface DeepSiteScanResult {
  primary: SinglePageScanResult;
  synthesis: Awaited<ReturnType<typeof synthesizeAuditReport>>;
  competitors: SinglePageScanResult[];
  failedCompetitors: string[]; // روابط منافسين فشل فحصها - بنوضحها بدل ما نتجاهلها بصمت
  competitorComparison: string | null; // فقرة مقارنة نصية لو فيه منافسين
}

// بنجيب نص الصفحة الفعلي مرة واحدة (بدل ما نكرر الجلب في كل دالة تحليل
// لوحدها) - نص خام بسيط، مش تحليل HTML كامل
async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": "AdLoopSiteScan/1.0" } });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

async function scanSinglePage(
  url: string,
  industryVertical: string | null,
  locale: Locale
): Promise<SinglePageScanResult> {
  const [technicalSEO, domainTrust, pageText, screenshot, performance] = await Promise.all([
    auditTechnicalSEO(url),
    auditDomainTrust(url),
    fetchPageText(url),
    captureScreenshot(url),
    auditPagePerformance(url, "mobile"),
  ]);

  // الجزء البصري محتاج الصورة - لو فشلت (خدمة معطّلة، رابط محمي)، بنكمل
  // بباقي التقرير من غيره بدل ما نوقف كل حاجة
  const visual = screenshot
    ? await auditVisualAndCopy(screenshot, pageText, industryVertical, locale)
    : null;

  // حساب الدرجة الإجمالية - بنستبعد أي مصدر مش متاح رياضياً (نفس مبدأ
  // weightedAverage المستخدم في كل مكان تاني في النظام)
  const scores: Array<{ score: number; weight: number }> = [
    { score: technicalSEO.score, weight: 0.15 },
    { score: domainTrust.score, weight: 0.1 },
  ];
  if (visual) {
    const visualAvg =
      (visual.designTrust.score + visual.copywriting.score + visual.cta.score +
        visual.trustSignals.score + visual.valueClarity.score) / 5;
    scores.push({ score: visualAvg, weight: 0.45 });
  }
  if (performance) {
    scores.push({ score: performance.performanceScore, weight: 0.3 });
  }

  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  const overallScore =
    totalWeight > 0
      ? Math.round(scores.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight)
      : 0;

  return { url, technicalSEO, domainTrust, visual, performance, overallScore };
}

export async function runDeepSiteScan(
  url: string,
  competitorUrls: string[],
  industryVertical: string | null,
  locale: Locale = "ar"
): Promise<DeepSiteScanResult> {
  const primary = await scanSinglePage(url, industryVertical, locale);

  // التركيب المترابط محتاج شكل FullAuditReport - لو الصورة فشلت، بنبني
  // نتيجة بصرية فاضية بدل ما نكسر الدالة (نفس أسلوب معالجة الأخطاء
  // المستخدم في باقي landingPageAudit.ts)
  const emptyVisual = {
    designTrust: { score: 0, findings: [] }, copywriting: { score: 0, findings: [] },
    cta: { score: 0, findings: [] }, layout: { score: 0, findings: [] },
    imageQuality: { score: 0, findings: [] }, trustSignals: { score: 0, findings: [] },
    valueClarity: { score: 0, findings: [] }, formFriction: { score: null, findings: [] },
    socialProofDepth: { score: 0, findings: [] }, urgencyCredibility: { score: null, findings: [] },
    differentiation: { score: 0, findings: [] }, navigationClarity: { score: 0, findings: [] },
    contentLocalizationQuality: { score: 0, findings: [] },
    acquisitionSuggestion: { type: "guarantee" as const, suggestion: "" },
  };

  const synthesis = await synthesizeAuditReport(
    {
      url: primary.url,
      overallScore: primary.overallScore,
      technicalSEO: primary.technicalSEO,
      domainTrust: primary.domainTrust,
      visual: primary.visual ?? emptyVisual,
    },
    locale
  );

  // Promise.allSettled مش Promise.all - عشان فشل منافس واحد (رابط غلط،
  // موقع بطيء جداً) منيسقطش بيه الفحص كله، رغم إن موقعك انت اتفحص صح
  // تماماً. فشل جزئي لازم يتعامل معاه جزئياً، مش يهدم كل حاجة.
  const competitorResults = await Promise.allSettled(
    competitorUrls.slice(0, 2).map((u) => scanSinglePage(u, industryVertical, locale))
  );

  const competitors: SinglePageScanResult[] = [];
  const failedCompetitors: string[] = [];

  competitorResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      competitors.push(result.value);
    } else {
      failedCompetitors.push(competitorUrls[i]);
      console.error(`فشل فحص المنافس ${competitorUrls[i]}:`, result.reason);
    }
  });

  let competitorComparison: string | null = null;
  if (competitors.length > 0) {
    competitorComparison = buildComparisonNarrative(primary, competitors, locale);
  }

  return { primary, synthesis, competitors, failedCompetitors, competitorComparison };
}

function buildComparisonNarrative(
  primary: SinglePageScanResult,
  competitors: SinglePageScanResult[],
  locale: Locale
): string {
  const avgCompetitorScore = Math.round(
    competitors.reduce((s, c) => s + c.overallScore, 0) / competitors.length
  );
  const diff = primary.overallScore - avgCompetitorScore;

  if (locale === "ar") {
    return diff >= 0
      ? `صفحتك متفوقة على متوسط منافسيك بفارق ${diff} نقطة (${primary.overallScore} مقابل ${avgCompetitorScore} تقريباً).`
      : `صفحتك متأخرة عن متوسط منافسيك بفارق ${Math.abs(diff)} نقطة (${primary.overallScore} مقابل ${avgCompetitorScore} تقريباً) - فيه مجال حقيقي للتحسين.`;
  }
  return diff >= 0
    ? `Your page outperforms the competitor average by ${diff} points (${primary.overallScore} vs ~${avgCompetitorScore}).`
    : `Your page trails the competitor average by ${Math.abs(diff)} points (${primary.overallScore} vs ~${avgCompetitorScore}) - real room for improvement.`;
}
