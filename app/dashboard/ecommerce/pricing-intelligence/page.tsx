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

export const dynamic = "force-dynamic";

export default async function PricingIntelligencePage() {
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

  const overview = await getEcommerceOverview(workspace.id, 30);
  const c = overview.currency;

  if (overview.products.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <EcomHeader
          title="ذكاء التسعير"
          subtitle="أين السعر خاطئ أصلاً، وبكم."
          storeName={workspace.name}
        />
        <DataGate
          titleAr="لم تُضف أي منتج بعد"
          reasonAr="ذكاء التسعير يحتاج تكلفة كل منتج (بضاعة، شحن، رسوم) ليعرف نقطة التعادل الحقيقية. أضف منتجاتك من صفحة التسعير."
          href="/dashboard/pricing"
          hrefLabelAr="صفحة التسعير"
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
      titleAr: `صحّح سعر ${raiseOps.length} منتج تحت التعادل`,
      reasonAr: `تبيع بخسارة مؤكَّدة بعد كل التكاليف. أكبرها «${raiseOps[0].name}» ينزف ${fmtNum(raiseOps[0].monthlyGain)} ${c} شهرياً.`,
      impactAr: `توقّف نزيف ${fmtNum(totalLeak)} ${c} شهرياً`,
      tone: "critical",
      href: "/dashboard/pricing",
      hrefLabelAr: "عدّل الأسعار",
    });
  }
  if (lowerOps.length > 0) {
    actions.push({
      titleAr: `اختبر خفض سعر ${lowerOps.length} منتج بطيء البيع`,
      reasonAr: `هامشها مرتفع (${Math.round(lowerOps[0].marginPct)}%+) ومبيعاتها ضعيفة — السعر قد يكون العائق. جرّب على منتج واحد أولاً وقِس ٤ أسابيع.`,
      tone: "warning",
      href: "/dashboard/pricing",
      hrefLabelAr: "صفحة التسعير",
    });
  }
  if (avgMargin < 15 && overview.products.length > 0) {
    actions.push({
      titleAr: "متوسط هامشك ضعيف عبر الكتالوج",
      reasonAr: `${Math.round(avgMargin)}% متوسط الهامش. هذا لا يحتمل ارتفاع تكلفة إعلان ولا موجة مرتجعات — راجع تسعيرك ككل لا منتجاً منتجاً.`,
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <EcomHeader
        title="ذكاء التسعير"
        subtitle="أين السعر خاطئ أصلاً، وبكم. مبنيّ على تكلفتك الحقيقية الكاملة لا على تخمين السوق."
        storeName={workspace.name}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="فرص رفع السعر"
          value={raiseOps.length}
          icon={ArrowUpCircle}
          tone={raiseOps.length > 0 ? "critical" : "verified"}
          caption={
            raiseOps.length > 0
              ? { text: `نزيف ${fmtNum(totalLeak)} ${c} شهرياً`, tone: "negative" }
              : { text: "لا منتج يبيع تحت التعادل", tone: "positive" }
          }
        />
        <MetricCard
          label="فرص خفض السعر"
          value={lowerOps.length}
          icon={ArrowDownCircle}
          tone={lowerOps.length > 0 ? "gap" : "neutral"}
          caption={{ text: "هامش مرتفع ومبيعات بطيئة", tone: "muted" }}
        />
        <MetricCard
          label="متوسط الهامش"
          value={Math.round(avgMargin)}
          unit="%"
          icon={Percent}
          tone={avgMargin >= 25 ? "verified" : avgMargin >= 15 ? "gap" : "critical"}
          bar={{ pct: Math.max(0, Math.min(100, avgMargin)) }}
        />
      </div>

      <LimitsNote
        items={[
          "لا نملك أسعار المنافسين — مقارنة السوق تحتاج مصدر بيانات خارجياً غير مربوط بعد.",
          "مرونة السعر (كم تنخفض المبيعات عند كل ١٠% رفع) تحتاج تجربة سعرين على المنتج نفسه وقياس النتيجة. المعمل يقيس ذلك حين تنفّذ تغييراً.",
        ]}
      />

      {raiseOps.length > 0 && (
        <>
          <SectionHeading hint="هذه ليست توصية بالرفع — هي خسارة مؤكَّدة محسوبة. كل وحدة تُباع منها تكلّفك مالاً.">
            تبيع تحت التعادل
          </SectionHeading>
          <div className="card-shadow mb-8 overflow-hidden rounded-2xl border border-critical/30 bg-surface">
            <DataTable
              headers={["المنتج", "السعر الحالي", "خسارة الوحدة", "بيع ٣٠ يوماً", "النزيف الشهري", "الرفع المطلوب"]}
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
                      إلى {fmtNum(p.currentPrice + p.neededIncrease)}
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
                عدّل الأسعار في صفحة التسعير
                <ArrowLeft size={13} />
              </Link>
            </div>
          </div>
        </>
      )}

      {lowerOps.length > 0 && (
        <>
          <SectionHeading hint="هامش مرتفع مع بيع بطيء قد يعني أن السعر يمنع الشراء. اختبار لا قرار — جرّب منتجاً واحداً وقِس.">
            مرشَّحة لاختبار خفض السعر
          </SectionHeading>
          <div className="card-shadow mb-8 overflow-hidden rounded-2xl border border-border bg-surface">
            <DataTable headers={["المنتج", "السعر", "الهامش", "بيع/يوم", "ربح الوحدة", "هامش بعد خفض ١٠%"]}>
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
                      <div className="text-[11px] text-text-faint">بسعر {fmtNum(newPrice)}</div>
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
          </div>
        </>
      )}

      <RecommendedActions actions={actions} emptyAr="تسعيرك سليم: لا منتج يبيع تحت التعادل، ومتوسط هامشك صحّي." />
    </div>
  );
}
