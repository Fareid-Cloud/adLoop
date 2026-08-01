// app/components/DemoBar.tsx
//
// شريط مساحة العرض التجريبية.
//
// **لا يُخفى ولا يُطوى.** كل شريط آخر في المنتج قابل للإخفاء؛ هذا لا.
// اللحظة التي ينسى فيها المستخدم أنه في الديمو هي اللحظة التي يُتّخذ فيها
// قرار على رقم غير حقيقي — وهي أسوأ ما يمكن أن يحدث لمنتج اسمه «طبقة
// الحقيقة».

import Link from "next/link";
import { FlaskConical, ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DemoBar({
  locale, daysLeft, hasRealWorkspace,
}: {
  locale: Locale;
  daysLeft: number | null;
  hasRealWorkspace: boolean;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `demo.${k}`, v);
  const expired = daysLeft !== null && daysLeft <= 0;

  return (
    // سطح هادئ بحدّ رفيع وشريط لوني جانبي واحد. الخلفية الصفراء الممتلئة
    // كانت تصرخ في كل صفحة وتسحب العين من الأرقام نفسها - والمقصود
    // تذكير دائم لا إنذار.
    <div className="relative mb-4 flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-3.5">
      <span className="absolute inset-y-0 w-1 bg-gap" style={{ insetInlineStart: 0 }} />
      <span className="ms-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gap/12 text-gap">
        <FlaskConical size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-text-primary">{tr("barTitle")}</span>
          <span className="rounded-full border border-gap/30 px-2 py-0.5 text-[11px] font-medium text-gap">
            {expired ? tr("barExpired") : daysLeft !== null ? tr("barDaysLeft", { n: daysLeft }) : tr("badge")}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">{tr("barBody")}</p>
      </div>

      <Link
        href="/dashboard/integrations"
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-medium text-white no-underline"
      >
        {tr("connectReal")}
        <ArrowLeft size={14} className="rtl:rotate-0 ltr:rotate-180" />
      </Link>

      {hasRealWorkspace && (
        <Link
          href="/dashboard"
          className="shrink-0 rounded-xl border border-border bg-surface px-3.5 py-2 text-[12.5px] text-text-primary no-underline"
        >
          {tr("switchToReal")}
        </Link>
      )}
    </div>
  );
}
