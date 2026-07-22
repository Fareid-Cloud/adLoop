// app/dashboard/billing/BillingClient.tsx
//
// ملاحظة: Paymob (عكس Stripe) معندهاش بوابة عميل ذاتية الخدمة مؤكدة
// (زي إلغاء الاشتراك بنفسك من صفحة مستضافة عندهم) - محتاج تتأكد من
// لوحة تحكم Paymob هل الميزة دي موجودة قبل ما نعتمد عليها. لحد التأكيد،
// الإلغاء بيحتاج تواصل مباشر، مش زرار ذاتي.

"use client";

import { useState } from "react";

const PLANS = [
  { key: "starter", label: "Starter" },
  { key: "pro", label: "Pro" },
];

export function BillingClient({ hasActiveSubscription }: { hasActiveSubscription: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(planKey: string) {
    setLoading(planKey);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(null);
  }

  if (hasActiveSubscription) {
    return (
      <p className="text-sm text-text-muted">
        لإلغاء الاشتراك أو تغيير طريقة الدفع، تواصل معنا مباشرة - سيرفس ذاتي هيتضاف قريب.
      </p>
    );
  }

  return (
    <div className="flex gap-3">
      {PLANS.map((plan) => (
        <button
          key={plan.key}
          onClick={() => handleCheckout(plan.key)}
          disabled={loading === plan.key}
          className="rounded-2xl bg-surface px-5 py-3 text-sm text-text-primary hover:bg-surface-raised"
        >
          {loading === plan.key ? "جارٍ التحويل..." : `اشترك في ${plan.label}`}
        </button>
      ))}
    </div>
  );
}
