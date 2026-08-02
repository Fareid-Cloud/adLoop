// app/dashboard/ecommerce/orders/page.tsx
//
// جودة الطلبات لا إدارتها. لا تنفيذ ولا طباعة بوالص - المتجر يفعل ذلك.
// السؤال هنا: أي طلبات تكلّفك مالاً دون أن تُنتج بيعاً، ولماذا.
//
// الترتيب مقصود بالأثر المالي: المرتجع أغلى من الملغى (دفعت الشحن مرّتين)،
// والمتأخّر هو السبب المباشر لكليهما.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate,
  DataTable, Td, Tr, fmtNum, type RecommendedAction,
} from "../_components/EcomPrimitives";
import { getOrderQuality } from "@/lib/ecommerce/storeIntelligence";
import { ShieldAlert } from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

const STATE_META: Record<string, { key: string; className: string }> = {
  PLACED: { key: "statePlaced", className: "bg-surface-raised text-text-muted" },
  FULFILLED: { key: "stateFulfilled", className: "bg-verified/10 text-verified" },
  CANCELLED: { key: "stateCancelled", className: "bg-gap/10 text-gap" },
  RETURNED: { key: "stateReturned", className: "bg-critical/10 text-critical" },
};

const TONE_STYLE = {
  critical: "border-critical/30 bg-critical/[0.06]",
  warning: "border-gap/30 bg-gap/[0.06]",
  positive: "border-verified/30 bg-verified/[0.06]",
  neutral: "border-border bg-surface",
} as const;

const TONE_TEXT = {
  critical: "text-critical",
  warning: "text-gap",
  positive: "text-verified",
  neutral: "text-text-primary",
} as const;

export default async function OrdersPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `orders.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);
  const tx = (i: { key: string; vars?: Record<string, string | number> }) => tText(locale, "ordText", i);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t("ar", "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return <DataGate titleAr={tc("noWorkspace")} reasonAr={tc("noWorkspaceHint")} href="/dashboard" hrefLabelAr={tc("toHome")} />;
  }

  const quality = await getOrderQuality(workspace.id, 30);
  const c = quality.currency;

  if (!quality.hasData) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitle")}
          storeName={workspace.name}
        />
        <DataGate
          titleAr={tr("noneTitle")}
          reasonAr={tr("noneReason")}
        />
      </div>
    );
  }

  const actions: RecommendedAction[] = [];
  const byKey = new Map(quality.buckets.map((b) => [b.key, b]));

  const delayed = byKey.get("delayed");
  if (delayed && delayed.count > 0) {
    actions.push({
      titleAr: tr("actDelayed", { count: delayed.count }),
      reasonAr: tr("actDelayedReason"),
      impactAr: tr("atRiskValue", { value: `${fmtNum(delayed.value)} ${c}` }),
      tone: "critical",
    });
  }

  const returned = byKey.get("returned");
  if (returned && returned.count > 0 && quality.totalOrders > 0) {
    const pct = Math.round((returned.count / quality.totalOrders) * 100);
    if (pct >= 10) {
      actions.push({
        titleAr: tr("actReturnRate", { pct }),
        reasonAr: tr("actReturnRateReason", { value: `${fmtNum(returned.value)} ${c}` }),
        tone: "critical",
        href: "/dashboard/ecommerce/products",
        hrefLabelAr: t(locale, "store.productsNav"),
      });
    }
  }

  const risky = byKey.get("risky");
  if (risky && risky.count > 0) {
    actions.push({
      titleAr: tr("actRisky", { count: risky.count }),
      reasonAr: tr("actRiskyReason"),
      impactAr: tr("atRiskValue", { value: `${fmtNum(risky.value)} ${c}` }),
      tone: "warning",
    });
  }

  const cancelled = byKey.get("cancelled");
  if (cancelled && cancelled.count > 0) {
    actions.push({
      titleAr: tr("actCancelled", { count: cancelled.count }),
      reasonAr: tr("actCancelledReason"),
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title={tr("title")}
        subtitle={`${tr("subtitle")} ${tc("lastNDays", { days: 30 })}.`}
        storeName={workspace.name}
      />

      <SectionHeading hint={tr("qualityHint", { total: fmtNum(quality.totalOrders) })}>{tr("quality")}</SectionHeading>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quality.buckets.map((b) => (
          <div key={b.key} className={`card-shadow rounded-2xl border p-4 ${TONE_STYLE[b.tone]}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-text-primary">{tx(b.label)}</span>
              <span className={`text-[22px] font-semibold tabular-nums ${TONE_TEXT[b.tone]}`}>{b.count}</span>
            </div>
            <div className="mt-1 text-[12px] tabular-nums text-text-muted">
              {fmtNum(b.value)} {c}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">{tx(b.description)}</p>
          </div>
        ))}
      </div>

      <SectionHeading hint={tr("recentHint")}>{tr("recent")}</SectionHeading>

      <div className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
        <DataTable headers={[tr("colOrder"), tr("colCustomer"), tr("colDate"), tr("colValue"), tr("colState"), tr("colPayment"), tr("colRisk")]}>
          {quality.recent.map((o) => {
            const state = STATE_META[o.state] ?? STATE_META.PLACED;
            const risky = (o.fraudRiskScore ?? 0) >= 50;
            return (
              <Tr key={o.id}>
                <Td>
                  <span className="font-medium text-text-primary">#{o.externalOrderId}</span>
                </Td>
                <Td className="text-text-muted">{o.customerName ?? "—"}</Td>
                <Td className="tabular-nums text-text-muted">{o.orderedAt.toISOString().slice(0, 10)}</Td>
                <Td className="tabular-nums font-medium text-text-primary">{fmtNum(o.total)}</Td>
                <Td>
                  <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${state.className}`}>
                    {tr(state.key)}
                  </span>
                </Td>
                <Td className="text-text-muted">
                  {o.isCod ? (
                    <span className="text-gap">{tr("cod")}</span>
                  ) : (
                    <span>{tr("paid")}</span>
                  )}
                </Td>
                <Td>
                  {o.fraudRiskScore === null || o.fraudRiskScore === 0 ? (
                    <span className="text-text-faint">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium tabular-nums ${
                        risky ? "bg-critical/10 text-critical" : "bg-surface-raised text-text-muted"
                      }`}
                      title={o.fraudRiskReasons.join(" • ")}
                    >
                      {risky && <ShieldAlert size={11} />}
                      {Math.round(o.fraudRiskScore)}
                    </span>
                  )}
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </div>

      <RecommendedActions actions={actions} emptyAr={tr("healthy")} />
    </div>
  );
}
