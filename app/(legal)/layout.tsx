// app/(legal)/layout.tsx
//
// قشرة موحّدة للوثائق القانونية العامّة — متاحة بلا تسجيل دخول.
//
// **مجموعة مسار لا مجلّد حقيقي:** الأقواس تجعل `(legal)` تنظيماً في شجرة
// الملفّات وحدها، فتبقى العناوين `/terms` و`/privacy` و`/cookies` مباشرةً.
// المسار السابق `/legal/…` كان يضيف طبقة لا يفهمها أحد ولا يكتبها أحد.

import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n/dictionary";

const PAGES = [
  { href: "/privacy", key: "legal.linkPrivacy" },
  { href: "/terms", key: "legal.linkTerms" },
  { href: "/cookies", key: "legal.linkCookies" },
] as const;

export default async function LegalLayout({ children }: { children: ReactNode }) {
  // لغة القارئ لا لغة مثبّتة: من سجّل دخوله يجد الوثيقة بلغته هو.
  //
  // 🔴 والافتراضي للزائر **الإنجليزية** لا العربية: هذه الصفحات يُدخَل إليها
  // من رابطَي «شروط الاستخدام» و«سياسة الخصوصية» أسفل نموذج التسجيل، وذلك
  // النموذج إنجليزيٌّ افتراضاً (`useAuthLocale`). فكان الزائر يقرأ نموذجاً
  // إنجليزياً، يضغط الرابط، فتفتح له الوثيقة القانونية بالعربية.
  const user = await getSessionUserFromCookies().catch(() => null);
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  const ar = locale === "ar";

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      data-mode-fixed=""
      className="min-h-screen bg-bg font-display"
    >
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <Link href="/" className="text-base font-bold tracking-tight text-text-primary no-underline">
            AdLoop
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
            {PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="no-underline hover:text-text-primary">
                {t(locale, p.key)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-3xl px-5 pb-10 text-xs text-text-faint sm:px-6">
        © {new Date().getFullYear()} AdLoop. {t(locale, "legal.rights")}
      </footer>
    </div>
  );
}
