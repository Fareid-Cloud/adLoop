
import { t } from "@/lib/i18n/dictionary";// lib/messengerLeadQuality.ts
//
// المشكلة اللي وصفتها بالظبط: ضغطة بالخطأ على إعلان بتوصّل رسالة تلقائية
// لماسنجر الصفحة، وبتتحسب "ليد" عند ميتا رغم إن الشخص مش قاصد يتواصل
// خالص. الفرق عن فجوة جوجل: هناك السؤال "وصلت محادثة فعلاً؟" - هنا
// المحادثة وصلت بالفعل، لكن السؤال الحقيقي "الشخص ده قاصد يتواصل ولا لأ؟"
// - مشكلة نية (Intent)، مش مشكلة وجود (Existence).
//
// الحل: بنستخدم إشارات تفاعل حقيقية (مش افتراض) - محادثة مفتوحة بس من
// غير أي رد بشري حقيقي من الشخص نفسه (بعد الرسالة التلقائية اللي بيبعتها
// الإعلان) هي أقوى إشارة على "ضغطة بالخطأ"، مش تواصل حقيقي.

export interface MessengerConversation {
  conversationId: string;
  hasAutomatedGreeting: boolean; // هل أول رسالة كانت الرسالة التلقائية اللي الإعلان بيبعتها
  humanRepliesCount: number; // كام رسالة فعلياً كتبها الشخص نفسه (مش الرد التلقائي)
  minutesSinceLastActivity: number; // قد إيه من وقت آخر نشاط في المحادثة
}

export interface LeadQualityResult {
  conversationId: string;
  isLikelyAccidental: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  /** مفتاح الرسالة ومتغيّراتها - النصّ أعلاه احتياطيّ عربي فقط. */
  reasonKey: string;
  reasonVars?: Record<string, string | number>;
}

// لو المحادثة اتفتحت من أكتر من ساعتين وصفر رد بشري حقيقي، الاحتمال
// الأقوى إنها ضغطة بالخطأ - مش قرار فوري (بنسيب وقت معقول للشخص يرد لو
// كان قاصد فعلاً، مش نحكم عليه من أول دقيقة). 120 هنا افتراضي بس - كل
// Workspace يقدر يعدّله من الإعدادات (messengerInactivityThresholdMinutes)
const DEFAULT_INACTIVITY_THRESHOLD_MINUTES = 120;

export function assessLeadQuality(
  conversation: MessengerConversation,
  inactivityThresholdMinutes: number = DEFAULT_INACTIVITY_THRESHOLD_MINUTES
): LeadQualityResult {
  const base = { conversationId: conversation.conversationId };

  // إشارة قوية جداً: مفيش رد بشري خالص، والمحادثة فاتت عليها وقت كافي
  if (
    conversation.humanRepliesCount === 0 &&
    conversation.minutesSinceLastActivity >= inactivityThresholdMinutes
  ) {
    return {
      ...base,
      isLikelyAccidental: true,
      confidence: "HIGH",
      reason: t("ar", "alerts.msgAccidental", { hours: Math.round(conversation.minutesSinceLastActivity / 60) }),
      reasonKey: "alerts.msgAccidental",
      reasonVars: { hours: Math.round(conversation.minutesSinceLastActivity / 60) },
    };
  }

  // إشارة متوسطة: مفيش رد بس لسه بدري نحكم (أقل من ساعتين)
  if (conversation.humanRepliesCount === 0) {
    return {
      ...base,
      isLikelyAccidental: false, // لسه منقدرش نجزم - منحسبهاش "عرضية" قبل ما الوقت يعدي
      confidence: "LOW",
      reason: t("ar", "alerts.msgTooEarly"),
      reasonKey: "alerts.msgTooEarly",
    };
  }

  // فيه رد بشري حقيقي واحد على الأقل - ده تواصل حقيقي، مهما كان قصير
  return {
    ...base,
    isLikelyAccidental: false,
    confidence: "HIGH",
    reason: t("ar", "alerts.msgGenuine"),
    reasonKey: "alerts.msgGenuine",
  };
}

