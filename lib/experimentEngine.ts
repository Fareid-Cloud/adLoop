// lib/experimentEngine.ts
//
// المعمل: كل قرار يُنفَّذ (بموافقتك أو بقاعدة أتمتة) يُسجَّل تلقائياً كتجربة،
// ثم تُقاس نتيجته بعد اكتمال نافذة القياس بمقارنة الفترة التالية للتغيير
// بالفترة السابقة له مباشرة — بنفس الطول وعلى نفس الحملة.
//
// السياق: جدول ExperimentLog كان موجوداً في قاعدة البيانات منذ زمن، لكن
// **لا شيء في المنتج كله كان يكتب فيه**، وكانت الصفحة تعرض نموذج إضافة
// يدوية فقط - فبدت الميزة بلا معنى. هذا الملف هو الحلقة المفقودة.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { EXPERIMENT_METRICS, DEFAULT_TRACKED_METRICS as DEFAULT_TRACKED, type ExperimentMetricKey } from "@/lib/experimentMetrics";

// معاد التصدير للتوافق مع المستوردين الحاليين على الخادم
export { EXPERIMENT_METRICS };
export type { ExperimentMetricKey };


interface Totals {
  cost: number; clicks: number; impressions: number;
  raw: number; verified: number; revenue: number;
  orders: number; returned: number;
}

const EMPTY: Totals = { cost: 0, clicks: 0, impressions: 0, raw: 0, verified: 0, revenue: 0, orders: 0, returned: 0 };

function sum(rows: any[]): Totals {
  return rows.reduce((a, r) => ({
    cost: a.cost + (r.cost ?? 0),
    clicks: a.clicks + (r.clicks ?? 0),
    impressions: a.impressions + (r.impressions ?? 0),
    raw: a.raw + (r.rawConversions ?? 0),
    verified: a.verified + (r.verifiedConversions ?? 0),
    revenue: a.revenue + (r.revenue ?? 0),
    orders: a.orders + (r.ordersCount ?? 0),
    returned: a.returned + (r.returnedOrdersCount ?? 0),
  }), { ...EMPTY });
}

function metricValue(key: string, t: Totals): number {
  switch (key) {
    case "cost": return t.cost;
    case "clicks": return t.clicks;
    case "impressions": return t.impressions;
    case "ctr": return t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    case "cpc": return t.clicks > 0 ? t.cost / t.clicks : 0;
    case "cpm": return t.impressions > 0 ? (t.cost / t.impressions) * 1000 : 0;
    case "conversions_reported": return t.raw;
    case "conversions_verified": return t.verified;
    case "verification_rate": return t.raw > 0 ? (t.verified / t.raw) * 100 : 0;
    case "inflation_rate": return t.raw > 0 ? ((t.raw - t.verified) / t.raw) * 100 : 0;
    case "cpl_raw": return t.raw > 0 ? t.cost / t.raw : 0;
    case "cpl_verified": return t.verified > 0 ? t.cost / t.verified : 0;
    case "conversion_rate": return t.clicks > 0 ? (t.verified / t.clicks) * 100 : 0;
    case "revenue": return t.revenue;
    case "roas": return t.cost > 0 ? t.revenue / t.cost : 0;
    case "orders": return t.orders;
    case "aov": return t.orders > 0 ? t.revenue / t.orders : 0;
    case "returned_orders": return t.returned;
    case "profit_estimate": return t.revenue - t.cost;
    case "verified_share_of_spend": return t.cost > 0 ? (t.verified / t.cost) * 100 : 0;
    default: return 0;
  }
}

/** يُسجَّل عند تنفيذ أي قرار فعلي - هذه هي نقطة الدخول التلقائية. */
export async function recordExperiment(input: {
  workspaceId: string;
  changeType: "BUDGET" | "AD_COPY" | "CREATIVE" | "LANDING_PAGE" | "TARGETING" | "BID_STRATEGY" | "PAUSE" | "AUTOMATION_RULE" | "OTHER";
  description: string;
  campaignId?: string | null;
  platform?: string | null;
  sourceActionId?: string | null;
  trackedMetrics?: ExperimentMetricKey[];
  windowDays?: number;
  note?: string | null;
  source?: "AUTO" | "MANUAL";
}) {
  return prisma.experimentLog.create({
    data: {
      workspaceId: input.workspaceId,
      changeType: input.changeType as any,
      description: input.description,
      relatedCampaignId: input.campaignId ?? null,
      platform: (input.platform as any) ?? null,
      sourceActionId: input.sourceActionId ?? null,
      trackedMetrics: input.trackedMetrics ?? DEFAULT_TRACKED,
      windowDays: input.windowDays ?? 7,
      note: input.note ?? null,
      source: (input.source ?? "AUTO") as any,
      status: "RUNNING",
    },
  });
}

