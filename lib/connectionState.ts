// lib/connectionState.ts
//
// تشخيص دقيق لحالة الربط. كانت الصفحات بتقيس "الربط" بوجود CampaignLink
// فقط، فتقول "المنصة غير مربوطة" حتى لو OAuth تم بنجاح — رسالة مضلّلة.
// هنا بنفرّق بين 3 حالات حقيقية: مش متصل / متصل بس مفيش حملات مختارة /
// حملات مختارة بس البيانات لسه ما اتزامنتش.

import { prisma } from "@/lib/prisma";

export type ConnectionState = "NOT_CONNECTED" | "NO_CAMPAIGNS" | "NO_DATA_YET" | "READY";

export interface PlatformStatus {
  state: ConnectionState;
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  TIKTOK_ADS: "TikTok Ads",
  SNAPCHAT_ADS: "Snapchat Ads",
};

const SUPPORTED_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"];

/**
 * المنصّات المربوطة فعليّاً من منظور مساحة عمل بعينها.
 *
 * `ConnectedPlatform` مرتبط بالمستخدم لا بمساحة العمل، فبذر ربط وهمي فيه
 * كان سيجعل مساحته **الحقيقية** تبدو مربوطة بتوكنات مزيّفة - خطر فعلي لا
 * مجرّد عرض خاطئ. لذلك تُعتبر المساحة التجريبية مربوطة بحكم كونها تجريبية،
 * ودليلها حملاتها المبذورة، ولا توجد بيانات اعتماد مزيّفة في أي مكان.
 *
 * هذه هي نقطة الحقيقة الوحيدة: كان كل قسم يستعلم عن `connectedPlatform`
 * بنفسه، فمرّ الديمو من بوّابة واحدة وسقط عند البقية - فبدت مساحة مليئة
 * بالبيانات وكأنها فارغة تنتظر الربط.
 */
export async function getConnectedPlatforms(
  workspaceId: string | null,
  userId: string
): Promise<Set<string>> {
  const [connections, ws] = await Promise.all([
    prisma.connectedPlatform.findMany({ where: { userId }, select: { platform: true } }),
    workspaceId
      ? prisma.workspace.findUnique({ where: { id: workspaceId }, select: { isDemo: true } })
      : Promise.resolve(null),
  ]);

  if (ws?.isDemo) return new Set(SUPPORTED_PLATFORMS);
  return new Set(connections.map((c: { platform: string }) => c.platform));
}

// حالة الربط لكل المنصات المدعومة - تُستخدم لعرض كروت الربط في الداشبورد
export async function getConnectStates(workspaceId: string, userId: string) {
  const platforms = SUPPORTED_PLATFORMS;
  const [connectedSet, links] = await Promise.all([
    getConnectedPlatforms(workspaceId, userId),
    prisma.campaignLink.groupBy({ by: ["platform"], where: { workspaceId }, _count: { _all: true } }),
  ]);

  const countByPlatform = new Map(links.map((l: any) => [l.platform, l._count._all]));

  return platforms.map((p) => ({
    platform: p,
    connected: connectedSet.has(p),
    campaignCount: countByPlatform.get(p) ?? 0,
  }));
}

export async function getPlatformStatus(
  workspaceId: string,
  userId: string,
  platform: string
): Promise<PlatformStatus> {
  const label = PLATFORM_LABEL[platform] ?? platform;

  const [connection, linkCount, snapshotCount] = await Promise.all([
    // أيّ منحةٍ لهذه المنصّة تكفي للقول إنّها «مربوطة» - وهو كلّ ما يُسأل
    // عنه هنا. صحّةُ كلّ منحةٍ على حدة تُفحص في «اختبار الاتصال».
    prisma.connectedPlatform.findFirst({
      where: { userId, platform: platform as any },
      orderBy: { connectedAt: "asc" },
    }),
    prisma.campaignLink.count({ where: { workspaceId, platform: platform as any } }),
    prisma.metricSnapshot.count({ where: { workspaceId, platform: platform as any } }),
  ]);

  if (!connection) {
    return {
      state: "NOT_CONNECTED",
      title: `${label} غير مربوط بعد`,
      description: `اربط حساب ${label} من الإعدادات لتبدأ مزامنة بياناتك.`,
      ctaHref: "/dashboard/integrations",
      ctaLabel: "ربط الحساب",
    };
  }

  if (linkCount === 0) {
    return {
      state: "NO_CAMPAIGNS",
      title: `حساب ${label} مربوط، لكن لم تختر حملات بعد`,
      description: `تم ربط حسابك بنجاح ✓ — الخطوة الأخيرة: اختر الحملات التي تريد متابعتها من الإعدادات ← مساحة العمل، وستبدأ الأرقام بالظهور بعد أول مزامنة.`,
      ctaHref: "/dashboard/integrations",
      ctaLabel: "اختيار الحملات",
    };
  }

  if (snapshotCount === 0) {
    return {
      state: "NO_DATA_YET",
      title: "الحملات مختارة، والبيانات في الطريق",
      description: `تم ربط ${label} واختيار ${linkCount} حملة ✓ — تجري المزامنة يومياً تلقائياً، وقد تستغرق أول مرة بعض الوقت. يمكنك تشغيل مزامنة فورية من الإعدادات.`,
      ctaHref: "/dashboard/integrations",
      ctaLabel: "مزامنة الآن",
    };
  }

  return { state: "READY", title: "", description: "", ctaHref: "", ctaLabel: "" };
}
