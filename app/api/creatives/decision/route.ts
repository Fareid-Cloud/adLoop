// app/api/creatives/decision/route.ts
//
// تنفيذ قرار Scale / Hold / Pause على إعلان بعينه.
//
// فحص الملكية إلزامي هنا (BOLA - أخطر ثغرات واجهات الـ API): هذه العملية
// تكتب فعلياً على حساب إعلاني حقيقي - توقف إعلاناً أو تزيد ميزانية. من دون
// التحقق من أن مساحة العمل تخصّ صاحب الجلسة، يستطيع أي مستخدم مسجَّل
// إيقاف إعلانات مُعلن آخر بمجرد معرفة معرّف الإعلان.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyAdDecision, type Decision } from "@/lib/adDecisions";

const ALLOWED: Decision[] = ["SCALE", "HOLD", "PAUSE"];

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { workspaceId?: string; adId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { workspaceId, adId, decision } = body;
  if (!workspaceId || !adId || !decision) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!ALLOWED.includes(decision as Decision)) {
    return NextResponse.json({ error: "قرار غير معروف" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const result = await applyAdDecision(workspaceId, adId, decision as Decision);
    return NextResponse.json(result);
  } catch (err) {
    // فشل حقيقي لدى المنصة يجب أن يظهر كما هو. إخفاؤه خلف "نجح" هو الخطأ
    // الذي يجعل المستخدم يظن أن ميزانيته زادت ولم يحدث شيء.
    console.error(`فشل تنفيذ قرار ${decision} على الإعلان ${adId}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل التنفيذ على المنصة" },
      { status: 500 }
    );
  }
}
