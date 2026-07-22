// app/api/creatives/quality-check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { auditAdImageQuality } from "@/lib/imageQualityAudit";
import { checkAndConsumeImageQualityQuota } from "@/lib/aiRateLimit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // إصلاح ثغرة مالية حقيقية: كانت الميزة دي من غير أي حد أقصى خالص
  const quota = await checkAndConsumeImageQualityQuota(user.id);
  if (!quota.allowed) {
    const message =
      quota.reason === "monthly_exhausted"
        ? "وصلت للحد الأقصى الشهري لفحص جودة الصور."
        : `وصلت للحد الساعي - جرّب تاني بعد ${quota.retryAfterMinutes} دقيقة.`;
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const { imageUrl, platform } = await req.json();
  if (!imageUrl || !platform) {
    return NextResponse.json({ error: "imageUrl و platform مطلوبين" }, { status: 400 });
  }

  const result = await auditAdImageQuality(imageUrl, platform);
  if (!result) {
    return NextResponse.json({ error: "تعذّر تحليل الصورة (رابط منتهي أو غير متاح)" }, { status: 422 });
  }

  return NextResponse.json(result);
}
