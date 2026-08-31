// app/dashboard/billing/page.tsx
//
// الاشتراك والباقة. الحالة كلّها من قاعدتنا (مصدرها الحقيقي ويب هوك
// Paymob) لا باستعلام مباشر عند كل زيارة - أسرع وأقلّ عرضة لحدود المعدّل.
//
// **رصيد الكريدت المعروض = مخصّص الباقة المتبقّي + المشترى.** الأوّل
// يتجدّد شهرياً والثاني يبقى، وخلطهما في رقم واحد يُخفي أيّهما ينفد أوّلاً.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlansClient } from "./PlansClient";
import { billingCurrencyFor, PLAN_BY_KEY, type PlanKey } from "@/lib/plans";
import { getMonthlyAiUsage } from "@/lib/aiRateLimit";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  const planKey = (user.subscriptionStatus === "ACTIVE" ? user.subscriptionPlan : null) as PlanKey | null;
  const plan = PLAN_BY_KEY.get(planKey ?? "free") ?? PLAN_BY_KEY.get("free")!;

  const used = await getMonthlyAiUsage(user.id);
  const allowance = plan.limits.aiCredits;
  const purchased = user.aiCreditsPurchased ?? 0;
  const left = Math.max(0, allowance - used) + purchased;

  return (
    <PlansClient
      locale={locale}
      currency={billingCurrencyFor(workspace?.currency ?? "USD")}
      currentPlan={planKey ?? "free"}
      creditsLeft={left}
      creditsAllowance={allowance + purchased}
      openCreditsOnLoad={sp.credits === "1"}
      // حالةُ الاشتراك تُمرَّر كي يجد المشترك زرَّ الإلغاء حيث يتوقّعه.
      // كان الإلغاء مستحيلاً من الواجهة رغم أنّ صفحة الشروط تَعِد به.
      subscription={
        user.subscriptionStatus === "ACTIVE" && user.currentPeriodEnd
          ? {
              periodEnd: user.currentPeriodEnd.toISOString(),
              cancelAtPeriodEnd: user.cancelAtPeriodEnd,
            }
          : null
      }
    />
  );
}
