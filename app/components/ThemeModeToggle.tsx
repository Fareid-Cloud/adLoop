"use client";

// تبديل الوضع الفاتح/الداكن من الرأس مباشرةً.
//
// كان التفضيل موجوداً في قاعدة البيانات وفي الإعدادات فقط - ثلاث نقرات
// لتبديل شيء يُبدَّل عشرات المرّات يومياً حسب الإضاءة حول المستخدم.
//
// السمة تُطبَّق على عنصر الجذر فوراً ثم تُحفظ في الخلفية: انتظار الشبكة قبل
// تغيير اللون يجعل الزرّ يبدو معطّلاً. فشل الحفظ لا يُلغي التغيير البصري -
// الجلسة الحالية تبقى كما اختار، والتفضيل يُحفظ في المحاولة التالية.

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function ThemeModeToggle({
  initialMode,
  locale,
}: {
  initialMode: string;
  locale: Locale;
}) {
  const [mode, setMode] = useState(initialMode === "dark" ? "dark" : "light");

  // العنصر الجذري هو ما تقرأه متغيّرات CSS، والغلاف الداخلي يحمل نسخته
  // أيضاً - يجب أن يتغيّرا معاً وإلا بقي نصف الصفحة على السمة القديمة.
  // 🔴 **والمسح الشامل كان يطمس ما وُضع ليبقى ثابتاً.**
  //
  // `[data-mode]` يلتقط كلَّ عنصرٍ يحمل الوصف - ومنه **معاينتا الوضع في
  // الإعدادات**، وهما موجودتان أصلاً لتُريا الفاتح والداكن جنباً إلى جنب.
  // فكانت المعاينة «الفاتحة» تُختَم `dark` فور تبديل الوضع، فتظهر مربّعاً
  // داكناً يُفترض أن يكون عيّنة الوضع الفاتح - أي أنّ الاختيار يعود يُجرَّب
  // لا يُقرأ، وهو بالضبط ما بُنيت البطاقة لإلغائه.
  //
  // فمن ثبّت وضعه صراحةً (`data-mode-fixed`) يُستثنى: المعاينتان، وقشرتا
  // الحساب والوثائق القانونية، ولوحة المالك.
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    document.querySelectorAll("[data-mode]:not([data-mode-fixed])").forEach((el) => {
      if (el !== document.documentElement) el.setAttribute("data-mode", mode);
    });
  }, [mode]);

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeMode: next }),
    }).catch(() => {});
  }

  const isDark = mode === "dark";
  const label = t(locale, isDark ? "home.themeToLight" : "home.themeToDark");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      // نفس هوية أزرار الرأس المجاورة (المساعدة، الجرس): دائري بلا إطار
      // ولا خلفية. الإطار والخلفية كانا يجعلانه يبدو عنصراً من عائلة أخرى
      // وسط ثلاثة أزرار متطابقة.
      className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
