// app/api/track/cta-click/route.ts
//
// صفحة الهبوط (اللي Fareid بيبنيها لعملائه) بتنده على الـ endpoint ده مع
// كل ضغطة على أي زرار CTA (واتساب، اتصال، فورم) - بغض النظر عن نوعه.
// مفتوح بدون تسجيل دخول لأنه بيتنده من متصفح الزائر النهائي، مش من داخل
// AdLoop نفسه. الحماية هنا مختلفة عن باقي الـ routes: مش authentication،
// لكن ربط بـ workspaceId معروف ومُتحقق مسبقاً (مش أي workspace عشوائي).

import { NextRequest, NextResponse } from "next/server";
import { recordCtaClick, CtaType } from "@/lib/ctaDeduplication";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // حد استخدام - نفس الزائر الشرعي مش هيدوس على أزرار CTA أكتر من كام
  // مرة في دقايق قليلة، فأي معدل أعلى بكتير غالباً محاولة إغراق بيانات
  // وهمية (زرار سكريبت آلي مش زائر حقيقي)
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "cta-click", 30, 10);
  if (!allowed) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const { workspaceId, sessionId, gclid, clickId, clickPlatform, campaignId, ctaType } = body;

  if (!workspaceId || !sessionId || !ctaType) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  if (!["WHATSAPP", "CALL", "FORM"].includes(ctaType)) {
    return NextResponse.json({ error: "invalid ctaType" }, { status: 400 });
  }

  // نتأكد إن الـ workspaceId ده فعلاً موجود عندنا - مش بنطلب تسجيل دخول،
  // بس بنرفض أي محاولة تسجيل لحساب مش موجود أصلاً (حماية بسيطة من إساءة
  // استخدام الـ endpoint المفتوح ده)
  const workspaceExists = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspaceExists) {
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  }

  await recordCtaClick({
    workspaceId,
    sessionId,
    gclid: gclid || (clickPlatform === "GOOGLE_ADS" ? clickId : undefined) || undefined,
    clickPlatform: clickPlatform || undefined,
    campaignId: campaignId || undefined,
    ctaType: ctaType as CtaType,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
