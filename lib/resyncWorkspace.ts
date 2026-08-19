// lib/resyncWorkspace.ts
//
// **نقطة تنفيذ واحدة لـ"زامن دلوقتي".**
//
// كان المنطق ده عايش جوّه مسار المزامنة اليدوية بتاع العميل وحده. ولوحة
// المالك محتاجة نفس الفعل بالظبط لأي مساحة (صندوق أدوات الإصلاح)، ونسخه
// كان معناه نسختين من تسجيل `SyncRun` بتختلفوا عند أول تعديل - وساعتها
// "آخر مزامنة" في قسم التكاملات بتقول حاجة والمزامنة عملت حاجة تانية.
//
// الملف بيغطّي **المزامنة الأساسية للمنصّات الثلاث بس** - نفس الحاجة اللي
// كان مسار العميل بيعملها. النداءات المساعدة (المجموعات الإعلانية، جودة
// الحساب، إلخ) بتفضل على الكرون اليوميّ، ومكتوب كده صراحة عشان محدش
// يفتكر إنّ الزرّ ده بيرجّع كل حاجة.

import { prisma } from "@/lib/prisma";

export interface SyncOutcome {
  platform: string;
  ok: boolean;
  error?: string;
}

export interface ResyncResult {
  results: SyncOutcome[];
  succeeded: number;
  snapshotCount: number;
}

/** الفشل المجهول يُخزَّن غياباً لا جملةً - الحقل بيتعرض كما هو للمستخدم */
function msg(err: unknown): string | undefined {
  return err instanceof Error ? err.message.slice(0, 200) : undefined;
}

export async function resyncWorkspace(
  workspaceId: string,
  trigger: "MANUAL" | "CRON" = "MANUAL"
): Promise<ResyncResult> {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId },
    select: { platform: true },
    distinct: ["platform"],
  });
  const linked = new Set(links.map((l) => l.platform));

  const { startSyncRun, finishSyncRun } = await import("@/lib/integrationsStatus");
  const results: SyncOutcome[] = [];

  async function runSync(platform: string, fn: () => Promise<unknown>) {
    const before = await prisma.metricSnapshot.count({
      where: { workspaceId, platform: platform as never },
    });
    const runId = await startSyncRun(workspaceId, platform, trigger);
    try {
      await fn();
      const after = await prisma.metricSnapshot.count({
        where: { workspaceId, platform: platform as never },
      });
      await finishSyncRun(runId, { ok: true, recordsWritten: Math.max(0, after - before) });
      results.push({ platform, ok: true });
    } catch (err) {
      await finishSyncRun(runId, { ok: false, error: msg(err) });
      results.push({ platform, ok: false, error: msg(err) });
    }
  }

  if (linked.has("GOOGLE_ADS")) {
    await runSync("GOOGLE_ADS", async () => {
      const { syncGoogleAdsForWorkspace } = await import("@/lib/syncGoogleAds");
      await syncGoogleAdsForWorkspace(workspaceId);
    });
  }
  if (linked.has("META_ADS")) {
    await runSync("META_ADS", async () => {
      const { syncMetaAdsForWorkspace } = await import("@/lib/syncMetaAds");
      await syncMetaAdsForWorkspace(workspaceId);
    });
  }
  if (linked.has("TIKTOK_ADS")) {
    await runSync("TIKTOK_ADS", async () => {
      const { syncTikTokAdsForWorkspace } = await import("@/lib/syncTikTokAds");
      await syncTikTokAdsForWorkspace(workspaceId);
    });
  }

  return {
    results,
    succeeded: results.filter((r) => r.ok).length,
    snapshotCount: await prisma.metricSnapshot.count({ where: { workspaceId } }),
  };
}
