// app/dashboard/tracking/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TrackingCoverageClient } from "./TrackingCoverageClient";
import { getAppUrl } from "@/lib/appUrl";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Radar } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function TrackingCoveragePage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
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
      <PageHeader
        icon={Radar}
        tone="verified"
        eyebrow={workspace.name}
        title={t(locale, "tagInstall.covTitle")}
        description={t(locale, "tagInstall.covIntro")}
      />

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
