// app/global-error.tsx
//
// آخر شبكة أمان: أي خطأ في التصيير لا يجوز أن يترك المستخدم أمام شاشة
// بيضاء. يُرسَل الخطأ إلى Sentry، ويُعرض للمستخدم ما يفهمه.
//
// **بلا قاموس وبلا أنماط المنتج، عمداً:** هذا الملفّ يعمل حين يفشل كلّ ما
// عداه، فكلّ ما يستورده يصير نقطةَ فشلٍ إضافية في اللحظة التي يجب ألّا
// يفشل فيها. الأنماط مضمَّنة، والنصّ مكتوب هنا.
//
// **ولذلك باللغتين:** هذا الملفّ يستبدل `<html>` نفسه، فلا `locale` يصل
// إليه ولا سبيل لمعرفة لغة القارئ. كان عربياً وحده، فيقف مستخدم الواجهة
// الإنجليزية أمام رسالة لا يقرؤها في أسوأ لحظة ممكنة. سطران متجاوران
// أقصر من أيّ آلية اكتشاف، وأضمن.

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
    <html lang="en" dir="ltr">
      <body style={{ margin: 0, background: "#0B0E14", color: "#F2F5F9" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>Something went wrong</h1>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 14px", direction: "rtl" }}>
              حدث خطأ غير متوقّع
            </h2>

            <p style={{ color: "#9AA5B4", fontSize: 13.5, lineHeight: 1.7, margin: "0 0 4px" }}>
              The technical team has been notified automatically.
            </p>
            <p style={{ color: "#9AA5B4", fontSize: 13.5, lineHeight: 1.7, margin: 0, direction: "rtl" }}>
              أُبلغ الفريق التقنيّ تلقائياً.
            </p>

            {/* رمز الخطأ ورسالته: بدونهما لا توجد أي وسيلة لتشخيص عطل
                الإنتاج دون الوصول إلى سجلات الخادم - وهو ما عطّل تحديد
                السبب سابقاً. */}
            {error?.digest && (
              <p style={{ color: "#6B7686", fontSize: 12, fontFamily: "ui-monospace, monospace", marginTop: 14 }}>
                {error.digest}
              </p>
            )}
            {error?.message && (
              <p
                style={{
                  color: "#6B7686",
                  fontSize: 12,
                  marginTop: 4,
                  direction: "ltr",
                  wordBreak: "break-word",
                }}
              >
                {String(error.message).slice(0, 300)}
              </p>
            )}

            <p style={{ color: "#6B7686", fontSize: 12, marginTop: 14, lineHeight: 1.7 }}>
              If this keeps happening, open <code>/api/health/schema</code> to check whether the
              database is behind the code.
            </p>

            <button
              onClick={reset}
              style={{
                marginTop: 18,
                padding: "10px 22px",
                borderRadius: 12,
                border: "none",
                background: "#3B82F6",
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Try again · حاول مرّة أخرى
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
