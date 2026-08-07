// app/components/ui/PageHeader.tsx
//
// رأس الصفحة - الهوية البصرية المشتركة لكلّ صفحة داخل اللوحة.
//
// **ما كان:** ثلاثون صفحة تفتح باسم مساحة العمل، ثمّ `<h1>` عارٍ، ثمّ سطر
// رمادي صغير - ثمّ جدول. لا أيقونة ولا لون ولا أيّ شيء يفرّق صفحة عن أخرى.
// المستخدم ينتقل بين خمس صفحات فتبدو له الخمس صفحةً واحدةً تغيّر محتواها،
// ولا يعرف أين هو إلا بقراءة العنوان في كلّ مرّة.
//
// **الأيقونة ليست زينة:** مربّع ملوّن ثابت لكلّ صفحة هو ما يجعلها تُميَّز
// من طرف العين قبل قراءة كلمة - وهذا بالضبط ما يفعله شريط التنقّل الجانبي
// بالفعل، فالصفحة تكرّر أيقونتها لا تخترع واحدة.
//
// **اللون دلاليّ لا عشوائيّ:** يتبع `tone` - محايد للاستكشاف، تحذيريّ لصفحة
// تعرض مشكلة، متحقَّق لصفحة تعرض ما تأكّد. هذا هو الفرق عن قوالب SaaS التي
// تلوّن لتُبهج.

import type { LucideIcon } from "lucide-react";

export type HeaderTone = "neutral" | "accent" | "verified" | "gap" | "critical";

const TONE: Record<HeaderTone, string> = {
  neutral: "bg-text-muted/10 text-text-muted",
  accent: "bg-accent/12 text-accent",
  verified: "bg-verified/12 text-verified",
  gap: "bg-gap/12 text-gap",
  critical: "bg-critical/12 text-critical",
};

export function PageHeader({
  icon: Icon,
  tone = "accent",
  eyebrow,
  title,
  description,
  actions,
}: {
  icon?: LucideIcon;
  tone?: HeaderTone;
  /** اسم مساحة العمل عادةً - يجيب «أرقام مَن هذه؟» قبل أن تُقرأ الأرقام */
  eyebrow?: string;
  title: string;
  description?: string;
  /** أزرار الصفحة - تصطفّ مع العنوان لا تحته، فلا تُدفع خارج الشاشة الأولى */
  actions?: React.ReactNode;
}) {
  return (
    // `flex-wrap` لا شبكة ثابتة: على الهاتف تنزل الأزرار سطراً كاملاً بدل
    // أن تضغط العنوان حتى ينكسر.
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}
            aria-hidden
          >
            <Icon size={19} />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="mb-0.5 truncate text-[12.5px] text-text-muted">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-muted">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
