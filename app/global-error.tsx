// app/global-error.tsx
//
// أي خطأ في الواجهة (React rendering error) مش المفروض يوقع الموقع كله من
// غير ما نعرف - الملف ده بيمسك أي خطأ زي ده، يبعته لـ Sentry، ويوري
// للمستخدم رسالة واضحة بدل شاشة بيضاء فاضية.

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html dir="rtl" lang="ar">
      <body>
        <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1>حدث خطأ غير متوقع</h1>
          <p style={{ color: "#666" }}>تم إبلاغ الفريق التقني تلقائياً بالمشكلة.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 20px" }}>
            حاول مرة أخرى
          </button>
        </div>
      </body>
    </html>
  );
}
