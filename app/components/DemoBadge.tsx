"use client";

// **شارة العرض التجريبي - بديل الشريط السفلي.**
//
// الشريط كان يحتلّ عرض الشاشة كاملاً أسفل الرأس ويكرّر الرسالة نفسها في
// كل صفحة، فيسرق مساحة من المحتوى الذي دخل المستخدم ليراه أصلاً - وهو
// نقيض الغرض: الديمو موجود ليُظهر المنتج لا ليُظهر لافتة فوقه.
//
// الشارة تقول ما يكفي بلمحة (أنت في عرض تجريبي)، والتفاصيل - ماذا يعني
// ذلك، وكم بقي، وكيف تخرج منه - تظهر عند المرور لمن أرادها.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FlaskConical, Database, Lock, Sparkles, ArrowLeft } from "lucide-react";
import { Portal } from "@/app/components/ui/Portal";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DemoBadge({
  locale,
  daysLeft,
  hasRealWorkspace,
}: {
  locale: Locale;
  daysLeft: number | null;
  hasRealWorkspace: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `demo.${k}`, v);

  // 🔴 **اللوحة كانت تختفي قبل أن تُبلَغ.**
  //
  // هي مرسَلة إلى `<body>` بالبوّابة (للسبب المشروح أسفل)، فليست ابنةً
  // للشارة في الشجرة. ومغادرةُ المؤشّر الشارةَ - ولو في طريقه إليها -
  // كانت تُغلقها فوراً، فلا يمكن بلوغ أيّ زرّ داخلها إطلاقاً.
  //
  // مهلةُ إغلاق تعبر الفراغ بين الشارة واللوحة، واللوحةُ نفسها تُلغيها
  // متى دخلها المؤشّر. ولا تعمل واحدةٌ منهما بلا الأخرى: المهلة وحدها
  // تُغلق بعد لحظة ولو كان المؤشّر داخلها، وإلغاؤها وحده لا يعبر الفراغ.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  };
  useEffect(() => cancelClose, []);

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/12 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent transition-colors hover:bg-accent/20"
      >
        <FlaskConical size={11} />
        {/* النصّ يُخفى على الهاتف لا الشارة: الرأس هناك يحمل ستّة عناصر
            في ٦٨ بكسل، فكان اسم مساحة العمل يُقصّ ليتّسع لكلمة «DEMO».
            الأيقونة وحدها تكفي كإشارة، واللوحة عند اللمس تشرح الباقي -
            وإخفاء الشارة كاملةً كان سيُسقط التمييز بين بيانات حقيقية
            وأمثلة على الشاشة التي يقضي فيها المستخدم أكثر وقته. */}
        <span className="hidden sm:inline">DEMO</span>
      </button>

      {open && (
        // 🔴 `fixed` في كلّ المقاسات، ولا `absolute` بعد `sm`.
        //
        // الشارة تعيش الآن داخل صفّ شعار الشريط الجانبيّ، و`<aside>` عليه
        // `overflow-hidden` (يلزمه: بدونه يفيض محتوى القائمة خارج حدّه).
        // فاللوحة الموضوعة `absolute` نسبةً إلى الشارة تُقصّ عند حدّ الشريط
        // ولا يظهر منها إلّا ما يسع عرضه. والعنصر المثبَّت بالشاشة لا يقصّه
        // `overflow` أيّ سلفٍ له - وهي القاعدة نفسها التي حلّت قصَّ لوحتَي
        // الإشعارات والحساب من قبل.
        //
        // الموضع: تحت صفّ الشعار مباشرةً (٦٨ بكسل + فراغ)، وعند حافّة
        // البداية - وهي حافّة الشريط نفسه في الاتّجاهين معاً.
        <Portal>
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="pop-shadow fixed top-[76px] z-[70] w-[min(290px,calc(100vw-1.5rem))] card pad-md"
          style={{ insetInlineStart: 12 }}
        >
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
            className="btn btn-primary justify-between"
          >
            {tr("upgrade")}
            <ArrowLeft size={14} className="ltr:rotate-180" />
          </Link>

          {hasRealWorkspace && (
            <Link
              href="/dashboard"
              className="btn btn-secondary btn-sm mt-2 block text-center"
            >
              {tr("backToReal")}
            </Link>
          )}
        </div>
        </Portal>
      )}
    </div>
  );
}
