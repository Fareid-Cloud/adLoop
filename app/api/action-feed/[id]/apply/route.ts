// app/api/action-feed/[id]/apply/route.ts
//
// إصلاح أمني حرج (BOLA - OWASP API Security #1): كان مفيش فحص ملكية
// خالص - أي مستخدم مسجّل دخول كان يقدر ينفّذ قرار أتمتة بتاع مستخدم تاني
// تماماً (زي إيقاف حملة أو تغيير ميزانية) لو عرف الـ ID بس.

import { NextRequest, NextResponse } from "next/server";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";
import { randomUUID } from "crypto";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { getSessionUser, getImpersonatorFromRequest } from "@/lib/auth";
import { applyActionFeedItem } from "@/lib/actionFeed";
import { prisma } from "@/lib/prisma";
import { logFeatureUse } from "@/lib/productTelemetry";
import { isFeatureEnabled } from "@/lib/featureFlags";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  const locale = localeOf(user);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // الوسيط يمنع كلَّ كتابةٍ أثناء العرض كـ، وهذه أخطرها على الإطلاق:
  // نداءُ كتابةٍ حقيقيٌّ على حساب إعلانات العميل يصرف من ميزانيته. تحقّقٌ
  // ثانٍ هنا بتوقيعٍ مُتحقَّقٍ منه فعلاً - لئلّا يكون منعُها معتمداً على
  // إعداد `matcher` وحده.
  if (getImpersonatorFromRequest(req)) {
    return NextResponse.json({ error: "impersonation_is_read_only" }, { status: 403 });
  }

  const item = await prisma.actionFeedItem.findFirst({
    where: { id: id, workspace: workspaceAccess(user.id) },
  });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  // نفس مفتاح الكرون: إيقاف التنفيذ الآليّ من اللوحة لازم يوقف
  // الزرّ اليدويّ كمان، وإلا كان الإيقاف نص إيقاف.
  if (!(await isFeatureEnabled("automation.apply"))) {
    return NextResponse.json({ error: "automation is temporarily disabled" }, { status: 503 });
  }

  try {
    await applyActionFeedItem(id);
    // قياس المنتج: التنفيذ الفعليّ - مش فتح الصفحة. الفرق بينهم هو الفرق
    // بين "الميزة اتشافت" و"الميزة اشتغلت".
    logFeatureUse(
      user.id,
      item.actionType?.startsWith("SET_BID_STRATEGY") ? "bid_strategy_apply" : "scale_kill_apply",
      item.workspaceId
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    // 🔴 **الفشل يظهر، وتفصيلُه لا يظهر.**
    //
    // كان `err.message` يُرسَل كما هو - ونصُّه من ميتا أو تيك توك أو من
    // داخلنا: يسرّب تفصيلاً تشغيلياً، ويصل بالعربية إلى قارئٍ إنجليزيّ،
    // ولا يقول للمشترك ماذا يفعل. وإخفاءُ الفشل ليس البديل - فذلك يجعله
    // يظنّ أنّ ميزانيته تغيّرت ولم يحدث شيء.
    //
    // فالمرجع هو الجسر: يُسجَّل التفصيل عندنا مقروناً به، ويُذكَر للمشترك
    // رقماً يقوله للدعم - فيصل التشخيص كاملاً بلا أن يُعرَض.
    const ref = randomUUID().slice(0, 8);
    console.error(`[platform-action] ref=${ref}`, { itemId: id, err });
    return NextResponse.json(
      { error: t(locale, "apiErr.platformActionFailed", { ref }), ref },
      { status: 502 }
    );
  }
}
