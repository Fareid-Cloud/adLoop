// app/dashboard/campaigns/device-geo/page.tsx
//
// "أنهي جهاز/موقع فعلاً بيجيب عملاء أرخص؟" - استعلامان منفصلان (جهاز،
// موقع جغرافي) بدل استعلام مدموج، تجنّباً لمشكلة حذف الصفوف في GAQL.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

const DEVICE_KEYS: Record<string, string> = {
  MOBILE: "devMobile",
  DESKTOP: "devDesktop",
  TABLET: "devTablet",
  CONNECTED_TV: "devTv",
  OTHER: "devOther",
};

export default async function DeviceGeoPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
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
      <h1 className="mb-2 page-title">{t(locale, "campPages.geoTitle")}</h1>
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.geoIntro")}
      </p>

      <div className="mb-6">
        <div className="mb-2 text-sm font-semibold text-text-primary">{t(locale, "campPages.geoByDevice")}</div>
        {devices.length === 0 ? (
          <EmptyState title={t(locale, "campPages.geoNoData")} description={t(locale, "campPages.geoNoDataBody")} />
        ) : (
          <div className="flex flex-col gap-2">
            {devices.map((d: any) => (
              <div key={d.device} className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <span className="text-sm text-text-primary">{deviceName(locale, d.device)}</span>
                <div className="flex items-center gap-3 text-xs text-text-faint">
                  <span>{t(locale, "campPages.geoClicks", { n: d.clicks.toLocaleString() })}</span>
                  <span className="font-mono text-verified">{d.cpa ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-text-primary">{t(locale, "campPages.dgTopGeo10")}</div>
        {geos.length === 0 ? (
          <EmptyState title={t(locale, "campPages.dgNone")} description={t(locale, "campPages.dgNoneBody")} />
        ) : (
          <div className="flex flex-col gap-2">
            {geos.map((g: any) => (
              <div key={g.geoTarget} className="flex items-center justify-between rounded-2xl bg-surface p-4">
                <span className="text-xs text-text-muted">{g.geoTarget}</span>
                <div className="flex items-center gap-3 text-xs text-text-faint">
                  <span>{g.clicks.toLocaleString()} {t(locale, "campPages.unitClicks")}</span>
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

/** جهاز غير معروف يُعرض كما ورد من المنصّة لا كفراغ */
function deviceName(locale: Locale, device: string): string {
  const key = DEVICE_KEYS[device];
  return key ? t(locale, `campPages.${key}`) : device;
}