// بيفحص مجموعة محادثات مرة واحدة، ويرجّع بس العدد الحقيقي (بعد استبعاد
// المحادثات اللي الاحتمال الأقوى إنها ضغطات بالخطأ) - ده الرقم اللي
// المفروض يتسجل كـ verifiedConversions، مش عدد المحادثات الخام
export function countGenuineLeads(
  conversations: MessengerConversation[],
  inactivityThresholdMinutes: number = DEFAULT_INACTIVITY_THRESHOLD_MINUTES
): {
  genuineCount: number;
  likelyAccidentalCount: number;
  pendingCount: number; // لسه محتاجة وقت قبل ما نحكم عليها
} {
  let genuineCount = 0;
  let likelyAccidentalCount = 0;
  let pendingCount = 0;

  for (const conv of conversations) {
    const result = assessLeadQuality(conv, inactivityThresholdMinutes);
    if (result.isLikelyAccidental) likelyAccidentalCount++;
    else if (result.confidence === "LOW") pendingCount++;
    else genuineCount++;
  }

  return { genuineCount, likelyAccidentalCount, pendingCount };
}

// ==================== الحلقة المفقودة - الوصل الفعلي بقاعدة البيانات ====================
// دي الدالة اللي كانت ناقصة من الأول - assessLeadQuality كانت موجودة
// من زمان بس صفر استدعاء ليها في المشروع كله. هنا بنقيّم كل محادثة
// عدّت عليها فترة كافية (مش مقيّمة قبل كده)، ولو تواصل حقيقي، بنزوّد
// verifiedConversions فعلياً - نفس مبدأ إصلاح الواتساب بالظبط.
export async function assessAndVerifyMessengerConversationsForWorkspace(workspaceId: string) {
  const { prisma } = await import("@/lib/prisma");

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const inactivityThreshold = workspace?.messengerInactivityThresholdMinutes ?? DEFAULT_INACTIVITY_THRESHOLD_MINUTES;

  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - inactivityThreshold);

  const pending = await prisma.messengerConversation.findMany({
    where: { workspaceId, assessed: false, lastMessageAt: { lte: cutoff } },
  });

  for (const conv of pending) {
    // humanRepliesCount تقريب معقول: messageCount - 1 (أول رسالة هي
    // اللي بتحمل referral.ad_id، وممكن تكون رد فعل تلقائي على الإعلان
    // نفسه مش رسالة "حقيقية" مقصودة - الردود اللي بعدها هي الدليل الأقوى)
    const result = assessLeadQuality(
      {
        conversationId: conv.id,
        hasAutomatedGreeting: true, // كل محادثات Click-to-Messenger بتبدأ بالسياق ده افتراضياً
        humanRepliesCount: Math.max(0, conv.messageCount - 1),
        minutesSinceLastActivity: (Date.now() - conv.lastMessageAt.getTime()) / 60000,
      },
      inactivityThreshold
    );

    if (result.confidence === "LOW") continue; // لسه بدري، هنحاول تاني بعدين

    await prisma.messengerConversation.update({
      where: { id: conv.id },
      data: { assessed: true, verified: !result.isLikelyAccidental },
    });

    if (!result.isLikelyAccidental && conv.campaignId) {
      // نفس علاج الواتساب: التحقّق يُكتب على `ConversionVerification` بـ`upsert`
      // لا على صفّ `MetricSnapshot` المجمَّع الذي قد لا يوجد. ومفتاح اليوم من
      // شريحة UTC (عمود `@db.Date`) لا من `new Date(y,m,d)` بتوقيت الخادم.
      const dayStart = new Date(conv.firstMessageAt.toISOString().slice(0, 10));
      // ماسنجر وحده يحمل معرّف الإعلان (`referral.ad_id` محفوظ على المحادثة)،
      // فيصل التحقّق إلى مستوى الإبداع لا الحملة وحدها (GAP-1). وحين لا
      // يُعرَف يبقى `"ALL"` فيُحسَب على الحملة - لا يُخمَّن إعلانٌ بعينه.
      const adId = conv.adId ?? "ALL";
      await prisma.conversionVerification.upsert({
        where: {
          workspaceId_platform_campaignId_date_adId: {
            workspaceId, platform: "META_ADS", campaignId: conv.campaignId, date: dayStart, adId,
          },
        },
        create: {
          workspaceId, platform: "META_ADS", campaignId: conv.campaignId,
          date: dayStart, adId, verifiedCount: 1,
        },
        update: { verifiedCount: { increment: 1 } },
      });
    }
  }
}
