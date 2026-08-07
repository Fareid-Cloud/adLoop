"use client";

// حدود خطأ على مستوى الداشبورد: أي خطأ في صفحة يظهر هنا كرسالة قابلة
// لإعادة المحاولة مع بقاء القائمة الجانبية وباقي البرنامج شغّالاً، بدل ما
// يصعد لـ global-error ويطيّح الموقع كله بشاشة خطأ عامة.
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // صفحة خطأ عميل: لا وصول للجلسة هنا، فتُقرأ اللغة من عنصر الجذر
  const locale: Locale =
    (typeof document !== "undefined" && document.documentElement.lang === "en") ? "en" : "ar";
  const [en, setEn] = useState(false);
  useEffect(() => setEn(navigator.language.toLowerCase().startsWith("en")), []);
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="icon-badge mb-4 h-12 w-12 bg-critical/15 text-critical">
        <AlertTriangle size={22} />
      </div>
      <h1 className="mb-1.5 text-lg font-semibold text-text-primary">
        {t(locale, "errPage.title")}
      </h1>
      <p className="mb-5 max-w-sm text-sm text-text-muted">
        {t(locale, "errPage.body")}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="btn btn-primary"
        >
          {t(locale, "errPage.retry")}
        </button>
        <a
          href="/dashboard"
          className="btn btn-secondary"
        >
          {t(locale, "errPage.home")}
        </a>
      </div>
    </div>
  );
}
