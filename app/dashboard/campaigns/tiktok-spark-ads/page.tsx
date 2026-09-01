// app/dashboard/campaigns/tiktok-spark-ads/page.tsx
//
// "Spark Ads فعلاً بتجيب نتيجة أحسن، ولا مجرد كلام تسويقي؟" - مصادر
// الصناعة نفسها مختلفة (37% مقابل 48% تحسّن حسب المصدر)، فبدل ما نصدّق
// رقم عام، بنقارن بيانات حسابك الحقيقية: Spark ضد الإعلان العادي (Dark
// Post) بنفس المقاييس اللي عندنا أصلاً (خطّاف، إكمال) - مش رقم مستورد.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Flame } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

function classify(identityType: string | null): "SPARK" | "DARK_POST" | "UNKNOWN" {
  if (identityType === "AUTH_CODE" || identityType === "TT_USER") return "SPARK";
  if (identityType === "CUSTOMIZED_USER") return "DARK_POST";
  return "UNKNOWN";
}

export default async function TikTokSparkAdsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const videos = await prisma.tikTokVideoMetricSnapshot.findMany({
    where: { workspaceId: workspace.id, impressions: { gt: 100 } },
  });

  const groups = { SPARK: [] as typeof videos, DARK_POST: [] as typeof videos };
  for (const v of videos) {
    const category = classify(v.identityType);
    if (category === "SPARK") groups.SPARK.push(v);
    else if (category === "DARK_POST") groups.DARK_POST.push(v);
  }

  function avg(arr: typeof videos, field: "hookRate" | "engagedViewRate" | "completionRate") {
    if (arr.length === 0) return null;
    return arr.reduce((s: number, v: (typeof arr)[number]) => s + (v[field] as number), 0) / arr.length;
  }

  const hasComparison = groups.SPARK.length > 0 && groups.DARK_POST.length > 0;

  return (
    <div>
      <PageHeader
        icon={Flame}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.spTitle")}
        description={t(locale, "campPages.spIntro")}
      />

      {!hasComparison ? (
        <EmptyState
          title={t(locale, "campPages.spNone")}
          description={t(locale, "campPages.spNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(["SPARK", "DARK_POST"] as const).map((type) => (
            <div key={type} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {type === "SPARK" ? t(locale, "campPages.sparkAds") : t(locale, "campPages.sparkOrganic")}
                </span>
                <span className="text-xs text-text-faint">{groups[type].length} {t(locale, "campPages.unitAd")}</span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{t(locale, "campPages.sparkHook")} {Math.round((avg(groups[type], "hookRate") ?? 0) * 1000) / 10}%</span>
                <span>{t(locale, "campPages.sparkEngaged")} {Math.round((avg(groups[type], "engagedViewRate") ?? 0) * 1000) / 10}%</span>
                <span>{t(locale, "campPages.sparkCompletion")} {Math.round((avg(groups[type], "completionRate") ?? 0) * 1000) / 10}%</span>
                {type === "SPARK" && (
                  <span>
                    {t(locale, "campPages.sparkComments")} {groups.SPARK.reduce((s: number, v: any) => s + v.totalComments, 0)}
                    {" "}({t(locale, "campPages.sparkSpam")} {groups.SPARK.reduce((s: number, v: any) => s + v.flaggedComments, 0)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
