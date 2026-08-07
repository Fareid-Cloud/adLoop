// app/dashboard/campaigns/learning-phase/page.tsx
//
// "لو زودت الميزانية، هخرج بره فترة التعلّم قد إيه؟" - عبر قاعدة ميتا
// الموثّقة علناً (~50 تحويل خلال 7 أيام)، محسوبة من بيانات يومية حقيقية
// جمعناها احنا - مش تقريب من رقم 28 يوم، ومش حقل API معطّل.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateLearningPhase } from "@/lib/syncMetaAds";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams, toDateBounds, daysBetween } from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

// الخريطة تحمل **مفاتيح** لا نصوصاً: تُعرَّف على مستوى الوحدة حيث لا
// وجود لـ`locale`، فتُترجَم وقت العرض.
const STATUS_CONFIG = {
  LIKELY_STABLE: { color: "text-verified", labelKey: "learnStable" },
  LEARNING: { color: "text-gap", labelKey: "learnIn" },
  LEARNING_LIMITED: { color: "text-critical", labelKey: "learnLimited" },
};

export default async function LearningPhasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = toDateBounds(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }


  const dailyRows = await prisma.adSetDailyConversions.groupBy({
    by: ["adSetId"],
    where: { workspaceId: workspace.id, date: bounds },
    _sum: { conversions: true },
  });

  const adSetNames = await prisma.metaAdSetSnapshot.findMany({
    where: { workspaceId: workspace.id },
    select: { adSetId: true, adSetName: true },
  });
  const nameMap = new Map<string, string | null>(
    adSetNames.map((a: any) => [a.adSetId, a.adSetName])
  );

  const estimates = dailyRows.map((r: any) =>
    estimateLearningPhase(r.adSetId, nameMap.get(r.adSetId) ?? null, r._sum.conversions ?? 0)
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={GraduationCap}
        tone="gap"
        eyebrow={workspace.name}
        title={t(locale, "campPages.learnTitle")}
      />
      <PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.learnIntro")}{" "}
        {t(locale, "campPages.learnFromData")}
      </p>

      {estimates.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.learnNone")}
          description={t(locale, "campPages.learnNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {estimates.map((e: any) => (
            <div key={e.adSetId} className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{e.adSetName ?? e.adSetId}</span>
                <span className={`text-xs font-medium ${STATUS_CONFIG[e.status as keyof typeof STATUS_CONFIG].color}`}>
                  {t(locale, `campPages.${STATUS_CONFIG[e.status as keyof typeof STATUS_CONFIG].labelKey}`)}
                </span>
              </div>
              <p className="text-xs text-text-faint">{e.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
