// lib/usageCaps.ts
//
// سقفا الاستهلاك الشهريّ: **الإنفاق المُدار** و**التحويلات المتحقَّقة**.
//
// هذان الحدّان مختلفان عن كلّ ما سبقهما في `entitlements.ts`. تلك حدود
// **فعل**: تُفحص قبل الفعل وتمنعه (مساحة عمل جديدة، منصّة إضافية، قاعدة
// أتمتة). وهذان حدّا **استهلاك**: لا فعل يُمنع، بل يتراكم رقمٌ حتى يبلغ
// السقف - فالسؤال ليس «هل أسمح بهذه الضغطة؟» بل «ماذا يحدث بعد التجاوز؟».
//
// **قرار المالك: تتوقّف المزامنة.** والرحلة كما تبنيها الشركات:
//
//   ٨٠٪  → تنبيه واحد لكلّ فترة. لا تكرار يوميّ يتحوّل إلى ضجيج يُتجاهَل.
//   ١٠٠٪ → تتوقّف المزامنة، وإشعار واحد يقول ما توقّف ولماذا وما الذي
//          يُعيده. ثمّ شريط دائم في اللوحة حتى يُحلّ.
//
// **ما لا يحدث عند التجاوز، عمداً:**
// - لا يُحذف شيء ولا يُخفى. كلّ ما وصل قبل السقف يبقى معروضاً كاملاً.
//   الاحتجاز مقابل الدفع سلوك ابتزاز لا تسعير.
// - لا يُقفل الحساب ولا تُمنع بقيّة أجزاء المنتج.
// - لا خطوة يدوية للاستئناف: الفحص يُحسب حيّاً من الباقة والفترة، فترقيةُ
//   الباقة أو أوّل يوم في الشهر الجديد يُعيدان المزامنة من تلقائهما.
//
// **الحدّ على المستخدم لا على مساحة العمل:** الاشتراك على المستخدم، وباقة
// الوكالات تمنح خمس عشرة مساحة بسقف إنفاق واحد يجمعها. قياسه لكلّ مساحة
// على حدة كان سيمنح مشترك الوكالات خمسة عشر ضعف ما دفع فيه.

import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";
import { pushToActionFeed } from "@/lib/actionFeed";
import { t } from "@/lib/i18n/dictionary";
import type { PlanKey } from "@/lib/plans";

/** نسبة التنبيه المبكّر. الاقتراب يُقال قبل الوصول لا بعده. */
const WARN_AT_PCT = 80;

/** أوّل يوم في الشهر الجاري (UTC) - مفتاح الفترة */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface UsageState {
  /** هل تتوقّف المزامنة الآن */
  blocked: boolean;
  /** أيّ سقف بلغه - يحدّد نصّ الرسالة، فلا نقول «إنفاق» لمن بلغ التحويلات */
  reason: "spend" | "conversions" | null;
  spendUsd: number;
  spendLimitUsd: number;
  verifiedConversions: number;
  verifiedLimit: number;
  /** أعلى النسبتين - هي التي تُعرض وتُقارَن بعتبة التنبيه */
  pct: number;
  planKey: PlanKey;
  /** أصغر باقة ترفع السقف الذي بُلِغ - لا الأغلى */
  suggestedPlan: PlanKey | null;
}

/**
 * الحالة من القيمة **المخزَّنة**، بلا أيّ تجميع.
 *
 * تُستدعى من تخطيط اللوحة ومن كلّ مسار مزامنة، أي عشرات المرّات في الدقيقة.
 * قراءةُ صفٍّ واحد بمفتاحه الأساسيّ هي كلّ ما تكلّفه.
 */
