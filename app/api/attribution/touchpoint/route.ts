// app/api/attribution/touchpoint/route.ts
//
// استقبال لمسة واحدة من وسم التتبّع. هذه هي نقطة الدخول التي تجعل الإسناد
// متعدّد اللمسات ممكناً أصلاً - بدونها لا يعرف النظام إلا آخر نقرة.
//
// من الخادم لا المتصفح: عنوان IP وبصمة المتصفح يُقرآن من الطلب نفسه، فلا
// يعتمدان على جافاسكربت قد يحجبه مانع إعلانات.

import { NextRequest, NextResponse } from "next/server";
import { verifyInternalServiceAuth } from "@/lib/internalServiceAuth";
import { recordTouchpoint } from "@/lib/touchpointPaths";

const VALID_KINDS = new Set(["AD_CLICK", "AD_VIEW", "SITE_VISIT", "CRM_EVENT", "MESSAGE"]);

export async function POST(req: NextRequest) {
  if (!verifyInternalServiceAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const workspaceId = str(body.workspaceId);
  const visitorId = str(body.visitorId);
  const kind = str(body.kind) ?? "SITE_VISIT";

  if (!workspaceId || !visitorId) {
    return NextResponse.json({ error: "workspaceId و visitorId مطلوبان" }, { status: 400 });
  }
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "نوع لمسة غير معروف" }, { status: 400 });
  }

  try {
    await recordTouchpoint({
      workspaceId,
      visitorId,
      sessionId: str(body.sessionId),
      kind: kind as "AD_CLICK",
      platform: str(body.platform),
      campaignId: str(body.campaignId),
      adSetId: str(body.adSetId),
      adId: str(body.adId),
      clickId: str(body.clickId),
      source: str(body.source),
      medium: str(body.medium),
      campaignTag: str(body.campaignTag),
      referrer: str(body.referrer),
      landingPath: str(body.landingPath),
      // تُقرأ من الطلب لا من الجسم - أدقّ وغير قابلة للتزوير من العميل
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
      occurredAt: body.occurredAt ? new Date(String(body.occurredAt)) : undefined,
      channel: str(body.channel),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("فشل تسجيل اللمسة:", err);
    return NextResponse.json({ error: "تعذّر تسجيل اللمسة" }, { status: 500 });
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
