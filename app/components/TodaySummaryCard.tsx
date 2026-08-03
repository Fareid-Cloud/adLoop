// app/components/TodaySummaryCard.tsx
//
// **الطبقة الأولى في التسلسل البصري للصفحة الرئيسية.**
//
// ثلاثة مستويات لا مستوى واحد:
//   ١) هذه البطاقة - حكم اليوم وأكبر إشارة وإجراء واحد. أكبر خطّ في
//      الصفحة، وخلفية ملوّنة بدلالة الحكم، وحدّ بلون الحالة.
//   ٢) بطاقات المؤشّرات وطبقة الحقيقة - وزن متوسّط.
//   ٣) الجداول والرسوم - وزن هادئ للتفصيل بعد أن يعرف المستخدم أين ينظر.
//
// قبل ذلك كانت كل بطاقة بنفس الوزن، فتلفّ العين بلا نقطة بداية.

import Link from "next/link";
import { ArrowLeft, Check, AlertTriangle, TrendingDown } from "lucide-react";
import type { TodaySummary, SummaryTone } from "@/lib/todaySummary";
import { t, type Locale } from "@/lib/i18n/dictionary";

const TONE: Record<SummaryTone, { color: string; Icon: typeof Check }> = {
  good: { color: "var(--verified)", Icon: Check },
  warn: { color: "var(--gap)", Icon: AlertTriangle },
  bad: { color: "var(--critical)", Icon: TrendingDown },
};

export function TodaySummaryCard({
  summary,
  locale,
}: {
  summary: TodaySummary;
  locale: Locale;
}) {
  const tone = TONE[summary.verdict.tone];

  return (
    <section
      className="mb-5 overflow-hidden rounded-2xl border bg-surface card-shadow"
      style={{
        // تلوين خفيف بدلالة الحكم لا زخرفة: البطاقة تُقرأ قبل نصّها.
        borderColor: `color-mix(in srgb, ${tone.color} 38%, transparent)`,
        background: `linear-gradient(to bottom, color-mix(in srgb, ${tone.color} 7%, var(--surface)), var(--surface) 62%)`,
      }}
    >
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:gap-8">
        {/* الحكم - أكبر خطّ في الصفحة كلها */}
        <div className="min-w-0 lg:w-[38%]">
          <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-text-faint">
            {t(locale, "summary.title")}
          </div>
          <h2
            className="text-[26px] font-semibold leading-tight tracking-tight"
            style={{ color: tone.color }}
          >
            {summary.verdict.headline}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{summary.verdict.sub}</p>
        </div>

        {/* الإشارات - سطر واحد لكل واحدة، أيقونتها تحمل الدلالة */}
        <ul className="min-w-0 flex-1 list-none space-y-2 p-0">
          {summary.lines.map((l, i) => {
            const lt = TONE[l.tone];
            return (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-text-primary">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${lt.color} 16%, transparent)`,
                    color: lt.color,
                  }}
                >
                  <lt.Icon size={11} strokeWidth={3} />
                </span>
                <span className="min-w-0">{l.text}</span>
              </li>
            );
          })}
        </ul>

        {/* الإجراء - وجهة واحدة لا قائمة خيارات */}
        {summary.action && (
          <div className="shrink-0 lg:w-[26%]">
            <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-text-faint">
              {t(locale, "summary.actionTitle")}
            </div>
            <Link
              href={summary.action.href}
              className="flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13.5px] font-medium text-white no-underline transition-opacity hover:opacity-90"
              style={{ background: tone.color }}
            >
              <span className="min-w-0 line-clamp-2">{summary.action.text}</span>
              <ArrowLeft size={15} className="shrink-0 ltr:rotate-180" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
