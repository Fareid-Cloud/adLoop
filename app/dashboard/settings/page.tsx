// app/dashboard/settings/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

export default async function SettingsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const [workspaces, connectedPlatforms] = await Promise.all([
    prisma.workspace.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.connectedPlatform.findMany({ where: { userId: user.id } }),
  ]);

  return (
    <SettingsClient
      user={{
        name: user.name,
        email: user.email,
        avatarIcon: user.avatarIcon,
        avatarImageUrl: user.avatarImageUrl,
        preferredLocale: user.preferredLocale,
        themeColor: user.themeColor,
        themeMode: user.themeMode,
        timezone: user.timezone,
        businessScale: user.businessScale,
        marketingOptOut: user.marketingOptOut,
      }}
      // تعيين صريح بدل تمرير الكائن كاملاً: مساحة العمل صارت تحمل توكنات
      // مشفّرة (CAPI)، وتمريرها كما هي يضعها في حزمة العميل بلا داعٍ.
      // الواجهة تحتاج معرفة **هل يوجد توكن** لا قيمته.
      workspaces={workspaces.map((w) => ({
        ...w,
        metaCapiToken: undefined,
        tiktokCapiToken: undefined,
        hasMetaCapiToken: !!w.metaCapiToken,
        hasTiktokCapiToken: !!w.tiktokCapiToken,
        emailEnabled: !!process.env.RESEND_API_KEY,
      }))}
      connectedPlatforms={connectedPlatforms.map((c: { platform: string; connectedAt: Date; expiresAt: Date | null }) => ({
        platform: c.platform,
        connectedAt: c.connectedAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString() ?? null,
      }))}
    />
  );
}
