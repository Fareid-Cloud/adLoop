// app/dashboard/ecommerce/_components/EcomPrimitives.tsx
//
// اللبنات المشتركة لكل صفحات قسم التجارة الإلكترونية.
//
// السبب في وجودها كملف واحد: القسم عشر صفحات تجيب النمط نفسه (ما المشكلة؟
// ما أثرها المالي؟ ما الإجراء؟). بناء كل صفحة بمكوّناتها الخاصة يعني عشر
// نسخ تتباعد شهراً بعد شهر. هنا تُعرَّف اللغة البصرية مرة واحدة.
//
// فلسفة التصميم: مساحة بيضاء واسعة، بطاقات قليلة مؤثّرة، جداول قوية،
// لا رسوم بيانية زخرفية. كل قسم ينتهي بإجراءات مقترحة - الصفحة التي لا
// تنتهي بقرار لم تؤدِّ غرضها.

import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { ReactNode } from "react";
import { ArrowLeft, Lightbulb, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { TH } from "@/app/components/ui/tableStyles";

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ==================== رأس الصفحة ====================

export function EcomHeader({
  title,
  subtitle,
  storeName,
  action,
}: {
  title: string;
  subtitle: string;
  storeName?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {storeName && <div className="mb-1 text-[13px] text-text-muted">{storeName}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function SectionHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[16.5px] font-semibold tracking-tight text-text-primary">{children}</h2>
      {hint && <p className="mt-0.5 text-[12px] text-text-faint">{hint}</p>}
    </div>
  );
}

// ==================== الإجراءات المقترحة ====================
//
// كل صفحة تنتهي بهذا. النمط ثابت عمداً: المستخدم يتعلّم أن أسفل الصفحة
// هو مكان "ماذا أفعل الآن"، فيصل إليه مباشرة بعد أول زيارتين.

/**
 * التوصية المعروضة أسفل كل صفحة متجر.
 *
 * **الحقول نصوص مترجَمة جاهزة**، تصل من `t(locale, ...)` في الصفحة. كانت
 * تُسمّى `title`/`reason` - لاحقة بقيت من نسخة أقدم كانت تحمل عربية
 * مثبَّتة. الاسم المضلّل خطر عملي: من يضيف توصية جديدة يقرأ `title`
 * فيكتب فيها نصّاً عربياً مباشرةً، ويعود القسم أحادي اللغة من جديد.
 */
export interface RecommendedAction {
  title: string;
  reason: string;
  impact?: string;
  href?: string;
  hrefLabel?: string;
  tone?: "critical" | "warning" | "positive" | "neutral";
}

export function RecommendedActions({
  actions,
  empty,
  locale = "ar",
}: {
  actions: RecommendedAction[];
  empty?: string;
  locale?: Locale;
}) {
  const fallbackEmpty = empty ?? t(locale, "common.noActions");
  return (
    <section className="mt-10 border-t border-border pt-6">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb size={16} className="text-accent" />
        <h2 className="text-[15px] font-semibold text-text-primary">{t(locale, "common.recommendedActions")}</h2>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-[12.5px] text-text-muted">
          {fallbackEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {actions.map((a, i) => (
            <div
              key={i}
              className="card-shadow flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot(a.tone)}`} />
                  <span className="text-[13.5px] font-medium text-text-primary">{a.title}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{a.reason}</p>
                {a.impact && (
                  <p className="mt-1 text-[12px] font-medium text-verified">{a.impact}</p>
                )}
              </div>
              {a.href && (
                <Link
                  href={a.href}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] font-medium text-text-primary no-underline transition-colors hover:bg-surface-3"
                >
                  {a.hrefLabel ?? t(locale, "common.open")}
                  <ArrowLeft size={13} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function toneDot(tone?: RecommendedAction["tone"]): string {
  switch (tone) {
    case "critical": return "bg-critical";
    case "warning": return "bg-gap";
    case "positive": return "bg-verified";
    default: return "bg-text-faint";
  }
}

// ==================== حالة غياب البيانات ====================
//
// لا نعرض صفراً مكان "لا نعرف". هذا المكوّن يقول ما الناقص وكيف يُسدّ.

export function DataGate({
  title,
  reason,
  href = "/dashboard/integrations",
  hrefLabel,
  locale = "ar",
}: {
  title: string;
  reason: string;
  href?: string;
  hrefLabel?: string;
  locale?: Locale;
}) {
  const cta = hrefLabel ?? t(locale, "store.connectStore");
  return (
    <div className="card-shadow rounded-2xl border border-border bg-surface p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-raised">
        <Info size={20} className="text-text-muted" />
      </div>
      <h3 className="text-[15px] font-medium text-text-primary">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-text-muted">{reason}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2 text-[12.5px] font-medium text-accent no-underline transition-colors hover:bg-accent/20"
      >
        {cta}
        <ArrowLeft size={13} />
      </Link>
    </div>
  );
}

// ==================== تنبيه حدود البيانات ====================

export function LimitsNote({
  items,
  locale = "ar",
}: {
  /** مفاتيح لا نصوص - تُترجَم هنا بلغة القارئ */
  items: Array<{ key: string; vars?: Record<string, string | number> }>;
  locale?: Locale;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 rounded-2xl border border-gap/30 bg-gap/[0.06] p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-gap">
        <AlertTriangle size={14} />
        {t(locale, "common.blindSpots")}
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="text-[12px] leading-relaxed text-text-muted">
            • {t(locale, item.key, item.vars)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==================== دلو قرار (بطاقة تصنيف) ====================

export function DecisionBucket({
  labelAr,
  descriptionAr,
  actionAr,
  count,
  valueAr,
  tone,
  children,
}: {
  labelAr: string;
  descriptionAr: string;
  actionAr?: string;
  count: number;
  valueAr?: string;
  tone: "critical" | "warning" | "positive" | "neutral";
  children?: ReactNode;
}) {
  return (
    <section className="card-shadow mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(tone)}`} />
            <h3 className="text-[14px] font-semibold text-text-primary">{labelAr}</h3>
            <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-text-muted">
              {count}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-text-muted">{descriptionAr}</p>
        </div>
        {valueAr && (
          <div className="text-end">
            <div className="text-[18px] font-semibold tabular-nums text-text-primary">{valueAr}</div>
          </div>
        )}
      </div>

      {children}

      {actionAr && (
        <div className="flex items-start gap-2 border-t border-border bg-surface-2/40 px-4 py-3">
          <TrendingUp size={13} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[12px] leading-relaxed text-text-muted">{actionAr}</p>
        </div>
      )}
    </section>
  );
}

// ==================== جدول ====================

export function DataTable({
  headers,
  children,
  minWidth = 720,
}: {
  headers: string[];
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-[12.5px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border text-text-muted">
            {headers.map((h, i) => (
              <th key={i} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b border-border/50 last:border-0">{children}</tr>;
}
