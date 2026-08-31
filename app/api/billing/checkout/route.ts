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
import { PLAN_BY_KEY, type BillingCycle, type PlanKey } from "@/lib/plans";
import { priceListFor, resolveBillingCountry } from "@/lib/billingRegion";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { workspaceAccess } from "@/lib/workspaceAccess";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // بدء الدفع ينشئ سجلّاً وينادي بوّابة خارجية - معدّل مرتفع منه إمّا
  // ضغط عصبي متكرّر أو إساءة، وكلاهما يستحقّ الحدّ.
  const { allowed } = await checkRateLimit(getClientIp(req), `checkout:${user.id}`, 10, 5);
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const body = await req.json().catch(() => null);

  // 🔴 **الفوترة لا تقرأ مساحة عمل - الاشتراك على الحساب لا على المساحة.**
  //
  // كان هذا المسار يشتقّ العملة من `dataCurrency` لأقدم مساحةٍ حقيقية، وهي
  // عملةُ الحساب الإعلانيّ: غيرُ قابلةٍ للتعديل، ولا علاقة لها بمن يدفع.
  // فصاحبُ حسابٍ بالدولار كان **يُرفَض دفعُه كلّياً** لأنّ البوّابة تقبل
  // الجنيه وحده - وصفحةُ الباقات كانت تقرأ حقلاً ثالثاً (`workspace.currency`)
  // فتعرض ٢٬٤٩٩ جنيهاً بينما يطلب هذا المسار ١٤٩ دولاراً.
  //
  // قائمةُ السعر الآن من `billingCountry` على الحساب: تُضبَط عند التسجيل
  // ولا يعدّلها صاحبُها (فتبقى ثغرة B-1 مغلقة)، والتحصيل بالجنيه دائماً.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { billingCountry: true },
  });
  const currency = priceListFor(
    await resolveBillingCountry(user.id, account?.billingCountry, req.headers)
  );

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
