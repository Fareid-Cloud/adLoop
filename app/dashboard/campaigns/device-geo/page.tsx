// app/dashboard/campaigns/device-geo/page.tsx
//
// "أنهي جهاز/موقع فعلاً بيجيب عملاء أرخص؟" - استعلامان منفصلان (جهاز،
// موقع جغرافي) بدل استعلام مدموج، تجنّباً لمشكلة حذف الصفوف في GAQL.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "الموبايل",
  DESKTOP: "الكمبيوتر",
  TABLET: "التابلت",
  CONNECTED_TV: "التلفزيون الذكي",
  OTHER: "أخرى",
};

export default async function DeviceGeoPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى لمحة لإنشاء أول مساحة عمل." />;
  }

  const [deviceRows, geoRows] = await Promise.all([
    prisma.devicePerformanceSnapshot.groupBy({
      by: ["device"],
      where: { workspaceId: workspace.id },
      _sum: { clicks: true, cost: true, conversions: true },
    }),
    prisma.geoPerformanceSnapshot.groupBy({
      by: ["geoTarget"],
      where: { workspaceId: workspace.id },
      _sum: { clicks: true, cost: true, conversions: true },
      orderBy: { _sum: { cost: "desc" } },
      take: 10,
    }),
  ]);

  function withCpa(rows: any[]) {
    return rows.map((r: any) => {
      const cost = r._sum.cost ?? 0;
      const conv = r._sum.conversions ?? 0;
      return { ...r, cost, clicks: r._sum.clicks ?? 0, cpa: conv > 0 ? Math.round((cost / conv) * 100) / 100 : null };
    });
  }

  const devices = withCpa(deviceRows).sort((a: any, b: any) => b.cost - a.cost);
  const geos = withCpa(geoRows);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">الجهاز والموقع الجغرافي</h1>
      <p className="mb-6 text-xs text-text-faint">
        أنهي جهاز أو موقع فعلاً بيجيب عملاء أرخص - استعلامان منفصلان عمداً لتجنّب فقدان بيانات حقيقية.
      </p>

      <div className="mb-6">
        <div className="mb-2 text-sm font-semibold text-text-primary">حسب الجهاز</div>
        {devices.length === 0 ? (
          <EmptyState title="لا توجد بيانات بعد" description="تُسحب تلقائياً مع المزامنة اليومية." />
        ) : (
          <div className="flex flex-col gap-2">
            {devices.map((d: any) => (
              <div key={d.device} className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <span className="text-sm text-text-primary">{DEVICE_LABELS[d.device] ?? d.device}</span>
                <div className="flex items-center gap-3 text-xs text-text-faint">
                  <span>{d.clicks.toLocaleString()} كليكة</span>
                  <span className="font-mono text-verified">{d.cpa ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-text-primary">أعلى 10 مواقع جغرافية إنفاقاً</div>
        {geos.length === 0 ? (
          <EmptyState title="لا توجد بيانات بعد" description="تُسحب تلقائياً مع المزامنة اليومية." />
        ) : (
          <div className="flex flex-col gap-2">
            {geos.map((g: any) => (
              <div key={g.geoTarget} className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <span className="text-xs text-text-muted">{g.geoTarget}</span>
                <div className="flex items-center gap-3 text-xs text-text-faint">
                  <span>{g.clicks.toLocaleString()} كليكة</span>
                  <span className="font-mono text-verified">{g.cpa ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
