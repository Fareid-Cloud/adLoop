// app/components/ui/MetricCard.tsx
//
// نظام بطاقة المؤشر الموحّد لكل أقسام المنتج - القديم (خلفية ملوّنة للبطاقة
// كاملة، أو إطار علوي ملوّن) أُلغي تماماً.
//
// المبدأ: البطاقة نفسها هادئة دائماً (سطح واحد، إطار رفيع، ظل خفيف)، واللون
// محصور في مربّع الأيقونة وفي مؤشّر التغيّر فقط. السبب عملي لا جمالي: عند
// وضع ست بطاقات متجاورة، تلوين خلفياتها كلها يجعل الصفحة تصرخ بلا أولوية،
// فتضيع الإشارة الحقيقية. حين تهدأ البطاقات، يبرز الرقم نفسه واتجاهه.
//
// البطاقة تدعم أربعة أشكال سفلية تُغطّي كل صفحات المنتج، بالتركيب لا بنسخ
// مكوّن جديد لكل صفحة:
//   • مؤشّر تغيّر (سهم + نسبة + مدة المقارنة)
//   • شريط نسبة + تعليق ("٤٣٪ من الإيراد")
//   • تعليق نصّي بلهجة دلالية
//   • رسم اتجاه صغير (sparkline)

import Link from "next/link";
import type { ReactNode, ComponentType } from "react";
import { ArrowUpRight, ArrowDownRight, ChevronLeft, Info } from "lucide-react";
import { MetricInfo } from "./MetricInfo";
import { t, type Locale } from "@/lib/i18n/dictionary";

export type MetricTone = "default" | "verified" | "gap" | "critical" | "accent" | "neutral";

export interface MetricDelta {
  /** النسبة أو الفرق المعروض - رقم أو نص جاهز مثل "2.7pp" */
  value: string | number;
  /** اتجاه السهم */
  direction: "up" | "down";
  /**
   * هل هذا الاتجاه جيّد. منفصل عن direction عمداً: ارتفاع التكلفة صعود
   * سيّئ، وانخفاض المرتجعات هبوط جيّد. ربط اللون بالاتجاه وحده يلوّن نصف
   * المؤشّرات بالعكس تماماً.
   */
  positive?: boolean;
  /** "مقارنةً بآخر ٣٠ يوماً" */
  caption?: string;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  /** لاحقة صغيرة بجانب الرقم: SAR، %، /100 */
  unit?: string;
  /** سطر صغير تحت الرقم: "منتج"، "هامش" */
  subLabel?: string;
  tone?: MetricTone;
  /** اسم قديم للـ tone - مُبقى لئلّا تنكسر عشرات الاستدعاءات القائمة */
  color?: MetricTone;
  href?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  delta?: MetricDelta;
  /** شريط نسبة سفلي (0-100) مع تعليقه */
  bar?: { pct: number; caption?: string };
  /** تعليق سفلي نصّي */
  caption?: { text: string; tone?: "muted" | "positive" | "warning" | "negative" };
  /** رسم اتجاه صغير أو أي عنصر إضافي */
  trend?: ReactNode;
  /** شرح المؤشّر عند المرور بالمؤشّر */
  hint?: string;
  /**
   * مفتاح شرح المؤشّر في القاموس (قسم explain). يفتح لوحة "ما هو / كيف
   * يُحسب / لماذا يهمّ" - أيقونة صامتة كانت تترك المستخدم يخمّن مصدر رقم
   * يُفترض أن يبني عليه قراراً.
   */
  explainKey?: string;
  locale: Locale;
  /** علامة التحقّق - جوهر المنتج: رقم متحقّق منه مقابل رقم معلَن */
  verified?: boolean;
  /**
   * بطاقة تفاعلية (فلتر مثلاً). تُمرَّر من مكوّن عميل فقط - المكوّنات
   * الخادمة لا تمرّر دوالّ. وجودها هنا يمنع نسخة بصرية ثانية للبطاقة
   * في الصفحات التفاعلية، وهو ما كان يحدث فعلاً في صفحة التشخيص.
   */
  onClick?: () => void;
  /** حالة الاختيار - تُبرز البطاقة بحلقة لونية بدل تغيير شكلها */
  selected?: boolean;
}

const TONE_ICON: Record<MetricTone, string> = {
  default: "bg-accent/10 text-accent",
  neutral: "bg-surface-raised text-text-muted",
  verified: "bg-verified/10 text-verified",
  gap: "bg-gap/10 text-gap",
  critical: "bg-critical/10 text-critical",
  accent: "bg-accent/10 text-accent",
};

const TONE_BAR: Record<MetricTone, string> = {
  default: "bg-accent",
  neutral: "bg-text-faint",
  verified: "bg-verified",
  gap: "bg-gap",
  critical: "bg-critical",
  accent: "bg-accent",
};

const CAPTION_TONE = {
  muted: "text-text-faint",
  positive: "text-verified",
  warning: "text-gap",
  negative: "text-critical",
};

