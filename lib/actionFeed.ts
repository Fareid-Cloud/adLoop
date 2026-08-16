// lib/actionFeed.ts
//
// بيوحّد مصدرين مختلفين في قائمة واحدة (زي ما اتفقنا: Action Feed = AI
// Command Center = Alerts، نفس الـ engine):
// 1) اقتراحات من AutomationRule اللي محتاجة موافقة (RuleExecution بحالة
//    PENDING_APPROVAL) - دي النوع "SUGGESTION" وليها Apply/Dismiss حقيقي
// 2) تنبيهات من فحوصات الصحة العامة (تراكينج واقف، ميزانية هتخلص) - دي
//    النوع "ALERT"، غالباً معلوماتي أكتر من كونه إجراء بضغطة واحدة

import { prisma } from "@/lib/prisma";
import type { RuleEvaluationResult } from "@/lib/automationRules";
import { t, Locale } from "@/lib/i18n/dictionary";
import { shouldSendEmail, sendUrgentNotificationEmail } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/webPush";
import { checkMonthlyChangeCeiling } from "@/lib/automationRules";
import { assertNotDemo } from "@/lib/demo";
import { itemTitle, itemDescription } from "@/lib/localizedRecord";

/**
 * المحرّكات التي تُنتج قرارات. قائمة مغلقة عمداً: إضافة محرّك جديد يجب أن
 * تمرّ من هنا فيظهر في التجميع، لا أن يسقط بصمت في "أخرى".
 */
export type ActionSource =
  | "AUTOMATION" | "SCALE_KILL" | "BID_STRATEGY" | "TRUTH_GAP" | "PRICING"
  | "STOCK" | "TRAFFIC_QUALITY" | "CREATIVE" | "FORECAST" | "CONNECTION"
  | "EXPERIMENT" | "ECOMMERCE" | "ACCOUNT" | "OTHER";

export interface ActionFeedInput {
  workspaceId: string;
  type: "SUGGESTION" | "ALERT" | "ACCOUNT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  description?: string;
  /**
   * مفتاح القاموس ومتغيّراته - يُفضَّل دائماً على `title`/`description`.
   * النصّان يبقيان كاحتياطي وللنصوص الحرّة التي لا مفتاح لها (مخرجات
   * الذكاء الاصطناعي مثلاً). حين يُمرَّر المفتاح، يُترجَم وقت **العرض**
   * بلغة القارئ لا بلغة الكرون الذي أنتج البند.
   */
  titleKey?: string;
  titleVars?: Record<string, string | number>;
  descKey?: string;
  descVars?: Record<string, string | number>;
  relatedRuleExecutionId?: string;
  linkUrl?: string; // لما المستخدم يدوس على الإشعار في الجرس، يودّيه فين
  actionType?: string; // نوع التنفيذ الحقيقي - null = اقتراح معلوماتي بس
  actionPayload?: Record<string, unknown>; // بيانات كافية للتنفيذ
  source?: ActionSource;
  /** الأثر المالي الشهري المقدَّر - يُترك فارغاً حين لا يمكن حسابه بصدق */
  estimatedImpact?: number | null;
}

