// app/dashboard/campaigns/tiktok-fatigue/page.tsx
//
// "الفيديو ده تعب بمعدل أسرع من المتوقع؟" - تيك توك بطبيعتها بتتعب أسرع.
// إشارتين: انخفاض معدل المشاهدة المتفاعلة أسبوع عن أسبوع (الأدق)،
// والتكرار كإشارة مساندة (بدون عتبة عالمية موحّدة - المصادر مختلفة).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectTikTokFatigue } from "@/lib/syncTikTokAds";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

const STATUS_CONFIG = {
  HEALTHY: { color: "text-verified", key: "tfHealthy" },
  EARLY_FATIGUE: { color: "text-gap", key: "tfEarly" },
  SEVERE_FATIGUE: { color: "text-critical", key: "tfSevere" },
  INSUFFICIENT_DATA: { color: "text-text-faint", key: "tfInsufficient" },
};

export default async function TikTokFatiguePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const weeklyData = await prisma.tikTokWeeklyEngagement.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { weekStart: "desc" },
  });

  const byAd = new Map<string, typeof weeklyData>();
  for (const row of weeklyData) {
    const arr = byAd.get(row.adId) ?? [];
    arr.push(row);
    byAd.set(row.adId, arr);
  }

  const videoNames = await prisma.tikTokVideoMetricSnapshot.findMany({
    where: { workspaceId: workspace.id },
    select: { adId: true, adName: true },
  });
  const nameMap = new Map<string, string | null>(videoNames.map((v: any) => [v.adId, v.adName]));

  const results = Array.from(byAd.entries()).map(([adId, weeks]) => {
    const sorted = weeks.sort((a: any, b: any) => b.weekStart.getTime() - a.weekStart.getTime());
    const thisWeek = sorted[0] ?? null;
    const lastWeek = sorted[1] ?? null;
    const fatigue = detectTikTokFatigue(adId, thisWeek, lastWeek);
    return {
      adName: nameMap.get(adId),
      ...fatigue,
    };
  });

  const sorted = results.sort((a, b) => {
    const order = { SEVERE_FATIGUE: 0, EARLY_FATIGUE: 1, HEALTHY: 2, INSUFFICIENT_DATA: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">{t(locale, "campPages.tfTitle")}</h1>
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.tfIntro2")}
      </p>

      {sorted.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.tfNone")}
          description={t(locale, "campPages.tfNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((r) => (
            <div key={r.adId} className="rounded-2xl bg-surface p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{r.adName ?? r.adId}</span>
                <span className={`text-xs font-medium ${STATUS_CONFIG[r.status].color}`}>
                  {t(locale, `campPages.${STATUS_CONFIG[r.status].key}`)}
                </span>
              </div>
              <p className="text-xs text-text-faint">{r.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
