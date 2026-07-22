// app/verify-email/page.tsx

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("رابط غير صالح");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json();
          setStatus("error");
          setError(data.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setError("حصل خطأ، حاول تاني");
      });
  }, [token]);

  return (
    <div dir="rtl" data-accent="blue" data-mode="dark" className="flex min-h-screen items-center justify-center bg-bg">
      <div className="max-w-sm rounded-2xl bg-surface p-8 text-center">
        {status === "loading" && <p className="text-text-muted">جارٍ التحقق...</p>}
        {status === "success" && (
          <>
            <h1 className="mb-2 text-xl font-semibold text-verified">تم تأكيد بريدك الإلكتروني ✓</h1>
            <a href="/dashboard" className="text-sm text-accent no-underline">
              الذهاب للوحة التحكم →
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="mb-2 text-xl font-semibold text-critical">تعذّر التحقق</h1>
            <p className="text-sm text-text-muted">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
