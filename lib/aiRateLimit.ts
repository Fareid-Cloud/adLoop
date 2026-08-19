// lib/aiRateLimit.ts
//
// رصيد شهري (150 مرة، تقريباً 5/يوم بالمتوسط)، بس موزّع بحد أقصى ساعي
// (مرتين في الساعة) عشان محدش يستهلك الرصيد كله دفعة واحدة في نص ساعة
// ويفضل من غير أي رصيد لباقي الشهر. لو حد محتاجها فعلاً أكتر، بيقدر
// يستنى شوية بدل ما نمنعه نهائياً.

import { prisma } from "@/lib/prisma";
import { checkCredits, consumePurchasedCreditIfNeeded, getEntitlements } from "@/lib/entitlements";
import { isOwnerEmail } from "@/lib/owner";

// إعادة معايرة عشان نضمن سقف التكلفة الشهري لكل مشترك عبر التلاتة ميزات.
// ⚠️ الأرقام هنا **عدد نداءات** لا دولارات - وتكلفة النداء الواحد ارتفعت
// بتشغيل التفكير (٧ أغسطس ٢٠٢٦)، فالسقف صار ~$5 بنفس هذه الحدود.
// الرقم الحاليّ وتفصيله في `docs/claude-api-usage-map.md` - حدِّثه هناك،
// فرقمٌ قديمٌ في تعليقٍ هنا أضلُّ من ألّا يكون تعليق.
// اللي بتستخدم Claude (راجع docs/claude-api-usage-map.md للحساب الكامل)
// الحد اليدوي = 80 مرة شهرياً + استدعاء تلقائي واحد يومياً (Cron) = 20-30/شهر تقريباً
// **سقف تقني لا تجاري.** يضمن ألّا تتجاوز كلفة Claude لمشترك واحد الحدّ
// المرصود (راجع docs/claude-api-usage-map.md)، ويُطبَّق فوق حدّ الباقة.
// الفعليّ = الأقلّ بين الاثنين.
export const MONTHLY_LIMIT = 80;
const HOURLY_LIMIT = 2;

export interface QuotaResult {
  allowed: boolean;
  remainingThisMonth: number;
  /** `disabled` = إيقاف عامّ من لوحة المالك، مش نفاد رصيد. الفرق مهمّ:
   *  الأول مؤقّت ومش ذنب المستخدم، والتاني بيتحلّ بترقية. */
  reason?: "monthly_exhausted" | "hourly_exhausted" | "disabled";
  retryAfterMinutes?: number; // لو اترفض بسبب الحد الساعي، تقول له يستنى قد إيه
}

/**
 * مفتاح الإيقاف العامّ للذكاء الاصطناعي.
 *
 * **بيتفحص هنا مش في كل مسار على حدة**: التلات مسارات (التحليلات، مربّع
 * السؤال، فحص الصور) بتعدّي كلها من دوال الرصيد دي، فالفحص هنا بيغطّيهم
 * الأربعة بضمانة إن أي مسار AI جديد يستخدم الرصيد بيتغطّى تلقائياً -
 * وده بالظبط النوع اللي بيُنسى لو الفحص كان متكرّر في كل مسار.
 */
async function aiGloballyEnabled(): Promise<boolean> {
  const { isFeatureEnabled } = await import("@/lib/featureFlags");
  return isFeatureEnabled("ai.insights");
}

const AI_DISABLED: QuotaResult = { allowed: false, remainingThisMonth: 0, reason: "disabled" };

