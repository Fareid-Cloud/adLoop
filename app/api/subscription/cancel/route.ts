// app/api/subscription/cancel/route.ts
//
// **إلغاءُ الاشتراك بيد صاحبه - ولم يكن ممكناً إطلاقاً.**
//
// 🔴 `cancelAtPeriodEnd` عمودٌ موجودٌ في المخطَّط، وكاتبُه الوحيد كان
// **مسار الأدمن**: أي أنّ المشترك الذي يريد الإلغاء لا يملك زرّاً ولا
// مساراً، ولا سبيل له إلّا مراسلة الدعم. وهذا يخالف ما تقوله صفحةُ
// الشروط نفسها («الإلغاء يوقف التجديد التالي ويُبقي الخدمة إلى نهاية
// الفترة المدفوعة») - نصٌّ يصف سلوكاً غير مبنيّ.
//
// ═══ الإلغاء لا يقطع الخدمة فوراً ═══
//
// `currentPeriodEnd` لا يُمَسّ: من دفع شهراً يأخذ شهره كاملاً. تُرفَع
// الراية وحدها، فيتوقّف التجديد ويبقى الوصول - وهو ما يفهمه المشترك من
// «إلغاء»، وما يمنع أن يُقرأ الإلغاء عقوبةً على من طلبه.
//
// والحالة تبقى `ACTIVE` عمداً حتى نهاية الفترة: `getEntitlements` يشترط
// `currentPeriodEnd > now`، فقلبُها الآن كان سيسحب ميزةً مدفوعةً بالفعل.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyCsrfToken } from "@/lib/csrf";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  if (!verifyCsrfToken(req)) {
    return NextResponse.json({ error: "csrf validation failed" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // نفس المسار للاتجاهين: الإلغاء والتراجع عنه قبل نهاية الفترة. ومن ألغى
  // بالخطأ لا يُطالَب بشراءٍ جديد ما دامت فترته سارية.
  const cancel = body?.resume !== true;

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionStatus: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, subscriptionPlan: true },
  });
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (current.subscriptionStatus !== "ACTIVE" || !current.currentPeriodEnd) {
    return NextResponse.json({ error: t(locale, "billingErr.noActiveSubscription") }, { status: 409 });
  }

  if (current.cancelAtPeriodEnd === cancel) {
    // لا تغيير - يُرَدّ نجاحاً بلا حدثٍ مكرَّر في السجلّ
    return NextResponse.json({ ok: true, cancelAtPeriodEnd: cancel, periodEnd: current.currentPeriodEnd });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { cancelAtPeriodEnd: cancel },
    }),
    prisma.subscriptionEvent.create({
      data: {
        userId: user.id,
        type: cancel ? "CANCELLED" : "ACTIVATED",
        fromPlan: current.subscriptionPlan ?? null,
        toPlan: current.subscriptionPlan ?? null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, cancelAtPeriodEnd: cancel, periodEnd: current.currentPeriodEnd });
}
