// app/dashboard/ecommerce/inventory/page.tsx
//
// تحليل المخزون لا إدارته. السؤال هنا ليس "كم لديّ؟" - المتجر يعرف ذلك -
// بل "كم من مالي نائم في بضاعة لا تتحرّك، وأي منتج سينفد بينما إعلانه
// ما زال يصرف؟".

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate, DecisionBucket,
  DataTable, Td, Tr, fmtNum, type RecommendedAction,
} from "../_components/EcomPrimitives";
import { getInventoryAnalysis } from "@/lib/ecommerce/inventoryIntelligence";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Boxes, Snowflake, PackageX } from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `inventory.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);
  const tx = (i: { key: string; vars?: Record<string, string | number> }) => tText(locale, "invText", i);

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

  const analysis = await getInventoryAnalysis(workspace.id, 30);
  const c = analysis.currency;

  if (!analysis.hasData) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitle")}
          storeName={workspace.name}
        />
        <DataGate
          titleAr={tr("noneTitle")}
          reasonAr={tr("noneReason", { count: analysis.untrackedProducts })}
          href="/dashboard/pricing"
          hrefLabelAr={tr("noneCta")}
        />
      </div>
    );
  }

  const actions: RecommendedAction[] = [];
  const runningOut = analysis.buckets.find((b) => b.key === "runningOut");
  const outOfStock = analysis.buckets.find((b) => b.key === "outOfStock");
  const dead = analysis.buckets.find((b) => b.key === "dead");

  if (outOfStock) {
    actions.push({
      titleAr: tr("actPause", { count: outOfStock.items.length }),
      reasonAr: tr("actPauseReason"),
      tone: "critical",
      href: "/dashboard/automation",
      hrefLabelAr: tr("actPauseCta"),
    });
  }
  if (runningOut) {
    actions.push({
      titleAr: tr("actRestock", { count: runningOut.items.length }),
      reasonAr: tr("actRestockReason", { name: runningOut.items[0].name, days: runningOut.items[0].daysLeft ?? 0 }),
      tone: "warning",
    });
  }
  if (dead && dead.capitalImpact > 0) {
    actions.push({
      titleAr: tr("actFree", { amount: `${fmtNum(dead.capitalImpact)} ${c}` }),
      reasonAr: tr("actFreeReason", { pct: analysis.deadCapitalPct }),
      tone: "warning",
      href: "/dashboard/ecommerce/opportunities",
      hrefLabelAr: t(locale, "profit.seeOpportunities"),
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title={tr("title")}
        subtitle={tr("subtitleWindow", { days: analysis.windowDays })}
        storeName={workspace.name}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={tr("capitalTied")}
          value={fmtNum(analysis.totalCapitalTied)}
          unit={c}
          icon={Boxes}
          tone="accent"
          caption={{ text: tr("capitalTiedHint"), tone: "muted" }}
        />
        <MetricCard
          label={tr("deadCapital")}
          value={analysis.deadCapitalPct}
          unit="%"
          icon={Snowflake}
          tone={analysis.deadCapitalPct >= 25 ? "critical" : analysis.deadCapitalPct >= 10 ? "gap" : "verified"}
          bar={{ pct: analysis.deadCapitalPct }}
          caption={{ text: tr("deadCapitalHint"), tone: "muted" }}
        />
        <MetricCard
          label={tr("untracked")}
          value={analysis.untrackedProducts}
          icon={PackageX}
          tone={analysis.untrackedProducts > 0 ? "gap" : "neutral"}
          caption={
            analysis.untrackedProducts > 0
              ? { text: tr("untrackedWarn"), tone: "warning" }
              : { text: tr("allTracked"), tone: "positive" }
          }
        />
      </div>

      <SectionHeading hint={tr("bucketsHint")}>{tr("buckets")}</SectionHeading>

      {analysis.buckets.map((bucket) => (
        <DecisionBucket
          key={bucket.key}
          labelAr={tx(bucket.label)}
          descriptionAr={tx(bucket.description)}
          actionAr={tx(bucket.action)}
          count={bucket.items.length}
          valueAr={bucket.capitalImpact > 0 ? `${fmtNum(bucket.capitalImpact)} ${c}` : undefined}
          tone={bucket.tone}
        >
          <DataTable
            headers={[tc("product"), tr("colStock"), tr("colVelocity"), tr("colDaysLeft"), tr("colLastSale"), tr("colCapital")]}
            minWidth={640}
          >
            {bucket.items.slice(0, 12).map((item) => (
              <Tr key={item.id}>
                <Td>
                  <div className="font-medium text-text-primary">{item.name}</div>
                  {item.sku && <div className="text-[11px] text-text-faint">{item.sku}</div>}
                </Td>
                <Td className="tabular-nums text-text-primary">{item.stockQuantity}</Td>
                <Td className="tabular-nums text-text-muted">{item.velocity || "—"}</Td>
                <Td className="tabular-nums">
                  {item.daysLeft !== null ? (
                    <span className={item.daysLeft <= 14 ? "font-semibold text-critical" : "text-text-primary"}>
                      {tr("daysUnit", { n: item.daysLeft })}
                    </span>
                  ) : (
                    <span className="text-text-faint">{tr("notSelling")}</span>
                  )}
                </Td>
                <Td className="tabular-nums text-text-muted">
                  {item.daysSinceLastSale !== null ? tr("sinceDays", { n: item.daysSinceLastSale }) : tr("neverSold")}
                </Td>
                <Td className="tabular-nums text-text-primary">{fmtNum(item.capitalTied)}</Td>
              </Tr>
            ))}
          </DataTable>
          {bucket.items.length > 12 && (
            <div className="border-t border-border px-4 py-2 text-[11.5px] text-text-faint">
              {tr("andMore", { n: bucket.items.length - 12 })}
            </div>
          )}
        </DecisionBucket>
      ))}

      <RecommendedActions actions={actions} emptyAr={tr("healthy")} />
    </div>
  );
}