/**
 * هل خدمة الذكاء الاصطناعي مضبوطة أصلاً؟
 *
 * 🔴 **بلا هذا الفحص كان الرصيد يُخصَم ولو لم يكن هناك مفتاح خالص.**
 * الخصم يسبق النداء، والنداء يفشل عند أوّل سطر لأنّ المفتاح غائب - فيبقى
 * العدّاد مرتفعاً مقابل تحليلٍ لم يُطلَب من أحد. لا سبيل للمستخدم أن يعرف،
 * ولا سبيل له أن يستردّ.
 */
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * ردّ رصيد تحليلٍ خُصِم ثمّ لم يُسلَّم.
 *
 * الخصم يسبق النداء عمداً (نداءٌ بلا خصمٍ مسبق يفتح باب تشغيلٍ متوازٍ بلا
 * سقف)، فالردّ هو ما يصحّح الحساب حين يفشل النداء لعطلٍ عندنا أو عند
 * المزوّد - رصيدٌ نفد، مفتاحٌ غير صالح، انقطاعُ خدمة. المستخدم لا يدفع
 * ثمن ما لم يصله.
 */
/**
 * مطالبةٌ ذرّيةٌ بحصّة: تُمنَح أو لا تُمنَح، بلا نافذةٍ بينهما.
 *
 * 🔴 **كان النمط: اقرأ العدّاد، افحصه في الذاكرة، ثمّ اكتب `العدد + 1`.**
 * وبين القراءة والكتابة يمرّ طلبٌ آخر: نداءان متوازيان عند الحدّ يقرآن
 * الرقم نفسَه، فيُسمَح للاثنين، وينادي كلاهما المزوّد - ثمّ تتصادم
 * الكتابتان فيستقرّ العدّاد على قيمةٍ أقلّ، فيُسمَح لثالثٍ بعدهما.
 *
 * أي أنّ الحدّ الذي بيع للعميل لا يحدّ فاتورةَ المزوّد. وهذا مالٌ يُنفَق
 * خارج ما بيع، لا مجرّد تجاوزِ عدّاد.
 *
 * والعلاج شرطٌ داخل جملة التحديث نفسِها: `increment` ذرّيّ في قاعدة
 * البيانات، و`lt` يُقيَّم في الجملة عينها - فإن سبقنا غيرُنا إلى آخر
 * حصّةٍ عاد التحديث بصفر صفوف، وهو رفضٌ صريح لا تخمين.
 */
async function claimQuotaAtomically(o: {
  userId: string;
  now: Date;
  monthlyCountField: string;
  monthlyResetField: string;
  monthlyLimit: number;
  prevMonthlyReset: Date;
  isNewMonth: boolean;
  hourlyCountField: string;
  hourlyResetField: string;
  hourlyLimit: number;
  prevHourlyReset: Date;
  isNewHour: boolean;
}): Promise<boolean> {
  // تدوير الشهر/الساعة بمقارنةٍ وتبديل: الشرط على قيمة الضبط السابقة، فلا
  // يصفّر العدّادَ إلّا أوّلُ من يصل - ومن يليه يجد الضبط قد تغيّر فيتخطّى.
  if (o.isNewMonth) {
    await prisma.user.updateMany({
      where: { id: o.userId, [o.monthlyResetField]: o.prevMonthlyReset } as never,
      data: { [o.monthlyCountField]: 0, [o.monthlyResetField]: o.now } as never,
    });
  }
  if (o.isNewHour) {
    await prisma.user.updateMany({
      where: { id: o.userId, [o.hourlyResetField]: o.prevHourlyReset } as never,
      data: { [o.hourlyCountField]: 0, [o.hourlyResetField]: o.now } as never,
    });
  }

  const claimed = await prisma.user.updateMany({
    where: {
      id: o.userId,
      [o.monthlyCountField]: { lt: o.monthlyLimit },
      [o.hourlyCountField]: { lt: o.hourlyLimit },
    } as never,
    data: {
      [o.monthlyCountField]: { increment: 1 },
      [o.hourlyCountField]: { increment: 1 },
    } as never,
  });
  return claimed.count === 1;
}

