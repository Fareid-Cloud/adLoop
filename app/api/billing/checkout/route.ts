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

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // بدء الدفع ينشئ سجلّاً وينادي بوّابة خارجية - معدّل مرتفع منه إمّا
  // ضغط عصبي متكرّر أو إساءة، وكلاهما يستحقّ الحدّ.
  const { allowed } = await checkRateLimit(getClientIp(req), `checkout:${user.id}`, 10, 5);
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const body = await req.json().catch(() => null);

  // 🔴 عملة الفوترة من `dataCurrency` (عملة حساب الإعلانات، غير قابلة
  // للتعديل - قاعدة "العملة تتبع المال")، لا من `workspace.currency`
  // الذي يحرّره المستخدم من الإعدادات. الشكل القديم كان يقرأ العملة
  // المحرَّرة، فمن لم يربط حساباً (أو أبقى كوكي الديمو نشطاً) كان يختار
  // الجنيه ويدفع سعر مصر لباقة الدولار - خصمُ ~65% خدمةً ذاتية.
  // بلا `dataCurrency` في أيّ مساحةٍ حقيقية → سعر القائمة بالدولار، لا
  // ما اختاره المستخدم.
  const realWorkspaceWithCurrency = await prisma.workspace.findFirst({
    where: { userId: user.id, isDemo: false, dataCurrency: { not: null } },
    select: { dataCurrency: true },
    orderBy: { createdAt: "asc" },
  });
  const currency = billingCurrencyFor(realWorkspaceWithCurrency?.dataCurrency ?? "USD");

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
