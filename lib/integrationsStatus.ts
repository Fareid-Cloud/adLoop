// lib/integrationsStatus.ts
//
// حالة كل تكامل مربوط فعلاً: عدد الحسابات، آخر مزامنة، الصحة، الصلاحيات،
// وسجلّ التشغيل.
//
// "الصحة" هنا ليست شارة تجميلية - تُحسب من ثلاثة أسباب حقيقية وحدها:
//   • انتهاء التوكن أو اقترابه ⇒ سيتوقّف التدفّق قريباً
//   • آخر مزامنة فشلت ⇒ التدفّق متوقّف الآن
//   • مضى على آخر مزامنة ناجحة أكثر من ٤٨ ساعة ⇒ البيانات قديمة
// وما عدا ذلك سليم. شارة خضراء بلا سبب محسوب هي أسوأ من غياب الشارة.

import { prisma } from "@/lib/prisma";
import { INTEGRATIONS, type IntegrationDef } from "@/lib/integrationsCatalog";

export type IntegrationHealth = "HEALTHY" | "NEEDS_ATTENTION" | "BROKEN";

export interface SyncRunSummary {
  id: string;
  platform: string;
  status: string;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  recordsWritten: number | null;
  errorMessage: string | null;
}

export interface ActiveIntegration {
  key: string;
  platform: string | null;
  name: string;
  nameAr: string;
  category: string;
  color: string;
  /** عدد الحسابات/المتاجر المرتبطة */
  accountCount: number;
  accountNames: string[];
  connectedAt: Date | null;
  expiresAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  health: IntegrationHealth;
  /** سبب الحالة بلغة المستخدم - لا شارة بلا تفسير */
  healthReason: string;
  /** الصلاحيات الفعلية التي يمنحها هذا الربط */
  permissions: string[];
  recentRuns: SyncRunSummary[];
  /** عدد الصفوف المكتوبة خلال آخر ٧ أيام - دليل أن التكامل حيّ لا مجرد متصل */
  recordsLast7Days: number;
}

export interface IntegrationsOverview {
  connectedCount: number;
  healthyCount: number;
  needsAttentionCount: number;
  lastSyncAt: Date | null;
  active: ActiveIntegration[];
  available: IntegrationDef[];
  recentActivity: SyncRunSummary[];
}

/** ما يمنحه كل ربط فعلياً - مكتوب لا مُخمَّن */
const PERMISSIONS: Record<string, string[]> = {
  GOOGLE_ADS: [
    "قراءة الحملات والمجموعات والإعلانات",
    "قراءة مصطلحات البحث ودرجة الجودة",
    "تعديل الميزانية واستراتيجية المزايدة",
    "إيقاف الإعلانات والحملات",
    "رفع التحويلات غير المتصلة",
  ],
  META_ADS: [
    "قراءة الحملات والمجموعات والإعلانات",
    "قراءة تفصيل الأماكن ومعدّل التكرار",
    "تعديل ميزانية المجموعات الإعلانية",
    "إيقاف الإعلانات والحملات",
    "رفع الأحداث عبر Conversions API",
  ],
  TIKTOK_ADS: [
    "قراءة الحملات والمجموعات والإعلانات",
    "قراءة تفاعل Spark Ads",
    "تعديل ميزانية المجموعات الإعلانية",
    "إيقاف الإعلانات والحملات",
    "رفع الأحداث عبر Events API",
  ],
};

const ECOMMERCE_PERMISSIONS = ["استقبال الطلبات فور حدوثها", "قراءة الإيراد والمرتجعات"];

/** بعد هذه المدة تُعدّ البيانات قديمة - المزامنة يومية، فيومان تأخّر إشارة حقيقية */
const STALE_SYNC_HOURS = 48;
/** تحذير قبل انتهاء التوكن */
const TOKEN_WARNING_DAYS = 7;

