// app/dashboard/diagnostics/tracking-coverage/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TrackingCoverageClient } from "./TrackingCoverageClient";

export default async function TrackingCoveragePage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
  }

  const pages = await prisma.monitoredPage.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">تغطية التتبع</h1>
      <p className="mb-6 text-xs text-text-faint">
        نتحقّق فعلياً من وجود كود التتبّع على كل صفحة هبوط تستخدمها، ولا نفترض ذلك.
      </p>

      <TrackingCoverageClient
        workspaceId={workspace.id}
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
