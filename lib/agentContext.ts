// lib/agentContext.ts
//
// ما يعرفه الوكيل عن الحساب حين يُسأل.
//
// **لماذا هذا الملفّ:** المحادثة كانت تُرسل ملخّص الحملات وحده. فسؤالٌ مثل
// «أيّ إعلان أوسّعه؟» أو «لماذا ارتفعت تكلفة العميل؟» كان يُجاب من بياناتٍ
// لا تحتويه أصلاً - لا لأنّ النموذج قصّر، بل لأنّنا لم نُرِه ما يلزم.
// الجواب الصحيح على سؤالٍ تحليليّ يحتاج أربعة مصادر لا واحداً: الحملة،
// والإعلان الفرديّ، والاتّجاه عبر الزمن، ونتيجة البيع.
//
// **والحمولة تُدفَع ثمناً بالتوكن**، فلا يُرسَل كلّ شيء: من كلّ مصدر تُؤخذ
// الصفوف التي تحمل خبراً (الأعلى إنفاقاً، الأشدّ تغيّراً) ويُقصّ الذيل.
// الذيل الرخيص لا يغيّر جواباً، ويزاحم ما يغيّره على المساحة.

import { prisma } from "@/lib/prisma";
import { buildCampaignSummaries, type CampaignSummary } from "@/lib/aiInsights";
import { getWorkspaceCreativePerformances } from "@/lib/creativeAnalysis";

/** حدود الحمولة - كلّ رقم منها سقفُ صفوفٍ تُرسَل، لا سقف ما يُقرأ */
const MAX_CAMPAIGNS = 15;
const MAX_CREATIVES_PER_SIDE = 5;
const MAX_TRENDS = 8;
const MAX_DECISIONS = 5;

/** صفٌّ واحد في جدول الإعلانات المرسَل */
export interface AgentCreativeRow {
  name: string;
  platform: string;
  cost: number;
  clicks: number;
  verifiedConversions: number | null;
  cpa: number;
  roas: number | null;
  daysActive: number;
  fatigued: boolean;
}

/** تغيّر تكلفة العميل: آخر سبعة أيّام مقابل السبعة التي قبلها */
export interface AgentTrendRow {
  campaign: string;
  recentCpl: number;
  priorCpl: number;
  changePct: number;
}

export interface AgentStoreFacts {
  orders: number;
  revenue: number;
  returnedOrders: number;
  averageOrderValue: number;
}

export interface AgentContext {
  currency: string;
  periodDays: number;
  campaigns: CampaignSummary[];
  /** الاتّجاه - وهو ما يجيب عن «لماذا تغيّر؟»، والملخّص وحده لا يجيبه */
  trends: AgentTrendRow[];
  bestCreatives: AgentCreativeRow[];
  worstCreatives: AgentCreativeRow[];
  /** المتجر - `null` حين لا متجر مربوط، لا أصفارٌ تُقرأ كخسارة */
  store: AgentStoreFacts | null;
  /** ما اقترحه النظام فعلاً - فلا يناقض الوكيل منتجَه في الصفحة نفسها */
  pendingDecisions: Array<{ severity: string; title: string }>;
}

/** هل في السياق ما يكفي لجوابٍ مبنيّ على أرقام؟ */
export function hasEnoughData(ctx: AgentContext): boolean {
  return ctx.campaigns.length > 0 || ctx.store !== null;
}

export async function gatherAgentContext(
  workspaceId: string,
  currency: string,
  periodDays = 30,
): Promise<AgentContext> {
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const [campaigns, creativeData, trends, store, decisions] = await Promise.all([
    buildCampaignSummaries(workspaceId, since, MAX_CAMPAIGNS),
    gatherCreatives(workspaceId),
    gatherTrends(workspaceId),
    gatherStore(workspaceId, since),
    prisma.actionFeedItem.findMany({
      where: { workspaceId, status: "PENDING" },
      select: { severity: true, title: true },
      orderBy: { createdAt: "desc" },
      take: MAX_DECISIONS,
    }),
  ]);

  return {
    currency,
    periodDays,
    campaigns,
    trends,
    bestCreatives: creativeData.best,
    worstCreatives: creativeData.worst,
    store,
    pendingDecisions: decisions.map((d) => ({ severity: d.severity, title: d.title })),
  };
}

// ==================== الإعلانات الفردية ====================
//
// تُعاد صياغة `CreativePerformance` لا تُمرَّر كما هي: فيها روابط صور
// ومعرّفات ومجموعات إعلانية لا تُقرأ في جواب، وكلّها توكناتٌ تُدفَع.