export async function refundAiRefreshQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, aiRefreshMonthlyCount: true, aiRefreshHourlyCount: true },
  });
  if (!user || isOwnerEmail(user.email)) return; // المالك لم يُخصَم منه أصلاً
  // إنقاصٌ ذرّيّ مشروط: استردادان متوازيان بالنمط القديم يقرآن الرقم
  // نفسه فينقص واحداً - فيخسر العميل حصّةً دفع ثمنها ولم تُستهلك.
  // والشرط `gt: 0` يمنع النزول تحت الصفر بلا قراءةٍ سابقة.
  await prisma.user.updateMany({
    where: { id: userId, aiRefreshMonthlyCount: { gt: 0 } },
    data: { aiRefreshMonthlyCount: { decrement: 1 } },
  });
  await prisma.user.updateMany({
    where: { id: userId, aiRefreshHourlyCount: { gt: 0 } },
    data: { aiRefreshHourlyCount: { decrement: 1 } },
  });
}

export async function checkAndConsumeAIRefreshQuota(
  userId: string
): Promise<QuotaResult> {
  if (!(await aiGloballyEnabled())) return AI_DISABLED;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      aiRefreshMonthlyCount: true,
      aiRefreshMonthlyReset: true,
      aiRefreshHourlyCount: true,
      aiRefreshHourlyReset: true,
    },
  });

  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 **حساب المالك يمرّ بلا خصم - قرارٌ صريح، لا سهو.**
  //
  // الحدود الشهرية مرفوعة أصلاً إلى أعلى باقة في `getEntitlements`، لكن
  // حدّ الساعة حارسُ اندفاع منفصل عن الباقة (فحصٌ واحد في الساعة يصيب
  // عميل الوكالة كما يصيب المجّاني) - وهو ما يقف أمام تجربة المالك
  // لمنتجه: يضغط، يصلح، يعيد، فينتظر ساعة.
  //
  // **وما يترتّب عليه:** لا سقف من جهة المنتج على إنفاق هذا الحساب لدى
  // مزوّد الذكاء الاصطناعي. السقف الوحيد هو رصيد الحساب في كونسول
  // المزوّد نفسه. الاستثناء معلّق ببريدٍ واحد لا بصفة تُمنح، فلا يتوسّع.
  if (isOwnerEmail(user.email)) {
    return { allowed: true, remainingThisMonth: Number.MAX_SAFE_INTEGER };
  }

  // 🔴 كان السقف رقماً واحداً (80) لكلّ المشتركين، فباقة `free` المُعلَن
  // فيها صفر تحليلات كانت تحصل على ثمانين، ورصيد الكريدت المشترى لا
  // يُخصَم منه شيء أبداً. أي أنّ الباقات كانت معروضة بحدود غير موجودة.
  // `checkCredits` هي مصدر الحقيقة لحساب «مخصّص الباقة + المشترى». كتابة
  // الحساب هنا مرّة ثانية تعني رقمين يفترقان عند أوّل تعديل في الباقات.
  const credits = await checkCredits(userId, 0);
  // 🔴 كان `Math.min(MONTHLY_LIMIT, credits.left)`: سقف مسطّح ٨٠ فوق كلّ
  // باقة. فباقة Agency تَعِد بستّمئة تحليل وتُسلّم ثمانين - أي أنّ ما يدفع
  // فيه العميل رقمٌ لا يصل إليه. الرصيد المُعلَن صار هو الرصيد الفعليّ.
  //
  // الحماية من الاستنزاف لم تسقط، انتقلت إلى محلّها: حدّ **معدّل** بالساعة
  // (تحت) يوقف الحلقة الجامحة، بينما السقف الشهريّ يحترم ما بيع فعلاً.
  const effectiveMonthly = credits.left;

  const now = new Date();

  // ==== إعادة ضبط العداد الشهري لو دخلنا شهر جديد ====
  const isNewMonth =
    now.getMonth() !== user.aiRefreshMonthlyReset.getMonth() ||
    now.getFullYear() !== user.aiRefreshMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.aiRefreshMonthlyCount;

  if (monthlyCount >= effectiveMonthly) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  // ==== إعادة ضبط العداد الساعي لو عدت الساعة ====
  const hourDiffMs = now.getTime() - user.aiRefreshHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.aiRefreshHourlyCount;

  if (hourlyCount >= HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil(
      (60 * 60 * 1000 - hourDiffMs) / 60000
    );
    return {
      allowed: false,
      remainingThisMonth: effectiveMonthly - monthlyCount,
      reason: "hourly_exhausted",
      retryAfterMinutes,
    };
  }

  // مطالبةٌ ذرّية: تُمنَح الحصّة أو تُرفَض في جملةٍ واحدة - راجع
  // `claimQuotaAtomically`. والرفض هنا ليس خطأً بل سباقٌ خسرناه: نداءٌ
  // متوازٍ أخذ آخر حصّةٍ بيننا وبين الفحص أعلاه.
  const granted = await claimQuotaAtomically({
    userId,
    now,
    monthlyCountField: "aiRefreshMonthlyCount",
    monthlyResetField: "aiRefreshMonthlyReset",
    monthlyLimit: effectiveMonthly,
    prevMonthlyReset: user.aiRefreshMonthlyReset,
    isNewMonth,
    hourlyCountField: "aiRefreshHourlyCount",
    hourlyResetField: "aiRefreshHourlyReset",
    hourlyLimit: HOURLY_LIMIT,
    prevHourlyReset: user.aiRefreshHourlyReset,
    isNewHour,
  });
  if (!granted) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  // الخصم من الرصيد المشترى يبدأ بعد نفاد مخصّص الباقة وحده - وإلّا كان
  // المستخدم يدفع ثمن رصيد إضافي لا يُستهلك.
  await consumePurchasedCreditIfNeeded(userId, monthlyCount + 1);

  return {
    allowed: true,
    remainingThisMonth: effectiveMonthly - (monthlyCount + 1),
  };
}

