// app/dashboard/diagnostics/tracking-coverage/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TrackingCoverageClient } from "./TrackingCoverageClient";
import { getAppUrl } from "@/lib/appUrl";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export default async function TrackingCoveragePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const pages = await prisma.monitoredPage.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 page-title">{t(locale, "tagInstall.covTitle")}</h1>
      <p className="mb-6 text-xs text-text-faint">{t(locale, "tagInstall.covIntro")}</p>

      <TrackingCoverageClient
        workspaceId={workspace.id}
        appUrl={getAppUrl()}
        locale={locale}
        pages={pages.map((p: any) => ({
          id: p.id,
          url: p.url,
          label: p.label,
          trackingDetected: p.trackingDetected,
          adloopDetected: p.adloopDetected ?? null,
          detectedSystems: p.detectedSystems ?? [],
          lastCheckedAt: p.lastCheckedAt?.toISOString() ?? null,
          lastError: p.lastError,
        }))}
      />
    </div>
  );
}
