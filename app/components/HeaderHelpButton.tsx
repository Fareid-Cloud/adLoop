"use client";

// زرّ المساعدة (؟) جنب الإشعارات.
//
// **الشكلُ هو شكلُ `HelpButton` الأصليّ بالحرف** - دايرة بلا إطار، وخلفيّةٌ
// عند المرور، و`HelpCircle` بسُمك ١٫٧٥. كنت كتبتُه من الصفر بـ`btn-icon`،
// وهي بتجيب حدَّ `.btn` وخلفيّته - فظهر **مربّعٌ** حوالين علامة الاستفهام
// وسط أيقوناتٍ كلُّها دوائر.
//
// اللي اتغيّر هو **الفعل** لا الشكل: بدل ما يفتح لوحةً خاصّةً به (وهو ما
// كان بيخلّي في المنتج مدخلين للدعم)، بيبعت `adloop:open-support` اللي
// `SupportChat` بيسمعه - نفس الحدث اللي بتفتح بيه بطاقةُ الرئيسية وصفحتا
// الباقات والتتبّع. فسطحُ دعمٍ واحد بأربع طرقٍ تفتحه.

import { HelpCircle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function HeaderHelpButton({ locale }: { locale: Locale }) {
  const label = t(locale, "helpPanel.button");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("adloop:open-support"))}
      className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
      aria-label={label}
      title={label}
    >
      <HelpCircle size={18} strokeWidth={1.75} />
    </button>
  );
}
