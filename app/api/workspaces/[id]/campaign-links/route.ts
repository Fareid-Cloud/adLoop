// app/api/workspaces/[id]/campaign-links/route.ts

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { backfillHistoricalData } from "@/lib/syncGoogleAds";
import { computeSmartDefaults } from "@/lib/dashboardDefaults";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const links = await prisma.campaignLink.findMany({ where: { workspaceId: id } });
  return NextResponse.json({ links });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // لازم نتأكد إن الـ Workspace ده فعلاً ملك المستخدم قبل أي تعديل - نفس
  // مبدأ التحقق من الملكية اللي حددناه في الـ ADR §7
  const workspace = await prisma.workspace.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { campaigns } = await req.json();
  // campaigns: Array<{ platform, externalAccountId, externalCampaignId, campaignName }>

  if (!Array.isArray(campaigns)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // هل ده أول ربط فعلي للـ Workspace ده؟ (مفيش بيانات مجمّعة قبل كده) -
  // لو أيوه، هنسحب آخر 90 يوم في الخلفية بعد الرد، عشان الحساب ميبدأش
  // من صفر لو أصلاً فيه كامبينز شغالة من زمان
  const hasExistingData = await prisma.metricSnapshot.findFirst({
    where: { workspaceId: id },
    select: { id: true },
  });
  const isFirstLink = !hasExistingData;

  // بنمسح الاختيار القديم ونكتب الجديد - أبسط وأوضح من محاولة نحسب الفرق
  // (diff) بين القديم والجديد، ومقبول هنا لأن العدد صغير (كامبينز مش آلاف الصفوف)
  const activePlatforms = [...new Set(campaigns.map((c: any) => c.platform))] as string[];
  const visibleMetrics = computeSmartDefaults(workspace.industryVertical, activePlatforms);

  await prisma.$transaction([
    prisma.campaignLink.deleteMany({ where: { workspaceId: id } }),
    prisma.campaignLink.createMany({
      data: campaigns.map((c: any) => ({
        workspaceId: id,
        platform: c.platform,
        externalAccountId: c.externalAccountId,
        externalCampaignId: c.externalCampaignId,
        campaignName: c.campaignName,
      })),
    }),
    // إصلاح TODO حقيقي: كانت visibleMetrics بتتحسب مرة واحدة بس وقت
    // إنشاء الـWorkspace (بمنصات فاضية، قبل أي ربط حقيقي)، ومعملهاش
    // إعادة حساب بعد كده - يعني الاختيار "الذكي" فضل عالق على تخمين
    // أولي للأبد حتى بعد ربط منصات حقيقية
    prisma.workspace.update({
      where: { id: id },
      data: { visibleMetrics },
    }),
  ]);

  if (isFirstLink && campaigns.some((c: any) => c.platform === "GOOGLE_ADS")) {
    // after() بتضمن إن السيرفر يفضل شغال لحد ما الاسترجاع يخلص، من غير
    // ما نأخّر الرد اللي المستخدم مستني يشوفه فوراً (Next.js 15.1+)
    after(async () => {
      try {
        await backfillHistoricalData(id);
      } catch (err) {
        console.error(`فشل استرجاع البيانات القديمة للـ Workspace ${id}:`, err);
      }
    });
  }

  return NextResponse.json({
    success: true,
    count: campaigns.length,
    backfillTriggered: isFirstLink,
  });
}