// ==================== مربّع السؤال ====================
//
// **الرصيد الشهريّ نفسه، والحدّ الساعيّ مختلف.**
//
// نداء Claude واحد بتكلفة واحدة، فجيبٌ ثانٍ للرصيد الشهريّ كان سيكسر
// الوعد المعلَن في صفحة الباقات («س تحليلاً في الشهر») بأن يجعل الرقم
// الحقيقيّ أكبر ممّا بيع - وهو نقيض ما اتُّفق عليه.
//
// أمّا الحدّ الساعيّ فمرّتان لا تصلح هنا: مَن يسأل سؤالاً ثمّ يستوضح ثمّ
// يسأل عن حملة أخرى قد استنفد ساعته وهو في منتصف تفكيره. اثنتا عشرة
// تكفي محادثةً حقيقية وتظلّ توقف أيّ حلقة جامحة.
const CHAT_HOURLY_LIMIT = 12;

export async function checkAndConsumeChatQuota(userId: string): Promise<QuotaResult> {
  if (!(await aiGloballyEnabled())) return AI_DISABLED;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      aiRefreshMonthlyCount: true,
      aiRefreshMonthlyReset: true,
      aiChatHourlyCount: true,
      aiChatHourlyReset: true,
    },
  });
  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 **حساب المالك يمرّ بلا خصم - قرارٌ صريح، لا سهو.**
  //
  // الحدود الشهرية مرفوعة أصلاً إلى أعلى باقة في `getEntitlements`، لكن
  // حدّ الساعة حارسُ اندفاع منفصل عن الباقة (فحصٌ واحد في الساعة يصيب
  // عميل الوكالة كما يصيب المجّاني) - وهو ما يقف أمام تجربة المالك
  // لمنتجه: يضغط، يصلح، يعيد، فينتظر ساعة.
  //
  // **وما يترتّب عليه:** لا سقف من جهة المنتج على إنفاق هذا الحساب لدى
  // مزوّد الذكاء الاصطناعي. السقف الوحيد هو رصيد الحساب في كونسول
  // المزوّد نفسه. الاستثناء معلّق ببريدٍ واحد لا بصفة تُمنح، فلا يتوسّع.
  if (isOwnerEmail(user.email)) {
    return { allowed: true, remainingThisMonth: Number.MAX_SAFE_INTEGER };
  }

  const credits = await checkCredits(userId, 0);
  const effectiveMonthly = credits.left;
  const now = new Date();

  const isNewMonth =
    now.getMonth() !== user.aiRefreshMonthlyReset.getMonth() ||
    now.getFullYear() !== user.aiRefreshMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.aiRefreshMonthlyCount;

  if (monthlyCount >= effectiveMonthly) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  const hourDiffMs = now.getTime() - user.aiChatHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.aiChatHourlyCount;

  if (hourlyCount >= CHAT_HOURLY_LIMIT) {
    return {
      allowed: false,
      remainingThisMonth: effectiveMonthly - monthlyCount,
      reason: "hourly_exhausted",
      retryAfterMinutes: Math.ceil((60 * 60 * 1000 - hourDiffMs) / 60000),
    };
  }

  // مطالبةٌ ذرّية: تُمنَح الحصّة أو تُرفَض في جملةٍ واحدة - راجع
  // `claimQuotaAtomically`. والرفض هنا ليس خطأً بل سباقٌ خسرناه: نداءٌ
  // متوازٍ أخذ آخر حصّةٍ بيننا وبين الفحص أعلاه.
  const granted = await claimQuotaAtomically({
    userId,
    now,
    monthlyCountField: "aiRefreshMonthlyCount",
    monthlyResetField: "aiRefreshMonthlyReset",
    monthlyLimit: effectiveMonthly,
    prevMonthlyReset: user.aiRefreshMonthlyReset,
    isNewMonth,
    hourlyCountField: "aiChatHourlyCount",
    hourlyResetField: "aiChatHourlyReset",
    hourlyLimit: CHAT_HOURLY_LIMIT,
    prevHourlyReset: user.aiChatHourlyReset,
    isNewHour,
  });
  if (!granted) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  await consumePurchasedCreditIfNeeded(userId, monthlyCount + 1);

  return { allowed: true, remainingThisMonth: effectiveMonthly - (monthlyCount + 1) };
}

