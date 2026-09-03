"use client";

import { CircleHelp } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

/**
 * زرّ المساعدة في الهيدر.
 *
 * **مُشغِّلٌ لا لوحة.** بيبعت `adloop:open-support` اللي `SupportChat`
 * بيسمعه - زيّ بطاقة الرئيسية وصفحتَي الباقات والتتبّع بالظبط. فمافيش
 * نسخةٌ تانية من الدعم، وكلُّ المداخل بتفتح نفس الشيء.
 */
export function HeaderHelpButton({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("adloop:open-support"))}
      aria-label={t(locale, "supportChat.sidebarLabel")}
      title={t(locale, "supportChat.sidebarLabel")}
      className="btn-icon"
    >
      <CircleHelp size={18} />
    </button>
  );
}
