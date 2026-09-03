// app/admin/page.tsx
//
// نظرة عامة - الشاشة اللي بتتفتح الأول كل يوم.
//
// الترتيب مقصود: **الرؤى فوق الأرقام.** الأرقام بتقول "الوضع إيه"،
// والجُمل بتقول "بُصّ على إيه" - واللي بيتفتح كل يوم محتاج التانية أوّلاً.
// اللي تحت الرؤى ملخّص، والتفصيل في صفحته.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Sparkline } from "@/app/components/ui/Sparkline";
import {
  LayoutDashboard, Users, DollarSign, Activity, AlertTriangle, Cpu, Star, LifeBuoy,
  Briefcase, ArrowRight,
} from "lucide-react";
import { lastNDays } from "@/lib/admin/shared";
import { getBusinessSummary } from "@/lib/admin/business";
import { getCustomerAnalytics } from "@/lib/admin/customers";
import { getProductAnalytics } from "@/lib/admin/product";
import { getOperationalAnalytics } from "@/lib/admin/operational";
import { getUsageOverview } from "@/lib/admin/usage";
import { getSystemHealth } from "@/lib/admin/system";
import { buildInsights } from "@/lib/admin/insights";
import { AdminPageHeader, Card, SectionTitle, InsightStrip, Badge, money, ago, dateTime } from "./components/AdminUI";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const user = await getSessionUserFromCookies();
  const role = resolveAdminRole(user);
  const caps = adminCapabilities(role);
  const canSeeMoney = caps.includes("analytics.financial");

  const range = lastNDays(30);

  const canSeeSales = caps.includes("customers.subscription");

  const [customers, product, operational, usage, system, business, recentAudit, newEnquiries, latestEnquiry] = await Promise.all([
    getCustomerAnalytics(range),
    getProductAnalytics(30),
    getOperationalAnalytics(range),
    getUsageOverview(30),
    getSystemHealth(),
    // الأرقام المالية ما تتحسبش أصلاً لمن ماعندوش صلاحيتها - إخفاء البطاقة
    // بس معناه إنّ الاستعلام اتنفّذ والبيانات وصلت للخادم بلا داعي.
    canSeeMoney ? getBusinessSummary(range) : Promise.resolve(undefined),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }).catch(() => []),
    // مين مايقدرش يمنح باقة مايشوفش الطابور - البانِرُ بيوعد بفعلٍ
    // الصفحةُ اللي وراه هتمنعه منه.
    canSeeSales ? prisma.salesEnquiry.count({ where: { status: "NEW" } }) : Promise.resolve(0),
    canSeeSales
      ? prisma.salesEnquiry.findFirst({
          where: { status: "NEW" },
          orderBy: { createdAt: "desc" },
          select: { company: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  const insights = buildInsights({ business, customers, product, operational, usage, system });

  const activitySeries = product.activityTrend.map((p) => p.users);
  const revenueSeries = business?.revenue.map((p) => p.usdCents / 100) ?? [];

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        subtitle={`Last 30 days · ${role === "OWNER" ? "Full access" : "Support access"}`}
        icon={LayoutDashboard}
      />

      {/* 🔴 **طلبُ الشراء مايستنّاش دورَه في الترتيب.**
          كلُّ حاجة تانية في الصفحة دي ملخَّصٌ بيستنّى، وده وحدُه فيه حدٌّ
          مستنّي ردّاً - وقيمتُه بتنزل بالساعة. فوق الرؤى، وبلونٍ يخطف
          العين، وبيختفي تماماً لمّا الطابور يفضى: بانِرٌ دائم بيتحوّل
          لخلفيةٍ في أسبوع فيتقري كزخرفة. */}
      {newEnquiries > 0 && (
        <Link
          href="/admin/sales?status=NEW"
          className="mb-4 flex items-center gap-3 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 no-underline transition-colors hover:bg-critical/15"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-critical text-white">
            <Briefcase size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-critical">
              {newEnquiries === 1
                ? "1 enterprise request is waiting"
                : `${newEnquiries} enterprise requests are waiting`}
            </span>
            <span className="block text-[12px] text-text-muted">
              {latestEnquiry
                ? `Newest: ${latestEnquiry.company} · ${ago(latestEnquiry.createdAt)}`
                : "Priced on a call — nobody has replied yet"}
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-critical rtl:rotate-180" />
        </Link>
      )}

      <InsightStrip insights={insights} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {canSeeMoney && business && (
          <MetricCard
            locale="en"
            label="MRR"
            value={money(business.mrr.usd.usd)}
            icon={DollarSign}
            tone="verified"
            subLabel={`${business.mrr.payingCustomers} paying`}
            // `toUsd` تُخرج من المجموع أيّ عملةٍ بلا سعر صرف مسجَّل - وهو
            // القرار الصحيح ("الغياب الصريح أصدق من رقم مطمئن غلط"، وهو نصّ
            // التعليق في `lib/admin/shared.ts`). لكنّ تبويب الأعمال وحده كان
            // يقول ذلك، والرقم هنا - وهو أوّل ما يُقرأ - يبدو كاملاً وليس كذلك.
            caption={
              Object.keys(business.mrr.usd.unconverted).length > 0
                ? {
                    text: `Excludes ${Object.entries(business.mrr.usd.unconverted)
                      .map(([c, v]) => `${(v / 100).toLocaleString("en-US")} ${c}`)
                      .join(", ")} — no exchange rate recorded`,
                    tone: "warning" as const,
                  }
                : undefined
            }
            trend={revenueSeries.length >= 4 ? <Sparkline values={revenueSeries} tone="verified" /> : undefined}
            delta={
              business.revenueDeltaPct !== null
                ? {
                    value: `${Math.abs(business.revenueDeltaPct).toFixed(0)}%`,
                    direction: business.revenueDeltaPct >= 0 ? "up" : "down",
                    positive: business.revenueDeltaPct >= 0,
                    caption: "vs previous month",
                  }
                : undefined
            }
          />
        )}
        <MetricCard
          locale="en"
          label="Customers"
          value={customers.total.toLocaleString("en-US")}
          icon={Users}
          tone="accent"
          subLabel={`${customers.paying} paying · ${customers.trialing} trialing`}
          delta={
            customers.newDeltaPct !== null
              ? {
                  value: `${Math.abs(customers.newDeltaPct).toFixed(0)}%`,
                  direction: customers.newDeltaPct >= 0 ? "up" : "down",
                  positive: customers.newDeltaPct >= 0,
                  caption: "new signups vs previous",
                }
              : undefined
          }
        />
        <MetricCard
          locale="en"
          label="Active (30d)"
          value={product.mau.toLocaleString("en-US")}
          icon={Activity}
          tone="accent"
          subLabel={product.stickinessPct !== null ? `${product.stickinessPct.toFixed(0)}% stickiness` : "DAU/MAU pending"}
          trend={activitySeries.length >= 4 ? <Sparkline values={activitySeries} tone="accent" /> : undefined}
        />
        <MetricCard
          locale="en"
          label="At risk"
          value={customers.atRisk.toLocaleString("en-US")}
          icon={AlertTriangle}
          tone={customers.atRisk > 0 ? "gap" : "verified"}
          subLabel="no login in 14 days"
          href="/admin/customers?atRisk=1"
        />
        <MetricCard
          locale="en"
          label="AI calls (period)"
          value={usage.totalAiCalls.toLocaleString("en-US")}
          icon={Cpu}
          tone={usage.anomalies.length > 0 ? "gap" : "accent"}
          subLabel={
            usage.totalEstimatedCostUsd !== null
              ? `~$${usage.totalEstimatedCostUsd.toFixed(2)} est.`
              : `~${(usage.totalEstimatedTokens / 1_000_000).toFixed(1)}M tokens`
          }
          href="/admin/analytics?tab=usage"
        />
        <MetricCard
          locale="en"
          label="Open issues"
          value={(system.urgentIssues + operational.tickets.open).toLocaleString("en-US")}
          icon={LifeBuoy}
          tone={system.urgentIssues + operational.tickets.open > 0 ? "critical" : "verified"}
          subLabel={`${operational.tickets.open} tickets · ${system.urgentIssues} account alerts`}
          href="/admin/support"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* صحة المزامنة */}
        <Card>
          <SectionTitle hint={system.lastCronRun ? ago(system.lastCronRun.runAt) : undefined}>
            Sync health
          </SectionTitle>
          {system.lastCronRun ? (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-text-primary">
                  {system.lastCronRun.succeeded}/{system.lastCronRun.totalWorkspaces}
                </span>
                <span className="text-[12px] text-text-faint">workspaces synced</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["STUCK", "FAILED", "STALE", "NEVER", "RUNNING", "OK"] as const).map((k) =>
                  system.counts[k] > 0 ? (
                    <Badge
                      key={k}
                      tone={k === "OK" ? "ok" : k === "RUNNING" ? "info" : k === "STALE" || k === "NEVER" ? "warn" : "bad"}
                    >
                      {system.counts[k]} {k.toLowerCase()}
                    </Badge>
                  ) : null
                )}
              </div>
              <Link href="/admin/system" className="mt-3 inline-block text-[12px] text-accent no-underline hover:underline">
                Open system health →
              </Link>
            </>
          ) : (
            <p className="text-[12px] text-text-faint">No cron run logged yet.</p>
          )}
        </Card>

        {/* أعلى الحسابات قيمة */}
        <Card>
          <SectionTitle hint="by monthly value">Top accounts</SectionTitle>
          {customers.topByMrr.length === 0 ? (
            <p className="text-[12px] text-text-faint">No paying accounts yet.</p>
          ) : (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {customers.topByMrr.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-primary no-underline hover:underline"
                  >
                    {c.isVip && <Star size={11} className="shrink-0 fill-gap text-gap" />}
                    <span className="truncate">{c.email}</span>
                  </Link>
                  {canSeeMoney && (
                    <span className="shrink-0 text-[12px] tabular-nums text-text-muted">{money(c.usdCents)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* آخر أفعال الأدمن */}
        <Card>
          <SectionTitle hint="last 8">Admin activity</SectionTitle>
          {recentAudit.length === 0 ? (
            <p className="text-[12px] text-text-faint">Nothing logged yet.</p>
          ) : (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {recentAudit.map((log) => (
                <li key={log.id} className="text-[12px] leading-snug">
                  <span className="font-mono text-[10.5px] uppercase tracking-wide text-text-faint">{log.action}</span>
                  <div className="truncate text-text-muted" title={log.details ?? undefined}>
                    {log.details ?? "—"}
                  </div>
                  <div className="text-[10.5px] text-text-faint">{dateTime(log.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/audit" className="mt-3 inline-block text-[12px] text-accent no-underline hover:underline">
            Full audit log →
          </Link>
        </Card>
      </div>
    </div>
  );
}
