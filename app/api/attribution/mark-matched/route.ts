// app/api/attribution/mark-matched/route.ts
//
// لما كود Ref يتلاقي فعلياً في رسالة واتساب - إسناد مؤكد 100%، مفيش
// داعي لمحرك التوزيع الاحتمالي هنا. بنسجّل AttributionResult من نوع
// VERIFIED للشفافية الكاملة.
//
// 🔴 إصلاح جذري: اكتشفنا إن MetricSnapshot.verifiedConversions كان
// بيتكتب صفر دائماً وقت المزامنة اليومية (للتلاتة منصات)، ومفيش أي
// مكان تاني في المشروع كله بيحدّثه برقم حقيقي بعد كده - يعني "التحقق"
// (جوهر المنتج كله) ماكانش بيوصل فعلياً لأي رقم معروض. هنا بالظبط
// نقطة التحقق الحقيقية (كود Ref اتلاقى في رسالة واتساب فعلية) - لازم
// تزوّد الرقم الحقيقي في نفس اللحظة دي.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInternalServiceAuth } from "@/lib/internalServiceAuth";

export async function POST(req: NextRequest) {
  if (!verifyInternalServiceAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, code, conversationId, receivedAt, platform, campaignId } = body;

  if (!workspaceId || !code || !conversationId || !receivedAt || !platform) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  await prisma.unmatchedClick.updateMany({
    where: { workspaceId, code, matched: false },
    data: { matched: true },
  });

  // 🔴 إصلاح باگ عد مزدوج حقيقي: كان upsert بيتفحص، لكن الزيادة تحت
  // كانت بتحصل دائماً بغض النظر - لو نفس المحادثة وصلت هنا مرتين (إعادة
  // محاولة webhook بعد timeout مثلاً)، كان العداد بيزيد مرتين لنفس
  // العميل الحقيقي الواحد. لازم نعرف هل ده أول مرة فعلاً قبل ما نزوّد.
  const existing = await prisma.attributionResult.findUnique({ where: { conversationId } });
  const isGenuinelyNew = !existing;

  await prisma.attributionResult.upsert({
    where: { conversationId },
    create: {
      workspaceId,
      conversationId,
      receivedAt: new Date(receivedAt),
      attributionType: "VERIFIED",
      probabilityDistribution: { [platform]: 1.0 },
      primarySignal: null,
    },
    update: {},
  });

  // الإصلاح الجذري - زيادة رقم التحويل المؤكد الحقيقي على نفس صف اليوم
  // اللي المزامنة اليومية كانت عاملاه بصفر. لو الصف مش موجود لسه (نادر -
  // مثلاً الرسالة وصلت قبل أول مزامنة يومية للحملة دي)، منعملش حاجة
  // بدل ما نفشل بصمت أو ننشئ صف ناقص البيانات التانية (impressions/cost)
  // + لازم يكون فعلاً أول مرة (مش إعادة معالجة نفس المحادثة)
  if (campaignId && isGenuinelyNew) {
    const receivedDate = new Date(receivedAt);
    const dayStart = new Date(receivedDate.getFullYear(), receivedDate.getMonth(), receivedDate.getDate());

    await prisma.metricSnapshot.updateMany({
      where: {
        workspaceId,
        platform,
        campaignId,
        date: dayStart,
        placementBreakdown: "ALL",
        placementDetail: "ALL",
      },
      data: { verifiedConversions: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}
