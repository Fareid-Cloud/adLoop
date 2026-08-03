// lib/reports/reportDocument.ts
//
// **مستند التقرير - هوية واحدة للتحميل والبريد والرابط.**
//
// كان التصدير ملفّ CSV خاماً: أعمدة بلا عنوان ولا علامة ولا سياق، يفتحه
// العميل فيرى جدولاً لا يشبه المنتج الذي خرج منه ولا يقول من أرسله. وهو
// أكثر ما يخرج من المنتج إلى خارجه - يُرسَل لمدير أو عميل أو شريك، فيكون
// أول انطباع عن AdLoop عند من لم يفتح المنتج أصلاً.
//
// **HTML لا PDF:** يُفتح في أي متصفّح وأي جهاز بلا برنامج، ويُطبع إلى PDF
// بنقرة عبر `@media print` أدناه، ويُدرج في البريد كما هو - فمصدر واحد
// يخدم المسارات الثلاثة بدل ثلاثة قوالب تتباعد مع الوقت.
//
// **كل الأنماط مضمّنة:** لا ملفّ خارجي ولا خطّ من شبكة - المستند يُفتح
// بعد شهر بلا إنترنت وبنفس شكله.

import { t, type Locale } from "@/lib/i18n/dictionary";

export interface ReportDocSection {
  title: string;
  /** رأس الجدول */
  columns: string[];
  rows: Array<Array<string | number>>;
  /** أعمدة رقمية تُحاذى نهايةً وتُكتب بأرقام متساوية العرض */
  numericColumns?: number[];
}

export interface ReportDocKpi {
  label: string;
  value: string;
  unit?: string;
  /** موجب أفضل أم أسوأ - يحدّد اللون فقط، لا الترتيب */
  tone?: "good" | "bad" | "neutral";
  caption?: string;
}

export interface ReportDocument {
  locale: Locale;
  workspaceName: string;
  title: string;
  periodLabel: string;
  generatedAt: Date;
  kpis: ReportDocKpi[];
  /** خلاصة بقواعد ثابتة - صفر AI، نفس منطق الشاشة */
  summary: string[];
  sections: ReportDocSection[];
}

