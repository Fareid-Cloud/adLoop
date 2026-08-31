// lib/admin/insights.ts
//
// الطبقة اللي بتفرّق بين "لوحة أرقام" و"نظام رؤى": الأرقام بتتحوّل جُمل.
//
// **قواعد ثابتة، صفر ذكاء اصطناعي** - نفس اختيار صفحة التقارير في المنتج
// نفسه. السبب مش التكلفة: الرؤية اللي بيتاخد عليها قرار تجاريّ لازم يبقى
// ليها سبب مكتوب يقدر المالك يراجعه ويعدّل عتبته، مش جملة طالعة من نموذج
// مش هترجع تانية بنفس الشكل. كل عتبة تحت مكتوبة في `THRESHOLDS` في مكان
// واحد، قابلة للتغيير بلا لمس منطق العرض.

import type { BusinessSummary } from "./business";
import type { CustomerAnalytics } from "./customers";
import type { ProductAnalytics } from "./product";
import type { OperationalAnalytics } from "./operational";
import type { UsageOverview } from "./usage";
import type { SystemHealth } from "./system";

export interface Insight {
  id: string;
  tone: "positive" | "warning" | "critical" | "neutral";
  /** الجملة نفسها - إنجليزي زي كل اللوحة */
  text: string;
  /** رابط الصفحة اللي بتفتح التفصيل - رؤية بلا مخرج نصف رؤية */
  href?: string;
}

/**
 * العتبات كلّها في مكان واحد.
 *
 * لو اتفرّقت جوّه الشروط، تعديل "إيه اللي يعتبر ملحوظ" بيبقى بحث في
 * الملف كله - وده اللي بيخلّي حد يسيبها على قيم مش مناسبة لحجمه.
 */
export const THRESHOLDS = {
  revenueMovePct: 10,
  churnedShareOfNewPct: 50,
  atRiskSharePct: 25,
  lowAdoptionPct: 20,
  minEntitledForAdoption: 5,
  stickinessLowPct: 15,
  failedPaymentsCount: 3,
  stalePipelineCount: 1,
  uncategorisedTicketsPct: 40,
  usageAnomalyCount: 1,
  vipUntagged: 1,
} as const;

