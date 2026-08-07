// app/api/creatives/quality-check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { auditAdImageQuality } from "@/lib/imageQualityAudit";
import { checkAndConsumeImageQualityQuota } from "@/lib/aiRateLimit";
import { blockAiInDemo } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // إصلاح ثغرة مالية حقيقية: كانت الميزة دي من غير أي حد أقصى خالص
  const quota = await checkAndConsumeImageQualityQuota(user.id);
  if (!quota.allowed) {
    const message =
      quota.reason === "monthly_exhausted"
        ? "وصلت للحد الأقصى الشهري لفحص جودة الصور."
        : `بلغت الحدّ المسموح في الساعة — حاول بعد ${quota.retryAfterMinutes} دقيقة.`;
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const { imageUrl, platform, workspaceId } = await req.json();
  if (!imageUrl || !platform || !workspaceId) {
    return NextResponse.json({ error: "imageUrl و platform و workspaceId مطلوبين" }, { status: 400 });
  }

  // ملكيّة المساحة تُتحقَّق قبل أيّ نداء: المعرّف يصل من العميل، فقبوله كما
  // ورد يعني أنّ أيّ حساب يصرف من حصّة غيره.
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  // نداء ذكاء اصطناعي حقيقيّ يُصرَف من مساحة عرض: يشتري رأياً في صورة مثال.
  const demoBlock = await blockAiInDemo(workspace.id, (user.preferredLocale as "ar" | "en") ?? "ar");
  if (demoBlock) return demoBlock;

  const result = await auditAdImageQuality(imageUrl, platform);
  if (!result) {
    return NextResponse.json({ error: "تعذّر تحليل الصورة (رابط منتهي أو غير متاح)" }, { status: 422 });
  }

  return NextResponse.json(result);
}
