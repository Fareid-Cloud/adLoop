// lib/mcp/tools.ts
//
// أدوات خادم MCP: ما يستطيع ذكاءُ المشترك الخاصّ أن يطلبه من AdLoop.
//
// **قاعدةٌ واحدة تحكم الملفّ كلّه: لا استعلامَ جديداً هنا.** كلّ أداةٍ
// غلافٌ رفيع فوق الدالّة نفسها التي تقرأ منها الشاشة. ولو كتبتُ استعلاماً
// موازياً لصار للرقم مصدران، ويوم يتغيّر أحدهما يقول MCP رقماً والشاشة
// رقماً آخر - وهو أسوأ عطبٍ ممكن في منتجٍ كلّ دعواه أنّ رقمه هو الصحيح.
//
// **وقراءةٌ فقط.** لا أداةَ توقف إعلاناً ولا تغيّر ميزانية: التنفيذ
// الحقيقيّ في AdLoop محميٌّ بتأكيدٍ بدرجتين عمداً، وذكاءٌ خارجيّ يتصرّف
// نيابةً عن المستخدم يلتفّ حول ذلك الحارس بالضبط.

import { prisma } from "@/lib/prisma";
import { getTruthSnapshot } from "@/lib/truthKpis";
import { getStoreFunnel } from "@/lib/storeFunnel";
import { getWorkspaceCreativePerformances } from "@/lib/creativeAnalysis";
import { getStoreComparison } from "@/lib/ecommerce/storeComparison";
import { HELP_SECTIONS } from "@/lib/helpContent";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (workspaceId: string, args: Record<string, unknown>) => Promise<unknown>;
}

/** نافذةٌ بالأيام - الافتراضيّ ثلاثون، وهو ما تفتح عليه الشاشة نفسها */
function windowOf(args: Record<string, unknown>): { from: Date; to: Date; days: number } {
  const days = Math.min(365, Math.max(1, Number(args.days) || 30));
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to, days };
}

const DAYS_SCHEMA = {
  type: "object",
  properties: {
    days: { type: "number", description: "How many days back to look. Default 30, max 365." },
  },
};