export function buildInsights(input: {
  business?: BusinessSummary;
  customers?: CustomerAnalytics;
  product?: ProductAnalytics;
  operational?: OperationalAnalytics;
  usage?: UsageOverview;
  system?: SystemHealth;
}): Insight[] {
  const out: Insight[] = [];
  const { business, customers, product, operational, usage, system } = input;

  // ==================== الإيراد ====================
  if (business) {
    const d = business.revenueDeltaPct;
    if (d !== null && Math.abs(d) >= THRESHOLDS.revenueMovePct) {
      out.push({
        id: "revenue-move",
        tone: d > 0 ? "positive" : "warning",
        text: `Collected revenue ${d > 0 ? "rose" : "fell"} ${Math.abs(d).toFixed(0)}% versus the previous month.`,
        href: "/admin/analytics?tab=business",
      });
    }

    const m = business.movement;
    if (m.churnedUsdCents > 0 && m.newUsdCents > 0) {
      const share = (m.churnedUsdCents / m.newUsdCents) * 100;
      if (share >= THRESHOLDS.churnedShareOfNewPct) {
        out.push({
          id: "churn-eating-growth",
          tone: "critical",
          text: `Churned revenue is ${share.toFixed(0)}% of new revenue this period — growth is being cancelled out, not compounded.`,
          href: "/admin/analytics?tab=business",
        });
      }
    }

    if (business.payments.failedThisPeriod >= THRESHOLDS.failedPaymentsCount) {
      out.push({
        id: "failed-payments",
        tone: "warning",
        text: `${business.payments.failedThisPeriod} payments failed this period. Failed cards are recoverable revenue if you reach the customer before they lapse.`,
        href: "/admin/customers?status=PAST_DUE",
      });
    }

    if (business.payments.stuckAwaitingWebhook > 0) {
      out.push({
        id: "stuck-awaiting-webhook",
        tone: "critical",
        text:
          `${business.payments.stuckAwaitingWebhook} payment${business.payments.stuckAwaitingWebhook === 1 ? " has" : "s have"} been pending for over 30 minutes. ` +
          (business.payments.paymobWebhooksEverReceived === 0
            ? "No Paymob webhook has ever reached us — check that the Integration Processed Callback URL is set, and that PAYMOB_HMAC_SECRET matches that integration."
            : "The card may have been charged without the subscription being activated."),
        href: "/admin/analytics?tab=business",
      });
    }

    if (business.payments.pendingOlderThanDay > 0) {
      out.push({
        id: "abandoned-checkout",
        tone: "neutral",
        text: `${business.payments.pendingOlderThanDay} checkouts were started over a day ago and never completed.`,
        href: "/admin/analytics?tab=business",
      });
    }

    // شرح صريح لغياب رقم، لا صفر صامت
    if (business.movement.events === 0) {
      out.push({
        id: "movement-no-history",
        tone: "neutral",
        text: "Revenue movement (new / expansion / contraction) has no history yet — subscription events started being recorded with this panel and build up from here.",
      });
    }
  }

  // ==================== العملاء ====================
  if (customers) {
    if (customers.total > 0) {
      const share = (customers.atRisk / customers.total) * 100;
      if (share >= THRESHOLDS.atRiskSharePct) {
        out.push({
          id: "at-risk-share",
          tone: "warning",
          text: `${customers.atRisk} of ${customers.total} accounts (${share.toFixed(0)}%) have not logged in for two weeks.`,
          href: "/admin/customers?atRisk=1",
        });
      }
    }

    const untaggedVip = customers.topByMrr.filter((c) => !c.isVip).slice(0, 3);
    if (untaggedVip.length >= THRESHOLDS.vipUntagged) {
      out.push({
        id: "vip-untagged",
        tone: "neutral",
        text: `${untaggedVip.length} of your highest-paying accounts are not marked VIP — ${untaggedVip.map((c) => c.email).join(", ")}.`,
        href: "/admin/customers",
      });
    }

    if (customers.newDeltaPct !== null && Math.abs(customers.newDeltaPct) >= THRESHOLDS.revenueMovePct) {
      out.push({
        id: "signup-move",
        tone: customers.newDeltaPct > 0 ? "positive" : "warning",
        text: `New signups are ${customers.newDeltaPct > 0 ? "up" : "down"} ${Math.abs(customers.newDeltaPct).toFixed(0)}% versus the previous period.`,
        href: "/admin/analytics?tab=customers",
      });
    }
  }

  // ==================== المنتج ====================
  if (product) {
    if (product.stickinessPct !== null && product.mau >= 10 && product.stickinessPct < THRESHOLDS.stickinessLowPct) {
      out.push({
        id: "low-stickiness",
        tone: "warning",
        text: `Stickiness is ${product.stickinessPct.toFixed(0)}% (DAU/MAU) — most accounts open the product occasionally rather than as a habit.`,
        href: "/admin/analytics?tab=product",
      });
    }

    for (const f of product.features) {
      if (
        f.adoptionPct !== null &&
        f.entitled !== null &&
        f.entitled >= THRESHOLDS.minEntitledForAdoption &&
        f.adoptionPct < THRESHOLDS.lowAdoptionPct
      ) {
        out.push({
          id: `low-adoption-${f.key}`,
          tone: "neutral",
          text: `${f.label}: ${f.entitled} accounts can use it, ${f.users} did. Adoption ${f.adoptionPct.toFixed(0)}%.`,
          href: "/admin/analytics?tab=product",
        });
      }
    }

    if (product.workspacesTotal > 0) {
      const stale = product.workspacesTotal - product.workspacesWithFreshData;
      if (stale > 0) {
        out.push({
          id: "stale-data",
          tone: stale > product.workspacesTotal / 4 ? "warning" : "neutral",
          text: `${stale} of ${product.workspacesTotal} workspaces have no ad data from the last 48 hours.`,
          href: "/admin/system",
        });
      }
    }
  }

  // ==================== الاستهلاك ====================
  if (usage) {
    if (usage.anomalies.length >= THRESHOLDS.usageAnomalyCount) {
      const top = usage.anomalies[0];
      out.push({
        id: "usage-anomaly",
        tone: "warning",
        text: `${usage.anomalies.length} account${usage.anomalies.length === 1 ? "" : "s"} consuming abnormally — ${top.email} ran ${top.todayCalls} AI calls today against its own ${top.averageCalls} average (${top.multiple}×).`,
        href: "/admin/analytics?tab=usage",
      });
    }
    if (usage.nearOrOverCap.length > 0) {
      out.push({
        id: "usage-cap",
        tone: "neutral",
        text: `${usage.nearOrOverCap.length} account${usage.nearOrOverCap.length === 1 ? " has" : "s have"} hit a usage warning or block in the last 30 days.`,
        href: "/admin/analytics?tab=usage",
      });
    }
    if (!usage.costConfigured && usage.totalEstimatedTokens > 0) {
      out.push({
        id: "cost-not-configured",
        tone: "neutral",
        text: "AI cost in dollars is not configured — set CLAUDE_COST_PER_MTOK_USD to turn the token estimate into a money figure.",
      });
    }
  }

  // ==================== التشغيل ====================
  if (system) {
    if (system.counts.STUCK > 0) {
      out.push({
        id: "stuck-syncs",
        tone: "critical",
        text: `${system.counts.STUCK} sync run${system.counts.STUCK === 1 ? "" : "s"} never reported back and are still marked running.`,
        href: "/admin/system",
      });
    }
    if (system.counts.FAILED >= THRESHOLDS.stalePipelineCount) {
      out.push({
        id: "failed-syncs",
        tone: "warning",
        text: `${system.counts.FAILED} workspace${system.counts.FAILED === 1 ? "" : "s"} last synced with an error.`,
        href: "/admin/system",
      });
    }
    if (system.expiringConnections > 0) {
      out.push({
        id: "expiring-connections",
        tone: "warning",
        text: `${system.expiringConnections} platform connection${system.expiringConnections === 1 ? "" : "s"} expire within a week — data goes stale silently when they lapse.`,
        href: "/admin/system",
      });
    }
  }

  if (operational) {
    const total = operational.tickets.open + operational.tickets.answered + operational.tickets.closed;
    if (total > 0 && operational.uncategorised / total >= THRESHOLDS.uncategorisedTicketsPct / 100) {
      out.push({
        id: "uncategorised-tickets",
        tone: "neutral",
        text: `${operational.uncategorised} of ${total} support threads have no category — "most common problem" stays a guess until they do.`,
        href: "/admin/support",
      });
    }
    if (operational.tickets.open > 0) {
      out.push({
        id: "open-tickets",
        tone: operational.tickets.open > 5 ? "warning" : "neutral",
        text: `${operational.tickets.open} support thread${operational.tickets.open === 1 ? " is" : "s are"} waiting on a reply.`,
        href: "/admin/support",
      });
    }
  }

  // الترتيب بالخطورة: اللوحة بتتقري من فوق، فالحرج لازم يبقى فوق
  const rank = { critical: 0, warning: 1, positive: 2, neutral: 3 };
  return out.sort((a, z) => rank[a.tone] - rank[z.tone]);
}
