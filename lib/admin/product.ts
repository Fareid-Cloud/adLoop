// lib/admin/product.ts
//
// تحليلات المنتج: مين بيستخدم إيه فعلاً.
//
// **الصدق هنا أهم من الاكتمال.** الميزات المدفوعة بالذكاء الاصطناعي
// عندها عدّادات حقيقية من زمان، فأرقامها دقيقة. باقي المنتج مافيهوش قياس
// أصلاً - عشان كده اتضاف `FeatureEvent` (سجلّ خفيف: مين، أنهي ميزة،
// إمتى) وبيتوصّل تدريجياً على أهم الشاشات مش على المنتج كله مرّة واحدة.
// الميزة اللي لسه ماتوصّلتش بتظهر "not instrumented" مش صفر استخدام.

import { prisma } from "@/lib/prisma";
import { dayKey } from "./shared";

/**
 * الميزات اللي فيها قياس فعليّ دلوقتي.
 *
 * القائمة **مصدر حقيقة معروض في الواجهة**: بتفرّق بين "ميزة مقيسة
 * استخدامها صفر" و"ميزة مش مقيسة". الاتنين بيبانوا زي بعض في أي جدول
 * بيعدّ صفوف، والفرق بينهم هو الفرق بين "الميزة فاشلة" و"إحنا مش عارفين".
 */
export const INSTRUMENTED_FEATURES = [
  { key: "scale_kill_apply", label: "Scale / Kill applied" },
  { key: "bid_strategy_apply", label: "Bid strategy applied" },
  { key: "report_generated", label: "Report generated" },
  { key: "deep_scan_started", label: "Deep site scan" },
  { key: "saved_view_created", label: "Saved view created" },
  { key: "automation_rule_created", label: "Automation rule created" },
  { key: "store_connected", label: "Store connected" },
  { key: "mcp_query", label: "MCP query" },
] as const;

export type InstrumentedFeatureKey = (typeof INSTRUMENTED_FEATURES)[number]["key"];

export interface FeatureUsageRow {
  key: string;
  label: string;
  events: number;
  users: number;
  /** كام حساب **يقدر** يستخدمها حسب باقته - مقام معدّل التبنّي */
  entitled: number | null;
  adoptionPct: number | null;
}

export interface ProductAnalytics {
  dau: number;
  wau: number;
  mau: number;
  /** DAU/MAU - مقياس اللزوجة القياسيّ */
  stickinessPct: number | null;
  activityTrend: Array<{ date: string; users: number }>;
  features: FeatureUsageRow[];
  aiFeatureUsage: Array<{ label: string; users: number; calls: number }>;
  platforms: Array<{ platform: string; accounts: number }>;
  workspacesWithFreshData: number;
  workspacesTotal: number;
  automationRules: number;
  appliedDecisions: number;
  /** ملاحظة تظهر تحت جدول الميزات */
  instrumentationNote: string;
}

