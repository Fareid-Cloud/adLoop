// app/legal/layout.tsx
//
// قشرة موحّدة لصفحات السياسات العامة (خصوصية / استخدام / كوكيز) - متاحة
// للجميع بدون تسجيل دخول، بالوضع الفاتح.
import type { ReactNode } from "react";
import Link from "next/link";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" data-accent="blue" data-mode="light" className="min-h-screen bg-bg font-display">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-base font-bold tracking-tight text-text-primary no-underline">
            AdLoop
          </Link>
          <nav className="flex gap-4 text-[13px] text-text-muted">
            <Link href="/legal/privacy" className="no-underline hover:text-text-primary">سياسة الخصوصية</Link>
            <Link href="/legal/terms" className="no-underline hover:text-text-primary">شروط الاستخدام</Link>
            <Link href="/legal/cookies" className="no-underline hover:text-text-primary">ملفات تعريف الارتباط</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-3xl px-6 pb-10 text-xs text-text-faint">
        © {new Date().getFullYear()} AdLoop. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