export async function pushToActionFeed(item: ActionFeedInput) {
  await prisma.actionFeedItem.create({
    data: {
      workspaceId: item.workspaceId,
      type: item.type,
      severity: item.severity as any,
      title: item.title,
      description: item.description,
      titleKey: item.titleKey ?? null,
      titleVars: (item.titleVars ?? undefined) as any,
      descKey: item.descKey ?? null,
      descVars: (item.descVars ?? undefined) as any,
      relatedRuleExecutionId: item.relatedRuleExecutionId,
      linkUrl: item.linkUrl,
      actionType: item.actionType,
      actionPayload: item.actionPayload as any,
      source: item.source ?? "OTHER",
      estimatedImpact: item.estimatedImpact ?? null,
    },
  });

  // نقطة دخول موحّدة واحدة لكل تنبيهات Action Feed (أتمتة، تنبيهات صحة
  // عامة، أي حاجة تانية تُضاف لاحقاً) - بدل ما كل مصدر يكرر نفس منطق
  // "هل يستاهل إيميل؟" بنفسه
  const workspace = await prisma.workspace.findUnique({ where: { id: item.workspaceId } });
  if (!workspace) return;

  const prefs = {
    notifyUrgentByEmail: workspace.notifyUrgentByEmail,
    notifyHighByEmail: workspace.notifyHighByEmail,
    notificationEmail: workspace.notificationEmail,
  };

  if (shouldSendEmail(item.severity, prefs)) {
    const owner = await prisma.user.findUnique({ where: { id: workspace.userId } });
    if (owner) {
      // النصّ يُترجَم بلغة المالك كما في الجرس تماماً. تمرير `item.title`
      // كان يرسل النصّ المخزَّن (عربي دائماً) مع وسم لغة إنجليزي.
      const ownerLocale = (owner.preferredLocale as "ar" | "en") ?? "ar";
      const localizable = {
        title: item.title,
        titleKey: item.titleKey,
        titleVars: item.titleVars,
        description: item.description,
        descKey: item.descKey,
        descVars: item.descVars,
      };
      await sendUrgentNotificationEmail({
        toEmail: workspace.notificationEmail || owner.email,
        workspaceName: workspace.name,
        title: itemTitle(ownerLocale, localizable),
        description: itemDescription(ownerLocale, localizable) || undefined,
        locale: ownerLocale,
      });
    }
  }
}

// بيحول نتيجة evaluateRule() (لو triggered) لبند Action Feed جاهز
export function ruleResultToActionFeedItem(
  workspaceId: string,
  ruleName: string,
  result: RuleEvaluationResult,
  requireApproval: boolean,
  locale: Locale,
  // الهدف الفعلي على المنصة. بدونه يبقى الاقتراح نصياً غير قابل للتنفيذ -
  // وهو ما كان عليه الحال: القواعد تُنتج نصاً فقط ولا تنفّذ شيئاً بالموافقة.
  target?: { platform: string; campaignId: string; campaignName?: string; action: string; changePct?: number }
): ActionFeedInput | null {
  if (!result.triggered) return null;

  // لو القاعدة اتمنعت بسبب فترة التهدئة، ده بند "تنبيه" (معلوماتي)،
  // مش "اقتراح" قابل للتنفيذ فوراً - المستخدم لازم يعرف ليه محصلش حاجة
  if (result.blockedByCooldown) {
    return {
      workspaceId,
      type: "ALERT",
      severity: "LOW",
      title: t(locale, "actionFeed.cooldownBlocked", { ruleName }),
    };
  }

  // ترجمة فعل القاعدة إلى نوع إجراء قابل للتنفيذ فعلياً على المنصة
  let actionType: string | undefined;
  let actionPayload: Record<string, unknown> | undefined;

  if (target) {
    if (target.action === "PAUSE_CAMPAIGN") {
      actionType = "PAUSE_CAMPAIGN";
      actionPayload = { platform: target.platform, campaignId: target.campaignId };
    } else if (target.action === "REDUCE_BUDGET_PCT" || target.action === "INCREASE_BUDGET_PCT") {
      const signed = target.action === "REDUCE_BUDGET_PCT"
        ? -Math.abs(target.changePct ?? 0)
        : Math.abs(target.changePct ?? 0);
      actionType = "CHANGE_CAMPAIGN_BUDGET";
      actionPayload = { platform: target.platform, campaignId: target.campaignId, changePct: signed };
    }
    // SEND_ALERT_ONLY وPAUSE_AD وADJUST_BID_PCT: الأول تنبيه بطبيعته،
    // والأخيران يحتاجان معرّف إعلان/مجموعة لا تملكه القاعدة على مستوى الحملة.
  }

  return {
    workspaceId,
    type: "SUGGESTION",
    severity: requireApproval ? "HIGH" : "MEDIUM",
    title: target?.campaignName
      ? `${ruleName} — ${target.campaignName}: ${result.suggestedAction}`
      : `${ruleName}: ${result.suggestedAction}`,
    description: t(locale, "actionFeed.conditionDetail", {
      value: result.currentValue ?? t(locale, "actionFeed.unavailable"),
      days: result.consecutiveDaysMatched,
    }),
    ...(actionType ? { actionType, actionPayload } : {}),
  };
}

