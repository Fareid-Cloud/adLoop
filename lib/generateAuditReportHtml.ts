// lib/generateAuditReportHtml.ts
//
// بيبني تقرير HTML كامل ومنسّق، جاهز للطباعة أو التحويل لـ PDF.
//
// قرار تقني مهم: التحويل النهائي لـ PDF بيتم عن طريق نفس خدمة Puppeteer/
// Browserless المحجوزة في الـ backlog (لالتقاط screenshots) - مش مكتبة
// PDF منفصلة زي pdfkit، لأن مكتبات PDF الخام مش بتدعم تشكيل الحروف
// العربية واتجاه RTL بشكل موثوق. متصفح حقيقي (Puppeteer) بيتعامل مع
// العربي صح تلقائياً لأنه بيرندر HTML/CSS عادي، ثم page.pdf() لإخراج
// الملف. هذا الملف بيبني الـ HTML بس - التحويل لـ PDF خطوة منفصلة
// (screenshotService.renderPdf(html)) هتُضاف مع خدمة الـ screenshot نفسها.

import { FullAuditReport } from "./landingPageAudit";
import { AuditSynthesis } from "./landingPageAudit";
import { Locale } from "@/lib/i18n/dictionary";

export function generateAuditReportHtml(
  report: FullAuditReport,
  synthesis: AuditSynthesis,
  workspaceName: string,
  locale: Locale = "ar"
): string {
  const isRTL = locale === "ar";
  const dir = isRTL ? "rtl" : "ltr";
  const dateStr = new Date().toLocaleDateString(isRTL ? "ar-EG" : "en-US");

  const scoreColor = (score: number) =>
    score >= 75 ? "#2FD48A" : score >= 50 ? "#FFB020" : "#FF5C5C";

  const categories: Array<{ label: string; score: number | null }> = [
    { label: isRTL ? "SEO التقني" : "Technical SEO", score: report.technicalSEO.score },
    { label: isRTL ? "ثقة الدومين" : "Domain Trust", score: report.domainTrust.score },
    { label: isRTL ? "ثقة التصميم" : "Design Trust", score: report.visual.designTrust.score },
    { label: isRTL ? "جودة الكتابة" : "Copywriting", score: report.visual.copywriting.score },
    { label: isRTL ? "أزرار الدعوة للفعل" : "CTA", score: report.visual.cta.score },
    { label: isRTL ? "ترتيب العناصر" : "Layout", score: report.visual.layout.score },
    { label: isRTL ? "جودة الصور" : "Image Quality", score: report.visual.imageQuality.score },
    { label: isRTL ? "إشارات الثقة" : "Trust Signals", score: report.visual.trustSignals.score },
    { label: isRTL ? "وضوح القيمة" : "Value Clarity", score: report.visual.valueClarity.score },
    { label: isRTL ? "احتكاك النموذج" : "Form Friction", score: report.visual.formFriction.score },
    { label: isRTL ? "عمق الدليل الاجتماعي" : "Social Proof Depth", score: report.visual.socialProofDepth.score },
    { label: isRTL ? "مصداقية الإلحاح" : "Urgency Credibility", score: report.visual.urgencyCredibility.score },
    { label: isRTL ? "التمايز التنافسي" : "Differentiation", score: report.visual.differentiation.score },
    { label: isRTL ? "وضوح التنقل" : "Navigation Clarity", score: report.visual.navigationClarity.score },
    { label: isRTL ? "جودة اللغة" : "Content Localization", score: report.visual.contentLocalizationQuality.score },
  ];

  const categoryRows = categories
    .filter((c) => c.score !== null)
    .map(
      (c) => `
      <div class="category-row">
        <span class="category-label">${escapeHtml(c.label)}</span>
        <div class="category-bar-track">
          <div class="category-bar-fill" style="width:${c.score}%; background:${scoreColor(c.score!)}"></div>
        </div>
        <span class="category-score" style="color:${scoreColor(c.score!)}">${c.score}</span>
      </div>`
    )
    .join("");

  const compoundingHtml = synthesis.compoundingIssues
    .map(
      (issue) => `
      <div class="issue-card ${issue.severity === "HIGH" ? "issue-high" : "issue-medium"}">
        <div class="issue-categories">${issue.categories.map(escapeHtml).join(isRTL ? " + " : " + ")}</div>
        <p>${escapeHtml(issue.explanation)}</p>
      </div>`
    )
    .join("");

  const rootCausesHtml = synthesis.rootCauses
    .map(
      (rc) => `
      <div class="root-cause-card">
        <h4>${escapeHtml(rc.rootCause)}</h4>
        <p class="manifests">${isRTL ? "يظهر في: " : "Manifests in: "}${rc.manifestsIn.map(escapeHtml).join("، ")}</p>
        <p>${escapeHtml(rc.explanation)}</p>
      </div>`
    )
    .join("");

  const roadmapHtml = synthesis.prioritizedRoadmap
    .sort((a, b) => a.rank - b.rank)
    .map(
      (action) => `
      <div class="roadmap-item">
        <div class="roadmap-rank">${action.rank}</div>
        <div class="roadmap-body">
          <div class="roadmap-action">${escapeHtml(action.action)}</div>
          <div class="roadmap-reasoning">${escapeHtml(action.reasoning)}</div>
          <span class="impact-badge impact-${action.expectedImpact.toLowerCase()}">${
            isRTL
              ? action.expectedImpact === "HIGH" ? "أثر كبير" : action.expectedImpact === "MEDIUM" ? "أثر متوسط" : "أثر محدود"
              : action.expectedImpact
          }</span>
        </div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 24mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif;
    color: #171C27;
    line-height: 1.7;
    font-size: 13px;
  }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 17px; margin-top: 32px; border-bottom: 2px solid #232A38; padding-bottom: 8px; }
  h4 { font-size: 14px; margin: 0 0 4px; }
  .meta { color: #5C6478; font-size: 12px; margin-bottom: 24px; }
  .overall-score {
    display: flex; align-items: center; gap: 16px;
    background: #F7F8FA; border-radius: 12px; padding: 20px; margin: 20px 0;
  }
  .overall-score .number { font-size: 42px; font-weight: 700; color: ${scoreColor(report.overallScore)}; }
  .executive-summary { font-size: 14px; background: #F7F8FA; padding: 16px; border-radius: 10px; }
  .category-row { display: flex; align-items: center; gap: 12px; margin: 10px 0; }
  .category-label { width: 160px; flex-shrink: 0; font-size: 12px; }
  .category-bar-track { flex: 1; height: 8px; background: #E4E7EC; border-radius: 999px; overflow: hidden; }
  .category-bar-fill { height: 100%; border-radius: 999px; }
  .category-score { width: 32px; text-align: end; font-weight: 600; font-size: 12px; }
  .issue-card { border-radius: 10px; padding: 14px; margin: 10px 0; }
  .issue-high { background: #FFF1F0; border: 1px solid #FF5C5C; }
  .issue-medium { background: #FFF8EB; border: 1px solid #FFB020; }
  .issue-categories { font-weight: 600; font-size: 12px; margin-bottom: 6px; }
  .root-cause-card { background: #F7F8FA; border-radius: 10px; padding: 14px; margin: 10px 0; }
  .manifests { color: #5C6478; font-size: 12px; }
  .roadmap-item { display: flex; gap: 12px; margin: 14px 0; align-items: flex-start; }
  .roadmap-rank {
    width: 28px; height: 28px; border-radius: 50%; background: #171C27; color: white;
    display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;
  }
  .roadmap-action { font-weight: 600; margin-bottom: 4px; }
  .roadmap-reasoning { color: #5C6478; font-size: 12px; margin-bottom: 6px; }
  .impact-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; }
  .impact-high { background: #E6FBF2; color: #1B9C67; }
  .impact-medium { background: #FFF8EB; color: #B8790A; }
  .impact-low { background: #F0F1F4; color: #5C6478; }
  .acquisition-box {
    background: #F0F5FF; border: 1px solid #3D8BFF; border-radius: 10px; padding: 16px; margin: 16px 0;
  }
</style>
</head>
<body>
  <h1>${isRTL ? "تقرير تدقيق صفحة الهبوط" : "Landing Page Audit Report"}</h1>
  <div class="meta">
    ${escapeHtml(workspaceName)} — ${escapeHtml(report.url)} — ${dateStr}
  </div>

  <div class="overall-score">
    <div class="number">${report.overallScore}</div>
    <div>
      <strong>${isRTL ? "النتيجة الإجمالية من 100" : "Overall Score out of 100"}</strong>
      <div class="executive-summary" style="margin-top:8px;">${escapeHtml(synthesis.executiveSummary)}</div>
    </div>
  </div>

  <h2>${isRTL ? "النتائج حسب الفئة" : "Scores by Category"}</h2>
  ${categoryRows}

  <h2>${isRTL ? "مشاكل مركّبة" : "Compounding Issues"}</h2>
  ${compoundingHtml || `<p>${isRTL ? "لم يتم رصد مشاكل مركّبة." : "No compounding issues detected."}</p>`}

  <h2>${isRTL ? "الأسباب الجذرية" : "Root Causes"}</h2>
  ${rootCausesHtml || `<p>${isRTL ? "لم يتم رصد أسباب جذرية مشتركة." : "No shared root causes detected."}</p>`}

  <h2>${isRTL ? "خارطة طريق الإصلاح المرتّبة" : "Prioritized Fix Roadmap"}</h2>
  ${roadmapHtml}

  <h2>${isRTL ? "اقتراح استقطاب العميل" : "Customer Acquisition Suggestion"}</h2>
  <div class="acquisition-box">${escapeHtml(report.visual.acquisitionSuggestion.suggestion)}</div>
</body>
</html>`;
}

// حماية بسيطة من HTML injection لأي نص جاي من الـ AI أو من بيانات الصفحة
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
