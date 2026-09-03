// app/components/InstallTagCta.tsx
//
// **دعوةٌ تُزيل نفسَها.**
//
// وسم AdLoop هو مصدرُ البيانات كلِّه: بدونه لا نقرةَ واحدة تُقارَن بما
// تدّعيه المنصّة، فلا «طبقةَ حقيقة» أصلاً. ومع ذلك كان مدفوناً في ثالث
// مستوىً داخل قسم التشخيص، فمن لم يعرف بوجوده لا يجده.
//
// 🔴 **والحلُّ ليس بنداً دائماً في القائمة وحده.** بندٌ دائم يصرخ بالقوّة
// نفسها في الحالتين: حين يكون التثبيت عاجلاً، وحين يكون قد تمّ من شهر -
// وما يصرخ دائماً يصير أثاثاً يكفّ النظر عن قراءته.
//
// فالبروزُ يتبع الحالة: يظهر هذا الزرّ ما دامت **لم تصل نقرةٌ واحدة**،
// ويختفي وحدَه أوّلَ ما تصل. لا زرَّ إغلاق: إخفاؤه يدوياً يعني أن يختفي
// وهو لم يُنجَز بعد - وهو الشيء الوحيد الذي لا يصحّ أن يُنسى.

import Link from "next/link";
import { Crosshair } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function InstallTagCta({ locale }: { locale: Locale }) {
  return (
    <Link
      href="/dashboard/tracking"
      // نبرةُ «فجوة» لا خطأ: لا شيء معطوب - خطوةٌ لم تُتَّخذ بعد.
      className="hidden items-center gap-1.5 rounded-xl border border-gap/40 bg-gap/10 px-2.5 py-1.5 text-[12px] font-medium text-gap no-underline transition-colors hover:bg-gap/[0.16] sm:inline-flex"
    >
      <Crosshair size={13} className="shrink-0" />
      {t(locale, "tagInstall.ctaInstall")}
    </Link>
  );
}
