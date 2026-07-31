// lib/homeActivity.ts
//
// سجلّ النشاط الحديث في الصفحة الرئيسية.
//
// **كل سطر له صفّ في قاعدة البيانات.** لا شيء مولَّد ولا مُقدَّر: عملية
// مزامنة فعلية، قرار طُبِّق فعلاً، تنبيه صدر فعلاً. سجلّ نشاط مُخترع
// أسوأ من غيابه لأنه يوحي بحياة ليست موجودة، ويُفقد الثقة بأول تدقيق.

import { prisma } from "@/lib/prisma";
import type { ActivityRow, PlatformCard } from "@/app/dashboard/HomePanels";

const FEED_LIMIT = 6;

export async function getRecentActivity(
  workspaceId: string,
  locale: "ar" | "en"
): Promise<ActivityRow[]> {
  const ar = locale === "ar";

  const [runs, actions] = await Promise.all([
    prisma.syncRun.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: FEED_LIMIT,
      select: {
        id: true, platform: true, status: true, startedAt: true,
        recordsWritten: true, errorMessage: true,
      },
    }),
    prisma.actionFeedItem.findMany({
      where: { workspaceId, status: { in: ["APPLIED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: { id: true, type: true, title: true, status: true, createdAt: true, severity: true },
    }),
  ]);

  const rows: ActivityRow[] = [];

  for (const r of runs) {
    const ok = r.status === "SUCCESS";
    rows.push({
      id: `sync-${r.id}`,
      kind: "SYNC",
      title: ar ? "تمّت مزامنة الحملات" : "Campaigns synced",
      // "نجحت ولم تجد جديداً" حالة مختلفة عن "نجحت وجلبت" - تُقال كما هي
      detail: !ok
        ? (r.errorMessage ?? (ar ? "فشلت المزامنة" : "Sync failed")).slice(0, 90)
        : r.recordsWritten && r.recordsWritten > 0
          ? ar ? `${r.recordsWritten} صفّاً محدَّثاً` : `${r.recordsWritten} rows updated`
          : ar ? "بلا بيانات جديدة" : "No new data",
      at: r.startedAt.toISOString(),
      platform: r.platform,
      ok,
    });
  }

  for (const a of actions) {
    const applied = a.status === "APPLIED";
    rows.push({
      id: `act-${a.id}`,
      kind: a.type === "ALERT" ? "ALERT" : "ACTION",
      title: a.title.slice(0, 80),
      detail: applied
        ? ar ? "نُفِّذ" : "Applied"
        : ar ? "بانتظار قرارك" : "Awaiting your decision",
      at: a.createdAt.toISOString(),
      platform: null,
      ok: a.severity !== "URGENT",
    });
  }

  return rows
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, FEED_LIMIT);
}

export async function getPlatformCards(
  workspaceId: string,
  userId: string
): Promise<PlatformCard[]> {
  const [connections, links, lastRuns] = await Promise.all([
    prisma.connectedPlatform.findMany({ where: { userId }, select: { platform: true } }),
    prisma.campaignLink.findMany({ where: { workspaceId }, select: { platform: true } }),
    prisma.syncRun.findMany({
      where: { workspaceId, status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { platform: true, startedAt: true },
    }),
  ]);

  const connected = new Set(connections.map((c: { platform: string }) => c.platform));
  const lastByPlatform = new Map<string, Date>();
  for (const r of lastRuns) {
    if (!lastByPlatform.has(r.platform)) lastByPlatform.set(r.platform, r.startedAt);
  }

  // "سليم" = مزامنة ناجحة خلال ٤٨ ساعة وحملات مختارة. المزامنة يومية،
  // فيومان تأخّر إشارة حقيقية لا تشدّد.
  const staleAfter = Date.now() - 48 * 60 * 60 * 1000;

  return (["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const).map((platform) => {
    const campaignCount = links.filter((l: { platform: string }) => l.platform === platform).length;
    const lastSync = lastByPlatform.get(platform) ?? null;
    return {
      platform,
      connected: connected.has(platform),
      campaignCount,
      lastSyncAt: lastSync?.toISOString() ?? null,
      healthy: campaignCount > 0 && !!lastSync && lastSync.getTime() > staleAfter,
    };
  });
}
