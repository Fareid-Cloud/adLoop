// app/layout.tsx
//
// 🔴 كان ده الملف الناقص اللي بيمنع البناء بالكامل - Next.js App Router
// بيتطلب root layout بـ<html>/<body> إجبارياً. اكتُشف بمراجعة شاملة عن
// طريق تشغيل `next build` فعلي (مش tsc بس). كل الجلسة دي كانت شغالة
// على فحص type-level نضيف، بس التطبيق مكانش هيتبني فعلياً.
//
// أيضاً بيحل فجوة مكتشفة: صفحات برّه الداشبورد ماكانتش بتحمّل خط
// Almarai خالص - next/font كان مستورد جوه dashboard/layout.tsx بس.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./dashboard/theme.css";

// خط عربي/لاتيني احترافي واحد للواجهة كلها - IBM Plex Sans Arabic: نظيف،
// حديث، تغطية ممتازة للعربي والأرقام، ويقترن طبيعياً مع IBM Plex Mono.
const display = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdLoop",
  description: "منصة إدارة إعلانات موحّدة - تحقّق من أرقامك بدل ما تصدّق أرقام المنصات فقط.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-mode="light" data-accent="blue">
      <body className={`${display.variable} font-display antialiased`}>{children}</body>
    </html>
  );
}
