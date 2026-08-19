// app/api/creatives/decision/route.ts
//
// تنفيذ قرار Scale / Hold / Pause على إعلان بعينه.
//
// فحص الملكية إلزامي هنا (BOLA - أخطر ثغرات واجهات الـ API): هذه العملية
// تكتب فعلياً على حساب إعلاني حقيقي - توقف إعلاناً أو تزيد ميزانية. من دون
// التحقق من أن مساحة العمل تخصّ صاحب الجلسة، يستطيع أي مستخدم مسجَّل
// إيقاف إعلانات مُعلن آخر بمجرد معرفة معرّف الإعلان.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyAdDecision, type Decision } from "@/lib/adDecisions";
import { t } from "@/lib/i18n/dictionary";
import { localeOf } from "@/lib/apiLocale";

const ALLOWED: Decision[] = ["SCALE", "HOLD", "PAUSE"];

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locale = localeOf(user);

  let body: { workspaceId?: string; adId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t(locale, "apiErr.badRequest") }, { status: 400 });
  }

  const { workspaceId, adId, decision } = body;
  if (!workspaceId || !adId || !decision) {
    return NextResponse.json({ error: t(locale, "apiErr.missingFields") }, { status: 400 });
  }
  if (!ALLOWED.includes(decision as Decision)) {
    return NextResponse.json({ error: t(locale, "apiErr.unknownDecision") }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const result = await applyAdDecision(workspaceId, adId, decision as Decision);
    return NextResponse.json(result);
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
    console.error(`[platform-action] ref=${ref}`, { adId, decision, err });
    return NextResponse.json(
      { error: t(locale, "apiErr.platformActionFailed", { ref }), ref },
      { status: 502 }
    );
  }
}
