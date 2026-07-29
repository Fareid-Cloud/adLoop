// lib/touchpointPaths.ts
//
// الجسر بين الجداول ونماذج الإسناد: يبني مسار اللمسات الكامل لكل تحويل.
//
// نافذة الاسترجاع (Lookback): ٩٠ يوماً افتراضياً - وهي النافذة القياسية
// لأول لمسة في أدوات الإسناد. اللمسات الأقدم من ذلك لم تعد سبباً معقولاً
// لعملية شراء اليوم، وإدخالها يضخّم فضل قنوات الوعي بلا أساس.
//
// ملاحظة صدق: التقاط اللمسات يبدأ من لحظة تركيب الوسم. المسارات المبنية
// هنا لا تعرف شيئاً عمّا حدث قبل ذلك، ولا تدّعي معرفته - buildConversionPaths
// تُعيد coverage بصراحة ليعرف المستخدم على أي أساس يقرأ الأرقام.

import { prisma } from "@/lib/prisma";
import type { ConversionPath, PathTouch } from "@/lib/attributionModels";

export const DEFAULT_LOOKBACK_DAYS = 90;

/** المنصة التي ستنسب هذا التحويل لنفسها في لوحتها - يُستنتج من معرّف النقرة
 *  المرافق للحدث. وجود gclid يعني أن جوجل ستعدّه تحويلاً لها، بلا نقاش. */
function platformFromClickIds(e: {
  gclid: string | null;
  fbc: string | null;
  ttclid: string | null;
}): string | null {
  if (e.gclid) return "GOOGLE_ADS";
  if (e.fbc) return "META_ADS";
  if (e.ttclid) return "TIKTOK_ADS";
  return null;
}

export interface BuiltPaths {
  paths: ConversionPath[];
  /** تحويلات بلا أي لمسة مسجّلة - مقياس تغطية الوسم لا مقياس أداء */
  conversionsWithoutTouches: number;
  /** نسبة التحويلات التي نملك لها مساراً فعلياً */
  pathCoveragePct: number;
  totalConversions: number;
}

export async function buildConversionPaths(
  workspaceId: string,
  from: Date,
  to: Date,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<BuiltPaths> {
  const conversions = await prisma.conversionEvent.findMany({
    where: { workspaceId, occurredAt: { gte: from, lte: to } },
    orderBy: { occurredAt: "asc" },
  });

  if (conversions.length === 0) {
    return { paths: [], conversionsWithoutTouches: 0, pathCoveragePct: 0, totalConversions: 0 };
  }

  const visitorIds = [...new Set(conversions.map((c) => c.visitorId).filter((v): v is string => !!v))];

  const lookbackStart = new Date(from);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);

  const touchRows = visitorIds.length
    ? await prisma.touchpoint.findMany({
        where: { workspaceId, visitorId: { in: visitorIds }, occurredAt: { gte: lookbackStart, lte: to } },
        orderBy: { occurredAt: "asc" },
      })
    : [];

  const touchesByVisitor = new Map<string, PathTouch[]>();
  for (const t of touchRows) {
    const arr = touchesByVisitor.get(t.visitorId) ?? [];
    arr.push({
      id: t.id,
      platform: t.platform,
      channel: t.channel,
      kind: t.kind,
      campaignId: t.campaignId,
      adSetId: t.adSetId,
      adId: t.adId,
      source: t.source,
      occurredAt: t.occurredAt.getTime(),
    });
    touchesByVisitor.set(t.visitorId, arr);
  }

  const paths: ConversionPath[] = [];
  let withoutTouches = 0;

  for (const c of conversions) {
    const convertedAt = c.occurredAt.getTime();
    const windowStart = convertedAt - lookbackDays * 24 * 60 * 60 * 1000;

    // لمسات هذا الزائر السابقة للتحويل فقط. لمسة وقعت **بعد** التحويل لا
    // تكون سبباً له - إدخالها خطأ منطقي شائع في أدوات الإسناد المتعجّلة.
    const touches = (c.visitorId ? touchesByVisitor.get(c.visitorId) ?? [] : []).filter(
      (t) => t.occurredAt <= convertedAt && t.occurredAt >= windowStart
    );

    if (touches.length === 0) {
      withoutTouches++;
      continue;
    }

    paths.push({
      conversionId: c.id,
      value: c.value,
      verified: c.verified,
      convertedAt,
      touches,
      platformReported: platformFromClickIds(c),
    });
  }

  const total = conversions.length;
  return {
    paths,
    conversionsWithoutTouches: withoutTouches,
    pathCoveragePct: total > 0 ? Math.round(((total - withoutTouches) / total) * 1000) / 10 : 0,
    totalConversions: total,
  };
}