/**
 * القياس اليومي: أي تجربة اكتملت نافذتها تُقاس مرة واحدة ثم تُقفل.
 * المقارنة: نفس عدد الأيام قبل التغيير مقابل بعده، على نفس الحملة إن حُدِّدت.
 */
export async function measurePendingExperiments(workspaceId: string) {
  const running = await prisma.experimentLog.findMany({
    where: { workspaceId, status: "RUNNING" },
  });
  if (running.length === 0) return;

  for (const exp of running) {
    const windowDays = exp.windowDays ?? 7;
    const changedAt = exp.changedAt;
    const windowEnd = new Date(changedAt);
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    // النافذة لم تكتمل بعد - نتركها تعمل
    if (windowEnd > new Date()) continue;

    const beforeStart = new Date(changedAt);
    beforeStart.setDate(beforeStart.getDate() - windowDays);

    const scope: any = {
      workspaceId,
      ...(exp.relatedCampaignId ? { campaignId: exp.relatedCampaignId } : {}),
      ...(exp.platform ? { platform: exp.platform } : {}),
    };

    const select = {
      cost: true, clicks: true, impressions: true, rawConversions: true,
      verifiedConversions: true, revenue: true, ordersCount: true, returnedOrdersCount: true,
    };

    const [beforeRows, afterRows] = await Promise.all([
      prisma.metricSnapshot.findMany({ where: { ...scope, date: { gte: beforeStart, lt: changedAt } }, select }),
      prisma.metricSnapshot.findMany({ where: { ...scope, date: { gte: changedAt, lte: windowEnd } }, select }),
    ]);

    // لا بيانات على أحد الجانبين ⇒ لا يمكن الحكم. نقولها صراحة بدل رقم مضلّل.
    if (beforeRows.length === 0 || afterRows.length === 0) {
      await prisma.experimentLog.update({
        where: { id: exp.id },
        data: { status: "INCONCLUSIVE", confidenceLevel: "INSUFFICIENT_DATA", measuredAt: new Date() },
      });
      continue;
    }

    const beforeTotals = sum(beforeRows);
    const afterTotals = sum(afterRows);

    const keys = exp.trackedMetrics.length > 0 ? exp.trackedMetrics : DEFAULT_TRACKED;
    const results: Record<string, { before: number; after: number; changePct: number | null }> = {};

    for (const key of keys) {
      const before = metricValue(key, beforeTotals);
      const after = metricValue(key, afterTotals);
      results[key] = {
        before: Math.round(before * 100) / 100,
        after: Math.round(after * 100) / 100,
        changePct: before > 0 ? Math.round(((after - before) / before) * 1000) / 10 : null,
      };
    }

    // الثقة من حجم العينة الحقيقي: التحويلات المحقّقة هي الأساس، لأن
    // اختلاف يومين في الإنفاق لا يعني شيئاً بلا تحويلات تؤكده.
    const verifiedTotal = beforeTotals.verified + afterTotals.verified;
    const confidenceLevel =
      verifiedTotal >= 40 ? "RELIABLE" : verifiedTotal >= 12 ? "PRELIMINARY" : "INSUFFICIENT_DATA";

    const primary = keys[0];
    await prisma.experimentLog.update({
      where: { id: exp.id },
      data: {
        status: "MEASURED",
        measuredAt: new Date(),
        metricResults: results,
        measuredMetric: primary,
        beforeMetricValue: results[primary]?.before ?? null,
        afterMetricValue: results[primary]?.after ?? null,
        confidenceLevel: confidenceLevel as any,
      },
    });

    // نتيجة موثوقة تستحق إشعاراً - وإلا تبقى في الصفحة دون إزعاج
    if (confidenceLevel === "RELIABLE") {
      const def = EXPERIMENT_METRICS.find((m) => m.key === primary);
      const change = results[primary]?.changePct;
      if (def && change !== null && change !== undefined) {
        const improved = def.lowerIsBetter ? change < 0 : change > 0;
        await pushToActionFeed({
          workspaceId,
          type: "ALERT",
          severity: "LOW",
          title: `نتيجة تجربة: ${improved ? "تحسّن" : "تراجع"} ${def.labelAr} بنسبة ${Math.abs(change)}%`,
          description: exp.description,
          linkUrl: "/dashboard/experiments",
        });
      }
    }
  }
}