export async function getUsageState(userId: string): Promise<UsageState> {
  const [ent, user] = await Promise.all([
    getEntitlements(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { usagePeriodStart: true, usageSpendUsd: true, usageVerifiedConv: true },
    }),
  ]);

  const period = currentPeriodStart();
  // فترة مخزَّنة قديمة = شهر انقضى ولم يُعَد القياس بعد. تُقرأ أصفاراً لا
  // بالرقم القديم: قراءة رقم الشهر الماضي على أنّه رقم هذا الشهر تُبقي
  // المزامنة موقوفةً بعد أن استحقّ المستخدم استئنافها.
  const fresh = !!user?.usagePeriodStart && user.usagePeriodStart.getTime() === period.getTime();
  const spendUsd = fresh ? user!.usageSpendUsd : 0;
  const verified = fresh ? user!.usageVerifiedConv : 0;

  const spendLimitUsd = ent.limits.monthlySpendUsd;
  const verifiedLimit = ent.limits.verifiedConversions;

  const spendPct = spendLimitUsd > 0 ? (spendUsd / spendLimitUsd) * 100 : 0;
  const convPct = verifiedLimit > 0 ? (verified / verifiedLimit) * 100 : 0;

  const overSpend = spendLimitUsd > 0 && spendUsd >= spendLimitUsd;
  const overConv = verifiedLimit > 0 && verified >= verifiedLimit;

  // عند تجاوز الاثنين معاً يُذكر الأعلى نسبةً: هو السقف الذي يجب أن ترفعه
  // الترقية فعلاً، وذكرُ الأدنى يجعل المستخدم يرقّي فيجد نفسه موقوفاً بعدُ.
  const reason: UsageState["reason"] =
    overSpend && overConv ? (spendPct >= convPct ? "spend" : "conversions")
    : overSpend ? "spend"
    : overConv ? "conversions"
    : null;

  return {
    blocked: !!reason,
    reason,
    spendUsd,
    spendLimitUsd,
    verifiedConversions: verified,
    verifiedLimit,
    pct: Math.round(Math.max(spendPct, convPct)),
    planKey: ent.planKey,
    suggestedPlan: reason ? nextPlanCovering(ent.planKey, reason, spendUsd, verified) : null,
  };
}

function nextPlanCovering(
  current: PlanKey,
  reason: "spend" | "conversions",
  spendUsd: number,
  verified: number
): PlanKey | null {
  // الاستيراد هنا لا في الأعلى: `plans.ts` بيانات ثابتة بلا استيراد، ونريد
  // إبقاءها كذلك حتى تُقرأ من مكوّنات المتصفّح.
  const { PLANS, PLAN_BY_KEY } = require("@/lib/plans") as typeof import("@/lib/plans");
  const currentOrder = PLAN_BY_KEY.get(current)?.order ?? 0;
  const need = reason === "spend" ? spendUsd : verified;
  const field = reason === "spend" ? "monthlySpendUsd" : "verifiedConversions";

  return (
    [...PLANS]
      .sort((a, b) => a.order - b.order)
      .find((p) => p.order > currentOrder && p.limits[field] > need)?.key ?? null
  );
}

// ==================== القياس ====================

interface Measured {
  spendUsd: number;
  verifiedConversions: number;
}

/**
 * تجميع شهر واحد لكلّ مساحات المستخدم.
 *
 * 🔴 **فخّ العدّ المزدوج:** ميتا تكتب صفوفها بأحد ثلاثة مستويات تقسيم لكلّ
 * حملة/يوم (مجمَّع، منصّة، منصّة+مكان)، والمستوى قد يتغيّر بين تشغيلٍ وآخر
 * إن رفضت واجهةُ ميتا الأدقَّ مرّة. فتبقى صفوف المستوى القديم إلى جانب
 * الجديد، وجمعُ الكلّ يحسب الإنفاق نفسه مرّتين.
 *
 * ولأنّ الزيادة هنا **توقف خدمة عميل يدفع**، فالخطأ في اتّجاهها غير مقبول:
 * لكلّ (منصّة، حملة، يوم) يُؤخَذ الصفّ المجمَّع إن وُجد، وإلّا فمجموع صفوف
 * التقسيم. فلا يُحتسب الإنفاق مرّتين ولا يسقط منه شيء.
 */
