// app/admin/components/AdminUI.tsx
//
// العناصر المشتركة بين صفحات اللوحة - **تركيب فوق نظام التصميم القائم،
// مش نظام تاني.** بطاقة المؤشّر والرسم الصغير والجداول كلها موجودة أصلاً
// في `app/components/ui`، والملف ده بيضيف اللي مالوش نظير هناك بس:
// رأس صفحة، شريط رؤى، شارة حالة، وخانة "مش مقيس".

import type { ReactNode, ComponentType } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

export function AdminPageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-critical/12 text-critical">
            <Icon size={18} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline gap-2 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-muted">{children}</h2>
      {hint && <span className="text-[11px] text-text-faint">{hint}</span>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-shadow rounded-2xl border border-border bg-surface p-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * ملاحظة "الرقم ده مش موجود وليه".
 *
 * **العنصر ده مش زخرفة.** خانة فاضية بتتقري صفر، والصفر قرار. أي مقياس
 * مالوش مصدر بيانات (تكلفة الاكتساب، المرتجعات) بيتعرض بالعنصر ده مع
 * السبب، مش بيتشال من الصفحة ولا بيتعرض صفر.
 */
export function NotMeasured({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
        <Info size={13} />
        {label}
        <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-faint">
          not measured
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-text-faint">{reason}</p>
    </div>
  );
}

export type BadgeTone = "ok" | "warn" | "bad" | "muted" | "info";

const BADGE: Record<BadgeTone, string> = {
  ok: "bg-verified/12 text-verified",
  warn: "bg-gap/12 text-gap",
  bad: "bg-critical/12 text-critical",
  muted: "bg-surface-raised text-text-muted",
  info: "bg-accent/12 text-accent",
};

export function Badge({ tone = "muted", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

export interface InsightView {
  id: string;
  tone: "positive" | "warning" | "critical" | "neutral";
  text: string;
  href?: string;
}

const INSIGHT_STYLE = {
  critical: { cls: "border-critical/30 bg-critical/8", icon: AlertTriangle, color: "text-critical" },
  warning: { cls: "border-gap/30 bg-gap/8", icon: TriangleAlert, color: "text-gap" },
  positive: { cls: "border-verified/30 bg-verified/8", icon: CheckCircle2, color: "text-verified" },
  neutral: { cls: "border-border bg-surface", icon: Info, color: "text-text-muted" },
} as const;

/**
 * شريط الرؤى - الفرق العمليّ بين لوحة أرقام ونظام رؤى.
 *
 * فوق البطاقات مش تحتها: الأرقام بتقول "الوضع إيه"، والجُمل دي بتقول
 * "بُصّ على إيه" - والترتيب ده هو نفسه ترتيب القراءة.
 */
export function InsightStrip({ insights }: { insights: InsightView[] }) {
  if (insights.length === 0) {
    return (
      <div className="mb-5 rounded-2xl border border-border bg-surface p-4 text-[13px] text-text-faint">
        Nothing stands out right now — no threshold in the rules engine was crossed.
      </div>
    );
  }
  return (
    <div className="mb-5 grid gap-2 lg:grid-cols-2">
      {insights.map((i) => {
        const s = INSIGHT_STYLE[i.tone];
        const Icon = s.icon;
        const inner = (
          <div className={`flex items-start gap-2.5 rounded-2xl border p-3 ${s.cls}`}>
            <Icon size={15} className={`mt-0.5 shrink-0 ${s.color}`} />
            <span className="text-[13px] leading-relaxed text-text-primary">{i.text}</span>
          </div>
        );
        return i.href ? (
          <Link key={i.id} href={i.href} className="no-underline transition-opacity hover:opacity-80">
            {inner}
          </Link>
        ) : (
          <div key={i.id}>{inner}</div>
        );
      })}
    </div>
  );
}

/** عرض المبالغ: القيم مخزّنة بالسنت في كل مكان، والقسمة في نقطة واحدة */
export function money(cents: number, currency = "USD"): string {
  return `${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
}

export function pct(v: number | null, digits = 0): string {
  return v === null ? "—" : `${v.toFixed(digits)}%`;
}

export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ago(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
