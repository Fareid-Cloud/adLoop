// app/dashboard/ecommerce/page.tsx
//
// النظرة التنفيذية للمتجر - ليست لوحة إعلانات ولا نسخة من تحليلات سلة.
// ثمانية مؤشّرات تجارية فقط، ثم أكبر الفرص وأكبر تسريب، ثم إجراءات.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/app/components/ui/MetricCard";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate, fmtNum,
  type RecommendedAction,
} from "./_components/EcomPrimitives";
import { getStoreOverview, getProfitJourney } from "@/lib/ecommerce/storeIntelligence";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import {
  Wallet, TrendingUp, Percent, ShoppingCart, Receipt, Repeat, RotateCcw, PackageX,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EcommerceOverviewPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return (
      <DataGate
        titleAr="لا توجد مساحة عمل بعد"
        reasonAr="ارجع إلى «لمحة» لإنشاء أول مساحة عمل."
        href="/dashboard"
        hrefLabelAr="إلى لمحة"
      />
    );
  }

  const [overview, journey, opps] = await Promise.all([
    getStoreOverview(workspace.id, 30),
    getProfitJourney(workspace.id, 30),
    buildOpportunities(workspace.id, 30),
  ]);

  const c = overview.currency;

  if (!overview.hasStoreConnection && overview.revenue === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <EcomHeader
          title="التجارة الإلكترونية"
          subtitle="أين تربح، أين تخسر، وما القرار التالي الذي يزيد أرباح متجرك."
          storeName={workspace.name}
        />
        <DataGate
          titleAr="اربط متجرك أولاً"
          reasonAr="هذا القسم يقيس الربح الحقيقي بعد كل التكاليف، ويحتاج طلباتك الفعلية. بدون متجر مربوط نعرف إنفاقك الإعلاني ولا نعرف ما عاد منه."
        />
      </div>
    );
  }

  const topOpps = opps.opportunities.slice(0, 3);
  const actions: RecommendedAction[] = topOpps.map((o) => ({
    titleAr: o.titleAr,
    reasonAr: o.reasonAr,
    impactAr: `أثر مقدَّر: ${fmtNum(o.estimatedMonthlyProfit)} ${c} شهرياً`,
    href: o.actionHref,
    hrefLabelAr: "نفّذ",
    tone: o.type === "PAUSE_ADS" || o.type === "RAISE_PRICE" ? "critical" : "positive",
  }));

  if (journey.biggestLeak) {
    actions.push({
      titleAr: `أكبر بند يستهلك إيرادك: ${journey.biggestLeak.labelAr}`,
      reasonAr: `يلتهم ${journey.biggestLeak.pctOfRevenue}% من إيرادك (${fmtNum(journey.biggestLeak.amount)} ${c}). أي خفض هنا يظهر في صافي الربح مباشرة.`,
      href: "/dashboard/ecommerce/profit",
      hrefLabelAr: "افتح رحلة الربح",
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <EcomHeader
        title="التجارة الإلكترونية"
        subtitle="أين تربح، أين تخسر، وما القرار التالي الذي يزيد أرباح متجرك. آخر ٣٠ يوماً."
        storeName={workspace.name}
      />

      <SectionHeading hint="مؤشّرات تجارية بحتة — لا تكرار لما تراه في لوحة متجرك أو منصّات الإعلان.">
        وضع المتجر
      </SectionHeading>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="الإيراد"
          value={fmtNum(overview.revenue)}
          unit={c}
          icon={Wallet}
          tone="accent"
          delta={
            overview.revenueChangePct !== null
              ? {
                  value: `${Math.abs(overview.revenueChangePct)}%`,
                  direction: overview.revenueChangePct >= 0 ? "up" : "down",
                  positive: overview.revenueChangePct >= 0,
                  caption: "عن الـ٣٠ يوماً السابقة",
                }
              : undefined
          }
        />
        <MetricCard
          label="صافي الربح"
          value={fmtNum(overview.netProfit)}
          unit={c}
          icon={TrendingUp}
          tone={overview.netProfit >= 0 ? "verified" : "critical"}
          delta={
            overview.profitChangePct !== null
              ? {
                  value: `${Math.abs(overview.profitChangePct)}%`,
                  direction: overview.profitChangePct >= 0 ? "up" : "down",
                  positive: overview.profitChangePct >= 0,
                  caption: "عن الفترة السابقة",
                }
              : undefined
          }
          caption={
            overview.netProfit < 0
              ? { text: "متجرك يخسر بعد احتساب كل التكاليف", tone: "negative" }
              : undefined
          }
        />
        <MetricCard
          label="هامش الربح"
          value={overview.grossMarginPct ?? "—"}
          unit={overview.grossMarginPct !== null ? "%" : undefined}
          icon={Percent}
          tone={
            overview.grossMarginPct === null
              ? "neutral"
              : overview.grossMarginPct >= 20
                ? "verified"
                : overview.grossMarginPct >= 10
                  ? "gap"
                  : "critical"
          }
          bar={overview.grossMarginPct !== null ? { pct: Math.max(0, overview.grossMarginPct) } : undefined}
        />
        <MetricCard label="الطلبات" value={fmtNum(overview.orders)} icon={ShoppingCart} tone="default" />

        <MetricCard
          label="متوسط قيمة الطلب"
          value={overview.avgOrderValue !== null ? fmtNum(overview.avgOrderValue) : "—"}
          unit={overview.avgOrderValue !== null ? c : undefined}
          icon={Receipt}
          tone="default"
        />
        <MetricCard
          label="عملاء عائدون"
          value={overview.returningCustomersPct ?? "—"}
          unit={overview.returningCustomersPct !== null ? "%" : undefined}
          icon={Repeat}
          tone="verified"
          caption={
            overview.returningCustomersPct === null
              ? { text: "يتطلّب بيانات عملاء من المتجر", tone: "muted" }
              : undefined
          }
        />
        <MetricCard
          label="معدّل المرتجعات"
          value={overview.refundRatePct}
          unit="%"
          icon={RotateCcw}
          tone={overview.refundRatePct >= 15 ? "critical" : overview.refundRatePct >= 8 ? "gap" : "verified"}
          caption={
            overview.refundRatePct >= 15
              ? { text: "مرتفع — أغلى أنواع الخسارة", tone: "negative" }
              : undefined
          }
        />
        <MetricCard
          label="منتجات مهدَّدة بالنفاد"
          value={overview.inventoryRiskCount}
          icon={PackageX}
          tone={overview.inventoryRiskCount > 0 ? "critical" : "neutral"}
          caption={
            overview.inventoryRiskCount > 0
              ? { text: "ستنفد خلال ١٤ يوماً بمعدّل البيع الحالي", tone: "negative" }
              : { text: "لا خطر نفاد قريب", tone: "positive" }
          }
        />
      </div>

      {!overview.hasOrderLevelData && (
        <div className="mb-8 rounded-2xl border border-gap/30 bg-gap/[0.06] p-4 text-[12.5px] leading-relaxed text-text-muted">
          الأرقام أعلاه محسوبة من مجاميع يومية لا من طلبات مفصَّلة. تحليل العملاء وجودة الطلبات
          يحتاجان طلبات حقيقية تصل عبر ويب هوك المتجر — تأكّد من تسجيله في لوحة متجرك.
        </div>
      )}

      {topOpps.length > 0 && (
        <>
          <SectionHeading hint={`إجمالي الفرص المرصودة: ${fmtNum(opps.totalPotentialProfit)} ${c} شهرياً`}>
            أكبر الفرص الآن
          </SectionHeading>
          <div className="mb-2 grid gap-3 lg:grid-cols-3">
            {topOpps.map((o) => (
              <div key={o.id} className="card-shadow rounded-2xl border border-border bg-surface p-4">
                <div className="text-[13px] font-medium text-text-primary">{o.titleAr}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[22px] font-semibold tabular-nums text-verified">
                    +{fmtNum(o.estimatedMonthlyProfit)}
                  </span>
                  <span className="text-[12px] text-text-muted">{c} شهرياً</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{o.reasonAr}</p>
              </div>
            ))}
          </div>
          <a
            href="/dashboard/ecommerce/opportunities"
            className="text-[12.5px] text-accent no-underline hover:underline"
          >
            عرض كل الفرص ({opps.opportunities.length})
          </a>
        </>
      )}

      <RecommendedActions actions={actions} />
    </div>
  );
}
