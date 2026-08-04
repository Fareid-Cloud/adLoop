"use client";

// **شارة العرض التجريبي - بديل الشريط السفلي.**
//
// الشريط كان يحتلّ عرض الشاشة كاملاً أسفل الرأس ويكرّر الرسالة نفسها في
// كل صفحة، فيسرق مساحة من المحتوى الذي دخل المستخدم ليراه أصلاً - وهو
// نقيض الغرض: الديمو موجود ليُظهر المنتج لا ليُظهر لافتة فوقه.
//
// الشارة تقول ما يكفي بلمحة (أنت في عرض تجريبي)، والتفاصيل - ماذا يعني
// ذلك، وكم بقي، وكيف تخرج منه - تظهر عند المرور لمن أرادها.

import { useState } from "react";
import Link from "next/link";
import { FlaskConical, Database, Lock, Sparkles, ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DemoBadge({
  locale = "ar",
  daysLeft,
  hasRealWorkspace,
}: {
  locale?: Locale;
  daysLeft: number | null;
  hasRealWorkspace: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `demo.${k}`, v);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/12 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent transition-colors hover:bg-accent/20"
      >
        <FlaskConical size={11} />
        DEMO
      </button>

      {open && (
        // `end-auto start-0` يثبّتها تحت الشارة في الاتجاهين - لوحة تُقصّ
        // خارج الشاشة في العربية عيبٌ رأيناه في الجرس من قبل.
        <div className="pop-shadow absolute start-0 top-full z-50 mt-2 w-[290px] card pad-md">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <FlaskConical size={16} />
            </span>
            <div>
              <div className="text-[13.5px] font-semibold text-text-primary">{tr("title")}</div>
              {daysLeft !== null && (
                <div className="text-[11.5px] text-text-muted">{tr("daysLeft", { n: daysLeft })}</div>
              )}
            </div>
          </div>

          <ul className="mb-3 mt-3 list-none space-y-2 p-0">
            {[
              { Icon: Database, text: tr("pointData") },
              { Icon: Lock, text: tr("pointNoWrite") },
              { Icon: Sparkles, text: tr("pointFull") },
            ].map(({ Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-text-muted">
                <Icon size={13} className="mt-0.5 shrink-0 text-text-faint" />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/dashboard/billing"
            className="flex items-center justify-between gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-[12.5px] font-medium text-white no-underline transition-opacity hover:opacity-90"
          >
            {tr("upgrade")}
            <ArrowLeft size={14} className="ltr:rotate-180" />
          </Link>

          {hasRealWorkspace && (
            <Link
              href="/dashboard"
              className="mt-2 block card-inset px-3.5 py-2 text-center text-[12px] text-text-muted no-underline"
            >
              {tr("backToReal")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
