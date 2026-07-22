// app/dashboard/settings/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
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
      }}
      workspaces={workspaces}
      connectedPlatforms={connectedPlatforms.map((c: { platform: string; connectedAt: Date; expiresAt: Date | null }) => ({
        platform: c.platform,
        connectedAt: c.connectedAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString() ?? null,
      }))}
    />
  );
}