export async function getIntegrationsOverview(
  workspaceId: string,
  userId: string
): Promise<IntegrationsOverview> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [connections, campaignLinks, ecommerce, runs] = await Promise.all([
    prisma.connectedPlatform.findMany({ where: { userId } }),
    prisma.campaignLink.findMany({
      where: { workspaceId },
      select: { platform: true, externalAccountId: true, campaignName: true },
    }),
    prisma.ecommerceConnection.findMany({ where: { workspaceId } }),
    prisma.syncRun.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: 60,
    }),
  ]);

  const runsByPlatform = new Map<string, SyncRunSummary[]>();
  for (const r of runs) {
    const arr = runsByPlatform.get(r.platform) ?? [];
    arr.push(r as SyncRunSummary);
    runsByPlatform.set(r.platform, arr);
  }

  const active: ActiveIntegration[] = [];
  const now = new Date();

  // ==== منصّات الإعلان ====
  for (const conn of connections) {
    const def = INTEGRATIONS.find((i) => i.platform === conn.platform);
    if (!def) continue;

    const accounts = campaignLinks.filter((l) => l.platform === conn.platform);
    const uniqueAccounts = [...new Map(accounts.map((a) => [a.externalAccountId, a])).values()];

    const platformRuns = runsByPlatform.get(conn.platform) ?? [];
    const lastRun = platformRuns[0] ?? null;
    const lastSuccess = platformRuns.find((r) => r.status === "SUCCESS") ?? null;

    const { health, reason } = assessHealth({
      now,
      expiresAt: conn.expiresAt,
      lastRunStatus: lastRun?.status ?? null,
      lastRunError: lastRun?.errorMessage ?? null,
      lastSuccessAt: lastSuccess?.startedAt ?? null,
      accountCount: uniqueAccounts.length,
    });

    active.push({
      key: def.key,
      platform: conn.platform,
      name: def.name,
      nameAr: def.nameAr,
      category: def.category,
      color: def.color,
      accountCount: uniqueAccounts.length,
      accountNames: uniqueAccounts.map((a) => a.externalAccountId),
      connectedAt: conn.connectedAt,
      expiresAt: conn.expiresAt,
      lastSyncAt: lastSuccess?.startedAt ?? null,
      lastSyncStatus: lastRun?.status ?? null,
      health,
      healthReason: reason,
      permissions: PERMISSIONS[conn.platform] ?? [],
      recentRuns: platformRuns.slice(0, 10),
      recordsLast7Days: platformRuns
        .filter((r) => r.startedAt >= sevenDaysAgo)
        .reduce((s, r) => s + (r.recordsWritten ?? 0), 0),
    });
  }

  // ==== المتاجر ====
  for (const store of ecommerce) {
    const def = INTEGRATIONS.find((i) => i.platform === store.platform);
    if (!def) continue;

    // المتاجر تعمل بالويب هوك لا بالمزامنة الدورية، فمقياس صحّتها مختلف
    // جوهرياً: وصول طلب حديث، لا نجاح مزامنة.
    const health: IntegrationHealth = !store.active
      ? "BROKEN"
      : store.lastOrderAt && hoursSince(store.lastOrderAt, now) <= 24 * 14
        ? "HEALTHY"
        : "NEEDS_ATTENTION";

    const reason = !store.active
      ? "الربط معطَّل."
      : !store.lastOrderAt
        ? "لم يصل أي طلب بعد - تأكّد من تسجيل الويب هوك في لوحة المتجر."
        : health === "HEALTHY"
          ? `آخر طلب وصل ${relativeAr(store.lastOrderAt, now)}.`
          : `لم يصل طلب منذ ${relativeAr(store.lastOrderAt, now)} - قد يكون الويب هوك توقّف.`;

    active.push({
      key: def.key,
      platform: store.platform,
      name: def.name,
      nameAr: def.nameAr,
      category: def.category,
      color: def.color,
      accountCount: 1,
      accountNames: [store.storeName ?? store.storeUrl ?? def.name],
      connectedAt: store.createdAt,
      expiresAt: null,
      lastSyncAt: store.lastOrderAt,
      lastSyncStatus: store.active ? "SUCCESS" : "FAILED",
      health,
      healthReason: reason,
      permissions: store.canWritePrices
        ? [...ECOMMERCE_PERMISSIONS, "تحديث أسعار المنتجات في المتجر"]
        : [...ECOMMERCE_PERMISSIONS, "قراءة فقط - التوكن لا يسمح بتحديث الأسعار"],
      recentRuns: [],
      recordsLast7Days: store.ordersReceived,
    });
  }

  const connectedKeys = new Set(active.map((a) => a.key));
  const available = INTEGRATIONS.filter((i) => !connectedKeys.has(i.key));

  const lastSyncTimes = active.map((a) => a.lastSyncAt).filter((d): d is Date => !!d);

  return {
    connectedCount: active.length,
    healthyCount: active.filter((a) => a.health === "HEALTHY").length,
    needsAttentionCount: active.filter((a) => a.health !== "HEALTHY").length,
    lastSyncAt: lastSyncTimes.length > 0 ? new Date(Math.max(...lastSyncTimes.map((d) => d.getTime()))) : null,
    active: active.sort((a, b) => healthRank(a.health) - healthRank(b.health)),
    available,
    recentActivity: runs.slice(0, 20) as SyncRunSummary[],
  };
}