async function gatherCreatives(
  workspaceId: string,
): Promise<{ best: AgentCreativeRow[]; worst: AgentCreativeRow[] }> {
  const { performances, daysActiveByAdId, fatiguedAdIds } =
    await getWorkspaceCreativePerformances(workspaceId);

  // إعلانٌ بلا إنفاق لا يُوسَّع ولا يُوقَف - لا قرار فيه فلا خبر منه.
  const spending = performances.filter((p) => p.cost > 0);
  if (spending.length === 0) return { best: [], worst: [] };

  const toRow = (p: (typeof spending)[number]): AgentCreativeRow => ({
    name: p.adName ?? p.headline ?? p.adId,
    platform: p.platform,
    cost: round(p.cost),
    clicks: p.clicks,
    verifiedConversions: p.verifiedConversions,
    cpa: round(p.cpa),
    roas: p.roas === null ? null : round(p.roas),
    daysActive: daysActiveByAdId.get(p.adId) ?? 0,
    fatigued: fatiguedAdIds.has(p.adId),
  });

  // الترتيب بتكلفة التحويل لا بالإنفاق: «الأفضل» مَن يشتري العميل بأرخص،
  // لا مَن يصرف أكثر. وإعلانٌ بصفر تحويل يُنفى إلى الأسوأ لا إلى الأرخص -
  // فتكلفة تحويله لا نهائية، وترتيبه أوّلاً كان سيقلب الجواب رأساً على عقب.
  const converted = spending.filter((p) => p.cpa > 0);
  const zeroConversion = spending.filter((p) => p.cpa <= 0);

  const byCpa = [...converted].sort((a, b) => a.cpa - b.cpa);

  return {
    best: byCpa.slice(0, MAX_CREATIVES_PER_SIDE).map(toRow),
    worst: [...zeroConversion, ...byCpa.slice().reverse()]
      .slice(0, MAX_CREATIVES_PER_SIDE)
      .map(toRow),
  };
}

// ==================== الاتّجاه ====================
//
// نافذتان متجاورتان بالطول نفسه. المقارنة بشهرٍ كامل تُخفي انهيار الأسبوع
// الأخير داخل متوسّطٍ هادئ - والسؤال «لماذا انهارت؟» عن الأسبوع الأخير.

async function gatherTrends(workspaceId: string): Promise<AgentTrendRow[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [recent, prior, links] = await Promise.all([
    prisma.metricSnapshot.groupBy({
      by: ["campaignId"],
      where: { workspaceId, date: { gte: sevenDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    }),
    prisma.metricSnapshot.groupBy({
      by: ["campaignId"],
      where: { workspaceId, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    }),
    prisma.campaignLink.findMany({
      where: { workspaceId },
      select: { externalCampaignId: true, campaignName: true },
    }),
  ]);

  const nameById = new Map(links.map((l) => [l.externalCampaignId, l.campaignName]));
  const priorById = new Map(prior.map((p) => [p.campaignId, p]));

  const rows: AgentTrendRow[] = [];
  for (const r of recent) {
    const p = priorById.get(r.campaignId);
    if (!p) continue;

    const recentConv = r._sum.verifiedConversions ?? 0;
    const priorConv = p._sum.verifiedConversions ?? 0;
    if (recentConv <= 0 || priorConv <= 0) continue;

    const recentCpl = (r._sum.cost ?? 0) / recentConv;
    const priorCpl = (p._sum.cost ?? 0) / priorConv;
    if (priorCpl <= 0) continue;

    rows.push({
      campaign: nameById.get(r.campaignId) ?? r.campaignId,
      recentCpl: round(recentCpl),
      priorCpl: round(priorCpl),
      changePct: round(((recentCpl - priorCpl) / priorCpl) * 100),
    });
  }

  // الأشدّ تغيّراً في الاتّجاهين: الانهيار خبرٌ والتحسّن خبرٌ، والثابت ليس خبراً.
  return rows.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, MAX_TRENDS);
}

// ==================== المتجر ====================

async function gatherStore(workspaceId: string, since: Date): Promise<AgentStoreFacts | null> {
  const agg = await prisma.order.aggregate({
    where: { workspaceId, orderedAt: { gte: since } },
    _count: { _all: true },
    _sum: { total: true },
  });

  const orders = agg._count._all;
  // لا طلبات = لا متجر مربوط، أو مربوطٌ بلا بيع. الحالتان تُقالان بـ«لا
  // بيانات» لا بصفٍّ من الأصفار يُقرأ كأنّ المتجر توقّف.
  if (orders === 0) return null;

  const returned = await prisma.order.count({
    where: { workspaceId, orderedAt: { gte: since }, isReturned: true },
  });

  const revenue = agg._sum.total ?? 0;
  return {
    orders,
    revenue: round(revenue),
    returnedOrders: returned,
    averageOrderValue: round(revenue / orders),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
