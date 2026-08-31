// app/dashboard/campaigns/seasonal-trend/page.tsx
//
// "الموسم الجاي هيأثر كيف على تكلفة الإعلان؟" - تنبؤ موسمي حقيقي محتاج
// بيانات تاريخية متعددة السنين مفيش عندنا. البديل الصادق: مقارنة تكلفة
// العميل الشهر الحالي بالشهر اللي فات - إشارة واقعية على اتجاه التكلفة،
// مش تنبؤ ذكي، لكن مبنية على بيانات فعلية بدل تخمين.

import { getSessionUserFromCookies } from "@/lib/auth";
import { metricRollupRows, sumRollup } from "@/lib/metricRollup";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, daysBetween } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function SeasonalTrendPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = await toDateBoundsForUser(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const comparableEndLastMonth = new Date(startOfLastMonth);
  comparableEndLastMonth.setDate(now.getDate());

  // 🔴 **أخبث التسعة:** بلا فلتر منصّة كان كلُّ طلبِ متجرٍ (`cost:0`,
  // `rawConversions:1`) يُعَدّ تحويلاً فيخفض CPA بالصمت، وبلا فلتر مكانٍ
  // كان صرف ميتا يُعَدّ مرّتين. الاثنان يقلبان اتجاه التكلفة نفسه.
  // `metricRollupRows` يقصر على منصّات الإعلان ويسوّي المكان. راجع الملف.
  const [thisMonthRows, lastMonthRows] = await Promise.all([
    metricRollupRows({ workspaceId: workspace.id, date: { gte: startOfThisMonth, lte: now } }),
    metricRollupRows({
      workspaceId: workspace.id,
      date: { gte: startOfLastMonth, lte: comparableEndLastMonth < endOfLastMonth ? comparableEndLastMonth : endOfLastMonth },
    }),
  ]);
  const thisMonth = sumRollup(thisMonthRows);
  const lastMonthComparable = sumRollup(lastMonthRows);

  const thisCpa = thisMonth.rawConversions > 0 ? thisMonth.cost / thisMonth.rawConversions : null;
  const lastCpa = lastMonthComparable.rawConversions > 0 ? lastMonthComparable.cost / lastMonthComparable.rawConversions : null;

  const hasComparison = thisCpa !== null && lastCpa !== null;
  const changePct = hasComparison ? Math.round(((thisCpa! - lastCpa!) / lastCpa!) * 100) : null;

  return (
    <div>
      <PageHeader
        icon={TrendingUp}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.seasonTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.seasonNote")}
        {t(locale, "campPages.seasonIntro")}
      </p>

      {!hasComparison ? (
        <EmptyState
          title={t(locale, "campPages.seasonNone")}
          description={t(locale, "campPages.seasonNoneBody")}
        />
      ) : (
        <div className="card p-5 text-center">
          <div className={`font-mono text-3xl ${changePct! > 0 ? "text-critical" : "text-verified"}`}>
            {changePct! > 0 ? "+" : ""}{changePct}%
          </div>
          <div className="mt-1 text-sm text-text-muted">
            {t(locale, "campPages.seasonCpaLabel")}{" "}
            {changePct! > 0 ? t(locale, "campPages.seasonHigher") : t(locale, "campPages.seasonLower")}{" "}
            {t(locale, "campPages.seasonVsLast")}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-text-faint">
            <div>{t(locale, "campPages.seasonThisMonth")} {Math.round(thisCpa!).toLocaleString()}</div>
            <div>{t(locale, "campPages.seasonLastMonth")} {Math.round(lastCpa!).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
