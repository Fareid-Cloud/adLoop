// app/dashboard/ecommerce/pricing-intelligence/page.tsx
//
// ذكاء التسعير لا تعديل الأسعار. تعديل السعر موجود في صفحة التسعير؛ هنا
// نجيب سؤالاً مختلفاً: أين السعر خاطئ أصلاً، وبكم؟
//
// حدّ صريح ومعروض للمستخدم: لا نملك أسعار المنافسين ولا منحنى مرونة سعرية
// مقاساً على متجرك. ما نملكه أدقّ في اتجاه واحد - نعرف تكلفتك الحقيقية
// كاملةً، فنعرف يقيناً أي سعر تحت التعادل. الفرص هنا مبنيّة على ذلك لا
// على تخمين استجابة السوق.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate, LimitsNote,
  DataTable, Td, Tr, fmtNum, type RecommendedAction,
} from "../_components/EcomPrimitives";
import { getEcommerceOverview } from "@/lib/ecommerce/productPerformance";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { ArrowUpCircle, ArrowDownCircle, Percent, Wallet, ArrowLeft } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function PricingIntelligencePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `pricingIntel.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return <DataGate titleAr={tc("noWorkspace")} reasonAr={tc("noWorkspaceHint")} href="/dashboard" hrefLabelAr={tc("toHome")} />;
  }

  const overview = await getEcommerceOverview(workspace.id, 30);
  const c = overview.currency;

  if (overview.products.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitleShort")}
          storeName={workspace.name}
        />
        <DataGate
          titleAr={tr("noneTitle")}
          reasonAr={tr("noneReason")}
          href="/dashboard/pricing"
          hrefLabelAr={tr("noneCta")}
        />
      </div>
    );
  }

  // ==== فرص الرفع: منتجات تبيع فعلاً لكن هامشها تحت التعادل أو ضعيف جداً ====
  const raiseOps = overview.products
    .filter((p) => p.unitsSold > 0 && p.profitPerUnit < 0)
    .map((p) => {
      const needed = Math.abs(p.profitPerUnit) * 1.1;
      return {
        ...p,
        neededIncrease: needed,
        neededPct: p.currentPrice > 0 ? (needed / p.currentPrice) * 100 : 0,
        monthlyGain: Math.abs(p.profitPerUnit) * p.unitsSold,
      };
    })
    .sort((a, b) => b.monthlyGain - a.monthlyGain);

  // ==== فرص الخفض: هامش مرتفع جداً ومبيعات ضعيفة - السعر قد يكون العائق ====
  const HIGH_MARGIN = 45;
  const lowerOps = overview.products
    .filter((p) => p.marginPct >= HIGH_MARGIN && p.unitsSold > 0 && p.velocity < 0.3)
    .sort((a, b) => b.marginPct - a.marginPct);

  const totalLeak = raiseOps.reduce((s, p) => s + p.monthlyGain, 0);
  const avgMargin =
    overview.products.length > 0
      ? overview.products.reduce((s, p) => s + p.marginPct, 0) / overview.products.length
      : 0;

  const actions: RecommendedAction[] = [];
  if (raiseOps.length > 0) {
    actions.push({
      titleAr: tr("actFix", { count: raiseOps.length }),
      reasonAr: tr("actFixReason", { name: raiseOps[0].name, amount: `${fmtNum(raiseOps[0].monthlyGain)} ${c}` }),
      impactAr: tr("actFixImpact", { amount: `${fmtNum(totalLeak)} ${c}` }),
      tone: "critical",
      href: "/dashboard/pricing",
      hrefLabelAr: tr("actFixCta"),
    });
  }
  if (lowerOps.length > 0) {
    actions.push({
      titleAr: tr("actTest", { count: lowerOps.length }),
      reasonAr: tr("actTestReason", { pct: Math.round(lowerOps[0].marginPct) }),
      tone: "warning",
      href: "/dashboard/pricing",
      hrefLabelAr: tr("noneCta"),
    });
  }
  if (avgMargin < 15 && overview.products.length > 0) {
    actions.push({
      titleAr: tr("actWeak"),
      reasonAr: tr("actWeakReason", { pct: Math.round(avgMargin) }),
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title={tr("title")}
        subtitle={tr("subtitle")}
        storeName={workspace.name}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={tr("raiseOps")}
          value={raiseOps.length}
          icon={ArrowUpCircle}
          tone={raiseOps.length > 0 ? "critical" : "verified"}
          caption={
            raiseOps.length > 0
              ? { text: tr("raiseOpsBleed", { amount: `${fmtNum(totalLeak)} ${c}` }), tone: "negative" }
              : { text: tr("raiseOpsNone"), tone: "positive" }
          }
        />
        <MetricCard
          label={tr("lowerOps")}
          value={lowerOps.length}
          icon={ArrowDownCircle}
          tone={lowerOps.length > 0 ? "gap" : "neutral"}
          caption={{ text: tr("lowerOpsHint"), tone: "muted" }}
        />
        <MetricCard
          label={tr("avgMargin")}
          value={Math.round(avgMargin)}
          unit="%"
          icon={Percent}
          tone={avgMargin >= 25 ? "verified" : avgMargin >= 15 ? "gap" : "critical"}
          bar={{ pct: Math.max(0, Math.min(100, avgMargin)) }}
        />
      </div>

      <LimitsNote
        items={[
          tr("limitNoCompetitors"),
          tr("limitElasticity"),
        ]}
      />

      {raiseOps.length > 0 && (
        <>
          <SectionHeading hint={tr("belowBreakEvenHint")}>{tr("belowBreakEven")}</SectionHeading>
          <div className="card-shadow mb-8 overflow-hidden rounded-2xl border border-critical/30 bg-surface">
            <DataTable
              headers={[tc("product"), tr("colCurrentPrice"), tr("colUnitLoss"), tr("colSold30", { days: 30 }), tr("colMonthlyBleed"), tr("colNeededRaise")]}
            >
              {raiseOps.slice(0, 15).map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="font-medium text-text-primary">{p.name}</div>
                    {p.sku && <div className="text-[11px] text-text-faint">{p.sku}</div>}
                  </Td>
                  <Td className="tabular-nums text-text-primary">{fmtNum(p.currentPrice)}</Td>
                  <Td className="tabular-nums font-semibold text-critical">
                    −{fmtNum(Math.abs(p.profitPerUnit))}
                  </Td>
                  <Td className="tabular-nums text-text-muted">{p.unitsSold}</Td>
                  <Td className="tabular-nums font-semibold text-critical">−{fmtNum(p.monthlyGain)}</Td>
                  <Td className="tabular-nums">
                    <span className={p.neededPct > 25 ? "text-gap" : "font-semibold text-verified"}>
                      +{Math.ceil(p.neededPct)}%
                    </span>
                    <div className="text-[11px] text-text-faint">
                      {tr("toPrice", { price: fmtNum(p.currentPrice + p.neededIncrease) })}
                    </div>
                  </Td>
                </Tr>
              ))}
            </DataTable>
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Link
                href="/dashboard/pricing"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent no-underline hover:underline"
              >
                {tr("editPrices")}
                <ArrowLeft size={13} />
              </Link>
            </div>
          </div>
        </>
      )}

      {lowerOps.length > 0 && (
        <>
          <SectionHeading hint={tr("testLowerHint")}>{tr("testLower")}</SectionHeading>
          <div className="card-shadow mb-8 overflow-hidden rounded-2xl border border-border bg-surface">
            <DataTable headers={[tc("product"), tc("price"), tc("margin"), tr("colVelocity"), tr("colUnitProfit"), tr("colMarginAfter")]}>
              {lowerOps.slice(0, 10).map((p) => {
                const newPrice = p.currentPrice * 0.9;
                const newProfit = p.profitPerUnit - p.currentPrice * 0.1;
                const newMargin = newPrice > 0 ? (newProfit / newPrice) * 100 : 0;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <div className="font-medium text-text-primary">{p.name}</div>
                    </Td>
                    <Td className="tabular-nums text-text-primary">{fmtNum(p.currentPrice)}</Td>
                    <Td className="tabular-nums text-verified">{Math.round(p.marginPct)}%</Td>
                    <Td className="tabular-nums text-text-muted">{p.velocity}</Td>
                    <Td className="tabular-nums text-text-primary">{fmtNum(p.profitPerUnit)}</Td>
                    <Td className="tabular-nums">
                      <span className={newMargin >= 15 ? "text-verified" : "text-gap"}>
                        {Math.round(newMargin)}%
                      </span>
                      <div className="text-[11px] text-text-faint">{tr("atPrice", { price: fmtNum(newPrice) })}</div>
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
          </div>
        </>
      )}

      <RecommendedActions actions={actions} emptyAr={tr("healthy")} />
    </div>
  );
}