// ==================== الالتقاط ====================

export interface TouchpointInput {
  workspaceId: string;
  visitorId: string;
  sessionId?: string | null;
  kind: "AD_CLICK" | "AD_VIEW" | "SITE_VISIT" | "CRM_EVENT" | "MESSAGE";
  platform?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
  adId?: string | null;
  clickId?: string | null;
  source?: string | null;
  medium?: string | null;
  campaignTag?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  occurredAt?: Date;
  /** تمريره يتخطّى الاستنتاج التلقائي */
  channel?: string | null;
}

const PAID_PLATFORMS: Record<string, string> = {
  GOOGLE_ADS: "PAID_SEARCH",
  META_ADS: "PAID_SOCIAL",
  TIKTOK_ADS: "PAID_VIDEO",
  SNAPCHAT_ADS: "PAID_SOCIAL",
};

/**
 * استنتاج القناة. الترتيب مقصود: وجود معرّف نقرة أو منصة إعلانية يحسم
 * الأمر قبل أي تخمين من الـ referrer، لأن الأول إشارة مؤكدة والثاني ظنّي.
 */
export function inferChannel(input: TouchpointInput): string {
  if (input.channel) return input.channel;

  if (input.platform && PAID_PLATFORMS[input.platform]) {
    // فيديو يوتيوب داخل جوجل ليس بحثاً مدفوعاً - نفرّقه عند توفّر الإشارة
    if (input.platform === "GOOGLE_ADS" && input.medium === "video") return "PAID_VIDEO";
    return PAID_PLATFORMS[input.platform];
  }
  if (input.clickId) return "PAID_SEARCH";
  if (input.kind === "CRM_EVENT") return "CRM";
  if (input.kind === "MESSAGE") return "REFERRAL";

  const medium = (input.medium ?? "").toLowerCase();
  if (medium === "email" || medium === "newsletter") return "EMAIL";
  if (medium === "cpc" || medium === "ppc" || medium === "paid") return "PAID_SEARCH";

  const ref = (input.referrer ?? "").toLowerCase();
  if (!ref) return "DIRECT";
  if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(ref)) return "ORGANIC_SEARCH";
  if (/facebook\.|instagram\.|tiktok\.|twitter\.|x\.com|linkedin\.|snapchat\./.test(ref))
    return "ORGANIC_SOCIAL";
  return "REFERRAL";
}

export async function recordTouchpoint(input: TouchpointInput) {
  return prisma.touchpoint.create({
    data: {
      workspaceId: input.workspaceId,
      visitorId: input.visitorId,
      sessionId: input.sessionId ?? null,
      kind: input.kind as never,
      channel: inferChannel(input) as never,
      platform: (input.platform ?? null) as never,
      campaignId: input.campaignId ?? null,
      adSetId: input.adSetId ?? null,
      adId: input.adId ?? null,
      clickId: input.clickId ?? null,
      source: input.source ?? null,
      medium: input.medium ?? null,
      campaignTag: input.campaignTag ?? null,
      referrer: input.referrer ?? null,
      landingPath: input.landingPath ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}
