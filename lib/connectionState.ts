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

export async function getPlatformStatus(
  workspaceId: string,
  userId: string,
  platform: string
): Promise<PlatformStatus> {
  const label = PLATFORM_LABEL[platform] ?? platform;

  const [connection, linkCount, snapshotCount] = await Promise.all([
    prisma.connectedPlatform.findUnique({
      where: { userId_platform: { userId, platform: platform as any } },
    }),
    prisma.campaignLink.count({ where: { workspaceId, platform: platform as any } }),
    prisma.metricSnapshot.count({ where: { workspaceId, platform: platform as any } }),
  ]);

  if (!connection) {
    return {
      state: "NOT_CONNECTED",
      title: `${label} غير مربوط بعد`,
      description: `اربط حساب ${label} من الإعدادات لتبدأ مزامنة بياناتك.`,
      ctaHref: "/dashboard/settings?tab=connections",
      ctaLabel: "ربط الحساب",
    };
  }

  if (linkCount === 0) {
    return {
      state: "NO_CAMPAIGNS",
      title: `حساب ${label} مربوط، لكن لم تختر حملات بعد`,
      description: `تم ربط حسابك بنجاح ✓ — الخطوة الأخيرة: اختر الحملات التي تريد متابعتها من الإعدادات ← مساحة العمل، وستبدأ الأرقام بالظهور بعد أول مزامنة.`,
      ctaHref: "/dashboard/settings?tab=workspace",
      ctaLabel: "اختيار الحملات",
    };
  }

  if (snapshotCount === 0) {
    return {
      state: "NO_DATA_YET",
      title: "الحملات مختارة، والبيانات في الطريق",
      description: `تم ربط ${label} واختيار ${linkCount} حملة ✓ — تجري المزامنة يومياً تلقائياً، وقد تستغرق أول مرة بعض الوقت. يمكنك تشغيل مزامنة فورية من الإعدادات.`,
      ctaHref: "/dashboard/settings?tab=workspace",
      ctaLabel: "مزامنة الآن",
    };
  }

  return { state: "READY", title: "", description: "", ctaHref: "", ctaLabel: "" };
}
