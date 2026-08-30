// lib/metricRollup.ts
//
// 🔴 **تسع صفحات قرار كانت تجمع `MetricSnapshot` بلا فلتر مكان ظهور.**
//
// الجدول يحمل مستويين لليوم الواحد: صفّاً مجمَّعاً (`ALL/ALL`)، وصفوفاً
// مقسَّمة على أماكن الظهور حين ينجح تقسيم ميتا (فيسبوك/إنستجرام/…).
// وجمعُ الكلّ بلا تمييزٍ يعدّ يوم ميتا مرّتين حين يجتمع المستويان على
// نفس (المنصّة، الحملة، اليوم) - وهو ما يحدث فعلاً حين يتغيّر مستوى
// التقسيم الذي تقبله ميتا بين مزامنةٍ وأخرى، فيبقى المستوى القديم
// ويُضاف الجديد فوقه.
//
// والنتيجة ليست رقماً مزخرفاً في بطاقة: هذه صفحات تقول «انقل ألفاً من
// حملةٍ إلى أخرى» و«تجاوزتَ ميزانيتك ١١٢٪» و«أوقف إعلاناتك». صرفُ ميتا
// المنفوخ يقلب التوصية نفسها لا دقّتها.
//
// والفلترة إلى `ALL` وحدها **ليست حلّاً**: حين ينجح التقسيم لا يُكتب صفّ
// `ALL` أصلاً لتلك الحملة، فتختفي ميتا من الصفحة تماماً. القاعدة الصحيحة
// - وهي المطبَّقة في `lib/usageCaps.ts` منذ إصلاحٍ سابق - أن يفوز الصفّ
// المجمَّع حين يوجد، وتُجمَع الصفوف المقسَّمة حين لا يوجد. هنا في موضعٍ
// واحد بدل تسعةٍ تعيد اكتشافها.

import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

/**
 * منصّات الإعلان وحدها.
 *
 * ويب هوك المتجر يكتب في نفس الجدول بمنصّته هو (سلّة/شوبيفاي…) وبصفوف
 * `cost: 0`. فأيّ استعلامٍ بلا فلتر منصّة يخلط طلبات المتجر بأداء الإعلان:
 * يزيد المقام بلا أن يزيد الصرف، **فينخفض CPA بالصمت** - ويقرأ الاتجاهُ
 * مختلفاً لمساحةٍ عندها متجر عن أخرى ليس عندها، لسببٍ لا علاقة له بالإعلان.
 */
export const AD_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const;

export interface MetricRollupRow {
  platform: string;
  campaignId: string;
  date: Date;
  impressions: number;
  clicks: number;
  cost: number;
  rawConversions: number;
  verifiedConversions: number;
  revenue: number;
  ordersCount: number;
}

/** المجموع بعد التسوية - لمن يريد رقماً واحداً لا صفوفاً. */
export type MetricRollupTotals = Omit<MetricRollupRow, "platform" | "campaignId" | "date">;

const ZERO: MetricRollupTotals = {
  impressions: 0, clicks: 0, cost: 0,
  rawConversions: 0, verifiedConversions: 0, revenue: 0, ordersCount: 0,
};

/**
 * صفوف المقاييس بعد إسقاط الازدواج: صفٌّ واحد لكلّ (منصّة، حملة، يوم).
 *
 * `platforms` تُترك فارغةً لمنصّات الإعلان الثلاث، وتُمرَّر صراحةً حين
 * يكون السؤال عن المتجر نفسه.
 */
export async function metricRollupRows(args: {
  workspaceId: string;
  date?: Prisma.DateTimeFilter;
  platforms?: readonly string[];
  campaignIds?: string[];
}): Promise<MetricRollupRow[]> {
  const platforms = args.platforms ?? AD_PLATFORMS;
  const base: Prisma.MetricSnapshotWhereInput = {
    workspaceId: args.workspaceId,
    platform: { in: platforms as never },
    ...(args.date ? { date: args.date } : {}),
    ...(args.campaignIds ? { campaignId: { in: args.campaignIds } } : {}),
  };

  const sums = {
    impressions: true, clicks: true, cost: true,
    rawConversions: true, verifiedConversions: true, revenue: true, ordersCount: true,
  } as const;

  const [aggregated, split] = await Promise.all([
    prisma.metricSnapshot.groupBy({
      by: ["platform", "campaignId", "date"],
      where: { ...base, placementBreakdown: "ALL", placementDetail: "ALL" },
      _sum: sums,
    }),
    prisma.metricSnapshot.groupBy({
      by: ["platform", "campaignId", "date"],
      where: { ...base, NOT: { placementBreakdown: "ALL", placementDetail: "ALL" } },
      _sum: sums,
    }),
  ]);

  const key = (r: { platform: string; campaignId: string; date: Date }) =>
    `${r.platform}|${r.campaignId}|${r.date.toISOString().slice(0, 10)}`;

  const shape = (r: (typeof aggregated)[number]): MetricRollupRow => ({
    platform: r.platform,
    campaignId: r.campaignId,
    date: r.date,
    impressions: r._sum.impressions ?? 0,
    clicks: r._sum.clicks ?? 0,
    cost: r._sum.cost ?? 0,
    rawConversions: r._sum.rawConversions ?? 0,
    verifiedConversions: r._sum.verifiedConversions ?? 0,
    revenue: r._sum.revenue ?? 0,
    ordersCount: r._sum.ordersCount ?? 0,
  });

  const rows = aggregated.map(shape);
  const seen = new Set(aggregated.map(key));
  for (const r of split) {
    if (seen.has(key(r))) continue; // المجمَّع موجود - المقسَّم تفصيلُه لا إضافةٌ عليه
    rows.push(shape(r));
  }
  return rows;
}

/** يجمع صفوفاً مسوّاةً في مجموعٍ واحد. */
export function sumRollup(rows: readonly MetricRollupRow[]): MetricRollupTotals {
  return rows.reduce<MetricRollupTotals>(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      cost: acc.cost + r.cost,
      rawConversions: acc.rawConversions + r.rawConversions,
      verifiedConversions: acc.verifiedConversions + r.verifiedConversions,
      revenue: acc.revenue + r.revenue,
      ordersCount: acc.ordersCount + r.ordersCount,
    }),
    { ...ZERO }
  );
}

/** يجمع الصفوف المسوّاة في مفاتيح - `platform` أو `platform|campaignId`. */
export function groupRollup(
  rows: readonly MetricRollupRow[],
  keyOf: (r: MetricRollupRow) => string
): Map<string, MetricRollupTotals> {
  const out = new Map<string, MetricRollupTotals>();
  for (const r of rows) {
    const k = keyOf(r);
    const prev = out.get(k) ?? { ...ZERO };
    out.set(k, {
      impressions: prev.impressions + r.impressions,
      clicks: prev.clicks + r.clicks,
      cost: prev.cost + r.cost,
      rawConversions: prev.rawConversions + r.rawConversions,
      verifiedConversions: prev.verifiedConversions + r.verifiedConversions,
      revenue: prev.revenue + r.revenue,
      ordersCount: prev.ordersCount + r.ordersCount,
    });
  }
  return out;
}
