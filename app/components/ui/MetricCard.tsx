// app/components/ui/MetricCard.tsx
//
// كل بطاقة رقم قابلة للضغط تودّي لتفاصيل أعمق في قسمها - مش مجرد اختصار
// بصري (ده كان طلب صريح: "كل box يدوس عليه يوديك لبيانات أكتر مش مجرد
// اختصار"). لو مفيش href، البطاقة بتتصرف عادي من غير أي إيحاء بالضغط.

import Link from "next/link";
import type { ReactNode, ComponentType } from "react";
import { ChevronLeft } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  color?: "default" | "verified" | "gap" | "critical" | "accent";
  href?: string;
  trend?: ReactNode; // عنصر صغير اختياري (زي sparkline أو نسبة تغيّر)
  icon?: ComponentType<{ size?: number; className?: string }>; // أيقونة صغيرة في مربع ملوّن - نفس هوية الرقم
  // اتجاه "الشاهد" - جوهر المنتج "نتحقق بدل ما نصدّق". لو محدّدة صراحة
  // (true/false)، بتضيف علامة ثقة بصرية فوق تلوين الرقم الموجود أصلاً -
  // مش بديل عن اللون، إضافة له (وضوح أكتر لمن عنده عمى ألوان مثلاً)
  verified?: boolean;
}

// لكل لون: نص الرقم، خلفية خفيفة (tint) للكارت كله، وخلفية أقوى شوية
// لمربع الأيقونة. الألوان دلالية دائماً (متحقق/تحذير/خطر)، مش زخرفة
// عشوائية - ده الفرق الجوهري عن "قوالب SaaS" الملوّنة بشكل عشوائي.
// التدرّج خفيف عمداً (10%) - ده برنامج بيتستخدم ساعات كل يوم، مش
// screenshot تسويقي؛ ألوان مشبّعة بالكامل هتتعب العين على المدى الطويل.
const COLOR_STYLES: Record<NonNullable<MetricCardProps["color"]>, { text: string; cardTint: string; iconBg: string }> = {
  default: { text: "text-text-primary", cardTint: "", iconBg: "bg-surface-raised text-text-muted" },
  verified: { text: "text-verified", cardTint: "bg-verified/[0.06]", iconBg: "bg-verified/15 text-verified" },
  gap: { text: "text-gap", cardTint: "bg-gap/[0.06]", iconBg: "bg-gap/15 text-gap" },
  critical: { text: "text-critical", cardTint: "bg-critical/[0.06]", iconBg: "bg-critical/15 text-critical" },
  accent: { text: "text-accent", cardTint: "bg-accent/[0.06]", iconBg: "bg-accent/15 text-accent" },
};

export function MetricCard({ label, value, color = "default", href, trend, verified, icon: Icon }: MetricCardProps) {
  const style = COLOR_STYLES[color];

  const content = (
    <div className={`group rounded-2xl border border-border/60 p-5 transition-colors hover:bg-surface-raised ${style.cardTint || "bg-surface"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}>
              <Icon size={14} />
            </span>
          )}
          <span className="text-[13px] text-text-muted">{label}</span>
        </div>
        {href && (
          <ChevronLeft
            size={14}
            className="rotate-180 text-text-faint opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-0"
          />
        )}
      </div>
      <div
        className={`flex items-baseline gap-1.5 font-mono text-[34px] font-medium leading-none tracking-tight ${
          verified === false ? "border-b border-dashed border-text-faint pb-1 opacity-85" : ""
        } ${style.text}`}
      >
        {value}
        {verified === true && (
          <span className="text-[15px] text-verified" title="رقم متحقق منه فعلياً">✓</span>
        )}
      </div>
      {trend && <div className="mt-3">{trend}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
