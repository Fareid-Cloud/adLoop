// app/dashboard/billing/page.tsx
//
// صفحة الاشتراك بتاعة AdLoop نفسها - مختلفة تماماً عن "pricing" (اللي
// دي فحص تسعير منتجات العميل، لبس مش لينا). الحالة كلها من قاعدة
// بياناتنا (مصدرها الحقيقي webhook Paymob)، مش استعلام مباشر لـPaymob
// وقت كل زيارة - أسرع وأقل عرضة لحدود معدل الطلبات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { BillingClient } from "./BillingClient";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NONE: { label: "لا يوجد اشتراك", color: "text-text-faint" },
  TRIALING: { label: "فترة تجربة", color: "text-gap" },
  ACTIVE: { label: "نشط", color: "text-verified" },
  PAST_DUE: { label: "فشل الدفع - محتاج تحديث", color: "text-critical" },
  CANCELED: { label: "ملغي", color: "text-text-faint" },
};

export default async function BillingPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const status = STATUS_LABELS[user.subscriptionStatus] ?? STATUS_LABELS.NONE;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-[26px] font-semibold text-text-primary">الاشتراك</h1>

      <div className="mb-6 rounded-2xl bg-surface p-5">
        <div className="mb-1 text-xs text-text-faint">حالة الاشتراك</div>
        <div className={`text-lg font-medium ${status.color}`}>{status.label}</div>
        {user.subscriptionPlan && (
          <div className="mt-1 text-sm text-text-muted">الخطة: {user.subscriptionPlan}</div>
        )}
        {user.currentPeriodEnd && (
          <div className="mt-1 text-xs text-text-faint">
            {user.cancelAtPeriodEnd ? "هيتوقف يوم" : "التجديد الجاي يوم"}{" "}
            {new Date(user.currentPeriodEnd).toLocaleDateString("ar")}
          </div>
        )}
      </div>

      <BillingClient
        hasActiveSubscription={user.subscriptionStatus === "ACTIVE" || user.subscriptionStatus === "PAST_DUE"}
      />
    </div>
  );
}