export function MetricCard(props: MetricCardProps) {
  const {
    label, value, unit, subLabel, href, icon: Icon,
    delta, bar, caption, trend, hint, verified, onClick, selected,
    explainKey, locale,
  } = props;
  const tone: MetricTone = props.tone ?? props.color ?? "default";

  const content = (
    <div
      className={`group card-shadow h-full rounded-2xl border bg-surface p-4 text-start transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-border ${
        selected ? `${SELECTED_RING[tone]} ring-1` : "border-border"
      }`}
    >
      {/* الرأس: أيقونة هادئة + اسم المؤشّر */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}>
              <Icon size={17} />
            </span>
          )}
          <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-text-muted">
            {/* 🔴 كان `truncate` يقصّ الاسم في شبكة الأربعة أعمدة، فيقرأ
                المشترك «Cost per Ver…» و«AI calls (peri…» - اسمُ المؤشّر
                مقطوعٌ فوق الرقم الذي يفسّره. والسطران أهون من نصف اسم:
                البطاقة تتّسع قليلاً ولا تُخفي معناها. */}
            <span className="line-clamp-2 leading-tight">{label}</span>
            {explainKey ? (
              <MetricInfo
                explain={{
                  what: t(locale, `explain.${explainKey}_what`),
                  how: t(locale, `explain.${explainKey}_how`),
                  why: t(locale, `explain.${explainKey}_why`),
                }}
                labels={{
                  what: t(locale, "explain.labelWhat"),
                  how: t(locale, "explain.labelHow"),
                  why: t(locale, "explain.labelWhy"),
                  close: t(locale, "explain.close"),
                }}
              />
            ) : hint ? (
              <Info size={11} className="shrink-0 text-text-faint" aria-label={hint} />
            ) : null}
          </span>
        </div>
        {href && (
          <ChevronLeft
            size={14}
            className="mt-1 shrink-0 rotate-180 text-text-faint opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-0"
          />
        )}
      </div>

      {/* الرقم - أرقام جدولية حتى تصطفّ رأسياً بين البطاقات ولا ترقص عند التحديث.
          `28px/bold` لا `26px/semibold`: البطاقة كانت تعرض الاسم والرقم
          بوزنين متقاربين، فتُقرأ ككتلة نصّ واحدة ولا يقفز الرقم إلى العين -
          وهو الشيء الوحيد الذي جاء المستخدم لأجله. الفارق في الوزن هو ما
          يجعل صفّاً من ستّ بطاقات يُمسح بنظرة بدل أن يُقرأ بطاقةً بطاقة. */}
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[28px] font-bold leading-none tracking-tight tabular-nums text-text-primary ${
            verified === false ? "border-b border-dashed border-text-faint pb-0.5 opacity-90" : ""
          }`}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] font-medium text-text-muted">{unit}</span>}
        {verified === true && (
          <span className="text-[13px] text-verified" title={t(locale, "ui.trustVerified")}>
            ✓
          </span>
        )}
      </div>

      {subLabel && <div className="mt-1 text-[12px] text-text-faint">{subLabel}</div>}

      {delta && (
        <div className="mt-2 flex items-center gap-1 text-[12px]">
          <DeltaMark delta={delta} />
          {delta.caption && <span className="text-text-faint">{delta.caption}</span>}
        </div>
      )}

      {caption && (
        <div className={`mt-2 text-[12px] ${CAPTION_TONE[caption.tone ?? "muted"]}`}>{caption.text}</div>
      )}

      {bar && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
            <div
              className={`h-full rounded-full ${TONE_BAR[tone]}`}
              style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
            />
          </div>
          {bar.caption && <div className="mt-1.5 text-[12px] text-text-faint">{bar.caption}</div>}
        </div>
      )}

      {trend && <div className="mt-3">{trend}</div>}
    </div>
  );

  if (onClick) {
    return (
      // 🔴🔴 أخطر باگ تخطيط في المنتج، وهذا سببه بالضبط:
      //
      // كان الغلاف `<button>`، وبداخله أيقونة الشرح `<button>` أخرى. و**HTML
      // يمنع زرّاً داخل زرّ**: محلّل المتصفّح يُغلق الزرّ الخارجيّ تلقائياً
      // عند أوّل زرّ داخليّ. فينتهي `<div class="card">` عند أيقونة الشرح،
      // ويخرج **الرقم والتعليق** من البطاقة إلى جذر الصفحة بعرضها كاملاً.
      //
      // النتيجة التي رآها المالك: بطاقة تحوي الأيقونة والعنوان فقط، والرقم
      // «٠» وسطر «Review these this week» ملقيان على حافة الصفحة تحتها -
      // صفحة التشخيص كلّها تبدو منهارة. ولا يظهر إلّا حين تجتمع الخاصّيتان
      // (`onClick` + `explainKey`)، وهو ما يفسّر ظهوره في صفحة دون أخرى.
      //
      // `div` بدور زرّ لا `button`: يحتفظ بالنقر ولوحة المفاتيح وقارئ الشاشة،
      // ويسمح بعناصر تفاعلية بداخله - وهو النمط القياسيّ لبطاقة قابلة للنقر
      // تحوي أزراراً.
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        aria-pressed={selected}
        className="block h-full w-full cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        {content}
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className="block h-full no-underline">
        {content}
      </Link>
    );
  }
  return content;
}

// حلقة الاختيار بلون المؤشّر نفسه - تمييز الحالة بلا تغيير بنية البطاقة،
// فلا "تقفز" الشبكة عند التبديل بين الفلاتر
const SELECTED_RING: Record<MetricTone, string> = {
  default: "border-accent ring-accent/40",
  neutral: "border-text-muted ring-text-muted/30",
  verified: "border-verified ring-verified/40",
  gap: "border-gap ring-gap/40",
  critical: "border-critical ring-critical/40",
  accent: "border-accent ring-accent/40",
};

function DeltaMark({ delta }: { delta: MetricDelta }) {
  // الافتراضي: صعود = جيّد. يُقلَب صراحةً عبر positive للمؤشّرات المعكوسة
  const good = delta.positive ?? delta.direction === "up";
  const Arrow = delta.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${good ? "text-verified" : "text-critical"}`}>
      <Arrow size={13} />
      {delta.value}
    </span>
  );
}
