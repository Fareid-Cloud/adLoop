// app/components/AuthShell.tsx
//
// قشرة شاشات الحساب (دخول/تسجيل/استعادة) بتصميم split-screen: نصف بصري
// بالعلامة، ونصف للفورم. اللغة إنجليزية افتراضياً ولا تتحوّل للعربية إلا
// باختيار صريح - لا خلط بين اللغتين إطلاقاً.
//
// الصورة: ضع ملفك في public/auth-visual.png (لو غير موجود يظهر تدرّج أنيق).

import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/dictionary";

const COPY = {
  en: {
    headline: "The truth behind every ad",
    sub: "We compare what platforms report against what actually converted — so you pay for real results only.",
  },
  ar: {
    headline: "الحقيقة وراء كل إعلان",
    sub: "نقارن ما تقوله المنصات بما تحقّق فعلاً — لتدفع مقابل النتائج الحقيقية فقط.",
  },
};

export function AuthShell({
  children,
  locale = "en",
  onLocaleChange,
  headline,
  sub,
  wide = false,
}: {
  children: ReactNode;
  locale?: Locale;
  onLocaleChange?: (l: Locale) => void;
  headline?: string;
  sub?: string;
  wide?: boolean; // للفورم متعدد الأعمدة (التسجيل)
}) {
  const copy = COPY[locale] ?? COPY.en;

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      className="flex min-h-screen bg-bg font-display"
    >
      {/* اللوحة البصرية - مخفية على الشاشات الصغيرة */}
      <div
        className="relative hidden w-1/2 overflow-hidden lg:block"
        style={{ background: "linear-gradient(150deg,#0A1628 0%,#0D2A4A 45%,#08192E 100%)" }}
      >
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/auth-visual.png')" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 20% 30%, rgba(59,130,246,.22), transparent 70%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, rgba(4,12,24,.92), transparent)" }} />

        <div className="absolute inset-x-0 bottom-0 p-12">
          <h2 className="mb-3 text-[34px] font-bold leading-tight text-white">{headline ?? copy.headline}</h2>
          <p className="max-w-md text-[15px] leading-relaxed text-white/70">{sub ?? copy.sub}</p>
        </div>
      </div>

      {/* الفورم */}
      <div className="relative flex w-full items-center justify-center px-5 py-10 lg:w-1/2">
        {/* مبدّل لغة صريح - التحويل للعربية باختيار المستخدم فقط */}
        {onLocaleChange && (
          <div className="absolute end-5 top-5 flex gap-1 rounded-lg border border-border bg-surface p-0.5 text-[12px]">
            {(["en", "ar"] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => onLocaleChange(l)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  locale === l ? "bg-accent font-medium text-white" : "text-text-muted hover:text-text-primary"
                }`}
              >
                {l === "en" ? "EN" : "العربية"}
              </button>
            ))}
          </div>
        )}
        <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>{children}</div>
      </div>
    </div>
  );
}