// ==================== فحص جودة صور الإعلانات ====================
// كانت من غير أي حد أقصى خالص - ثغرة مالية حقيقية. 30/شهر، 5/ساعة
// (سقف أعلى نسبياً - فحص إعلانات كتير مرة واحدة استخدام شرعي متوقّع)
const IMAGE_QUALITY_MONTHLY_LIMIT = 30;
const IMAGE_QUALITY_HOURLY_LIMIT = 5;

/** ردّ فحص صورةٍ خُصِم ولم يُسلَّم - نفس مبدأ `refundAiRefreshQuota` */
export async function refundImageQualityQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, imageQualityMonthlyCount: true, imageQualityHourlyCount: true },
  });
  if (!user || isOwnerEmail(user.email)) return;
  // إنقاصٌ ذرّيّ مشروط: استردادان متوازيان بالنمط القديم يقرآن الرقم
  // نفسه فينقص واحداً - فيخسر العميل حصّةً دفع ثمنها ولم تُستهلك.
  // والشرط `gt: 0` يمنع النزول تحت الصفر بلا قراءةٍ سابقة.
  await prisma.user.updateMany({
    where: { id: userId, imageQualityMonthlyCount: { gt: 0 } },
    data: { imageQualityMonthlyCount: { decrement: 1 } },
  });
  await prisma.user.updateMany({
    where: { id: userId, imageQualityHourlyCount: { gt: 0 } },
    data: { imageQualityHourlyCount: { decrement: 1 } },
  });
}

