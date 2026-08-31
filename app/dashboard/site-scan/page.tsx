// app/dashboard/site-scan/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { DeepScanClient } from "./DeepScanClient";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { ScanSearch } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function SiteScanPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const pastScans = await prisma.siteScanResult.findMany({
    where: { workspaceId: workspace.id, status: "COMPLETED" },
    orderBy: { scannedAt: "desc" },
    take: 10,
    select: { id: true, url: true, overallScore: true, scannedAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
        <PageHeader
          icon={ScanSearch}
          tone="accent"
          eyebrow={workspace.name}
          title={t(locale, "campPages.scanTitle")}
        description={t(locale, "campPages.scanIntro")}
        />
      <DeepScanClient
        locale={locale}
        workspaceId={workspace.id}
        pastScans={pastScans.map((s: { id: string; url: string; overallScore: number | null; scannedAt: Date }) => ({
          id: s.id,
          url: s.url,
          overallScore: s.overallScore,
          scannedAt: s.scannedAt.toISOString(),
        }))}
      />
    </div>
  );
}
