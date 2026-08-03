// app/components/PerformanceFunnel.tsx
//
// **قمع الأداء: أين يتسرّب العميل بالضبط.**
//
// أربع مراحل تُقرأ يساراً إلى يمين (أو العكس في العربية): ظهور ← نقرة ←
// تحويل مُعلَن ← تحويل متحقَّق. القيمة ليست في الأرقام الأربعة - كلٌّ منها
// موجود في مكان آخر - بل في **نِسب الانتقال بينها**: هي التي تقول أين
// المشكلة. ظهور كثير بنقرات قليلة مشكلة إعلان، ونقرات كثيرة بتحويلات
// قليلة مشكلة صفحة هبوط، وتحويلات مُعلنة كثيرة بمتحقَّق قليل مشكلة تتبّع
// أو جودة ليد - وهي حالة المنتج الأساسية.
//
// المرحلة الأخيرة بلون التحقّق دائماً: هي وحدها الرقم الذي يُدفع مقابله.

import { t, type Locale } from "@/lib/i18n/dictionary";

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  /** نسبة الانتقال من المرحلة السابقة - تُحسب هنا لا في الاستدعاء */
  rateLabel?: string;
}

export function PerformanceFunnel({
  impressions,
  clicks,
  reported,
  verified,
  locale,
}: {
  impressions: number;
  clicks: number;
  reported: number;
  verified: number;
  locale: Locale;
}) {
  const tr = (k: string) => t(locale, `funnel.${k}`);
  const rate = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  const stages: Array<{ label: string; value: number; rate: number | null; rateLabel: string; verified?: boolean }> = [
    { label: tr("impressions"), value: impressions, rate: null, rateLabel: "" },
    { label: tr("clicks"), value: clicks, rate: rate(clicks, impressions), rateLabel: tr("ctr") },
    { label: tr("reported"), value: Math.round(reported), rate: rate(reported, clicks), rateLabel: tr("convRate") },
    { label: tr("verified"), value: verified, rate: rate(verified, reported), rateLabel: tr("verifyRate"), verified: true },
  ];

  const max = Math.max(impressions, 1);
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

  return (
    <section className="card-shadow rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 text-[13px] font-medium text-text-muted">{tr("title")}</div>

      <div className="flex flex-col gap-2.5">
        {stages.map((s, i) => {
          // العرض لوغاريتمي لا خطّي: الظهور أكبر من التحويل بثلاث مراتب،
          // فالمقياس الخطّي يجعل المراحل الثلاث الأخيرة خيوطاً لا تُرى.
          const ratio = s.value > 0 ? Math.log10(s.value + 1) / Math.log10(max + 1) : 0;
          const width = Math.max(6, ratio * 100);
          return (
            <div key={i}>
              {i > 0 && (
                <div className="mb-1 flex items-center gap-1.5 ps-1 text-[11px] text-text-faint">
                  <span className="inline-block h-3 w-px bg-border" />
                  {s.rateLabel} {s.rate!.toFixed(1)}%
                </div>
              )}
              <div className="flex items-center gap-3">
                <div
                  className={`h-9 rounded-lg transition-[width] duration-700 ease-out ${
                    s.verified ? "bg-verified" : "bg-accent/70"
                  }`}
                  style={{ width: `${width}%` }}
                />
                <div className="flex min-w-0 shrink-0 items-baseline gap-2">
                  <span
                    className={`font-mono text-[15px] font-semibold ${
                      s.verified ? "text-verified" : "text-text-primary"
                    }`}
                  >
                    {fmt(s.value)}
                  </span>
                  <span className="truncate text-[11.5px] text-text-muted">{s.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
