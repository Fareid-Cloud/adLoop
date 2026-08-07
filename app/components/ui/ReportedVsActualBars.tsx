// app/components/ui/ReportedVsActualBars.tsx
//
// **المُبلَّغ مقابل المؤكَّد - في شريط واحد لا عمودين.**
//
// النسخة السابقة كانت عمودين منفصلين يطفوان جنب بعضهما. مشكلتها ليست
// جمالية: الفجوة - وهي كامل موضوع المنتج - لم تكن مرسومة إطلاقاً. كان
// على العين أن تقيس فرق ارتفاع عمودين متباعدين ثم تطرح رقمين تحتهما.
//
// الآن الشريط واحد: طوله كلّه = ما تقوله المنصّات، والجزء الممتلئ منه =
// ما ثبت فعلاً، والباقي **هو** الفجوة ومكتوب عليها مقدارها. قراءة واحدة.

import { t, type Locale } from "@/lib/i18n/dictionary";

export function ReportedVsActualBars({
  reported,
  actual,
  locale,
}: {
  reported: number;
  actual: number;
  locale: Locale;
}) {
  const safeReported = Math.max(reported, 0);
  const verifiedPct = safeReported > 0 ? Math.min(100, (actual / safeReported) * 100) : 0;
  const gap = Math.max(0, safeReported - actual);
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

  return (
    <div className="w-full min-w-0 px-1">
      {/* الطرفان: الرقمان اللذان تقارنهما، كلٌّ بلون معناه */}
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-faint">{t(locale, "truthBar.verified")}</div>
          <div className="flex items-baseline gap-1 font-mono text-[22px] font-semibold leading-none text-verified">
            {fmt(actual)}
            <span className="text-[13px]">✓</span>
          </div>
        </div>
        <div className="min-w-0 text-end">
          <div className="text-[11px] text-text-faint">{t(locale, "truthBar.reported")}</div>
          <div className="font-mono text-[22px] font-semibold leading-none text-text-muted">
            {fmt(safeReported)}
          </div>
        </div>
      </div>

      {/* الشريط: الممتلئ مؤكَّد، والفارغ هو الفجوة نفسها */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gap/25">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-verified transition-[width] duration-700 ease-out"
          style={{ width: `${verifiedPct}%` }}
        />
      </div>

      {gap > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-gap">
          <span className="h-2 w-2 shrink-0 rounded-full bg-gap/45" />
          {t(locale, "truthBar.gapLine", { n: fmt(gap) })}
        </div>
      )}
    </div>
  );
}
