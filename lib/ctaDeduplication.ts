// lib/ctaDeduplication.ts
//
// المشكلة: زائر واحد بيدوس زرار واتساب، مش راضي، بيدوس زرار الاتصال كمان -
// من غير الحل ده، المنصة (أو حتى نظامنا) ممكن يسجلهم كـ 2 تحويل منفصلين
// لعميل واحد بس. الحل: كل زائر بياخد sessionId ثابت طول زيارته (كوكي من
// الطرف الأول)، وكل ضغطة CTA بتتسجل بنفس الـ id ده. لما أول إشارة تحقق
// حقيقية توصل (رسالة واتساب فعلية، مكالمة اتسجلت، فورم اتبعت)، النظام
// بيتأكد إن الجلسة دي ماحدش سبق واعتبرها "تحويل" قبل كده، وبعدين بس
// بيسجلها كتحويل واحد - أي إشارة تانية بعد كده لنفس الجلسة بتتسجل كلمسة
// إضافية للتحليل ("العميل جرب واتساب وبعدين اتصل")، مش تحويل جديد يضاعف
// الرقم.

import { prisma } from "@/lib/prisma";

export type CtaType = "WHATSAPP" | "CALL" | "FORM";

// بيُستدعى مع كل ضغطة CTA (بغض النظر عن نوعها) - مجرد تسجيل خام للتحليل،
// مش بيقرر تحويل ولا لأ
export async function recordCtaClick(params: {
  workspaceId: string;
  sessionId: string;
  gclid?: string;
  clickPlatform?: string;
  campaignId?: string;
  ctaType: CtaType;
  userAgent?: string;
}) {
  await prisma.ctaClickEvent.create({
    data: {
      workspaceId: params.workspaceId,
      sessionId: params.sessionId,
      gclid: params.gclid,
      clickPlatform: params.clickPlatform as any,
      campaignId: params.campaignId,
      ctaType: params.ctaType,
      userAgent: params.userAgent,
    },
  });
}

export interface ConversionResolution {
  isNewConversion: boolean; // true = أول مرة الجلسة دي بتتحول، سجّلها في verifiedConversions
  totalTouchpoints: number; // كام قناة الزائر جرب قبل ما يتحول (مفيد كـ insight)
}

// عدد الأيام اللي بنفتش فيها عن نفس رقم الهاتف قبل ما نعتبره عميل جديد -
// شخص اتصل الشهر اللي فات وعاد تاني الشهر ده غالباً استفسار جديد فعلاً،
// مش نفس التحويل بيتكرر - فالنافذة محدودة، مش أبد الدهر
const PHONE_DEDUP_WINDOW_DAYS = 30;

// بيُستدعى بس لما إشارة تحقق حقيقية توصل (مش مجرد ضغطة) - رسالة واتساب
// فعلية وصلت، مكالمة اتسجلت، فورم اتبعت. القرار النهائي "ده تحويل جديد
// ولا لأ" بيتاخد هنا، بشكل آمن من الـ Race Conditions عن طريق
// unique constraint على قاعدة البيانات نفسها (نفس مبدأ ProcessedWebhookEvent).
//
// طبقة إضافية (phoneNumber): sessionId بيمنع التكرار جوه نفس الزيارة/الجهاز
// بس - لو نفس الشخص جه تاني من جهاز مختلف (موبايل بعد كمبيوتر)، هياخد
// sessionId جديد تماماً ومنقدرش نمسكه بالطريقة القديمة. لو رقم الهاتف
// متاح (من رسالة واتساب فعلية)، بنفحصه كمان كخط دفاع تاني.
export async function resolveSessionConversion(
  workspaceId: string,
  sessionId: string,
  ctaType: CtaType,
  phoneNumber?: string
): Promise<ConversionResolution> {
  const totalTouchpoints = await prisma.ctaClickEvent.count({
    where: { workspaceId, sessionId },
  });

  // الفحص الأول (لو رقم الهاتف متاح): هل نفس الرقم ده اتحول قبل كده
  // خلال آخر 30 يوم من جهاز/جلسة تانية؟ - فحص على مستوى التطبيق، مش
  // unique constraint، لأن رقم الهاتف مش متاح دايماً (nullable) ومعدل
  // وصول التحويلات هنا أبطأ بطبيعته (بشري، مش نقرات آلية) فمخاطر الـ
  // race condition أقل بكتير من فحص الـ sessionId
  if (phoneNumber) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - PHONE_DEDUP_WINDOW_DAYS);

    const existingByPhone = await prisma.sessionConversion.findFirst({
      where: { workspaceId, phoneNumber, convertedAt: { gte: windowStart } },
    });

    if (existingByPhone) {
      return { isNewConversion: false, totalTouchpoints };
    }
  }

  try {
    await prisma.sessionConversion.create({
      data: { workspaceId, sessionId, firstCtaType: ctaType, phoneNumber },
    });
    // نجح التسجيل = أول مرة الجلسة دي بتتحول فعلياً
    return { isNewConversion: true, totalTouchpoints };
  } catch (err: any) {
    if (err?.code === "P2002") {
      // الجلسة دي اتحوّلت قبل كده بقناة تانية - الإشارة دي لمسة إضافية بس،
      // مش تحويل جديد. منضربش الرقم، ومنرميش خطأ برضو - ده سلوك متوقع
      return { isNewConversion: false, totalTouchpoints };
    }
    throw err; // أي خطأ تاني (قاعدة البيانات واقعة مثلاً) لازم يظهر
  }
}

// تحليل مفيد: توزيع "قد إيه زائر جرب قناة واحدة بس مقابل أكتر من قناة
// قبل ما يتحول" - بيوري هل فيه احتكاك حقيقي (الناس مضطرة تجرب أكتر من
// طريقة عشان توصلك) يستاهل الانتباه
export async function getMultiTouchRate(
  workspaceId: string,
  since: Date
): Promise<{ singleTouch: number; multiTouch: number; multiTouchRatePct: number }> {
  const conversions = await prisma.sessionConversion.findMany({
    where: { workspaceId, convertedAt: { gte: since } },
    select: { sessionId: true },
  });

  let singleTouch = 0;
  let multiTouch = 0;

  for (const conv of conversions) {
    const clickCount = await prisma.ctaClickEvent.count({
      where: { workspaceId, sessionId: conv.sessionId },
    });
    if (clickCount > 1) multiTouch++;
    else singleTouch++;
  }

  const total = singleTouch + multiTouch;
  const multiTouchRatePct = total > 0 ? Math.round((multiTouch / total) * 100) : 0;

  return { singleTouch, multiTouch, multiTouchRatePct };
}