export async function checkAndConsumeImageQualityQuota(userId: string): Promise<QuotaResult> {
  if (!(await aiGloballyEnabled())) return AI_DISABLED;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      imageQualityMonthlyCount: true,
      imageQualityMonthlyReset: true,
      imageQualityHourlyCount: true,
      imageQualityHourlyReset: true,
    },
  });
  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 **حساب المالك يمرّ بلا خصم - قرارٌ صريح، لا سهو.**
  //
  // الحدود الشهرية مرفوعة أصلاً إلى أعلى باقة في `getEntitlements`، لكن
  // حدّ الساعة حارسُ اندفاع منفصل عن الباقة (فحصٌ واحد في الساعة يصيب
  // عميل الوكالة كما يصيب المجّاني) - وهو ما يقف أمام تجربة المالك
  // لمنتجه: يضغط، يصلح، يعيد، فينتظر ساعة.
  //
  // **وما يترتّب عليه:** لا سقف من جهة المنتج على إنفاق هذا الحساب لدى
  // مزوّد الذكاء الاصطناعي. السقف الوحيد هو رصيد الحساب في كونسول
  // المزوّد نفسه. الاستثناء معلّق ببريدٍ واحد لا بصفة تُمنح، فلا يتوسّع.
  if (isOwnerEmail(user.email)) {
    return { allowed: true, remainingThisMonth: Number.MAX_SAFE_INTEGER };
  }

  // 🔴 كان السقف رقماً واحداً (80) لكلّ المشتركين، فباقة `free` المُعلَن
  // فيها صفر تحليلات كانت تحصل على ثمانين، ورصيد الكريدت المشترى لا
  // يُخصَم منه شيء أبداً. أي أنّ الباقات كانت معروضة بحدود غير موجودة.
  // `checkCredits` هي مصدر الحقيقة لحساب «مخصّص الباقة + المشترى». كتابة
  // الحساب هنا مرّة ثانية تعني رقمين يفترقان عند أوّل تعديل في الباقات.
  const credits = await checkCredits(userId, 0);
  const effectiveMonthly = Math.min(MONTHLY_LIMIT, credits.left);

  const now = new Date();
  const isNewMonth =
    now.getMonth() !== user.imageQualityMonthlyReset.getMonth() ||
    now.getFullYear() !== user.imageQualityMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.imageQualityMonthlyCount;

  if (monthlyCount >= IMAGE_QUALITY_MONTHLY_LIMIT) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  const hourDiffMs = now.getTime() - user.imageQualityHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.imageQualityHourlyCount;

  if (hourlyCount >= IMAGE_QUALITY_HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil((60 * 60 * 1000 - hourDiffMs) / 60000);
    return { allowed: false, remainingThisMonth: IMAGE_QUALITY_MONTHLY_LIMIT - monthlyCount, reason: "hourly_exhausted", retryAfterMinutes };
  }

  // مطالبةٌ ذرّية: تُمنَح الحصّة أو تُرفَض في جملةٍ واحدة - راجع
  // `claimQuotaAtomically`. والرفض هنا ليس خطأً بل سباقٌ خسرناه: نداءٌ
  // متوازٍ أخذ آخر حصّةٍ بيننا وبين الفحص أعلاه.
  const granted = await claimQuotaAtomically({
    userId,
    now,
    monthlyCountField: "imageQualityMonthlyCount",
    monthlyResetField: "imageQualityMonthlyReset",
    monthlyLimit: effectiveMonthly,
    prevMonthlyReset: user.imageQualityMonthlyReset,
    isNewMonth,
    hourlyCountField: "imageQualityHourlyCount",
    hourlyResetField: "imageQualityHourlyReset",
    hourlyLimit: IMAGE_QUALITY_HOURLY_LIMIT,
    prevHourlyReset: user.imageQualityHourlyReset,
    isNewHour,
  });
  if (!granted) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  return { allowed: true, remainingThisMonth: IMAGE_QUALITY_MONTHLY_LIMIT - (monthlyCount + 1) };
}

