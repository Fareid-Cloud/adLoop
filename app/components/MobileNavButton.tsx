"use client";

// app/components/MobileNavButton.tsx
//
// زرّ فتح القائمة على الشاشات الصغيرة.
//
// **لماذا حدث على النافذة لا رفع الحالة:** الزرّ يعيش في رأس الصفحة
// والدرج في `SidebarNav`، وبينهما `app/dashboard/layout.tsx` وهو **مكوّن
// خادم** لا يملك حالة يرفعها إليها. البديل كان تحويل التخطيط كلّه إلى
// مكوّن عميل - أي نقل كلّ استعلاماته إلى المتصفّح - وهو ثمن باهظ لزرّ.

import { Menu } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function MobileNavButton({ locale }: { locale: Locale }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("adloop:open-nav"))}
      aria-label={t(locale, "nav.openMenu")}
      title={t(locale, "nav.openMenu")}
      // 44×44 هو الحدّ الأدنى لمساحة اللمس المريحة على الهاتف - أصغر منه
      // يُخطئه الإصبع باستمرار.
      className="card flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary lg:hidden"
    >
      <Menu size={20} />
    </button>
  );
}
