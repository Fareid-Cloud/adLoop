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

  // منع التكرار **ذرّياً** عبر قيد `conversationId` الفريد، لا بفحصٍ ثمّ
  // تصرّفٍ منفصلَين. الشكل القديم (`findUnique` ثمّ increment) كان يترك
  // نافذةً بين القراءة والكتابة: تسليمان متزامنان لنفس المحادثة (إعادة
  // إرسال webhook بعد timeout) يقرآن كلاهما "غير موجود" فيزيدان العدّاد
  // مرّتين لعميلٍ واحد. هنا: `create` ينجح مرّةً واحدة، والثانية تسقط على
  // `P2002` فلا تزيد شيئاً. والعلامة والزيادة في `$transaction` واحدة:
  // انهيارٌ بينهما لا يترك محادثةً معلَّمةً بلا عدّها، ولا العكس.
  //
  // 🔴 قيدٌ معماريٌّ موثَّق (لم يُصلَح هنا عمداً): الزيادة على
  // `MetricSnapshot` المقسَّم بالـplacement تفشل لميتا (لا صفّ `ALL`)،
  // وللمزامنة نفس-اليوم في جوجل (لا صفّ لليوم بعد). العلاج الصحيح جدولُ
  // تحقّقٍ مستقلٌّ يُجمَع منه القرّاء - تغييرٌ يلمس المخطَّط والقاعدة
  // المشتركة، ومحجوزٌ خلف إرسال التراكر لـ`campaignId` (لا يُرسَل اليوم).
  // فهذه الدالة صارت الآن **صحيحةً في الذرّية ومنع التكرار**، ويبقى مكان
  // تخزين الرقم قراراً معلَّقاً بمراجعةٍ على بيئةٍ تجريبية.
  const receivedDate = new Date(receivedAt);
  // مفتاح اليوم من شريحة UTC صريحة لا من توقيت الخادم المحلّي: عمود
  // `MetricSnapshot.date` هو `@db.Date` بمنتصف ليل UTC، وبناؤه بـ
  // `new Date(y,m,d)` على مضيفٍ غير UTC ينتج يوماً مختلفاً فلا يطابق.
  const dayStart = new Date(receivedDate.toISOString().slice(0, 10));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.attributionResult.create({
        data: {
          workspaceId,
          conversationId,
          receivedAt: receivedDate,
          attributionType: "VERIFIED",
          probabilityDistribution: { [platform]: 1.0 },
          primarySignal: null,
        },
      });

      if (campaignId) {
        await tx.metricSnapshot.updateMany({
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
    });
  } catch (err: any) {
    // تسليمٌ مكرَّر لمحادثةٍ عُولِجت سلفاً: نجاحٌ بلا تكرار أثر.
    if (err?.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
