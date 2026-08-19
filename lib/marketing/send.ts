// lib/marketing/send.ts
//
// **محرّك الحملات: من يستحقّ أيّ رسالة اليوم، وبأيّ أرقام.**
//
// يُشغَّل يومياً من الكرون. لكلّ مستخدم مؤهَّل يحسب سياقه من بيانات
// حقيقية، ويختار الرسالة المستحقّة، ويُرسلها مرّة واحدة إلى الأبد.
//
// **ثلاث ضمانات لا يجوز المساس بها:**
//   1. لا رسالة بلا ربط حساب — من لم يربط لم ير المنتج بعد، وتسويقه له
//      إزعاج لا إقناع.
//   2. لا رسالة مرّتين — `MarketingEmailLog` بقيد تفرّد في قاعدة البيانات،
//      لا بمنطق تطبيقي وحده. إعادة تشغيل الكرون آمنة.
//   3. لا رسالة في اليوم نفسه مع أخرى — رسالتان في يوم واحد تُقرأ إلحاحاً.

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { renderEmail } from "@/lib/emailTemplate";
import { getAppUrl } from "@/lib/appUrl";
import { getEntitlements } from "@/lib/entitlements";
import { ALL_MESSAGES, DAY_TOLERANCE, type MarketingMessage } from "./campaigns";
import { BUILDERS, type MarketingContext } from "./copy";
import { isFeatureEnabled } from "@/lib/featureFlags";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const DAY_MS = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY_MS);

/** يقع ضمن نافذة التسامح - الكرون يومي وقد يتأخّر. */
const due = (actual: number, target: number) => Math.abs(actual - target) <= DAY_TOLERANCE;

export interface MarketingRunResult {
  considered: number;
  sent: number;
  skippedNoData: number;
  skippedAlreadySent: number;
}

export async function runMarketingCampaigns(): Promise<MarketingRunResult> {
  const result: MarketingRunResult = { considered: 0, sent: 0, skippedNoData: 0, skippedAlreadySent: 0 };

  // إيقاف عامّ من لوحة المالك - **قبل أي استعلام**: الغرض من الإيقاف
  // منع الإرسال، ومافيش داعي نبني قائمة مستقبِلين مش هتتبعت.
  if (!(await isFeatureEnabled("marketing.emails"))) {
    console.warn("[marketing] الحملات موقوفة من لوحة المالك - لم تُرسَل أيّ رسالة.");
    return result;
  }

  if (!resend) {
    console.warn("[marketing] RESEND_API_KEY غير مضبوط - لم تُرسَل أيّ حملة.");
    return result;
  }

  const now = new Date();

  // الشرط الأوّل: ربط حساب إعلاني واحد على الأقلّ. `distinct` على مستوى
  // المستخدم لا مساحة العمل - من يملك ثلاث مساحات مربوطة شخص واحد.
  const linked = await prisma.campaignLink.findMany({
    where: { platform: { in: ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] } },
    select: { workspace: { select: { userId: true } } },
    distinct: ["workspaceId"],
  });
  const userIds = [...new Set(linked.map((l) => l.workspace.userId))];

  for (const userId of userIds) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, preferredLocale: true,
          createdAt: true, lastActiveAt: true,
          subscriptionStatus: true, currentPeriodEnd: true,
          marketingOptOut: true,
        },
      });
      if (!user || user.marketingOptOut) continue;

      const ent = await getEntitlements(user.id);
      const message = pickMessage(ent, user, now);
      if (!message) continue;

      result.considered++;

      // الفحص قبل بناء السياق: القراءة من قاعدة البيانات أغلى من استعلام
      // فهرس واحد، ولا معنى لحسابها لمن أُرسلت إليه الرسالة أصلاً.
      const already = await prisma.marketingEmailLog.findUnique({
        where: { userId_messageId: { userId: user.id, messageId: message.id } },
      });
      if (already) { result.skippedAlreadySent++; continue; }

      // رسالة واحدة في اليوم كحدّ أقصى
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const sentToday = await prisma.marketingEmailLog.count({
        where: { userId: user.id, sentAt: { gte: todayStart } },
      });
      if (sentToday > 0) continue;

      const ctx = await buildContext(user, ent, now);
      const built = BUILDERS[message.id]?.(ctx);
      // لا أرقام تكفي: تُتخطّى ولا تُسجَّل، فتُعاد المحاولة غداً بأرقام أحدث
      if (!built) { result.skippedNoData++; continue; }

      await resend.emails.send({
        from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
        to: user.email,
        subject: built.subject.replace(/[\r\n]/g, " "),
        html: renderEmail({
          locale: ctx.locale,
          art: "loop",
          eyebrow: built.eyebrow,
          title: built.title,
          subtitle: built.subtitle,
          blocks: built.blocks,
          tone: built.tone,
          cta: { label: built.ctaLabel, url: `${getAppUrl()}${message.ctaPath}` },
          secondaryCta: {
            label: ctx.locale === "ar" ? "افتح اللوحة الرئيسية" : "Open the dashboard",
            url: `${getAppUrl()}/dashboard`,
          },
          unsubscribeUrl: `${getAppUrl()}/dashboard/settings?tab=preferences`,
        }),
      });

      await prisma.marketingEmailLog.create({ data: { userId: user.id, messageId: message.id } });
      result.sent++;
    } catch (err) {
      // فشل مستخدم واحد لا يوقف الحملة على الباقين
      console.error(`[marketing] فشلت المعالجة للمستخدم ${userId}:`, err);
    }
  }

  return result;
}