// ==== إجراءات المستخدم على البند ====

export async function applyActionFeedItem(itemId: string) {
  const item = await prisma.actionFeedItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  // نقطة الاختناق الوحيدة لكل تنفيذ حقيقي على منصّة إعلانية. الحارس هنا
  // لا في كل دالة تنفيذ على حدة: دالة واحدة تفوت تكفي لأن تُوقف ضغطةٌ
  // في الديمو إعلاناً حقيقياً لعميل.
  await assertNotDemo(item.workspaceId);

  // لو مفيش actionType، ده اقتراح معلوماتي بس (زي "راجع الصفحة دي") -
  // مفيش حاجة تتنفّذ آلياً، بس نسجّل الموافقة
  if (!item.actionType) {
    await prisma.actionFeedItem.update({
      where: { id: itemId },
      data: { status: "APPLIED", resolvedAt: new Date() },
    });
    return;
  }

  // ── حدّ الباقة: التوسيع والإيقاف ──────────────────────────────────
  //
  // 🔴 `scaleKill` كان معروضاً في جدول الباقات («عرض» مقابل «تنفيذ»)
  // ولا يُفحص في أيّ موضع: الباقة المجّانية التي تَعِد بالعرض وحده كانت
  // توقف إعلاناً حقيقياً بضغطة.
  //
  // الفحص عند التنفيذ لا عند العرض - عمداً: الاقتراح نفسه يبقى مرئياً
  // لصاحب الباقة المجّانية، فهو **قيمة** المنتج وأصدق دعوةٍ للترقية من
  // أيّ لافتة. ما يُمنَع هو الفعل وحده.
  const APPLY_GATED_ACTIONS = ["PAUSE_AD_GOOGLE", "PAUSE_AD_META", "PAUSE_AD_TIKTOK"];
  if (APPLY_GATED_ACTIONS.includes(item.actionType)) {
    const ws = await prisma.workspace.findUnique({
      where: { id: item.workspaceId },
      select: { userId: true },
    });
    if (ws) {
      const { getEntitlements } = await import("@/lib/entitlements");
      const ent = await getEntitlements(ws.userId);
      if (ent.limits.scaleKill !== "apply") {
        // خطأ مقروء لا صمت: الواجهة تعرضه كما هو، فيعرف المستخدم أنّ
        // الضغطة لم تُنفَّذ ولماذا - لا أن يظنّ إعلانه متوقّفاً وهو يعمل.
        const locale = await (await import("@/lib/workspaceLocale")).ownerLocaleFor(item.workspaceId);
        throw new Error(t(locale, "limits.scaleKillLocked"));
      }
    }
  }

  // تنفيذ حقيقي - لو فشل، مبنسجلش APPLIED خالص، عشان المستخدم يعرف
  // إن التنفيذ فعلاً فشل ويقدر يحاول تاني، مش يفتكر إنه اتنفذ وهو معملش حاجة
  const payload = item.actionPayload as any;

  // حاجز أمان حقيقي - سقف أقصى لمجموع نسب تغيير المزايدة المُنفَّذة في
  // نفس الشهر لنفس الكيان (حملة/مجموعة إعلانية)، عشان تغييرات آلية
  // متتالية متراكمش فوق بعض من غير سقف. كان checkMonthlyChangeCeiling
  // مبني من زمان بس معزول تماماً - هنا أول استخدام حقيقي ليه.
  const BID_STRATEGY_ACTIONS = ["SET_BID_STRATEGY_GOOGLE", "SET_BID_STRATEGY_META", "SET_BID_STRATEGY_TIKTOK"];
  if (BID_STRATEGY_ACTIONS.includes(item.actionType) && typeof payload?.changePct === "number") {
    const workspace = await prisma.workspace.findUnique({ where: { id: item.workspaceId } });
    const entityKey = payload.campaignId ?? payload.adSetId ?? payload.adGroupId;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const previousChangesThisMonth = await prisma.actionFeedItem.findMany({
      where: {
        workspaceId: item.workspaceId,
        actionType: { in: BID_STRATEGY_ACTIONS },
        status: "APPLIED",
        resolvedAt: { gte: monthStart },
      },
    });
    const sameEntityChanges = previousChangesThisMonth
      .filter((p: any) => {
        const prevPayload = p.actionPayload as any;
        return (prevPayload?.campaignId ?? prevPayload?.adSetId ?? prevPayload?.adGroupId) === entityKey;
      })
      .map((p: any) => ({ executedAt: p.resolvedAt!, changePct: (p.actionPayload as any).changePct }));

    const ceilingCheck = checkMonthlyChangeCeiling(
      sameEntityChanges,
      workspace?.monthlyChangeCeilingPct ?? 50,
      payload.changePct
    );

    if (!ceilingCheck.allowed) {
      throw new Error(
        t("ar", "alerts.ceilingExceeded", {
          pct: ceilingCheck.ceilingPct,
          total: ceilingCheck.totalChangeIfApplied,
        })
      );
    }
  }

  switch (item.actionType) {
    case "SET_BID_STRATEGY_GOOGLE": {
      const { applyGoogleBidStrategyChange } = await import("@/lib/syncGoogleAds");
      await applyGoogleBidStrategyChange(item.workspaceId, payload.campaignId, payload.newStrategy, payload.targetCpaValue);
      break;
    }
    case "SET_BID_STRATEGY_META": {
      const { applyMetaBidStrategyChange } = await import("@/lib/syncMetaAds");
      await applyMetaBidStrategyChange(item.workspaceId, payload.adSetId, payload.bidAmountCents);
      break;
    }
    case "SET_BID_STRATEGY_TIKTOK": {
      const { applyTikTokBidStrategyChange } = await import("@/lib/syncTikTokAds");
      await applyTikTokBidStrategyChange(item.workspaceId, payload.advertiserId, payload.adGroupId, payload.bidPrice);
      break;
    }
    case "PAUSE_AD_GOOGLE": {
      const { pauseGoogleAd } = await import("@/lib/syncGoogleAds");
      await pauseGoogleAd(item.workspaceId, payload.campaignId, payload.adGroupId, payload.adId);
      break;
    }
    case "PAUSE_AD_META": {
      const { pauseMetaAd } = await import("@/lib/syncMetaAds");
      await pauseMetaAd(item.workspaceId, payload.adId);
      break;
    }
    case "PAUSE_AD_TIKTOK": {
      const { pauseTikTokAd } = await import("@/lib/syncTikTokAds");
      await pauseTikTokAd(item.workspaceId, payload.advertiserId, payload.adId);
      break;
    }
    // ==== إجراءات مستوى الحملة - كانت الفجوة الأكبر: قواعد الأتمتة كانت
    // تنتج اقتراحات نصية لا تحمل actionType، فلا تنفّذ شيئاً حتى بالموافقة.
    case "PAUSE_CAMPAIGN": {
      const { pauseCampaignOnPlatform } = await import("@/lib/platformCampaignActions");
      await pauseCampaignOnPlatform(item.workspaceId, payload.platform, payload.campaignId);
      break;
    }
    case "CHANGE_CAMPAIGN_BUDGET": {
      const { changeCampaignBudgetOnPlatform } = await import("@/lib/platformCampaignActions");
      await changeCampaignBudgetOnPlatform(item.workspaceId, payload.platform, payload.campaignId, payload.changePct);
      break;
    }
    // اعتماد سعر مقترح: يُحدَّث في المتجر نفسه لا عندنا فقط
    case "APPLY_PRODUCT_PRICE": {
      const { syncPriceToStore } = await import("@/lib/ecommerce/priceSync");
      const { prisma: db } = await import("@/lib/prisma");
      const sync = await syncPriceToStore(item.workspaceId, payload.productId, payload.newPrice);
      await db.product.update({
        where: { id: payload.productId },
        data: { currentPrice: payload.newPrice },
      });
      // فشل الكتابة على المتجر ليس فشلاً كاملاً - السعر صحيح عندنا الآن،
      // لكن يجب أن يعرف المستخدم أن متجره لم يتغيّر بعد.
      // المفتاح لا الجملة: الرسالة تُترجَم عند عرضها لا عند رميها.
      if (!sync.ok) throw new Error(`priceSync.${sync.reasonKey ?? "unknown"}`);
      break;
    }
    default:
      throw new Error(`نوع إجراء غير معروف: ${item.actionType}`);
  }

  await prisma.actionFeedItem.update({
    where: { id: itemId },
    data: { status: "APPLIED", resolvedAt: new Date() },
  });

  // كل تنفيذ حقيقي يُسجَّل تلقائياً كتجربة في المعمل، لتُقاس نتيجته بعد
  // اكتمال النافذة. المستخدم لا ينشئ شيئاً بنفسه - هذا هو جوهر "الحلقة"
  // في AdLoop: قرار ← تنفيذ ← قياس أثره الفعلي.
  try {
    const { recordExperiment } = await import("@/lib/experimentEngine");
    const CHANGE_TYPE: Record<string, any> = {
      PAUSE_CAMPAIGN: "PAUSE",
      PAUSE_AD_GOOGLE: "PAUSE",
      PAUSE_AD_META: "PAUSE",
      PAUSE_AD_TIKTOK: "PAUSE",
      CHANGE_CAMPAIGN_BUDGET: "BUDGET",
      SET_BID_STRATEGY_GOOGLE: "BID_STRATEGY",
      SET_BID_STRATEGY_META: "BID_STRATEGY",
      SET_BID_STRATEGY_TIKTOK: "BID_STRATEGY",
    };
    await recordExperiment({
      workspaceId: item.workspaceId,
      changeType: CHANGE_TYPE[item.actionType ?? ""] ?? "OTHER",
      // عنوان البند صار مفتاحاً بالفعل، فتَرِثه التجربة كما هو بدل نسخ نصّه
      description: item.title,
      descKey: item.titleKey ?? undefined,
      descVars: (item.titleVars ?? undefined) as Record<string, string | number> | undefined,
      campaignId: payload.campaignId ?? null,
      platform: payload.platform ?? null,
      sourceActionId: item.id,
      source: "AUTO",
    });
  } catch (err) {
    // تسجيل التجربة مساعد، لا يجوز أن يُفشل تنفيذاً نجح فعلاً على المنصة
    console.error("تعذّر تسجيل التجربة بعد تنفيذ القرار:", err);
  }
}

export async function dismissActionFeedItem(itemId: string) {
  await prisma.actionFeedItem.update({
    where: { id: itemId },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
}

// ==== الجرس - قراءة وحذف (منفصلين عمداً عن Apply/Dismiss اللي فوق) ====

export async function markNotificationRead(itemId: string) {
  await prisma.actionFeedItem.update({
    where: { id: itemId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(workspaceId: string) {
  await prisma.actionFeedItem.updateMany({
    where: { workspaceId, read: false },
    data: { read: true },
  });
}

export async function deleteNotification(itemId: string) {
  await prisma.actionFeedItem.delete({ where: { id: itemId } });
}