async function measureUser(userId: string): Promise<Measured> {
  const workspaces = await prisma.workspace.findMany({
    // المساحة التجريبية خارج القياس: أرقامها مولَّدة، ومحاسبة المستخدم
    // على إنفاقٍ لم يُنفَق أسوأ من عدم القياس أصلاً.
    where: { userId, isDemo: false },
    select: { id: true, currency: true, dataCurrency: true },
  });
  if (workspaces.length === 0) return { spendUsd: 0, verifiedConversions: 0 };

  const since = currentPeriodStart();
  const rateCache = new Map<string, number | null>();
  let spendUsd = 0;
  let verifiedConversions = 0;

  for (const ws of workspaces) {
    const [aggregated, split] = await Promise.all([
      prisma.metricSnapshot.groupBy({
        by: ["platform", "campaignId", "date"],
        where: { workspaceId: ws.id, date: { gte: since }, placementBreakdown: "ALL", placementDetail: "ALL" },
        _sum: { cost: true, verifiedConversions: true },
      }),
      prisma.metricSnapshot.groupBy({
        by: ["platform", "campaignId", "date"],
        where: {
          workspaceId: ws.id,
          date: { gte: since },
          NOT: { placementBreakdown: "ALL", placementDetail: "ALL" },
        },
        _sum: { cost: true, verifiedConversions: true },
      }),
    ]);

    const key = (r: { platform: string; campaignId: string; date: Date }) =>
      `${r.platform}|${r.campaignId}|${r.date.toISOString().slice(0, 10)}`;

    const seen = new Set(aggregated.map(key));
    let cost = 0;
    for (const r of aggregated) {
      cost += r._sum.cost ?? 0;
      verifiedConversions += r._sum.verifiedConversions ?? 0;
    }
    for (const r of split) {
      if (seen.has(key(r))) continue;
      cost += r._sum.cost ?? 0;
      verifiedConversions += r._sum.verifiedConversions ?? 0;
    }

    // التكلفة مخزَّنة بعملة الحساب الإعلانيّ، والسقف بالدولار.
    //
    // `dataCurrency` أوّلاً لا `currency`: الأولى تأتي من المنصّة نفسها،
    // والثانية كانت قائمةً حرّة يبدّلها المستخدم - فتبديلُها كان يبدّل
    // قياس السقف على إنفاقٍ لم يتغيّر. صارتا تتطابقان بالبناء اليوم،
    // والصريح هنا يمنع عودة الالتباس.
    const dataCurrency = ws.dataCurrency ?? ws.currency;
    if (dataCurrency === "USD") {
      spendUsd += cost;
      continue;
    }
    if (!rateCache.has(dataCurrency)) {
      const snap = await prisma.exchangeRateSnapshot.findFirst({
        where: { fromCurrency: "USD", toCurrency: dataCurrency },
        orderBy: { date: "desc" },
        select: { rate: true },
      });
      rateCache.set(dataCurrency, snap?.rate && snap.rate > 0 ? snap.rate : null);
    }
    const rate = rateCache.get(dataCurrency);
    if (rate) {
      spendUsd += cost / rate;
    } else {
      // لا سعر صرف = لا قياس صادق. تجاهُل إنفاق هذه المساحة أسلم من
      // معاملة الجنيه كأنّه دولار - وهو ما كان سيوقف مزامنة عميلٍ لم
      // يقترب من سقفه أصلاً. الكرون يسجّل سعر الصرف يومياً، فهذه حالة
      // أوّل يوم لا حالة دائمة.
      console.warn(`[usageCaps] لا سعر صرف USD/${dataCurrency} - أُسقط إنفاق المساحة ${ws.id} من القياس`);
    }
  }

  return { spendUsd: Math.round(spendUsd), verifiedConversions };
}

