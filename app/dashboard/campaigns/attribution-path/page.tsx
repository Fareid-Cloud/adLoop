// app/dashboard/campaigns/attribution-path/page.tsx
//
// "رأى العميل إعلاناً على إنستجرام ثم اشترى من جوجل - لمن يُنسب الفضل؟"
// لا توجد API واحدة تجيب عن هذا السؤال (جوجل وميتا لا تتبادلان بيانات
// العملاء)، لكن لدينا بيانات حقيقية جمعناها بأنفسنا: CtaClickEvent يسجّل
// كل نقرة من أي منصة لنفس الجلسة، وSessionConversion يسجّل التحويل الفعلي.
// هذه الصفحة تُظهر "أي المنصات لمست الجلسة نفسها قبل أن تتحوّل" - صورة
// واقعية مبنية على تتبّعنا نحن، لا على افتراض.
//
// ملاحظة أمانة مهمة: هذا يغطّي التفاعلات التي مرّت عبر أداة التتبّع
// الخاصة بنا وحدها (نقرات واتساب/اتصال/نموذج) - ولا يشمل مشاهدة إعلان
// دون نقرة (كمشاهدة ريلز بلا تفاعل)، فذلك لا يُرصد عند أحد أصلاً.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Target, GitBranch } from "lucide-react";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Route } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";


export default async function AttributionPathPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = await toDateBoundsForUser(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }


  const conversions = await prisma.sessionConversion.findMany({
    where: { workspaceId: workspace.id, convertedAt: { gte: bounds.gte } },
    take: 500,
  });

  if (conversions.length === 0) {
    return (
      <div>
        <PageHeader
          icon={Route}
          tone="accent"
          eyebrow={workspace.name}
          title={t(locale, "campPages.pathTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
        <EmptyState title={t(locale, "campPages.pathNoneTitle")} description={t(locale, "campPages.pathNoneBody")} />
      </div>
    );
  }

  const sessionIds = conversions.map((c: any) => c.sessionId);
  const allClicks = await prisma.ctaClickEvent.findMany({
    where: { workspaceId: workspace.id, sessionId: { in: sessionIds } },
    select: { sessionId: true, clickPlatform: true, clickedAt: true },
  });

  const clicksBySession = new Map<string, Set<string>>();
  for (const click of allClicks) {
    const platform = click.clickPlatform ?? "GOOGLE_ADS";
    const set = clicksBySession.get(click.sessionId) ?? new Set();
    set.add(platform);
    clicksBySession.set(click.sessionId, set);
  }

  let singleTouch = 0;
  let multiTouch = 0;
  const pathCounts = new Map<string, number>();

  for (const sessionId of sessionIds) {
    const platforms = Array.from(clicksBySession.get(sessionId) ?? []).sort();
    if (platforms.length <= 1) {
      singleTouch++;
    } else {
      multiTouch++;
      const pathKey = platforms.join(" ← ");
      pathCounts.set(pathKey, (pathCounts.get(pathKey) ?? 0) + 1);
    }
  }

  const topPaths = Array.from(pathCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const multiTouchPct = conversions.length > 0 ? Math.round((multiTouch / conversions.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        icon={Route}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.pathTitle")}
        description={t(locale, "campPages.pathIntro")}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label={t(locale, "campPages.pathSingle")}
          value={100 - multiTouchPct}
          unit="%"
          icon={Target}
          tone="neutral"
          bar={{ pct: 100 - multiTouchPct }}
          explainKey="singlePath"
          locale={locale}
        />
        <MetricCard
          label={t(locale, "campPages.pathMulti")}
          value={multiTouchPct}
          unit="%"
          icon={GitBranch}
          tone="verified"
          bar={{ pct: multiTouchPct }}
          caption={{
            text:
              multiTouchPct > 0
                ? t(locale, "campPages.pathMultiCaption")
                : t(locale, "campPages.pathNoMulti"),
            tone: multiTouchPct > 0 ? "warning" : "muted",
          }}
          explainKey="multiPath"
          locale={locale}
        />
      </div>

      {topPaths.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-text-primary">{t(locale, "campPages.pathTopTitle")}</div>
          <div className="flex flex-col gap-2">
            {topPaths.map(([path, count]) => (
              <div key={path} className="card flex items-center justify-between p-4">
                <span className="text-sm text-text-primary">
                  {path.split(" ← ").map((p) => platformLabel(locale, p)).join(" ← ")}
                </span>
                <span className="font-mono text-sm text-verified">{t(locale, "campPages.pathConversions", { n: count })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
