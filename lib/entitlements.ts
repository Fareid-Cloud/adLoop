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
      createdAt: true,
    },
  });

  const purchasedCredits = user?.aiCreditsPurchased ?? 0;
  if (!user) {
    return { planKey: "free", state: "FREE", limits: limitsOf("free"), trialDaysLeft: null, purchasedCredits: 0 };
  }

  // المالك أوّلاً: قبل الاشتراك وقبل التجربة، فلا تنتهي صلاحيته بمرور
  // يومٍ ولا تتوقّف على صفٍّ في جدول الاشتراكات قد يُعاد ضبطه.
  if (isOwnerEmail(user.email)) {
    const key = topPlanKey();
    return {
      planKey: key,
      state: "ACTIVE",
      limits: limitsOf(key),
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
      limits: limitsOf(PLAN_BY_KEY.has(key) ? key : "starter"),
      trialDaysLeft: null,
      purchasedCredits,
    };
  }

  // التجربة تُحسب من تاريخ التسجيل لا من حقل منفصل: حقل يُنسى ضبطه
  // يمنح تجربة أبدية، وتاريخ التسجيل موجود دائماً ولا يُنسى.
  const daysSinceSignup = Math.floor((now.getTime() - user.createdAt.getTime()) / 86_400_000);
  const trialDaysLeft = TRIAL_DAYS - daysSinceSignup;

  if (trialDaysLeft > 0) {
    return { planKey: "pro", state: "TRIAL", limits: limitsOf("pro"), trialDaysLeft, purchasedCredits };
  }

  // انتهت التجربة بلا اشتراك: نزول إلى المجّانية لا حائط. الحساب لا
  // يضيع، والوسم يبقى مركَّباً، فالعودة ضغطة لا إعداد من جديد.
  return {
    planKey: "free",
    state: user.subscriptionStatus === "PAST_DUE" ? "EXPIRED" : "FREE",
    limits: limitsOf("free"),
    trialDaysLeft: null,
    purchasedCredits,
  };
}

function limitsOf(key: PlanKey): PlanLimits {
  return (PLAN_BY_KEY.get(key) ?? PLAN_BY_KEY.get("free")!).limits;
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

export async function checkStoreLimit(userId: string, workspaceId: string): Promise<LimitCheck> {
  const [ent, count] = await Promise.all([
    getEntitlements(userId),
    prisma.ecommerceConnection.count({ where: { workspaceId, active: true } }),
  ]);
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
