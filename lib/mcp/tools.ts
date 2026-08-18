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
import { t } from "@/lib/i18n/dictionary";
import { getCustomerAnalytics } from "@/lib/ecommerce/storeIntelligence";
import { getLtvByChannel, getCohorts, getCustomerJourney } from "@/lib/ecommerce/customerCohorts";

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
  {
    name: "get_customer_analytics",
    description:
      "Lifetime value, repeat purchase rate, how much more a returning customer is worth than a one-time buyer, customer segments (VIP, at-risk, one-time) and the top customers by spend.",
    inputSchema: {
      type: "object",
      properties: {
        store_id: { type: "string", description: "Limit to one connected store. Omit for the whole workspace." },
      },
    },
    run: async (workspaceId, args) => {
      const storeId = args.store_id ? String(args.store_id) : null;
      const a = await getCustomerAnalytics(workspaceId, storeId);
      return {
        total_customers: a.totalCustomers,
        repeat_purchase_rate_pct: a.repeatPurchaseRatePct,
        avg_lifetime_value: a.avgLtv,
        repeat_customer_value_multiple: a.repeatCustomerValueMultiple,
        segments: a.segments.map((s) => ({
          key: s.key,
          // `label` مفتاحُ ترجمةٍ لا عبارة (قاعدةُ المشروع في النصّ المخزَّن)،
          // فيُحَلّ هنا عند الحدّ: أدواتُ MCP إنجليزيةٌ كلّها، ومفتاحٌ خام
          // مثل `ecom.segmentVip` لا يعني شيئاً لذكاءٍ خارجيّ.
          label: t("en", s.label.key, s.label.vars),
          customers: s.count, revenue: s.revenue, avg_ltv: s.avgLtv,
        })),
        top_customers: a.topCustomers.map((c) => ({
          name: c.displayName, city: c.city, orders: c.ordersCount,
          total_spent: c.totalSpent, last_order_at: c.lastOrderAt, return_rate_pct: c.returnRatePct,
        })),
        currency: a.currency,
        has_data: a.hasData,
      };
    },
  },
  {
    name: "get_ltv_by_channel",
    description:
      "Lifetime value per acquisition channel, with cost to acquire a customer on that channel and the LTV-to-CAC ratio. A ratio below 1 means the channel loses money over the customer's life, not just on the first order. Always report the `basis` field with the answer.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Window for ad spend and newly acquired customers. Default 365." },
      },
    },
    run: async (workspaceId, args) => {
      const days = Math.min(1095, Math.max(30, Number(args.days) || 365));
      const r = await getLtvByChannel(workspaceId, days);
      return {
        channels: r.channels.map((c) => ({
          platform: c.platform, customers: c.customers, avg_lifetime_value: c.avgLtv,
          lifetime_revenue: c.lifetimeRevenue, avg_orders_per_customer: c.avgOrdersPerCustomer,
          repeat_rate_pct: c.repeatRatePct, cac: c.cac, ltv_to_cac: c.ltvToCac,
        })),
        window_days: days,
        currency: r.currency,
        basis: r.basis,
        has_data: r.hasData,
      };
    },
  },
  {
    name: "get_cohorts",
    description:
      "Customers grouped by the month of their first order: size, revenue, average lifetime value, repeat rate, and how many days it took repeat buyers to come back. Shows whether newer customers behave better or worse than older ones.",
    inputSchema: {
      type: "object",
      properties: {
        months: { type: "number", description: "How many months back. Default 12, max 36." },
      },
    },
    run: async (workspaceId, args) => {
      const months = Math.min(36, Math.max(1, Number(args.months) || 12));
      const r = await getCohorts(workspaceId, months);
      return {
        cohorts: r.cohorts.map((c) => ({
          month: c.month, customers: c.customers, revenue: c.revenue, avg_lifetime_value: c.avgLtv,
          repeat_rate_pct: c.repeatRatePct, avg_days_to_second_order: c.avgDaysToSecondOrder,
        })),
        currency: r.currency,
        has_data: r.hasData,
      };
    },
  },
  {
    name: "get_customer_journey",
    description:
      "One customer's full purchase history: every order with its date, channel and amount, which channels they bought from, and their totals. Looks up by display name only - phone and email are stored hashed, so they cannot be searched.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Part of the customer's display name." },
      },
      required: ["name"],
    },
    run: async (workspaceId, args) => {
      const j = await getCustomerJourney(workspaceId, String(args.name ?? ""));
      if (!j.found) return { found: false, basis: j.basis };
      return {
        found: true,
        name: j.displayName,
        city: j.city,
        first_order_at: j.firstOrderAt,
        last_order_at: j.lastOrderAt,
        orders_count: j.ordersCount,
        total_spent: j.totalSpent,
        total_returned: j.totalReturned,
        channels: j.channels,
        orders: j.orders.map((o) => ({
          ordered_at: o.orderedAt, platform: o.platform, total: o.total,
          returned: o.isReturned, state: o.state,
        })),
        currency: j.currency,
        basis: j.basis,
      };
    },
  },
];

export const TOOL_BY_NAME = new Map(MCP_TOOLS.map((t) => [t.name, t]));
