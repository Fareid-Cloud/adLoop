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

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
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

  const analysis = await getInventoryAnalysis(workspace.id, 30);
  const c = analysis.currency;

  if (!analysis.hasData) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title="المخزون"
          subtitle="أين ينام رأس مالك، وأي منتج على وشك النفاد."
          storeName={workspace.name}
        />
        <DataGate
          titleAr="لا يوجد منتج متتبَّع المخزون"
          reasonAr={`${analysis.untrackedProducts} منتج بلا رصيد مسجَّل. يصل الرصيد تلقائياً من متجرك المربوط، أو يُضبط يدوياً من صفحة التسعير.`}
          href="/dashboard/pricing"
          hrefLabelAr="اضبط المنتجات"
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
      titleAr: `أوقف إعلانات ${outOfStock.items.length} منتج نفد رصيدها`,
      reasonAr: "كل ريال ينفق على منتج لا يمكن تسليمه هو خسارة كاملة — لا تحويل ممكن أصلاً.",
      tone: "critical",
      href: "/dashboard/automation",
      hrefLabelAr: "قاعدة المخزون",
    });
  }
  if (runningOut) {
    actions.push({
      titleAr: `أعد طلب ${runningOut.items.length} منتج قبل نفادها`,
      reasonAr: `أقربها «${runningOut.items[0].name}» يكفي ${runningOut.items[0].daysLeft} يوماً فقط بمعدّل بيعه الحالي.`,
      tone: "warning",
    });
  }
  if (dead && dead.capitalImpact > 0) {
    actions.push({
      titleAr: `حرّر ${fmtNum(dead.capitalImpact)} ${c} من مخزون متوقّف`,
      reasonAr: `${analysis.deadCapitalPct}% من قيمة مخزونك مجمَّدة في بضاعة لم تتحرّك منذ ٩٠ يوماً. باقة أو تخفيض يسترد جزءاً منها.`,
      tone: "warning",
      href: "/dashboard/ecommerce/opportunities",
      hrefLabelAr: "شوف الفرص",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title="المخزون"
        subtitle={`أين ينام رأس مالك، وأي منتج على وشك النفاد. مبنيّ على مبيعات آخر ${analysis.windowDays} يوماً.`}
        storeName={workspace.name}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="رأس المال في المخزون"
          value={fmtNum(analysis.totalCapitalTied)}
          unit={c}
          icon={Boxes}
          tone="accent"
          caption={{ text: "بالتكلفة لا بسعر البيع — هذا ما خرج من جيبك فعلاً", tone: "muted" }}
        />
        <MetricCard
          label="رأس مال مجمَّد"
          value={analysis.deadCapitalPct}
          unit="%"
          icon={Snowflake}
          tone={analysis.deadCapitalPct >= 25 ? "critical" : analysis.deadCapitalPct >= 10 ? "gap" : "verified"}
          bar={{ pct: analysis.deadCapitalPct }}
          caption={{ text: "في بضاعة لم تتحرّك منذ ٩٠ يوماً", tone: "muted" }}
        />
        <MetricCard
          label="منتجات بلا تتبّع"
          value={analysis.untrackedProducts}
          icon={PackageX}
          tone={analysis.untrackedProducts > 0 ? "gap" : "neutral"}
          caption={
            analysis.untrackedProducts > 0
              ? { text: "لا يمكن رصد نفادها ولا رأس المال فيها", tone: "warning" }
              : { text: "كل المنتجات متتبَّعة", tone: "positive" }
          }
        />
      </div>

      <SectionHeading hint="كل دلو له إجراء مقابل. الدلو الفارغ لا يُعرض إطلاقاً.">
        دلاء القرار
      </SectionHeading>

      {analysis.buckets.map((bucket) => (
        <DecisionBucket
          key={bucket.key}
          labelAr={bucket.labelAr}
          descriptionAr={bucket.descriptionAr}
          actionAr={bucket.actionAr}
          count={bucket.items.length}
          valueAr={bucket.capitalImpact > 0 ? `${fmtNum(bucket.capitalImpact)} ${c}` : undefined}
          tone={bucket.tone}
        >
          <DataTable
            headers={["المنتج", "الرصيد", "بيع/يوم", "يكفي", "آخر بيع", "رأس المال"]}
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
                      {item.daysLeft} يوم
                    </span>
                  ) : (
                    <span className="text-text-faint">لا يُباع</span>
                  )}
                </Td>
                <Td className="tabular-nums text-text-muted">
                  {item.daysSinceLastSale !== null ? `منذ ${item.daysSinceLastSale} يوماً` : "لم يُبَع"}
                </Td>
                <Td className="tabular-nums text-text-primary">{fmtNum(item.capitalTied)}</Td>
              </Tr>
            ))}
          </DataTable>
          {bucket.items.length > 12 && (
            <div className="border-t border-border px-4 py-2 text-[11.5px] text-text-faint">
              و{bucket.items.length - 12} منتجاً آخر في هذا الدلو.
            </div>
          )}
        </DecisionBucket>
      ))}

      <RecommendedActions actions={actions} emptyAr="مخزونك متوازن: لا نفاد قريب ولا رأس مال مجمَّد بنسبة مقلقة." />
    </div>
  );
}
