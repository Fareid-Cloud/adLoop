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

export interface ActionFeedInput {
  workspaceId: string;
  type: "SUGGESTION" | "ALERT" | "ACCOUNT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  description?: string;
  relatedRuleExecutionId?: string;
  linkUrl?: string; // لما المستخدم يدوس على الإشعار في الجرس، يودّيه فين
  actionType?: string; // نوع التنفيذ الحقيقي - null = اقتراح معلوماتي بس
  actionPayload?: Record<string, unknown>; // بيانات كافية للتنفيذ
}

export async function pushToActionFeed(item: ActionFeedInput) {
  await prisma.actionFeedItem.create({
    data: {
      workspaceId: item.workspaceId,
      type: item.type,
      severity: item.severity as any,
      title: item.title,
      description: item.description,
      relatedRuleExecutionId: item.relatedRuleExecutionId,
      linkUrl: item.linkUrl,
      actionType: item.actionType,
      actionPayload: item.actionPayload as any,
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
      await sendUrgentNotificationEmail({
        toEmail: workspace.notificationEmail || owner.email,
        workspaceName: workspace.name,
        title: item.title,
        description: item.description,
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
  locale: Locale = "ar"
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

  return {
    workspaceId,
    type: "SUGGESTION",
    severity: requireApproval ? "HIGH" : "MEDIUM",
    title: `${ruleName}: ${result.suggestedAction}`,
    description: t(locale, "actionFeed.conditionDetail", {
      value: result.currentValue ?? t(locale, "actionFeed.unavailable"),
      days: result.consecutiveDaysMatched,
    }),
  };
}

// ==== إجراءات المستخدم على البند ====

export async function applyActionFeedItem(itemId: string) {
  const item = await prisma.actionFeedItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  // لو مفيش actionType، ده اقتراح معلوماتي بس (زي "راجع الصفحة دي") -
  // مفيش حاجة تتنفّذ آلياً، بس نسجّل الموافقة
  if (!item.actionType) {
    await prisma.actionFeedItem.update({
      where: { id: itemId },
      data: { status: "APPLIED", resolvedAt: new Date() },
    });
    return;
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
        `تخطّى سقف التغيير الشهري (${ceilingCheck.ceilingPct}%) - مجموع التغييرات على نفس الإعلان/الحملة هيوصل ${ceilingCheck.totalChangeIfApplied}% لو نفّذت ده. راجع الإعدادات لو عايز تعدّل السقف.`
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
    default:
      throw new Error(`نوع إجراء غير معروف: ${item.actionType}`);
  }

  await prisma.actionFeedItem.update({
    where: { id: itemId },
    data: { status: "APPLIED", resolvedAt: new Date() },
  });
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
