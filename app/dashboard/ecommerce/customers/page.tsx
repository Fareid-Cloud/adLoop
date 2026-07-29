// app/dashboard/ecommerce/customers/page.tsx
//
// تحليل العملاء لا إدارتهم. لا قوائم اتصال ولا سجلّ محادثات - المتجر
// وأدوات الـCRM تفعل ذلك. السؤال هنا: من يستحق أن تنفق عليه أكثر، ومن
// على وشك أن يختفي بينما تنفق على جلب بدلاء له بأضعاف التكلفة.
//
// الخصوصية: لا نعرض بريداً ولا هاتفاً - مُهشَّمة في قاعدة البيانات أصلاً.
// تحليل السلوك لا يحتاج معرفة الهوية.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, RecommendedActions, DataGate,
  DataTable, Td, Tr, fmtNum, type RecommendedAction,
} from "../_components/EcomPrimitives";
import { getCustomerAnalytics } from "@/lib/ecommerce/storeIntelligence";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Users, Repeat, Wallet, Crown } from "lucide-react";
import { t, tText, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

const TONE_DOT = {
  positive: "bg-verified",
  warning: "bg-gap",
  critical: "bg-critical",
  neutral: "bg-text-faint",
} as const;

export default async function CustomersPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `customers.${k}`, v);
  const tc = (k: string, v?: Record<string, string | number>) => t(locale, `common.${k}`, v);
  const tx = (i: { key: string; vars?: Record<string, string | number> }) => tText(locale, "segText", i);

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

  const analytics = await getCustomerAnalytics(workspace.id);
  const c = analytics.currency;

  if (!analytics.hasData) {
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
  const vipAtRisk = analytics.segments.find((s) => s.key === "vipAtRisk");
  const atRisk = analytics.segments.find((s) => s.key === "atRisk");
  const highReturners = analytics.segments.find((s) => s.key === "highReturners");

  if (vipAtRisk) {
    actions.push({
      titleAr: `تواصل مع ${vipAtRisk.count} من كبار عملائك هذا الأسبوع`,
      reasonAr: `متوسط إنفاق الواحد منهم ${fmtNum(vipAtRisk.avgLtv)} ${c}، ولم يطلبوا منذ أكثر من ٩٠ يوماً. فقدان واحد منهم يعادل فقدان عشرات العملاء العاديين.`,
      impactAr: `قيمة معرَّضة للفقد: ${fmtNum(vipAtRisk.revenue)} ${c}`,
      tone: "critical",
    });
  }
  if (atRisk) {
    actions.push({
      titleAr: `حملة استرجاع لـ${atRisk.count} عميل متوقّف`,
      reasonAr: "اشتروا أكثر من مرة ثم توقّفوا — أثبتوا أنهم يحبّون منتجك، فاسترجاعهم أرخص بكثير من جلب عميل جديد بالكامل.",
      impactAr: `قيمة محتملة: ${fmtNum(atRisk.avgLtv * atRisk.count * 0.15)} ${c}`,
      tone: "warning",
      href: "/dashboard/ecommerce/opportunities",
      hrefLabelAr: "شوف الفرص",
    });
  }
  if (highReturners) {
    actions.push({
      titleAr: `راجع ما يطلبه ${highReturners.count} من كثيري الإرجاع`,
      reasonAr: "٤٠% من طلباتهم أو أكثر ارتدّت. غالباً السبب وصف منتج أو مقاس غير دقيق، لا سلوك عميل — والإصلاح يفيد كل عملائك.",
      tone: "critical",
      href: "/dashboard/ecommerce/products",
      hrefLabelAr: "المنتجات",
    });
  }
  if (analytics.repeatPurchaseRatePct !== null && analytics.repeatPurchaseRatePct < 20) {
    actions.push({
      titleAr: "معدّل الشراء المتكرّر منخفض",
      reasonAr: `${analytics.repeatPurchaseRatePct}% فقط من عملائك اشتروا أكثر من مرة. أنت تدفع لجلب عميل جديد في كل عملية بيع تقريباً — وهذا أغلى نموذج ممكن.`,
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

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={tr("total")} value={fmtNum(analytics.totalCustomers)} icon={Users} tone="accent" />
        <MetricCard
          label={tr("repeatRate")}
          value={analytics.repeatPurchaseRatePct ?? "—"}
          unit="%"
          icon={Repeat}
          tone={
            (analytics.repeatPurchaseRatePct ?? 0) >= 30 ? "verified"
              : (analytics.repeatPurchaseRatePct ?? 0) >= 15 ? "gap" : "critical"
          }
          bar={{ pct: analytics.repeatPurchaseRatePct ?? 0 }}
        />
        <MetricCard
          label={tr("avgLtv")}
          value={analytics.avgLtv !== null ? fmtNum(analytics.avgLtv) : "—"}
          unit={c}
          icon={Wallet}
          tone="default"
          caption={{ text: tr("avgLtvHint"), tone: "muted" }}
        />
        <MetricCard
          label={tr("repeatMultiple")}
          value={analytics.repeatCustomerValueMultiple ?? "—"}
          unit={analytics.repeatCustomerValueMultiple !== null ? "×" : undefined}
          icon={Crown}
          tone="verified"
          caption={{ text: tr("repeatMultipleHint"), tone: "muted" }}
        />
      </div>

      <SectionHeading hint={tr("segmentsHint")}>{tr("segments")}</SectionHeading>

      <div className="mb-8 flex flex-col gap-2.5">
        {analytics.segments.map((s) => (
          <div key={s.key} className="card-shadow rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[s.tone]}`} />
                  <h3 className="text-[13.5px] font-semibold text-text-primary">{tx(s.label)}</h3>
                  <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-text-muted">
                    {s.count}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{tx(s.description)}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-accent">{tx(s.action)}</p>
              </div>
              <div className="shrink-0 text-end">
                <div className="text-[16px] font-semibold tabular-nums text-text-primary">
                  {fmtNum(s.revenue)} <span className="text-[11px] font-normal text-text-muted">{c}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-text-faint">
                  {tr("avgPerCustomer", { value: fmtNum(s.avgLtv) })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionHeading hint={tr("topSpendersHint")}>{tr("topSpenders")}</SectionHeading>

      <div className="card-shadow overflow-hidden rounded-2xl border border-border bg-surface">
        <DataTable headers={[tr("colCustomer"), tr("colCity"), tr("colOrders"), tr("colSpent"), tr("colReturnRate"), tr("colLastOrder")]}>
          {analytics.topCustomers.map((cust, i) => (
            <Tr key={cust.id}>
              <Td>
                <span className="font-medium text-text-primary">
                  {cust.displayName ?? tr("anonymous", { n: i + 1 })}
                </span>
              </Td>
              <Td className="text-text-muted">{cust.city ?? "—"}</Td>
              <Td className="tabular-nums text-text-primary">{cust.ordersCount}</Td>
              <Td className="tabular-nums font-medium text-text-primary">{fmtNum(cust.totalSpent)}</Td>
              <Td className="tabular-nums">
                <span className={cust.returnRatePct >= 40 ? "font-semibold text-critical" : "text-text-muted"}>
                  {cust.returnRatePct}%
                </span>
              </Td>
              <Td className="text-text-muted">
                {cust.lastOrderAt ? cust.lastOrderAt.toISOString().slice(0, 10) : "—"}
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>

      <RecommendedActions actions={actions} emptyAr={tr("healthy")} />
    </div>
  );
}
