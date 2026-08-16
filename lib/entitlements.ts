// lib/entitlements.ts
//
// ما يحقّ للمستخدم فعله بحسب باقته. **مصدر حقيقة واحد لا اثنان.**
//
// كان `dashboard/layout.tsx` يحمل جدول حدود خاصاً به فيه باقة `growth`
// لا وجود لها، ويمنح `pro` خمس عشرة مساحة عمل بينما الكتالوج يمنحها
// ثلاثاً. جدولان للحدود يعني أن أحدهما يكذب دائماً - والمستخدم يكتشف
// أيّهما عند أوّل رفض غير مفهوم.
//
// **التجربة تُعامَل كالباقة الاحترافية.** المقصود أن يرى ما سيشتريه، لا
// نسخة منقوصة تُقنعه بأن المنتج أقلّ ممّا هو.

import { prisma } from "@/lib/prisma";
import { PLAN_BY_KEY, type PlanKey, type PlanLimits } from "@/lib/plans";
import { isOwnerEmail } from "@/lib/owner";

export type SubscriptionState = "TRIAL" | "ACTIVE" | "EXPIRED" | "FREE";

export interface Entitlements {
  planKey: PlanKey;
  state: SubscriptionState;
  limits: PlanLimits;
  /** أيام متبقّية في التجربة - null خارجها */
  trialDaysLeft: number | null;
  /** رصيد الكريدت المشترى - يبقى بعد نفاد مخصّص الباقة */
  purchasedCredits: number;
}

/** مدّة التجربة. أقصر منها لا تكفي لأن تُغلق حلقة التحقّق أصلاً. */
export const TRIAL_DAYS = 14;
/** مدّة الديمو - محدودة عمداً حتى لا تصير نسخة مفتوحة للاطّلاع الدائم */
export const DEMO_DAYS = 7;

/**
 * حساب المالك: أعلى باقة دائماً، بلا اشتراك ولا انتهاء.
 *
 * **بريدٌ بعينه لا صفة `isAdmin`** - وهذا هو الفرق الذي يجعل الاستثناء
 * مقبولاً. لو عُلّق على الصفة، لصار كلّ حساب يُمنح `isAdmin` يوماً ما
 * حاملاً لإنفاقٍ بلا سقف، ولصار تسريب حسابٍ واحد تسريباً لرصيدٍ مفتوح.
 * البريد الواحد لا يُمنح ولا يُورَّث.
 *
 * الجواب يأتي من `lib/owner.ts` - موضعٌ واحد يعرف مَن المالك.
 */
