// app/dashboard/campaigns/tiktok-hook-rate/page.tsx
//
// "معدل الخطّاف" - أهم مؤشر جودة فيديو خاص بتيك توك، مفيش له مكافئ في
// أي منصة تانية. فيديو مايخطفش الانتباه في ثانيتين، مهما كان جميل، هيضيع فلوسه.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

function pctColor(rate: number, good: number, bad: number): string {
  if (rate >= good) return "text-verified";
  if (rate <= bad) return "text-critical";
  return "text-gap";
}

export default async function TikTokHookRatePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const videos = await prisma.tikTokVideoMetricSnapshot.findMany({
    where: { workspaceId: workspace.id, impressions: { gt: 100 } },
    orderBy: { hookRate: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 page-title">{t(locale, "campPages.hkTitle")}</h1>
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.hkIntro")}
      </p>

      {videos.length === 0 ? (
        <EmptyState
          title={t(locale, "campPages.hkNone")}
          description={t(locale, "campPages.hkNoneBody")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {videos.map((v: any) => (
            <div key={v.adId} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{v.adName ?? v.adId}</span>
                <span className={`font-mono text-lg ${pctColor(v.hookRate, 0.3, 0.15)}`}>
                  {Math.round(v.hookRate * 1000) / 10}%
                </span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{t(locale, "campPages.hkHook", { n: Math.round(v.hookRate * 1000) / 10 })}</span>
                <span>{t(locale, "campPages.thEngaged6s")} {Math.round(v.engagedViewRate * 1000) / 10}%</span>
                <span>{t(locale, "campPages.thFullCompletion")} {Math.round(v.completionRate * 1000) / 10}%</span>
                <span>{v.impressions.toLocaleString()} {t(locale, "campPages.unitImpressions")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
