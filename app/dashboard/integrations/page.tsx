// app/dashboard/integrations/page.tsx
//
// ربط المنصات - نقطة واحدة لكل مصادر البيانات، بدل تفرّقها بين الإعدادات
// وصفحات المنصّات وشاشة الإعداد الأولي.
//
// العنوان داخل الصفحة "ربط المنصات" بالعربية و"Integrations" بالإنجليزية،
// بينما يبقى اسم القسم في القائمة الجانبية كما هو - مصدرهما مختلف عمداً.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getIntegrationsOverview } from "@/lib/integrationsStatus";
import { IntegrationsView } from "./IntegrationsView";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";

  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>
    );
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return (
      <EmptyState
        title={t(locale, "common.noWorkspace")}
        description={t(locale, "common.noWorkspaceHint")}
      />
    );
  }

  const overview = await getIntegrationsOverview(workspace.id, user.id);

  return <IntegrationsView overview={overview} workspaceId={workspace.id} locale={locale} />;
}