/** أيّ رسالة يستحقّها هذا المستخدم اليوم - أو لا شيء. */
function pickMessage(
  ent: Awaited<ReturnType<typeof getEntitlements>>,
  user: { createdAt: Date; lastActiveAt: Date | null; currentPeriodEnd: Date | null },
  now: Date
): MarketingMessage | null {
  // مشترك فعليّ: لا تجربة ولا استعادة - حملة التفاعل وحدها
  if (ent.state === "ACTIVE") {
    return pickEngage(user, now);
  }

  if (ent.state === "TRIAL" && ent.trialDaysLeft !== null) {
    const m = ALL_MESSAGES.find((x) => x.campaign === "trial" && x.day > 0 && due(ent.trialDaysLeft!, x.day));
    if (m) return m;
    return pickEngage(user, now);
  }

  if (ent.state === "EXPIRED" && user.currentPeriodEnd) {
    const since = daysBetween(now, user.currentPeriodEnd);
    const after = ALL_MESSAGES.find((x) => x.campaign === "trial" && x.day < 0 && due(since, -x.day));
    if (after) return after;
    return ALL_MESSAGES.find((x) => x.campaign === "winback" && due(since, x.day)) ?? null;
  }

  return pickEngage(user, now);
}

/** حملة التفاعل تُقاس بالخمول: من يدخل يومياً لا يحتاج تذكيراً بالدخول. */
function pickEngage(user: { createdAt: Date; lastActiveAt: Date | null }, now: Date): MarketingMessage | null {
  const idle = daysBetween(now, user.lastActiveAt ?? user.createdAt);
  return ALL_MESSAGES.find((x) => x.campaign === "engage" && due(idle, x.day)) ?? null;
}

/** أرقام المستلم نفسه - آخر 30 يوماً عبر كلّ مساحات عمله. */
async function buildContext(
  user: { id: string; name: string | null; preferredLocale: string | null },
  ent: Awaited<ReturnType<typeof getEntitlements>>,
  now: Date
): Promise<MarketingContext> {
  const locale = user.preferredLocale === "en" ? "en" : "ar";
  const workspaces = await prisma.workspace.findMany({
    where: { userId: user.id, isDemo: false },
    select: { id: true, currency: true, conversionSyncEnabled: true },
  });
  const ids = workspaces.map((w) => w.id);
  const from = new Date(now.getTime() - 30 * DAY_MS);

  const [totals, decisions, zeroVerified] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: { in: ids }, date: { gte: from } },
      _sum: { cost: true, rawConversions: true, verifiedConversions: true },
    }),
    prisma.actionFeedItem.findMany({
      where: { workspaceId: { in: ids }, status: "PENDING", severity: { in: ["URGENT", "HIGH"] } },
      select: { estimatedImpact: true },
    }),
    // إعلانات أنفقت بلا تحقّق - إشارة «إنفاق ضائع أو تتبّع مكسور»
    prisma.creativeSnapshot.groupBy({
      by: ["adId"],
      where: { workspaceId: { in: ids }, date: { gte: from } },
      _sum: { cost: true, verifiedConversions: true },
      having: { verifiedConversions: { _sum: { equals: 0 } }, cost: { _sum: { gt: 0 } } },
    }),
  ]);

  return {
    locale,
    firstName: user.name?.trim().split(/\s+/)[0] ?? null,
    currency: workspaces[0]?.currency ?? "SAR",
    pendingDecisions: decisions.length,
    estimatedImpact: decisions.reduce((s, d) => s + (d.estimatedImpact ?? 0), 0),
    reported: totals._sum.rawConversions ?? 0,
    verified: totals._sum.verifiedConversions ?? 0,
    spend: totals._sum.cost ?? 0,
    zeroVerifiedAds: zeroVerified.length,
    zeroVerifiedSpend: zeroVerified.reduce((s, g) => s + (g._sum.cost ?? 0), 0),
    conversionSyncOn: workspaces.some((w) => w.conversionSyncEnabled),
    daysLeft: ent.trialDaysLeft ?? 0,
  };
}
