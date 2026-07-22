// app/components/ImpersonationBanner.tsx

"use client";

import { useState } from "react";

export function ImpersonationBanner() {
  const [returning, setReturning] = useState(false);

  async function handleReturn() {
    setReturning(true);
    await fetch("/api/admin/stop-impersonating", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <div className="flex items-center justify-between bg-critical px-4 py-2 text-xs text-white">
      <span>أنت الآن شايف الحساب ده كأدمن - أي تعديل هيؤثر على بيانات العميل الحقيقية</span>
      <button
        onClick={handleReturn}
        disabled={returning}
        className="rounded-full bg-white/20 px-3 py-1 text-white hover:bg-white/30"
      >
        {returning ? "جارٍ الرجوع..." : "الرجوع للوحة الأدمن"}
      </button>
    </div>
  );
}
