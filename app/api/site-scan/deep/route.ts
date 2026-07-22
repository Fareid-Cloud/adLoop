// app/api/site-scan/deep/route.ts
//
// الفحص العميق بطيء (صورة + تحليل AI بصري + أداء + احتمال منافسين) -
// ممكن ياخد نص دقيقة أو أكتر. بنرجّع فوراً بـ ID للمتابعة، والشغل
// الفعلي بيحصل في الخلفية عن طريق after() (نفس نمط استرجاع البيانات
// التاريخية اللي بنيناه قبل كده) - الخادم بيفضل شغال لحد ما يخلص، من
// غير ما نأخّر رد المستخدم أو نصطدم بحد وقت استجابة السيرفر.

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { runDeepSiteScan } from "@/lib/siteScanOrchestrator";
import { checkAndConsumeSiteScanQuota } from "@/lib/aiRateLimit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // إصلاح ثغرة مالية حقيقية: أغلى ميزة في المشروع (4 نداءات Claude لكل
  // فحص) كانت من غير أي حد أقصى خالص. الفحص هنا قبل أي شغل خالص، عشان
  // طلب مرفوض ميعملش حتى صف PENDING أو يشغّل أي حاجة في الخلفية
  const quota = await checkAndConsumeSiteScanQuota(user.id);
  if (!quota.allowed) {
    const message =
      quota.reason === "monthly_exhausted"
        ? "وصلت للحد الأقصى الشهري للفحص العميق."
        : `وصلت للحد الساعي - جرّب تاني بعد ${quota.retryAfterMinutes} دقيقة.`;
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const { workspaceId, url, competitorUrls } = await req.json();
  if (!workspaceId || !url) {
    return NextResponse.json({ error: "workspaceId و url مطلوبين" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const scan = await prisma.siteScanResult.create({
    data: {
      workspaceId,
      url,
      competitorUrls: Array.isArray(competitorUrls) ? competitorUrls.slice(0, 2) : [],
      status: "PENDING",
    },
  });

  after(async () => {
    try {
      await prisma.siteScanResult.update({ where: { id: scan.id }, data: { status: "RUNNING" } });

      const result = await runDeepSiteScan(
        url,
        Array.isArray(competitorUrls) ? competitorUrls : [],
        workspace.industryVertical,
        "ar"
      );

      await prisma.siteScanResult.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETED",
          overallScore: result.primary.overallScore,
          technicalSEOScore: result.primary.technicalSEO.score,
          domainTrustScore: result.primary.domainTrust.score,
          performanceScore: result.primary.performance?.performanceScore ?? null,
          visualScore: result.primary.visual
            ? Math.round(
                (result.primary.visual.designTrust.score + result.primary.visual.cta.score +
                  result.primary.visual.valueClarity.score) / 3
              )
            : null,
          fullReport: result as any,
          completedAt: new Date(),
        },
      });

      // إشعار "خلص فحص الموقع" - بالظبط الحالة اللي المستخدم ممكن يكون
      // خرج من الصفحة وسايبه يشتغل لوحده في الخلفية (الفحص بياخد نص دقيقة+)
      const { pushToActionFeed } = await import("@/lib/actionFeed");
      await pushToActionFeed({
        workspaceId,
        type: "ACCOUNT",
        severity: "LOW",
        title: "فحص الموقع خلص",
        description: `النتيجة الإجمالية: ${result.primary.overallScore}/100`,
        linkUrl: `/dashboard/site-scan`,
      });
    } catch (err) {
      console.error(`فشل الفحص العميق للرابط ${url}:`, err);
      await prisma.siteScanResult.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "خطأ غير معروف",
          completedAt: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ scanId: scan.id, status: "PENDING" }, { status: 202 });
}
