// app/dashboard/ecommerce/stores/page.tsx
//
// **أيّ متاجرك يكسب؟**
//
// صفحةٌ لم يكن لها معنى قبل اليوم: القيد كان يحصر المساحة في متجرٍ واحدٍ
// لكلّ منصّة، فلا شيء يُقارَن. وبعد سقوطه صار للتاجر متجران - علامتان،
// أو تجزئة وجملة - فصار السؤال أوّل ما يسأله.
//
// ولا تعرض إلّا متاجر **مساحة العمل المختارة**: مقارنةٌ تخلط متاجر
// مساحتين تقيس ما لا يُقارَن.

import { getSessionUserFromCookies } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { getStoreComparison } from "@/lib/ecommerce/storeComparison";
import { getStoreFunnel } from "@/lib/storeFunnel";
import { StoreFunnel } from "@/app/components/StoreFunnel";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { EcomHeader, SectionHeading, DataGate, fmtNum } from "../_components/EcomPrimitives";
import { TH } from "@/app/components/ui/tableStyles";
import { Trophy, Store, AlertTriangle } from "lucide-react";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, daysBetween, toDateBounds } from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function StoreComparisonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `storeCompare.${k}`, vars);

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return (
      <DataGate
        title={t(locale, "common.noWorkspace")}
        reason={t(locale, "common.noWorkspaceHint")}
        locale={locale}
      />
    );
  }

  // الفترة تُختار ولا تُفرَض: «آخر ثلاثين يوماً» ثابتةً تخفي الموسمية،
  // ولا تسمح بمقارنة شهرٍ بشهر. والمنتقي نفسه المستعمل في بقيّة الصفحات.
  const sp = await searchParams;
  const period = periodFromParams(sp);
  const bounds = toDateBounds(period.range);
  const from = bounds.gte;
  const to = bounds.lte;
  const WINDOW_DAYS = Math.max(1, daysBetween(period.range.from, period.range.to));

  const cmp = await getStoreComparison(workspace.id, WINDOW_DAYS);
  // عملة المتجر تُقرأ من طلباته لا تُفترض - والمسار يحتاجها للعرض.
  const funnel = await getStoreFunnel(workspace.id, from, to, cmp.currency ?? workspace.currency ?? "SAR");

  // لا متجر أصلاً: الطريق إلى الربط لا رسالةٌ تصف الفراغ.
  if (cmp.stores.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] pb-12">
        {/* 🔴 الرأس في فرع الفراغ أيضاً - وهي القاعدة نفسها التي طُبِّقت على
            «المحفظة» و«المنتجات». بدونه يهبط من لم يربط متجراً على بطاقةٍ
            وحيدةٍ بلا عنوانٍ ولا أيقونة، فلا يعرف أيّ صفحةٍ فتح. */}
        <EcomHeader
          title={tr("title")}
          subtitle={tr("subtitle")}
          storeName={workspace.name}
        />
        <DataGate
          title={tr("noStoresTitle")}
          reason={tr("noStoresReason")}
          hrefLabel={tr("connectStore")}
          locale={locale}
        />
      </div>
    );
  }

  const money = (n: number) => `${fmtNum(n)}${cmp.currency ? ` ${cmp.currency}` : ""}`;
  const winner = cmp.stores.find((s) => s.connectionId === cmp.winnerId) ?? null;

  return (
    <div className="mx-auto max-w-[1200px] pb-12">
      {/* منتقي الفترة في صفّ العنوان لا تحته: شريطٌ وحده على عرض الصفحة
          يقرأ كقسمٍ مستقلّ، وهو ليس قسماً بل ضبطٌ لما في العنوان. */}
      <EcomHeader
        title={tr("title")}
        subtitle={tr("subtitle")}
        storeName={workspace.name}
        action={
          <PeriodBar
            locale={locale}
            preset={period.preset}
            range={period.range}
            compare={period.compare}
          />
        }
      />

      {/* ═══ الحكم: أيّها يكسب، وبأيّ مقياس ═══ */}
      {winner ? (
        <div className="card mb-5 flex flex-wrap items-center gap-3 border-verified/30 bg-verified/[0.06] p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-verified/12">
            <Trophy size={17} className="text-verified" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-text-primary">
              {tr("winnerIs", { name: winner.name })}
            </p>
            {/* المقياس مُعلَن: الإيراد ليس ربحاً، وخلطهما يقلب القرار. */}
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
              {cmp.winnerBasis === "PROFIT"
                ? tr("winnerByProfit", { amount: money(winner.grossProfit ?? 0) })
                : tr("winnerByRevenue", { amount: money(winner.revenue) })}
            </p>
          </div>
        </div>
      ) : cmp.stores.length === 1 ? (
        // متجرٌ واحد: لا حكم بلا خصم. والحلّ يسافر مع الحدّ.
        <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised">
            <Store size={17} className="text-text-muted" />
          </span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-text-muted">
            {tr("oneStoreOnly")}
          </p>
          <a href="/dashboard/integrations" className="btn btn-ghost shrink-0">
            {tr("addStore")}
          </a>
        </div>
      ) : null}

      {/* ═══ المقارنة ═══ */}
      <SectionHeading hint={tr("tableHint")}>{tr("tableTitle")}</SectionHeading>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>{tr("colStore")}</th>
              <th className={TH}>{tr("colOrders")}</th>
              <th className={TH}>{tr("colRevenue")}</th>
              <th className={TH}>{tr("colAov")}</th>
              <th className={TH}>{tr("colAdSpend")}</th>
              <th className={TH}>{tr("colRoas")}</th>
              <th className={TH}>{tr("colReturns")}</th>
              <th className={TH}>{tr("colProfit")}</th>
              <th className={TH}>{tr("colTopProduct")}</th>
            </tr>
          </thead>
          <tbody>
            {cmp.stores.map((s) => (
              <tr
                key={s.connectionId}
                data-search-id={s.connectionId}
                className={`border-b border-border/50 last:border-0 ${
                  s.connectionId === cmp.winnerId ? "bg-verified/[0.05]" : ""
                }`}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <PlatformLogo platform={s.platform} size={15} />
                    <span className="font-medium text-text-primary">{s.name}</span>
                    {s.connectionId === cmp.winnerId && (
                      <Trophy size={12} className="shrink-0 text-verified" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-text-primary">{fmtNum(s.orders)}</td>
                <td className="px-4 py-2.5 tabular-nums text-text-primary">{money(s.revenue)}</td>
                <td className="px-4 py-2.5 tabular-nums text-text-muted">
                  {s.avgOrderValue === null ? "—" : money(s.avgOrderValue)}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-text-muted">
                  {s.adSpend === null ? (
                    <span className="text-text-faint" title={tr("noSpendTitle")}>
                      {tr("noSpend")}
                    </span>
                  ) : (
                    money(s.adSpend)
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {/* بلا حملةٍ منسوبة لا مقام للقسمة - وصفرٌ مكانه يجعل
                      العائد لانهائياً، ورقمٌ مقسومٌ من إنفاق المساحة كلّها
                      يخلط متجراً بآخر. */}
                  {s.roas === null ? (
                    <span className="text-text-faint">—</span>
                  ) : (
                    <span className={s.roas >= 1 ? "text-verified" : "text-critical"}>
                      {s.roas.toFixed(2)}x
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-text-muted">
                  {s.returnedOrders > 0 ? (
                    <span className="text-gap">
                      {fmtNum(s.returnedOrders)} · {money(s.returnedValue)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {/* تكلفةٌ غير مُدخَلة تعني أنّنا لا نعرف الربح - وصفرٌ
                      مكانها يجعل المتجر يبدو خاسراً كلَّ إيراده. */}
                  {s.grossProfit === null ? (
                    <span className="text-text-faint" title={tr("noCostTitle")}>
                      {tr("noCost")}
                    </span>
                  ) : (
                    <span className={s.grossProfit >= 0 ? "text-verified" : "text-critical"}>
                      {money(s.grossProfit)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-text-muted">
                  {s.topProduct ? (
                    <span title={tr("topProductTitle", { units: s.topProduct.units })}>
                      {s.topProduct.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ طلباتٌ لا متجر لها ═══
          تُعرض ولا تُوزَّع: قسمتها بالتساوي تُنتج أرقاماً تبدو دقيقةً وهي
          مخترعة، في صفحةٍ يُقرَّر بها أين يُوضع المال. */}
      {cmp.unattributedOrders > 0 && (
        <div className="card mb-6 flex flex-wrap items-start gap-3 border-gap/30 bg-gap/[0.05] p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gap" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-text-primary">
              {tr("unattributedTitle", { n: fmtNum(cmp.unattributedOrders) })}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
              {tr("unattributedHint", { amount: money(cmp.unattributedRevenue) })}
            </p>
          </div>
        </div>
      )}

      {cmp.unassignedAdSpend > 0 && (
        <div className="card mb-6 flex flex-wrap items-start gap-3 border-gap/30 bg-gap/[0.05] p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gap" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-text-primary">
              {tr("unassignedSpendTitle", { amount: money(cmp.unassignedAdSpend) })}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
              {tr("unassignedSpendHint")}
            </p>
          </div>
          <a href="/dashboard/integrations" className="btn btn-ghost shrink-0">
            {tr("assignCampaigns")}
          </a>
        </div>
      )}

      {/* ═══ المسار العامّ - المتاجر كلّها مجتمعة ═══ */}
      <SectionHeading hint={tr("funnelHint")}>{tr("funnelTitle")}</SectionHeading>
      <StoreFunnel data={funnel} locale={locale} />
    </div>
  );
}
