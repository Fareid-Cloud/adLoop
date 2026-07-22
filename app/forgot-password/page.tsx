// app/forgot-password/page.tsx

"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true); // بنوري نفس الرسالة دايماً، بغض النظر هل الإيميل موجود ولا لأ
  }

  return (
    <div dir="rtl" data-accent="blue" data-mode="dark" className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">نسيت كلمة المرور؟</h1>
        {sent ? (
          <p className="text-sm text-verified">
            لو الإيميل ده مسجّل عندنا، هيوصلك رابط إعادة التعيين خلال دقايق.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mb-3 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-2.5 text-sm text-white disabled:opacity-50"
            >
              {loading ? "جارٍ الإرسال..." : "أرسل رابط إعادة التعيين"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
