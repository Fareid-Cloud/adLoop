// app/dashboard/campaigns/match-types/page.tsx
//
// "المطابقة الواسعة بتاكل ميزانيتي من غير عملاء حقيقيين؟" - مقارنة
// مباشرة بين Broad/Phrase/Exact على نفس الحملة.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Crosshair } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

const MATCH_TYPE_LABELS: Record<string, string> = {
  BROAD: "mtBroad",
  PHRASE: "mtPhrase",
  EXACT: "mtExact",
  UNKNOWN: "mtUnknown",
};

export default async function MatchTypesPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const rows = await prisma.matchTypeSnapshot.groupBy({
    by: ["matchType"],
    where: { workspaceId: workspace.id },
    _sum: { impressions: true, clicks: true, cost: true, conversions: true },
  });

  const results = rows
    .map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const conv = r._sum.conversions ?? 0;
      return {
        matchType: r.matchType,
        clicks: r._sum.clicks ?? 0,
        cost,
        conversions: conv,
        cpa: conv > 0 ? Math.round((cost / conv) * 100) / 100 : null,
        wasteRisk: conv === 0 && cost > 5,
      };
    })
    .sort((a: any, b: any) => b.cost - a.cost);

  return (
    <div>
      <PageHeader
        icon={Crosshair}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.mtTitle")}
        description={t(locale, "campPages.mtIntro")}
      />

      {results.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.mtNone")}
          description={t(locale, "campPages.mtNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((r: any) => (
            <div
              key={r.matchType}
              className={`rounded-2xl p-4 ${r.wasteRisk ? "bg-critical/10" : "bg-surface"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {/* المفتاح يمرّ على `t()`: كان يُطبع خاماً فيرى
                      المستخدم «mtPhrase» مكان «مطابقة العبارة». */}
                  {MATCH_TYPE_LABELS[r.matchType]
                    ? t(locale, `campPages.${MATCH_TYPE_LABELS[r.matchType]}`)
                    : r.matchType}
                </span>
                <span className={`font-mono text-lg ${r.wasteRisk ? "text-critical" : "text-verified"}`}>
                  {r.cpa ?? "—"}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{r.clicks.toLocaleString()} {t(locale, "campPages.unitClicks")}</span>
                <span>{r.cost.toLocaleString()} {t(locale, "campPages.unitCost")}</span>
                <span>{r.conversions} {t(locale, "campPages.unitConversions")}</span>
              </div>
              {r.wasteRisk && (
                <div className="mt-2 text-xs text-critical">
                  {t(locale, "campPages.mtWasteRisk")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
