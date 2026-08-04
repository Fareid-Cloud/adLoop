// app/components/LegalLinks.tsx
//
// روابط الصفحات القانونية.
//
// **ما كان:** الصفحات الثلاث مبنيّة بالكامل (`/legal/terms`, `/legal/privacy`,
// `/legal/cookies`) و**صفر رابط إليها في المنتج كلّه** — لا في التسجيل ولا
// في الإعدادات ولا في أيّ تذييل. وجودها بلا مدخل يعني أنّها غير موجودة
// عملياً: لا يصلها إلّا من يعرف المسار ويكتبه بيده.
//
// مكوّن واحد بثلاثة أشكال بدل ثلاث نسخ تفترق: `inline` لأسفل نماذج
// الدخول، و`footer` لتذييل اللوحة، و`stacked` لقائمة في الإعدادات.

import Link from "next/link";
import { t, type Locale } from "@/lib/i18n/dictionary";

const PAGES = [
  { href: "/legal/terms", key: "legal.linkTerms" },
  { href: "/legal/privacy", key: "legal.linkPrivacy" },
  { href: "/legal/cookies", key: "legal.linkCookies" },
] as const;

export function LegalLinks({
  locale,
  variant = "inline",
  className = "",
}: {
  locale: Locale;
  variant?: "inline" | "footer" | "stacked";
  className?: string;
}) {
  const links = PAGES.map((p) => (
    <Link
      key={p.href}
      href={p.href}
      className="text-text-faint no-underline transition-colors hover:text-text-primary hover:underline"
    >
      {t(locale, p.key)}
    </Link>
  ));

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col gap-1.5 text-[12.5px] ${className}`}>{links}</div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] ${
        variant === "footer" ? "justify-center" : ""
      } ${className}`}
    >
      {links.map((l, i) => (
        <span key={PAGES[i].href} className="flex items-center gap-3">
          {l}
          {i < links.length - 1 && <span className="text-border">·</span>}
        </span>
      ))}
    </div>
  );
}