/** أعلى الباقات ترتيباً - لا اسمٌ مكتوب بيده يفترق عن الكتالوج لو أُضيفت أعلى منه */
function topPlanKey(): PlanKey {
  return [...PLAN_BY_KEY.values()].sort((a, b) => b.order - a.order)[0].key;
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      currentPeriodEnd: true,
      aiCreditsPurchased: true,
      planLimitOverrides: true,
      createdAt: true,
    },
  });

  const purchasedCredits = user?.aiCreditsPurchased ?? 0;
  if (!user) {
    return { planKey: "free", state: "FREE", limits: limitsOf("free"), trialDaysLeft: null, purchasedCredits: 0 };
  }

  // حدودٌ خاصّة تعلو الباقة - مخرج من لا تسعه أكبر باقة (وكالةٌ
  // بخمسين عميلاً مثلاً). تُطبّق على كلّ مسارات الإرجاع تحت، لا على
  // مسار الاشتراك النشط وحده: الاتفاق الخاصّ لا يسقط لأنّ الدفعة
  // تأخّرت يوماً.
  const overrides = parseOverrides(user.planLimitOverrides);

  // المالك أوّلاً: قبل الاشتراك وقبل التجربة، فلا تنتهي صلاحيته بمرور
  // يومٍ ولا تتوقّف على صفٍّ في جدول الاشتراكات قد يُعاد ضبطه.
  if (isOwnerEmail(user.email)) {
    const key = topPlanKey();
    return {
      planKey: key,
      state: "ACTIVE",
      limits: limitsOf(key, overrides),
      trialDaysLeft: null,
      purchasedCredits,
    };
  }

  const now = new Date();
  const activePaid =
    user.subscriptionStatus === "ACTIVE" &&
    !!user.currentPeriodEnd &&
    user.currentPeriodEnd > now;

  if (activePaid) {
    const key = (user.subscriptionPlan as PlanKey) ?? "starter";
    return {
      planKey: PLAN_BY_KEY.has(key) ? key : "starter",
      state: "ACTIVE",
      limits: limitsOf(PLAN_BY_KEY.has(key) ? key : "starter", overrides),
      trialDaysLeft: null,
      purchasedCredits,
    };
  }

  // التجربة تُحسب من تاريخ التسجيل لا من حقل منفصل: حقل يُنسى ضبطه
  // يمنح تجربة أبدية، وتاريخ التسجيل موجود دائماً ولا يُنسى.
  const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86_400_000);
  const trialDaysLeft = TRIAL_DAYS - daysSinceSignup;

  if (trialDaysLeft > 0) {
    return { planKey: "pro", state: "TRIAL", limits: limitsOf("pro", overrides), trialDaysLeft, purchasedCredits };
  }

  // انتهت التجربة بلا اشتراك: نزول إلى المجّانية لا حائط. الحساب لا
  // يضيع، والوسم يبقى مركَّباً، فالعودة ضغطة لا إعداد من جديد.
  return {
    planKey: "free",
    state: user.subscriptionStatus === "PAST_DUE" ? "EXPIRED" : "FREE",
    limits: limitsOf("free", overrides),
    trialDaysLeft: null,
    purchasedCredits,
  };
}

function limitsOf(key: PlanKey, overrides?: Partial<PlanLimits>): PlanLimits {
  const base = (PLAN_BY_KEY.get(key) ?? PLAN_BY_KEY.get("free")!).limits;
  return overrides ? { ...base, ...overrides } : base;
}

/**
 * قراءة `planLimitOverrides` من عمود Json.
 *
 * **لا يُقبل منه إلّا ما هو حدٌّ عدديّ معروف**: العمود حرّ الشكل،
 * ونشرُ محتواه كما هو على `PlanLimits` يعني أنّ قيمةً مكتوبة خطأً
 * (نصٌّ مكان رقم، أو `scaleKill: "apply"` من حيث لا يُقصد) تسري في كلّ
 * فحوص الحدود بلا أن يمسكها شيء - والمقارنة مع نصّ تمرّ صامتة في
 * جافاسكريبت. والحقل يُضبط يدوياً، واليدويّ يُخطئ.
 */
