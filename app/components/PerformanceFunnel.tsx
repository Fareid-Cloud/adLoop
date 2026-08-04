// app/components/PerformanceFunnel.tsx
//
// **قمع الأداء: أين يتسرّب العميل بالضبط.**
//
// أربع مراحل تنزل من الأوسع إلى الأضيق: ظهور ← نقرة ← تحويل مُعلَن ←
// تحويل متحقَّق. القيمة ليست في الأرقام الأربعة — كلٌّ منها موجود في مكان
// آخر — بل في **نِسب الانتقال بينها**: هي التي تقول أين المشكلة. ظهور
// كثير بنقرات قليلة مشكلة إعلان، ونقرات كثيرة بتحويلات قليلة مشكلة صفحة
// هبوط، وتحويلات مُعلنة كثيرة بمتحقَّق قليل مشكلة تتبّع أو جودة ليد — وهي
// حالة المنتج الأساسية.
//
// **لماذا شكل قمع لا أعمدة:** النسخة السابقة كانت أشرطة أفقية بأطوال
// متناقصة — تُقرأ كرسم بيانيّ عاديّ، فتقارن العين الأطوال ولا ترى
// التسرّب. الشكل المضلَّع الهابط يجعل الضيق **هو** الرسالة: المساحة
// المفقودة بين مرحلة وأخرى مرئية بذاتها لا مستنتَجة من فرق طولين.
//
// **لماذا SVG:** شبه المنحرف الحقيقي (حافّة مائلة تصل عرض مرحلة بعرض
// التالية) لا يُبنى بـ`div` إلّا بحيَل تنكسر عند تغيّر الاتّجاه أو المقاس.
// المضلَّع هنا حسابيّ ودقيق في الاتّجاهين معاً.
//
// المرحلة الأخيرة بلون التحقّق دائماً: هي وحدها الرقم الذي يُدفع مقابله.

import { t, type Locale } from "@/lib/i18n/dictionary";

const VIEW_W = 100;
const BAND_H = 46;
/** أضيق عرض مسموح — أقلّ منه يصير الشكل خيطاً لا مرحلة */
const MIN_W = 14;

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
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

  const stages = [
    { label: tr("impressions"), value: impressions, rate: null as number | null, rateLabel: "" },
    { label: tr("clicks"), value: clicks, rate: rate(clicks, impressions), rateLabel: tr("ctr") },
    { label: tr("reported"), value: Math.round(reported), rate: rate(reported, clicks), rateLabel: tr("convRate") },
    {
      label: tr("verified"),
      value: verified,
      rate: rate(verified, reported),
      rateLabel: tr("verifyRate"),
      isVerified: true,
    },
  ];

  const max = Math.max(impressions, 1);

  // العرض لوغاريتمي لا خطّي: الظهور أكبر من التحويل بثلاث مراتب، فالمقياس
  // الخطّي يجعل المراحل الثلاث الأخيرة خيوطاً بعرض بكسل واحد.
  const widthOf = (v: number) => {
    if (v <= 0) return MIN_W;
    const ratio = Math.log10(v + 1) / Math.log10(max + 1);
    return Math.max(MIN_W, ratio * VIEW_W);
  };

  const widths = stages.map((s) => widthOf(s.value));

  return (
    <section className="card pad-md">
      <div className="mb-4 text-[13px] font-medium text-text-muted">{tr("title")}</div>

      <div className="flex flex-col">
        {stages.map((s, i) => {
          const wTop = widths[i];
          // الحافّة السفلى تلتقي بعرض المرحلة التالية فيتّصل الشكل بلا
          // قفزة. آخر مرحلة قاعدة القمع فتبقى مستقيمة.
          const wBottom = i < stages.length - 1 ? widths[i + 1] : wTop;
          const xTop = (VIEW_W - wTop) / 2;
          const xBottom = (VIEW_W - wBottom) / 2;
          const lost = s.rate !== null ? 100 - s.rate : null;

          return (
            <div key={i}>
              {/* نسبة الانتقال — الرقم الذي يحمل التشخيص، لا الرقم المطلق */}
              {i > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-1.5 text-[11px]">
                  <span className="num font-semibold text-text-primary">{s.rate!.toFixed(1)}%</span>
                  <span className="text-text-faint">{s.rateLabel}</span>
                  {lost !== null && lost > 0 && (
                    <span className="text-gap">
                      · {tr("lost")} {lost.toFixed(1)}%
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <svg
                  viewBox={`0 0 ${VIEW_W} ${BAND_H}`}
                  preserveAspectRatio="none"
                  className="h-[42px] min-w-0 flex-1"
                  role="presentation"
                >
                  <polygon
                    points={`${xTop},0 ${xTop + wTop},0 ${xBottom + wBottom},${BAND_H} ${xBottom},${BAND_H}`}
                    className={s.isVerified ? "fill-verified" : "fill-accent"}
                    // تدرّج نزولاً: الأعلى أوسع وأكثر عدداً وأقلّ يقيناً،
                    // والأسفل أضيق وأثبت. التدرّج يقول ذلك بلا شرح مكتوب.
                    opacity={s.isVerified ? 1 : 0.4 + i * 0.16}
                  />
                </svg>

                <div className="flex w-[46%] shrink-0 flex-col justify-center sm:w-[38%]">
                  <span
                    className={`num text-[16px] font-semibold leading-tight ${
                      s.isVerified ? "text-verified" : "text-text-primary"
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

      {/* الخلاصة: من كلّ من رآك، كم وصل متحقَّقاً */}
      <div className="mt-4 border-t border-border pt-3 text-[11.5px] leading-relaxed text-text-faint">
        {tr("summary")}{" "}
        <span className="num font-semibold text-verified">
          {impressions > 0 ? ((verified / impressions) * 100).toFixed(3) : "0"}%
        </span>
      </div>
    </section>
  );
}
