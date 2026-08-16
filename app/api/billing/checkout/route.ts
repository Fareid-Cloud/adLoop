// app/api/billing/checkout/route.ts
//
// بدء الدفع. **المبلغ يُشتقّ في الخادم** من مفتاح الباقة الواصل - لا
// يُستقبل من العميل إطلاقاً، وإلا اشترى أحدهم باقة الوكالات بجنيه.
//
// كل ما يخصّ منع الشحن المزدوج في `lib/billing.ts` - هنا التحقّق فقط.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { startSubscriptionCheckout, startCreditsCheckout } from "@/lib/billing";
import { billingCurrencyFor, PLAN_BY_KEY, type BillingCycle, type PlanKey } from "@/lib/plans";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // بدء الدفع ينشئ سجلّاً وينادي بوّابة خارجية - معدّل مرتفع منه إمّا
  // ضغط عصبي متكرّر أو إساءة، وكلاهما يستحقّ الحدّ.
  const { allowed } = await checkRateLimit(getClientIp(req), `checkout:${user.id}`, 10, 5);
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const body = await req.json().catch(() => null);

  // العملة من مساحة عمل المستخدم لا من العميل - وإلا اختار الأرخص
  const workspace = await getActiveWorkspace(user.id);
  const currency = billingCurrencyFor(workspace?.currency ?? "USD");

  if (body?.mode === "credits") {
    const result = await startCreditsCheckout({
      userId: user.id,
      userEmail: user.email,
      currency,
      credits: Number(body?.credits),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const planKey = String(body?.plan ?? "") as PlanKey;
  const plan = PLAN_BY_KEY.get(planKey);
  // 🔴 `contactOnly` تُفحص هنا لا في الواجهة وحدها: سعر الباقة المؤسّسية
  // صفرٌ في الجدول لأنّها تُسعَّر بالاتّفاق، فبعثُ اسمها إلى هذا المسار
  // مباشرةً كان سيُنشئ اشتراكاً بلا حدود بمقابلٍ صفر. الواجهة تُخفي الزرّ،
  // والإخفاء ليس منعاً.
  if (!plan || planKey === "free" || plan.contactOnly) {
    return NextResponse.json({ ok: false, errorKey: "errUnknownPlan" }, { status: 400 });
  }
  const cycle: BillingCycle = body?.cycle === "yearly" ? "yearly" : "monthly";

  const result = await startSubscriptionCheckout({
    userId: user.id,
    userEmail: user.email,
    currency,
    planKey,
    cycle,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