export async function getProductAnalytics(days = 30): Promise<ProductAnalytics> {
  const now = Date.now();
  const d1 = new Date(now - 86_400_000);
  const d7 = new Date(now - 7 * 86_400_000);
  const d30 = new Date(now - 30 * 86_400_000);
  const since = new Date(now - days * 86_400_000);
  const freshSince = new Date(now - 2 * 86_400_000);

  const [
    dauRows, wauRows, mauRows, activityRows,
    featureGroups, featureUserRows,
    platforms, workspacesTotal, freshWorkspaces,
    automationRules, appliedDecisions, aiUsers,
  ] = await Promise.all([
    prisma.userActivityDay.findMany({ where: { date: { gte: d1 } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.userActivityDay.findMany({ where: { date: { gte: d7 } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.userActivityDay.findMany({ where: { date: { gte: d30 } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.userActivityDay.findMany({ where: { date: { gte: since } }, select: { date: true, userId: true } }),
    prisma.featureEvent.groupBy({ by: ["key"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.featureEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { key: true, userId: true },
      distinct: ["key", "userId"],
    }),
    prisma.connectedPlatform.groupBy({ by: ["platform"], _count: true }),
    prisma.workspace.count(),
    prisma.metricSnapshot.findMany({
      where: { date: { gte: freshSince } },
      select: { workspaceId: true },
      distinct: ["workspaceId"],
    }),
    prisma.automationRule.count(),
    prisma.actionFeedItem.count({ where: { status: "APPLIED" } }),
    prisma.user.findMany({
      where: {
        OR: [
          { aiRefreshMonthlyCount: { gt: 0 } },
          { imageQualityMonthlyCount: { gt: 0 } },
          { siteScanMonthlyCount: { gt: 0 } },
        ],
      },
      select: { aiRefreshMonthlyCount: true, imageQualityMonthlyCount: true, siteScanMonthlyCount: true },
    }),
  ]);

  const dau = dauRows.length;
  const wau = wauRows.length;
  const mau = mauRows.length;

  const trendMap = new Map<string, Set<string>>();
  for (const r of activityRows) {
    const k = dayKey(r.date);
    const set = trendMap.get(k) ?? new Set<string>();
    set.add(r.userId);
    trendMap.set(k, set);
  }

  const eventCount = new Map(featureGroups.map((g) => [g.key, g._count]));
  const userCount = new Map<string, number>();
  for (const r of featureUserRows) userCount.set(r.key, (userCount.get(r.key) ?? 0) + 1);

  // مقام التبنّي: كام حساب باقته بتسمح بالميزة. متاح للميزات اللي ليها
  // حقل في `PlanLimits`؛ اللي مالهاش بيرجع `null` وبيظهر "—" مش صفر.
  const entitledFor = await entitledCounts();

  const features: FeatureUsageRow[] = INSTRUMENTED_FEATURES.map((f) => {
    const users = userCount.get(f.key) ?? 0;
    const entitled = entitledFor[f.key] ?? null;
    return {
      key: f.key,
      label: f.label,
      events: eventCount.get(f.key) ?? 0,
      users,
      entitled,
      adoptionPct: entitled && entitled > 0 ? (users / entitled) * 100 : null,
    };
  }).sort((a, z) => z.events - a.events);

  const aiFeatureUsage = [
    { label: "AI insights / Ask", users: aiUsers.filter((u) => u.aiRefreshMonthlyCount > 0).length, calls: aiUsers.reduce((s, u) => s + u.aiRefreshMonthlyCount, 0) },
    { label: "Image quality audit", users: aiUsers.filter((u) => u.imageQualityMonthlyCount > 0).length, calls: aiUsers.reduce((s, u) => s + u.imageQualityMonthlyCount, 0) },
    { label: "Deep site scan", users: aiUsers.filter((u) => u.siteScanMonthlyCount > 0).length, calls: aiUsers.reduce((s, u) => s + u.siteScanMonthlyCount, 0) },
  ];

  return {
    dau,
    wau,
    mau,
    stickinessPct: mau > 0 ? (dau / mau) * 100 : null,
    activityTrend: [...trendMap.entries()]
      .sort((a, z) => a[0].localeCompare(z[0]))
      .map(([date, set]) => ({ date, users: set.size })),
    features,
    aiFeatureUsage,
    platforms: platforms.map((p) => ({ platform: p.platform, accounts: p._count })),
    workspacesWithFreshData: freshWorkspaces.length,
    workspacesTotal,
    automationRules,
    appliedDecisions,
    instrumentationNote:
      "Only the features listed here emit usage events. A zero here means the feature was not used; a feature missing from this list is not measured at all yet — the two are different, and the list grows as instrumentation is added.",
  };
}

/** كام حساب باقته بتسمح بكل ميزة - مقام معدّل التبنّي */
async function entitledCounts(): Promise<Record<string, number>> {
  const { PLAN_BY_KEY } = await import("@/lib/plans");
  const groups = await prisma.user.groupBy({ by: ["subscriptionPlan"], _count: true });

  let scaleKillApply = 0;
  let mcp = 0;
  let reports = 0;
  let deepScans = 0;
  let automation = 0;
  let stores = 0;
  let savedViews = 0;

  for (const g of groups) {
    const plan = PLAN_BY_KEY.get((g.subscriptionPlan ?? "free") as never);
    if (!plan) continue;
    const l = plan.limits;
    if (l.scaleKill === "apply") scaleKillApply += g._count;
    if (l.mcp) mcp += g._count;
    if (l.scheduledReports) reports += g._count;
    if (l.deepScans > 0 || l.deepScans === -1) deepScans += g._count;
    if (l.automationRules !== 0) automation += g._count;
    if (l.stores > 0 || l.stores === -1) stores += g._count;
    if (l.savedViews > 0 || l.savedViews === -1) savedViews += g._count;
  }

  return {
    scale_kill_apply: scaleKillApply,
    bid_strategy_apply: scaleKillApply,
    report_generated: reports,
    deep_scan_started: deepScans,
    saved_view_created: savedViews,
    automation_rule_created: automation,
    store_connected: stores,
    mcp_query: mcp,
  };
}