/**
 * يقيس، ويخزّن، ويُطلق تنبيه الاقتراب أو إشعار التوقّف مرّةً واحدةً لكلّ فترة.
 *
 * يُستدعى من الكرون اليوميّ بعد المزامنة: القياس على بيانات ما قبل التشغيل
 * يجعل التجاوزَ يظهر بعد يومٍ كامل من وقوعه.
 */
export async function refreshUsageAndNotify(userId: string): Promise<UsageState> {
  const measured = await measureUser(userId);
  const period = currentPeriodStart();

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { usagePeriodStart: true, usageWarnedAt: true, usageBlockedAt: true },
  });

  // فترة جديدة تُصفّر علامتَي التنبيه أيضاً، وإلّا صمت التنبيه إلى الأبد
  // بعد أوّل شهر بُلِغ فيه السقف.
  const rolled = before?.usagePeriodStart?.getTime() !== period.getTime();

  await prisma.user.update({
    where: { id: userId },
    data: {
      usagePeriodStart: period,
      usageSpendUsd: measured.spendUsd,
      usageVerifiedConv: measured.verifiedConversions,
      ...(rolled ? { usageWarnedAt: null, usageBlockedAt: null } : {}),
    },
  });

  const state = await getUsageState(userId);
  const warnedAt = rolled ? null : before?.usageWarnedAt ?? null;
  const blockedAt = rolled ? null : before?.usageBlockedAt ?? null;

  if (state.blocked && !blockedAt) {
    await notifyAll(userId, state, "blocked");
    await prisma.user.update({ where: { id: userId }, data: { usageBlockedAt: new Date() } });
  } else if (!state.blocked && state.pct >= WARN_AT_PCT && !warnedAt) {
    await notifyAll(userId, state, "warn");
    await prisma.user.update({ where: { id: userId }, data: { usageWarnedAt: new Date() } });
  }

  return state;
}

/**
 * الإشعار يصل عبر كلّ مساحات المستخدم لا واحدة: التنبيه على المستخدم
 * (فالحدّ عليه)، ومساحةٌ بعينها قد تكون هي التي لا يفتحها أبداً.
 */
async function notifyAll(userId: string, state: UsageState, kind: "warn" | "blocked") {
  const workspaces = await prisma.workspace.findMany({
    where: { userId, isDemo: false },
    select: { id: true },
  });

  const isSpend = state.reason === "spend" || (kind === "warn" && state.spendLimitUsd > 0);
  const titleKey = kind === "blocked" ? "alerts.usageBlockedTitle" : "alerts.usageWarnTitle";
  const descKey = kind === "blocked"
    ? (isSpend ? "alerts.usageBlockedSpendBody" : "alerts.usageBlockedConvBody")
    : "alerts.usageWarnBody";

  const vars = {
    pct: state.pct,
    spend: state.spendUsd.toLocaleString("en-US"),
    spendLimit: state.spendLimitUsd.toLocaleString("en-US"),
    conv: state.verifiedConversions.toLocaleString("en-US"),
    convLimit: state.verifiedLimit.toLocaleString("en-US"),
  };

  for (const ws of workspaces) {
    await pushToActionFeed({
      workspaceId: ws.id,
      source: "ACCOUNT",
      type: "ACCOUNT",
      severity: kind === "blocked" ? "URGENT" : "MEDIUM",
      // النصّ يُخزَّن مفتاحاً ويُترجَم عند العرض بلغة القارئ - الكرون لا
      // يعرف بأيّ لغة سيُقرأ ما يكتبه الليلة.
      title: t("ar", titleKey),
      titleKey,
      description: t("ar", descKey, vars),
      descKey,
      descVars: vars,
      linkUrl: "/dashboard/billing",
    });
  }
}

/**
 * البوّابة التي تسبق أيّ مزامنة.
 *
 * تُقرأ من القيمة المخزَّنة، فلا تُضيف على المزامنة تكلفةَ تجميعٍ جديد.
 */
export async function isSyncBlocked(userId: string): Promise<boolean> {
  return (await getUsageState(userId)).blocked;
}
