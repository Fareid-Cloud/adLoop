// app/dashboard/ecommerce/reports/page.tsx
//
// تقرير تنفيذي واحد قابل للطباعة والمشاركة - لا مولّد تقارير بعشرين خياراً.
//
// السبب: التقرير الذي يحتاج ضبطاً قبل إخراجه لا يُخرَج. هذا التقرير يجيب
// ما يسأل عنه الشريك أو المحاسب فعلاً: كم بعنا، كم بقي، وأين ذهب الباقي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  EcomHeader, SectionHeading, DataGate, DataTable, Td, Tr, fmtNum,
} from "../_components/EcomPrimitives";
import { getProfitJourney, getStoreOverview, getCustomerAnalytics } from "@/lib/ecommerce/storeIntelligence";
import { getEcommerceOverview } from "@/lib/ecommerce/productPerformance";
import { buildOpportunities } from "@/lib/ecommerce/opportunities";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const windowDays = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return <DataGate titleAr="لا توجد مساحة عمل بعد" reasonAr="ارجع إلى «لمحة»." href="/dashboard" hrefLabelAr="إلى لمحة" />;
  }

  const [journey, overview, products, customers, opps] = await Promise.all([
    getProfitJourney(workspace.id, windowDays),
    getStoreOverview(workspace.id, windowDays),
    getEcommerceOverview(workspace.id, windowDays),
    getCustomerAnalytics(workspace.id),
    buildOpportunities(workspace.id, windowDays),
  ]);

  const c = journey.currency;

  if (journey.revenue <= 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <EcomHeader title="التقارير" subtitle="تقرير تنفيذي قابل للمشاركة." storeName={workspace.name} />
        <DataGate
          titleAr="لا توجد بيانات لإصدار تقرير"
          reasonAr="التقرير يُبنى من مبيعاتك وتكاليفك الحقيقية. اربط متجرك ليبدأ تجميع البيانات."
        />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const topProducts = [...products.products].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="print:hidden">
        <EcomHeader
          title="التقارير"
          subtitle={`تقرير تنفيذي لآخر ${windowDays} يوماً — جاهز للطباعة أو المشاركة كما هو.`}
          storeName={workspace.name}
          action={<PrintButton />}
        />
      </div>

      {/* الورقة نفسها - تُطبع وحدها */}
      <article className="card-shadow rounded-2xl border border-border bg-surface p-6 print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-border pb-4">
          <h2 className="text-[20px] font-semibold text-text-primary">{workspace.name}</h2>
          <p className="mt-1 text-[12.5px] text-text-muted">
            تقرير أداء المتجر — آخر {windowDays} يوماً • صدر في {today}
          </p>
        </header>

        {/* الخلاصة أولاً - من يقرأ سطراً واحداً يقرأ هذا */}
        <section className="mb-6">
          <h3 className="mb-2 text-[14px] font-semibold text-text-primary">الخلاصة</h3>
          <p className="text-[13px] leading-relaxed text-text-muted">
            حقّق المتجر إيراداً قدره{" "}
            <span className="font-semibold text-text-primary">{fmtNum(journey.revenue)} {c}</span>، وبقي منه{" "}
            <span className={`font-semibold ${journey.netProfit >= 0 ? "text-verified" : "text-critical"}`}>
              {fmtNum(journey.netProfit)} {c}
            </span>{" "}
            صافي ربح بهامش {journey.netMarginPct ?? 0}%
            {journey.biggestLeak && (
              <>
                . أكبر بند مستهلك للإيراد هو {journey.biggestLeak.labelAr} بنسبة{" "}
                {journey.biggestLeak.pctOfRevenue}%
              </>
            )}
            .
            {opps.opportunities.length > 0 && (
              <>
                {" "}
                رُصدت {opps.opportunities.length} فرصة بأثر مقدَّر{" "}
                <span className="font-semibold text-verified">
                  {fmtNum(opps.totalPotentialProfit)} {c}
                </span>{" "}
                شهرياً.
              </>
            )}
          </p>
        </section>

        {/* المؤشّرات */}
        <section className="mb-6">
          <h3 className="mb-2 text-[14px] font-semibold text-text-primary">المؤشّرات</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Fact label="الإيراد" value={`${fmtNum(journey.revenue)} ${c}`} />
            <Fact label="صافي الربح" value={`${fmtNum(journey.netProfit)} ${c}`} />
            <Fact label="الهامش الصافي" value={`${journey.netMarginPct ?? 0}%`} />
            <Fact label="الطلبات" value={fmtNum(overview.orders)} />
            <Fact
              label="متوسط قيمة الطلب"
              value={overview.avgOrderValue !== null ? `${fmtNum(overview.avgOrderValue)} ${c}` : "—"}
            />
            <Fact label="معدّل المرتجعات" value={`${overview.refundRatePct}%`} />
            <Fact
              label="عملاء عائدون"
              value={overview.returningCustomersPct !== null ? `${overview.returningCustomersPct}%` : "—"}
            />
            <Fact
              label="متوسط قيمة العميل"
              value={customers.avgLtv !== null ? `${fmtNum(customers.avgLtv)} ${c}` : "—"}
            />
            <Fact label="منتجات مهدَّدة بالنفاد" value={String(overview.inventoryRiskCount)} />
          </div>
        </section>

        {/* رحلة الربح */}
        <section className="mb-6">
          <h3 className="mb-2 text-[14px] font-semibold text-text-primary">أين ذهب المال</h3>
          <DataTable headers={["البند", "المبلغ", "% من الإيراد", "المتبقّي"]} minWidth={420}>
            {journey.stages.map((s) => (
              <Tr key={s.key}>
                <Td className="font-medium text-text-primary">{s.labelAr}</Td>
                <Td className={`tabular-nums ${s.amount < 0 ? "text-critical" : "text-text-primary"}`}>
                  {s.amount < 0 ? "−" : ""}
                  {fmtNum(Math.abs(s.amount))}
                </Td>
                <Td className="tabular-nums text-text-muted">{s.pctOfRevenue}%</Td>
                <Td className="tabular-nums text-text-muted">{fmtNum(s.runningTotal)}</Td>
              </Tr>
            ))}
          </DataTable>
        </section>

        {/* أفضل المنتجات */}
        {topProducts.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-[14px] font-semibold text-text-primary">أعلى المنتجات ربحاً</h3>
            <DataTable headers={["المنتج", "الوحدات", "الإيراد", "الربح", "الهامش"]} minWidth={480}>
              {topProducts.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium text-text-primary">{p.name}</Td>
                  <Td className="tabular-nums text-text-muted">{p.unitsSold}</Td>
                  <Td className="tabular-nums text-text-primary">{fmtNum(p.revenue)}</Td>
                  <Td className={`tabular-nums ${p.totalProfit >= 0 ? "text-verified" : "text-critical"}`}>
                    {fmtNum(p.totalProfit)}
                  </Td>
                  <Td className="tabular-nums text-text-muted">{p.marginPct}%</Td>
                </Tr>
              ))}
            </DataTable>
          </section>
        )}

        {/* التوصيات */}
        {opps.opportunities.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-[14px] font-semibold text-text-primary">أهمّ التوصيات</h3>
            <ol className="flex list-inside list-decimal flex-col gap-2">
              {opps.opportunities.slice(0, 5).map((o) => (
                <li key={o.id} className="text-[12.5px] leading-relaxed text-text-muted">
                  <span className="font-medium text-text-primary">{o.titleAr}</span> — {o.actionAr}{" "}
                  <span className="font-semibold text-verified">
                    (+{fmtNum(o.estimatedMonthlyProfit)} {c} شهرياً)
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* حدود التقرير - تُطبع مع التقرير عمداً */}
        {journey.missingCostsAr.length > 0 && (
          <section className="border-t border-border pt-4">
            <h3 className="mb-1.5 text-[12.5px] font-semibold text-text-muted">حدود هذا التقرير</h3>
            <ul className="flex flex-col gap-1">
              {journey.missingCostsAr.map((m, i) => (
                <li key={i} className="text-[11.5px] leading-relaxed text-text-faint">
                  • {m}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/50 py-1.5">
      <div className="text-[11.5px] text-text-faint">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium tabular-nums text-text-primary">{value}</div>
    </div>
  );
}
