// app/dashboard/campaigns/quality-score/page.tsx
//
// "درجة الجودة منخفضة" مش إجابة كافية - الصفحة دي بتوضح السبب الفعلي:
// صلة الإعلان؟ صفحة الهبوط؟ نسبة النقر المتوقعة؟ كل كلمة على حدة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

const COMPONENT_KEYS: Record<string, string> = {
  BELOW_AVERAGE: "qsBelowAvg",
  AVERAGE: "qsAvg",
  ABOVE_AVERAGE: "qsAboveAvg",
};

export default async function QualityScorePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  // الأولوية للكلمات منخفضة الجودة (تحت 5 من 10) - دي اللي فعلاً بتستاهل انتباه
  const rows = await prisma.qualityScoreSnapshot.findMany({
    where: { workspaceId: workspace.id, qualityScore: { lte: 5 } },
    orderBy: { qualityScore: "asc" },
    take: 30,
  });

  function diagnoseIssue(row: (typeof rows)[number]): string {
    const issues: string[] = [];
    if (row.landingPageExperience === "BELOW_AVERAGE") issues.push(t(locale, "campPages.qsLanding"));
    if (row.adRelevance === "BELOW_AVERAGE") issues.push(t(locale, "campPages.qsRelevance"));
    if (row.expectedCtr === "BELOW_AVERAGE") issues.push(t(locale, "campPages.qsExpectedCtr"));
    return issues.length > 0 ? issues.join(" + ") : t(locale, "campPages.qsUnclear");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">{t(locale, "campPages.qsTitle")}</h1>
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.qsIntro")}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.qsNone")}
          description={t(locale, "campPages.qsNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row: any) => (
            <div key={row.id} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {row.keywordText ?? row.criterionId}
                </span>
                <span className="font-mono text-lg text-critical">{row.qualityScore}/10</span>
              </div>
              <div className="mb-2 text-xs text-gap">{t(locale, "campPages.qsMainReason")} {diagnoseIssue(row)}</div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{t(locale, "campPages.qsRelevance")}: {label(locale, row.adRelevance)}</span>
                <span>{t(locale, "campPages.qsLanding")}: {label(locale, row.landingPageExperience)}</span>
                <span>{t(locale, "campPages.qsExpectedCtr")}: {label(locale, row.expectedCtr)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** المكوّن غير المعروف يُعرض كشرطة لا كنصّ خام من الـAPI */
function label(locale: Locale, value: string | null | undefined): string {
  const key = COMPONENT_KEYS[value ?? ""];
  return key ? t(locale, `campPages.${key}`) : "—";
}
