// app/components/DemoExpiredGate.tsx
//
// ما يراه المستخدم حين تنتهي مدّة العرض التجريبي.
//
// **لماذا بوابة لا لافتة:** بيانات العرض أمثلة لا أرقام حقيقية. إبقاؤها
// معروضة بعد انتهاء المدّة - ولو بتنبيه فوقها - يعني أنّ منتجاً جوهره
// «تحقّق من أرقامك بدل تصديق أرقام المنصّات» يعرض هو نفسه أرقاماً غير
// حقيقية كأنها حقيقية. لذلك تُحجب اللوحة كاملةً، لا تُزيَّن بتحذير.
//
// ومعها الخطوة التالية جاهزة في مكانها: بوابة تقول «انتهى» وتصمت تترك
// المستخدم عالقاً.

import Link from "next/link";
import { Link2, CreditCard } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DemoExpiredGate({
  locale,
  accent,
  mode,
  fontVars,
}: {
  locale: Locale;
  accent: string;
  mode: string;
  fontVars: string;
}) {
  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent={accent}
      data-mode={mode}
      className={`${fontVars} flex min-h-screen items-center justify-center bg-bg px-5 font-display`}
    >
      <div className="card pad-lg w-full max-w-md text-center">
        <h1 className="section-title mb-2">{t(locale, "demoGate.demoExpiredTitle")}</h1>
        <p className="mb-6 text-[13px] leading-relaxed text-text-muted">
          {t(locale, "demoGate.demoExpiredBody")}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/integrations"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white no-underline"
          >
            <Link2 size={14} />
            {t(locale, "demoGate.demoExpiredConnect")}
          </Link>
          <Link
            href="/dashboard/billing"
            className="card-inset inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-text-primary no-underline"
          >
            <CreditCard size={14} />
            {t(locale, "demoGate.demoExpiredPlans")}
          </Link>
        </div>
      </div>
    </div>
  );
}
