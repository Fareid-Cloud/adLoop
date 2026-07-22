// app/dashboard/site-scan/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { DeepScanClient } from "./DeepScanClient";

export default async function SiteScanPage() {
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

  const pastScans = await prisma.siteScanResult.findMany({
    where: { workspaceId: workspace.id, status: "COMPLETED" },
    orderBy: { scannedAt: "desc" },
    take: 10,
    select: { id: true, url: true, overallScore: true, scannedAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">فحص الموقع</h1>
      <p className="mb-6 text-xs text-text-faint">
        فحص عميق مترابط: تقني + بصري بالذكاء الاصطناعي + أداء حقيقي (Google
        PageSpeed) + مقارنة منافسين، مبني على تحليل مركّب مش نتائج منعزلة.
      </p>
      <DeepScanClient
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