function parseOverrides(raw: unknown): Partial<PlanLimits> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const NUMERIC_LIMITS = [
    "workspaces", "adAccounts", "monthlySpendUsd", "verifiedConversions",
    "historyMonths", "automationRules", "stores", "aiCredits", "deepScans", "savedViews",
  ] as const;
  const out: Partial<PlanLimits> = {};
  for (const key of NUMERIC_LIMITS) {
    const v = (raw as Record<string, unknown>)[key];
    // وـ-1 تعني «بلا حدّ» في كلّ الفحوص، فهي مقبولة وحدها دون السوالب.
    if (typeof v === "number" && Number.isFinite(v) && (v >= 0 || v === -1)) {
      out[key] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ==================== فحوص الحدّ ====================

export interface LimitCheck {
  allowed: boolean;
  /** الحدّ الحالي - يُعرض في الرسالة بدل "وصلت الحدّ" المجرّدة */
  limit: number;
  current: number;
  /** أصغر باقة ترفع هذا الحدّ - الترقية المقترحة لا الأغلى */
  suggestedPlan: PlanKey | null;
}

export async function checkWorkspaceLimit(userId: string): Promise<LimitCheck> {
  const [ent, count] = await Promise.all([
    getEntitlements(userId),
    prisma.workspace.count({ where: { userId } }),
  ]);
  return buildCheck(count, ent.limits.workspaces, ent.planKey, "workspaces");
}

export async function checkStoreLimit(
  userId: string,
  workspaceId: string,
  /** 🔴 **المنصّة التي يجري ربطها الآن - وبدونها كان تعديلُ ربطٍ قائمٍ
   *  يُرفض.**
   *
   *  مسار الحفظ `upsert`: يُنشئ أو **يُحدّث**. وكان الحدّ يَعُدّ الروابط
   *  النشطة كلّها ثمّ يقارن `count < limit`، فصاحب باقةٍ حدّها متجرٌ
   *  واحد ومعه متجرٌ مربوط بالفعل يصير `1 < 1` كاذباً - فيُمنع من
   *  **تعديل متجره هو**: تغيير اسمه، أو تدوير سرّه، أو إضافة توكن نسيه.
   *  أي أنّ الحدّ كان يمنع الصيانة لا الإضافة.
   *
   *  فإن كان لهذه المنصّة ربطٌ قائم، فالعملية تحديثٌ لا إضافة، ولا يُسأل
   *  الحدّ أصلاً. */
  platform?: string
): Promise<LimitCheck> {
  const [ent, count, existing] = await Promise.all([
    getEntitlements(userId),
    prisma.ecommerceConnection.count({ where: { workspaceId, active: true } }),
    platform
      ? prisma.ecommerceConnection.findFirst({
          where: { workspaceId, platform: platform as never },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (existing) {
    return { allowed: true, limit: ent.limits.stores, current: count, suggestedPlan: null };
  }
  return buildCheck(count, ent.limits.stores, ent.planKey, "stores");
}

/**
 * حدّ المنصّات المربوطة.
 *
 * 🔴 كان معروضاً في جدول الباقات وغير مطبَّق في أيّ من مسارات OAuth الثلاثة:
 * جوجل وميتا وتيك توك تحفظ الربط مباشرةً بلا سؤال. وهو الحدّ الذي يفصل
 * الباقة المجّانية (منصّة واحدة) عن كلّ ما فوقها ("all") - أي أنّ المجّانيّ
 * كان يربط الثلاث.
 *
 * `"all"` تعني بلا حدّ، فتُمثَّل بـ`Infinity` لتمرّ في المقارنة نفسها بدل
 * فرعٍ منفصل يُنسى تحديثه.
 *
 * تُعَدّ المنصّات الفريدة لا الصفوف: إعادة ربط الحساب نفسه ليست منصّةً
 * جديدة، وإلا منع الحدُّ المستخدمَ من تجديد ربطٍ منتهٍ.
 */
export async function checkPlatformLimit(userId: string): Promise<LimitCheck> {
  const [ent, rows] = await Promise.all([
    getEntitlements(userId),
    prisma.connectedPlatform.findMany({
      where: { userId },
      select: { platform: true },
      distinct: ["platform"],
    }),
  ]);
  const limit = ent.limits.platforms === "all" ? Infinity : ent.limits.platforms;
  return buildCheck(rows.length, limit, ent.planKey, "platforms");
}

/**
 * حدّ الحسابات الإعلانية داخل المنصّة الواحدة.
 *
 * **يُعَدّ من `CampaignLink` لا من `ConnectedPlatform`** - وهذا هو الفرق
 * الذي يجعل الحدّ عادلاً. فمنحة جوجل عبر حساب إدارة (MCC) تصل إلى عشرات
 * الحسابات بتوكن واحد: لو عُدّت تسجيلات الدخول، لأخذ صاحب MCC عدداً بلا
 * حدّ بينما يُحاسَب صاحب ميتا عن كلّ حساب - وهو تسعيرٌ يعاقب على المنصّة
 * لا على الاستعمال.
 *
 * ولأنّ لحظةَ ربط الحملات هي أوّل لحظةٍ يبدأ فيها الحساب يكلّفنا مزامنةً
 * يومية، فهي موضع الفحص - لا لحظةُ الموافقة على OAuth، التي لا تُنشئ عبئاً
 * بذاتها وقد تكون مجرّد تجديدٍ لصلاحيةٍ منتهية.
 *
 * @param incomingAccountIds الحسابات التي يجري ربطها الآن. حسابٌ مربوطٌ
 *   بالفعل لا يُحسَب إضافةً - وإلّا مُنع المشترك من **تعديل اختياره** في
 *   حسابه هو: إضافة حملةٍ نسيها، أو إزالة أخرى. الحدّ يمنع التوسّع لا الصيانة.
 *
 * @param replacingWorkspaceId مساحةُ العمل التي **يُستبدَل** ربطها بالكامل.
 *   فمسار الحفظ يمسح روابطها ثمّ يكتب المُرسَل، فلو عُدَّت روابطها القديمة
 *   مع الجديدة لحُسب الحساب الواحد مرّتين - ولمُنع المشترك من إعادة حفظ
 *   الاختيار نفسه بلا تغيير.
 */
export async function checkAdAccountLimit(
  userId: string,
  platform: string,
  incomingAccountIds: string[],
  replacingWorkspaceId?: string
): Promise<LimitCheck> {
  const [ent, existing] = await Promise.all([
    getEntitlements(userId),
    prisma.campaignLink.findMany({
      where: {
        platform: platform as never,
        workspace: { userId },
        ...(replacingWorkspaceId ? { workspaceId: { not: replacingWorkspaceId } } : {}),
      },
      select: { externalAccountId: true },
      distinct: ["externalAccountId"],
    }),
  ]);

  return resolveAdAccountLimit(
    existing.map((r) => r.externalAccountId),
    incomingAccountIds,
    ent.limits.adAccounts
  );
}

/**
 * حساب الحدّ نفسه، منزوعاً من قاعدة البيانات ليكون قابلاً للتشغيل والاختبار.
 *
 * وهو الجزء الذي يستحقّ الفصل: القاعدة تقول «كم حساباً بعد الحفظ؟» لا «كم
 * حساباً وصل؟» - فالفرق بين الاتّحاد والمجموع هو الفرق بين مشتركٍ يعيد حفظ
 * اختياره بلا تغيير فيمرّ، وآخر يُرفض لأنّ حساباته حُسبت مرّتين.
 */
export function resolveAdAccountLimit(
  knownAccountIds: string[],
  incomingAccountIds: string[],
  limit: number
): LimitCheck {
  // الاتّحاد لا المجموع: ما بعد الحفظ هو ما نقيسه، فالحساب المربوط الذي
  // يُرسَل ثانيةً موجودٌ في الطرفين ويُحسَب مرّة.
  const after = new Set([...knownAccountIds.filter(Boolean), ...incomingAccountIds.filter(Boolean)]);

  if (limit === -1) return { allowed: true, limit: -1, current: after.size, suggestedPlan: null };
  // `buildCheck` يسأل «هل يتّسع لواحدٍ آخر؟» بينما نحن نعرف العدد النهائيّ
  // بالضبط، فنقارنه مباشرةً - والترقية المقترَحة تأتي من الجدول نفسه.
  if (after.size <= limit) {
    return { allowed: true, limit, current: after.size, suggestedPlan: null };
  }
  const upgrade = [...PLAN_BY_KEY.values()]
    .sort((a, b) => a.order - b.order)
    .find((p) => p.limits.adAccounts === -1 || p.limits.adAccounts >= after.size);
  return { allowed: false, limit, current: after.size, suggestedPlan: upgrade?.key ?? null };
}

/**
 * سقفُ عدد تسجيلات الدخول المحفوظة لمنصّةٍ واحدة.
 *
 * الحدُّ الحقيقيّ على الحسابات لا على المنح (`checkAdAccountLimit`)، لأنّ
 * المنحة لا تكلّف شيئاً حتى تُربط بها حملة. لكنّ تركها بلا سقفٍ يعني أنّ
 * ضغطاً متكرّراً على «أضف حساباً» يراكم صفوفَ توكناتٍ لا تنتهي - ولكلٍّ
 * منها توكنٌ حيّ لحساب إعلانيّ حقيقيّ. **سطحُ الخطر يكبر بلا مقابل.**
 *
 * والسقف نفسه رقم الحسابات: منحةٌ لكلّ حساب هو أقصى ما يحتاجه أحد، وحساب
 * الإدارة (MCC) يبلغ العدد نفسه بمنحةٍ واحدة.
 */
export async function checkGrantLimit(userId: string, platform: string): Promise<LimitCheck> {
  const [ent, count] = await Promise.all([
    getEntitlements(userId),
    prisma.connectedPlatform.count({ where: { userId, platform: platform as never } }),
  ]);
  return buildCheck(count, ent.limits.adAccounts, ent.planKey, "adAccounts");
}

export async function checkAutomationRuleLimit(userId: string, workspaceId: string): Promise<LimitCheck> {
  const [ent, count] = await Promise.all([
    getEntitlements(userId),
    prisma.automationRule.count({ where: { workspaceId } }),
  ]);
  return buildCheck(count, ent.limits.automationRules, ent.planKey, "automationRules");
}

function buildCheck(
  current: number,
  limit: number,
  currentPlan: PlanKey,
  field: keyof PlanLimits
): LimitCheck {
  if (limit === -1) return { allowed: true, limit: -1, current, suggestedPlan: null };
  return {
    allowed: current < limit,
    limit,
    current,
    suggestedPlan: current < limit ? null : nextPlanAbove(currentPlan, field, limit),
  };
}

/**
 * أصغر باقة تتجاوز الحدّ الحالي - لا الأغلى. اقتراح الوكالات لمن تجاوز
 * مساحة عمل واحدة يبدو استغلالاً فيُرفض، واقتراح التالية يبدو منطقياً.
 */
function nextPlanAbove(current: PlanKey, field: keyof PlanLimits, currentLimit: number): PlanKey | null {
  const ordered = [...PLAN_BY_KEY.values()].sort((a, b) => a.order - b.order);
  const currentOrder = PLAN_BY_KEY.get(current)?.order ?? 0;
  for (const p of ordered) {
    if (p.order <= currentOrder) continue;
    const v = p.limits[field];
    if (typeof v === "number" && (v === -1 || v > currentLimit)) return p.key;
  }
  return null;
}

// ==================== كريدت الذكاء الاصطناعي ====================

export interface CreditCheck {
  allowed: boolean;
  allowance: number;
  used: number;
  purchased: number;
  /** الرصيد الكلّي المتبقّي: ما تبقّى من المخصّص + المشترى */
  left: number;
}

/**
 * المخصّص الشهري يُستهلك أوّلاً ثم المشترى. العكس يُهدر رصيداً دفع
 * المستخدم ثمنه بينما مخصّصه المجّاني ينتهي بنهاية الشهر بلا استخدام.
 */
export async function checkCredits(userId: string, usedThisMonth: number): Promise<CreditCheck> {
  const ent = await getEntitlements(userId);
  const allowance = ent.limits.aiCredits;
  const fromAllowance = Math.max(0, allowance - usedThisMonth);
  const left = fromAllowance + ent.purchasedCredits;
  return {
    allowed: left > 0,
    allowance,
    used: usedThisMonth,
    purchased: ent.purchasedCredits,
    left,
  };
}

/** يُستدعى بعد استهلاك فعلي - يخصم من المشترى فقط بعد نفاد المخصّص */
export async function consumePurchasedCreditIfNeeded(
  userId: string,
  usedThisMonth: number
): Promise<void> {
  const ent = await getEntitlements(userId);
  if (usedThisMonth <= ent.limits.aiCredits) return;
  if (ent.purchasedCredits <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsPurchased: { decrement: 1 } },
  });
}