// ==================== الفحص العميق لصفحة الهبوط ====================
// كانت من غير أي حد أقصى خالص - أغلى ميزة بالمشروع (4 نداءات Claude
// لكل فحص). 5/شهر، 1/ساعة (فحص عميق فعل نادر ومقصود، مش حاجة تتكرر)
// 🔴 كان رقماً مسطّحاً (5) للجميع، بينما `deepScans` في `PlanLimits` تعطي
// Agency عشرين وPro خمسةً وStarter صفراً. باقةٌ تَعِد بعشرين وتُسلّم خمسةً
// هي الحدّ نفسه الذي أصلحناه في مساحات العمل، في ميزةٍ أغلى: كلّ فحص نداءُ
// ذكاءٍ اصطناعيّ بصور. الحدّ يُقرأ من الباقة الآن.
//
// ولا يُخصَم من رصيد التحليلات: الفحص العميق ميزةٌ بحدّها الخاصّ في جدول
// الباقات، فخصمه من رصيدٍ آخر يعني أنّ استعمال ميزةٍ يستهلك حصّة ميزةٍ
// أخرى - وهو ما لا تقوله صفحة الباقات لأحد.

const SITE_SCAN_HOURLY_LIMIT = 1;

/**
 * ردّ فحصٍ خُصِم ثمّ فشل لسببٍ ليس من صنع المستخدم.
 *
 * الفحص العميق يُخصَم عند البدء لأنّ عمله يجري في الخلفية بعد ردّ الطلب -
 * ولا سبيل لتأجيل الخصم إلى ما بعد النجاح دون فتح باب تشغيل متوازٍ بلا
 * سقف. فالخصم يبقى مقدَّماً، **والردّ هو ما يصحّح الحساب** حين يفشل
 * الفحص لعطلٍ عندنا أو عند مزوّد خارجيّ.
 *
 * الحدّ السفليّ صفر: الفشل مرّتين لا يجعل الرصيد سالباً.
 */
export async function refundSiteScanQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, siteScanMonthlyCount: true, siteScanHourlyCount: true },
  });
  if (!user) return;
  // إنقاصٌ ذرّيّ مشروط: استردادان متوازيان بالنمط القديم يقرآن الرقم
  // نفسه فينقص واحداً - فيخسر العميل حصّةً دفع ثمنها ولم تُستهلك.
  // والشرط `gt: 0` يمنع النزول تحت الصفر بلا قراءةٍ سابقة.
  await prisma.user.updateMany({
    where: { id: userId, siteScanMonthlyCount: { gt: 0 } },
    data: { siteScanMonthlyCount: { decrement: 1 } },
  });
  await prisma.user.updateMany({
    where: { id: userId, siteScanHourlyCount: { gt: 0 } },
    data: { siteScanHourlyCount: { decrement: 1 } },
  });
}