function assessHealth(input: {
  now: Date;
  expiresAt: Date | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  lastSuccessAt: Date | null;
  accountCount: number;
}): { health: IntegrationHealth; reason: string } {
  const { now, expiresAt, lastRunStatus, lastRunError, lastSuccessAt, accountCount } = input;

  if (expiresAt && expiresAt <= now) {
    return { health: "BROKEN", reason: "انتهت صلاحية الربط - أعد الموافقة لاستئناف تدفّق البيانات." };
  }

  if (lastRunStatus === "FAILED") {
    return {
      health: "BROKEN",
      reason: lastRunError
        ? `آخر مزامنة فشلت: ${truncate(lastRunError, 120)}`
        : "آخر مزامنة فشلت - التدفّق متوقّف الآن.",
    };
  }

  if (accountCount === 0) {
    return {
      health: "NEEDS_ATTENTION",
      reason: "الحساب مربوط لكن لم تُختَر أي حملة بعد - لا شيء يُزامَن.",
    };
  }

  if (expiresAt) {
    const days = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= TOKEN_WARNING_DAYS) {
      return { health: "NEEDS_ATTENTION", reason: `صلاحية الربط تنتهي خلال ${days} يوم - جدّدها قبل توقّف التدفّق.` };
    }
  }

  if (!lastSuccessAt) {
    return {
      health: "NEEDS_ATTENTION",
      reason: "لم تُسجَّل مزامنة ناجحة بعد - شغّل مزامنة يدوية للتحقّق من الربط.",
    };
  }

  const hours = hoursSince(lastSuccessAt, now);
  if (hours > STALE_SYNC_HOURS) {
    return {
      health: "NEEDS_ATTENTION",
      reason: `آخر مزامنة ناجحة ${relativeAr(lastSuccessAt, now)} - أقدم من المتوقّع (المزامنة يومية).`,
    };
  }

  return { health: "HEALTHY", reason: `آخر مزامنة ناجحة ${relativeAr(lastSuccessAt, now)}.` };
}

function healthRank(h: IntegrationHealth): number {
  return h === "BROKEN" ? 0 : h === "NEEDS_ATTENTION" ? 1 : 2;
}

function hoursSince(d: Date, now: Date): number {
  return (now.getTime() - d.getTime()) / (60 * 60 * 1000);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

/** صياغة عربية سليمة للزمن النسبي - لا "منذ 1 أيام" */
export function relativeAr(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "الآن";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${plural(minutes, "دقيقة", "دقيقتين", "دقائق")}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${plural(hours, "ساعة", "ساعتين", "ساعات")}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${plural(days, "يوم", "يومين", "أيام")}`;

  const months = Math.floor(days / 30);
  return `منذ ${plural(months, "شهر", "شهرين", "أشهر")}`;
}

function plural(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${many}`;
  return `${n} ${one}`;
}

// ==================== تسجيل تشغيل المزامنة ====================

export async function startSyncRun(
  workspaceId: string,
  platform: string,
  trigger: "MANUAL" | "CRON"
): Promise<string> {
  const run = await prisma.syncRun.create({
    data: { workspaceId, platform: platform as never, status: "RUNNING", trigger: trigger as never },
  });
  return run.id;
}

export async function finishSyncRun(
  runId: string,
  outcome: { ok: boolean; recordsWritten?: number; error?: string }
) {
  const run = await prisma.syncRun.findUnique({ where: { id: runId }, select: { startedAt: true } });
  const finishedAt = new Date();
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status: outcome.ok ? "SUCCESS" : "FAILED",
      finishedAt,
      durationMs: run ? finishedAt.getTime() - run.startedAt.getTime() : null,
      recordsWritten: outcome.recordsWritten ?? null,
      errorMessage: outcome.error ?? null,
    },
  });
}