async function workspaceCurrency(workspaceId: string): Promise<string> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });
  return w?.currency ?? "SAR";
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_truth_snapshot",
    description:
      "The core AdLoop number: what the ad platforms reported versus what was actually verified, per platform, with cost per customer on both bases and the size of the gap.",
    inputSchema: DAYS_SCHEMA,
    run: async (workspaceId, args) => {
      const { from, to } = windowOf(args);
      const snap = await getTruthSnapshot(workspaceId, { from, to });
      return {
        totals: snap.totals,
        platforms: snap.platforms,
        journey: snap.journey,
        sync: snap.sync,
        probabilistic: snap.probabilistic,
        unbackedClaims: snap.unbackedClaims,
      };
    },
  },
  {
    name: "list_campaigns",
    description:
      "Campaigns linked to this workspace with their spend, reported conversions and verified conversions over the window.",
    inputSchema: DAYS_SCHEMA,
    run: async (workspaceId, args) => {
      const { from, to } = windowOf(args);
      const links = await prisma.campaignLink.findMany({
        where: { workspaceId },
        select: { externalCampaignId: true, campaignName: true, platform: true },
      });
      const rows = await prisma.metricSnapshot.groupBy({
        by: ["campaignId", "platform"],
        where: { workspaceId, date: { gte: from, lte: to } },
        _sum: { cost: true, rawConversions: true, verifiedConversions: true, clicks: true, impressions: true },
      });
      const nameOf = new Map(links.map((l) => [l.externalCampaignId, l.campaignName]));
      return rows.map((r) => ({
        campaignId: r.campaignId,
        name: nameOf.get(r.campaignId ?? "") ?? null,
        platform: r.platform,
        cost: r._sum?.cost ?? 0,
        clicks: r._sum?.clicks ?? 0,
        impressions: r._sum?.impressions ?? 0,
        reportedConversions: r._sum?.rawConversions ?? 0,
        verifiedConversions: r._sum?.verifiedConversions ?? 0,
      }));
    },
  },
  {
    name: "get_creative_performance",
    description:
      "Individual ads with spend, conversions and cost per customer, plus which ones are showing fatigue and how many days each has been running.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", description: "GOOGLE_ADS, META_ADS or TIKTOK_ADS. Omit for all." },
      },
    },
    run: async (workspaceId, args) => {
      const platform = typeof args.platform === "string" ? args.platform : undefined;
      const r = await getWorkspaceCreativePerformances(workspaceId, platform);
      return {
        creatives: r.performances,
        fatiguedAdIds: [...r.fatiguedAdIds],
        daysActiveByAdId: Object.fromEntries(r.daysActiveByAdId),
      };
    },
  },
  {
    name: "get_funnel",
    description:
      "The purchase path from impression to an order that survived returns, with how many carried through at each step and which step leaks most.",
    inputSchema: DAYS_SCHEMA,
    run: async (workspaceId, args) => {
      const { from, to } = windowOf(args);
      return getStoreFunnel(workspaceId, from, to, await workspaceCurrency(workspaceId));
    },
  },
  {
    name: "get_search_terms",
    description:
      "What people actually typed before clicking a Google ad, with cost and conversions per term.",
    inputSchema: DAYS_SCHEMA,
    run: async (workspaceId, args) => {
      const { from } = windowOf(args);
      return prisma.searchTermSnapshot.findMany({
        where: { workspaceId, date: { gte: from } },
        orderBy: { cost: "desc" },
        take: 200,
        select: { searchTerm: true, cost: true, clicks: true, conversions: true, impressions: true, date: true },
      });
    },
  },
  {
    name: "get_store_metrics",
    description:
      "Connected stores compared over the window: revenue, orders, average order value, returns and ad spend attributed to each.",
    inputSchema: DAYS_SCHEMA,
    run: async (workspaceId, args) => {
      const { days } = windowOf(args);
      return getStoreComparison(workspaceId, days);
    },
  },
  {
    name: "get_orders_summary",
    description:
      "Orders in the window with their state, total and whether they were returned. Customer contact details are never included.",
    inputSchema: DAYS_SCHEMA,
    run: async (workspaceId, args) => {
      const { from, to } = windowOf(args);
      // 🔴 حقول العميل (الهاتف والبريد والاسم) لا تخرج من هنا إطلاقاً.
      // المشترك يملك أن يُصدّرها من المنتج بنفسه؛ أمّا تسليمُها لذكاءٍ
      // خارجيّ فقرارٌ يخصّ عملاءه هو، لا نأخذه نيابةً عنه.
      const orders = await prisma.order.findMany({
        where: { workspaceId, orderedAt: { gte: from, lte: to } },
        orderBy: { orderedAt: "desc" },
        take: 500,
        select: {
          externalOrderId: true,
          platform: true,
          total: true,
          shippingCost: true,
          currency: true,
          state: true,
          isReturned: true,
          itemCount: true,
          orderedAt: true,
        },
      });
      return { count: orders.length, orders };
    },
  },
  {
    name: "get_pending_decisions",
    description:
      "Decisions AdLoop is currently suggesting - scale, kill, bid strategy and alerts - with their severity. Reading them here does not apply them; that stays a click inside AdLoop.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many to return. Default 30." },
      },
    },
    run: async (workspaceId, args) => {
      const limit = Math.min(100, Math.max(1, Number(args.limit) || 30));
      return prisma.actionFeedItem.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          type: true,
          severity: true,
          titleKey: true,
          titleVars: true,
          descKey: true,
          descVars: true,
          actionType: true,
          createdAt: true,
        },
      });
    },
  },
  {
    name: "compare_periods",
    description:
      "The same verified numbers for two windows side by side, so a change can be measured rather than guessed.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Length of each window in days. Default 30." },
      },
    },
    run: async (workspaceId, args) => {
      const { from, to, days } = windowOf(args);
      const prevTo = new Date(from);
      const prevFrom = new Date(from);
      prevFrom.setDate(prevFrom.getDate() - days);
      const snap = await getTruthSnapshot(workspaceId, { from, to }, { from: prevFrom, to: prevTo });
      return {
        window: { from, to },
        comparedWith: { from: prevFrom, to: prevTo },
        totals: snap.totals,
        platforms: snap.platforms,
      };
    },
  },
  {
    // 🔴 **الأداة العاشرة، وسببُها أنّ غيابها يجعل الذكاء يخترع.** سؤالٌ
    // مثل «إزاي أظبّط تتبّع التحويلات في AdLoop؟» بلا هذه الأداة يُجاب من
    // معرفةٍ عامّة عن منتجٍ لا يعرفه - أي بخطواتٍ غير موجودة عندنا. وبها
    // يُجاب من نصّنا نحن.
    name: "search_help",
    description:
      "Search AdLoop's own help content for how to do something in the product. Use this instead of answering from general knowledge - the steps here are the real ones.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the user wants to do, in Arabic or English." },
      },
      required: ["query"],
    },
    run: async (_workspaceId, args) => {
      const q = String(args.query ?? "").trim().toLowerCase();
      if (!q) return { matches: [] };
      const terms = q.split(/\s+/).filter((t) => t.length > 1);
      const scored: Array<{ score: number; article: unknown }> = [];
      for (const section of HELP_SECTIONS) {
        for (const a of section.articles) {
          const hay = [a.q.ar, a.q.en, a.a.ar, a.a.en, ...a.tags].join(" ").toLowerCase();
          const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
          if (score > 0) {
            scored.push({
              score,
              article: {
                id: a.id,
                section: section.title.en,
                question: { ar: a.q.ar, en: a.q.en },
                answer: { ar: a.a.ar, en: a.a.en },
              },
            });
          }
        }
      }
      scored.sort((x, y) => y.score - x.score);
      return { matches: scored.slice(0, 6).map((s) => s.article) };
    },
  },
];

export const TOOL_BY_NAME = new Map(MCP_TOOLS.map((t) => [t.name, t]));