export async function checkAndConsumeSiteScanQuota(userId: string): Promise<QuotaResult> {
  if (!(await aiGloballyEnabled())) return AI_DISABLED;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      siteScanMonthlyCount: true,
      siteScanMonthlyReset: true,
      siteScanHourlyCount: true,
      siteScanHourlyReset: true,
    },
  });
  if (!user) return { allowed: false, remainingThisMonth: 0 };

  // 🔴 **حساب المالك يمرّ بلا خصم - قرارٌ صريح، لا سهو.**
  //
  // الحدود الشهرية مرفوعة أصلاً إلى أعلى باقة في `getEntitlements`، لكن
  // حدّ الساعة حارسُ اندفاع منفصل عن الباقة (فحصٌ واحد في الساعة يصيب
  // عميل الوكالة كما يصيب المجّاني) - وهو ما يقف أمام تجربة المالك
  // لمنتجه: يضغط، يصلح، يعيد، فينتظر ساعة.
  //
  // **وما يترتّب عليه:** لا سقف من جهة المنتج على إنفاق هذا الحساب لدى
  // مزوّد الذكاء الاصطناعي. السقف الوحيد هو رصيد الحساب في كونسول
  // المزوّد نفسه. الاستثناء معلّق ببريدٍ واحد لا بصفة تُمنح، فلا يتوسّع.
  if (isOwnerEmail(user.email)) {
    return { allowed: true, remainingThisMonth: Number.MAX_SAFE_INTEGER };
  }

  // 🔴 كان السقف رقماً واحداً (80) لكلّ المشتركين، فباقة `free` المُعلَن
  // فيها صفر تحليلات كانت تحصل على ثمانين، ورصيد الكريدت المشترى لا
  // يُخصَم منه شيء أبداً. أي أنّ الباقات كانت معروضة بحدود غير موجودة.
  // `checkCredits` هي مصدر الحقيقة لحساب «مخصّص الباقة + المشترى». كتابة
  // الحساب هنا مرّة ثانية تعني رقمين يفترقان عند أوّل تعديل في الباقات.
  const { limits } = await getEntitlements(userId);
  const monthlyLimit = limits.deepScans;

  const now = new Date();
  const isNewMonth =
    now.getMonth() !== user.siteScanMonthlyReset.getMonth() ||
    now.getFullYear() !== user.siteScanMonthlyReset.getFullYear();
  const monthlyCount = isNewMonth ? 0 : user.siteScanMonthlyCount;

  if (monthlyCount >= monthlyLimit) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  const hourDiffMs = now.getTime() - user.siteScanHourlyReset.getTime();
  const isNewHour = hourDiffMs >= 60 * 60 * 1000;
  const hourlyCount = isNewHour ? 0 : user.siteScanHourlyCount;

  if (hourlyCount >= SITE_SCAN_HOURLY_LIMIT) {
    const retryAfterMinutes = Math.ceil((60 * 60 * 1000 - hourDiffMs) / 60000);
    return { allowed: false, remainingThisMonth: monthlyLimit - monthlyCount, reason: "hourly_exhausted", retryAfterMinutes };
  }

  // مطالبةٌ ذرّية: تُمنَح الحصّة أو تُرفَض في جملةٍ واحدة - راجع
  // `claimQuotaAtomically`. والرفض هنا ليس خطأً بل سباقٌ خسرناه: نداءٌ
  // متوازٍ أخذ آخر حصّةٍ بيننا وبين الفحص أعلاه.
  const granted = await claimQuotaAtomically({
    userId,
    now,
    monthlyCountField: "siteScanMonthlyCount",
    monthlyResetField: "siteScanMonthlyReset",
    monthlyLimit: monthlyLimit,
    prevMonthlyReset: user.siteScanMonthlyReset,
    isNewMonth,
    hourlyCountField: "siteScanHourlyCount",
    hourlyResetField: "siteScanHourlyReset",
    hourlyLimit: SITE_SCAN_HOURLY_LIMIT,
    prevHourlyReset: user.siteScanHourlyReset,
    isNewHour,
  });
  if (!granted) {
    return { allowed: false, remainingThisMonth: 0, reason: "monthly_exhausted" };
  }

  return { allowed: true, remainingThisMonth: monthlyLimit - (monthlyCount + 1) };
}

/**
 * الاستهلاك الشهري الحالي - للعرض في صفحة الاشتراك لا للتحكّم.
 *
 * يُعيد صفراً بعد بداية شهر جديد حتى قبل أن يستدعي المستخدم شيئاً: العدّاد
 * لا يُصفَّر إلا عند أوّل استهلاك فعلي، فقراءته الخام تعرض رقم الشهر
 * الماضي على من لم يستخدم شيئاً بعد.
 */
export async function getMonthlyAiUsage(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiRefreshMonthlyCount: true, aiRefreshMonthlyReset: true },
  });
  if (!user) return 0;

  const now = new Date();
  const reset = user.aiRefreshMonthlyReset;
  if (reset && (reset.getMonth() !== now.getMonth() || reset.getFullYear() !== now.getFullYear())) {
    return 0;
  }
  return user.aiRefreshMonthlyCount ?? 0;
}
