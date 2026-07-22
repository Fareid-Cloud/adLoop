// lib/frequencyCheck.ts
//
// كانت frequencyByPlatform ثابتة فاضية دايماً في dailyTasks.ts. هنا
// بنحسبها فعلياً - ميتا عندها حقل frequency مباشر في الـInsights API،
// تيك توك عندنا بيانات مخزّنة أصلاً (TikTokWeeklyEngagement). جوجل
// معندهاش مفهوم Frequency مباشر بنفس الطريقة - مش هنخترع رقم ليها.

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";

const META_API_VERSION = "v25.0";

export async function getFrequencyByPlatform(workspaceId: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const links = await prisma.campaignLink.findMany({
      where: { workspaceId, platform: "META_ADS" },
    });
    if (links.length > 0) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { user: { include: { connectedPlatforms: true } } },
      });
      const connection = workspace?.user.connectedPlatforms.find(
        (c: any) => c.platform === "META_ADS"
      );

      if (connection) {
        let totalFrequency = 0;
        let count = 0;
        for (const link of links) {
          const res = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${link.externalCampaignId}/insights` +
              `?fields=frequency&date_preset=last_7d&access_token=${decryptToken(connection.accessToken)}`
          );
          const data = await res.json();
          const freq = Number(data.data?.[0]?.frequency ?? 0);
          if (freq > 0) {
            totalFrequency += freq;
            count++;
          }
        }
        if (count > 0) result.META_ADS = totalFrequency / count;
      }
    }
  } catch (err) {
    console.error("فشل جلب Frequency لميتا:", err);
  }

  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const tiktokRows = await prisma.tikTokWeeklyEngagement.findMany({
      where: { workspaceId, weekStart: { gte: weekAgo } },
    });
    if (tiktokRows.length > 0) {
      const avg = tiktokRows.reduce((sum: number, r: any) => sum + r.frequency, 0) / tiktokRows.length;
      if (avg > 0) result.TIKTOK_ADS = avg;
    }
  } catch (err) {
    console.error("فشل حساب Frequency لتيك توك:", err);
  }

  return result;
}
