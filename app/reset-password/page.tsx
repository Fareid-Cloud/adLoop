// app/reset-password/page.tsx

"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PasswordRequirements } from "@/app/components/PasswordRequirements";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return <p className="text-sm text-critical">رابط غير صالح.</p>;
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-8">
      <h1 className="mb-4 text-xl font-semibold text-text-primary">كلمة مرور جديدة</h1>
      {success ? (
        <p className="text-sm text-verified">تم التغيير بنجاح، جارٍ تحويلك لتسجيل الدخول...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="mb-1 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
          />
          <PasswordRequirements password={newPassword} />
          {error && <p className="mb-2 text-xs text-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-2.5 text-sm text-white disabled:opacity-50"
          >
            {loading ? "جارٍ الحفظ..." : "احفظ كلمة المرور الجديدة"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div dir="rtl" data-accent="blue" data-mode="dark" className="flex min-h-screen items-center justify-center bg-bg">
      <Suspense fallback={<div />}>
        <ResetPasswordInner />
      </Suspense>
    </div>
  );
}
