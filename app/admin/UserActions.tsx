// app/admin/UserActions.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Ban, CheckCircle2 } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";

export function UserActions({ userId, isSuspended }: { userId: string; isSuspended: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    if (!confirm("هتدخل حساب العميل ده مباشرة - العملية دي مسجّلة في سجل التدقيق. متأكد؟")) return;
    setLoading(true);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ targetUserId: userId }),
    });
    if (res.ok) window.location.href = "/dashboard";
    setLoading(false);
  }

  async function handleSuspendToggle() {
    const action = isSuspended ? "إلغاء تعليق" : "تعليق";
    if (!confirm(`متأكد من ${action} الحساب ده؟`)) return;
    setLoading(true);
    await fetch("/api/admin/suspend-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ targetUserId: userId, suspend: !isSuspended }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleImpersonate}
        disabled={loading}
        title="دخول كالعميل (View As)"
        className="text-text-faint hover:text-accent disabled:opacity-50"
      >
        <Eye size={15} />
      </button>
      <button
        onClick={handleSuspendToggle}
        disabled={loading}
        title={isSuspended ? "إلغاء التعليق" : "تعليق الحساب"}
        className={isSuspended ? "text-verified hover:text-verified" : "text-text-faint hover:text-critical"}
      >
        {isSuspended ? <CheckCircle2 size={15} /> : <Ban size={15} />}
      </button>
    </div>
  );
}