const BRAND = {
  ink: "#171C27",
  muted: "#5C6478",
  faint: "#8B95A3",
  line: "#E7EAEF",
  surface: "#FFFFFF",
  tint: "#F7F8FA",
  accent: "#4C8DFF",
  verified: "#16A34A",
  critical: "#DC2626",
};

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderReportDocument(doc: ReportDocument): string {
  const ar = doc.locale === "ar";
  const dir = ar ? "rtl" : "ltr";
  const tr = (k: string, v?: Record<string, string | number>) => t(doc.locale, `reportDoc.${k}`, v);

  const dateStr = doc.generatedAt.toLocaleDateString(ar ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const toneColor = (tone?: string) =>
    tone === "good" ? BRAND.verified : tone === "bad" ? BRAND.critical : BRAND.ink;

  const kpiCards = doc.kpis
    .map(
      (k) => `
      <div class="kpi">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value" style="color:${toneColor(k.tone)}">${esc(k.value)}${
          k.unit ? `<span class="kpi-unit">${esc(k.unit)}</span>` : ""
        }</div>
        ${k.caption ? `<div class="kpi-caption">${esc(k.caption)}</div>` : ""}
      </div>`
    )
    .join("");

  const summaryList = doc.summary.length
    ? `<section class="card summary">
         <h2>${esc(tr("summaryTitle"))}</h2>
         <ul>${doc.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
       </section>`
    : "";

  const tables = doc.sections
    .map((sec) => {
      const nums = new Set(sec.numericColumns ?? []);
      const head = sec.columns
        .map((c, i) => `<th class="${nums.has(i) ? "num" : ""}">${esc(c)}</th>`)
        .join("");
      const body = sec.rows
        .map(
          (r) =>
            `<tr>${r
              .map((cell, i) => `<td class="${nums.has(i) ? "num" : ""}">${esc(cell)}</td>`)
              .join("")}</tr>`
        )
        .join("");
      return `
        <section class="card">
          <h2>${esc(sec.title)}</h2>
          <div class="table-wrap">
            <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
          </div>
        </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="${ar ? "ar" : "en"}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.title)} — ${esc(doc.workspaceName)}</title>
<style>
  /* خطّ النظام لا خطّ من شبكة: المستند يُفتح بلا إنترنت بنفس شكله */
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:${ar ? '"Segoe UI",Tahoma,' : ""}-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    background:${BRAND.tint};color:${BRAND.ink};line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  .page{max-width:900px;margin:0 auto;padding:32px 20px 56px}

  .head{
    background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:18px;
    padding:26px 28px;margin-bottom:18px;
  }
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}
  .mark{
    width:30px;height:30px;border-radius:9px;background:${BRAND.accent};
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:700;font-size:15px;letter-spacing:-.4px;
  }
  .brand-name{font-size:16px;font-weight:700;letter-spacing:-.3px}
  h1{font-size:25px;font-weight:650;letter-spacing:-.5px;line-height:1.25}
  .meta{margin-top:7px;font-size:13px;color:${BRAND.muted}}
  .meta b{color:${BRAND.ink};font-weight:600}

  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:12px;margin-bottom:18px}
  .kpi{background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:14px;padding:15px 16px}
  .kpi-label{font-size:12px;color:${BRAND.muted};margin-bottom:5px}
  .kpi-value{font-size:23px;font-weight:650;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
  .kpi-unit{font-size:12px;font-weight:500;color:${BRAND.muted};margin-inline-start:4px}
  .kpi-caption{margin-top:4px;font-size:11.5px;color:${BRAND.faint}}

  .card{background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:16px;padding:20px 22px;margin-bottom:16px}
  .card h2{font-size:15px;font-weight:650;letter-spacing:-.2px;margin-bottom:12px}

  .summary ul{list-style:none}
  .summary li{
    position:relative;padding-inline-start:18px;margin-bottom:7px;
    font-size:13.5px;color:${BRAND.ink};
  }
  .summary li::before{
    content:"";position:absolute;inset-inline-start:0;top:8px;
    width:6px;height:6px;border-radius:50%;background:${BRAND.accent};
  }

  .table-wrap{overflow-x:auto;margin:0 -22px;padding:0 22px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{
    text-align:start;font-weight:600;font-size:11.5px;letter-spacing:.03em;
    text-transform:uppercase;color:${BRAND.muted};
    padding:9px 10px;border-bottom:1px solid ${BRAND.line};white-space:nowrap;
  }
  td{padding:11px 10px;border-bottom:1px solid ${BRAND.line}}
  tbody tr:last-child td{border-bottom:0}
  .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}

  .foot{margin-top:22px;text-align:center;font-size:11.5px;color:${BRAND.faint}}

  /* الطباعة إلى PDF: نفس المستند بلا ظلال ولا خلفيات مهدِرة للحبر،
     ولا يُقطع أي جدول بين صفحتين */
  @media print{
    body{background:#fff}
    .page{padding:0;max-width:none}
    .head,.card,.kpi{border-color:#DDE1E7;break-inside:avoid}
    .card{break-inside:avoid}
    .foot{margin-top:14px}
  }
</style>
</head>
<body>
  <div class="page">
    <header class="head">
      <div class="brand">
        <span class="mark">A</span>
        <span class="brand-name">AdLoop</span>
      </div>
      <h1>${esc(doc.title)}</h1>
      <p class="meta">
        <b>${esc(doc.workspaceName)}</b> · ${esc(doc.periodLabel)} · ${esc(tr("generatedOn", { date: dateStr }))}
      </p>
    </header>

    <div class="kpis">${kpiCards}</div>
    ${summaryList}
    ${tables}

    <p class="foot">${esc(tr("footer"))}</p>
  </div>
</body>
</html>`;
}
