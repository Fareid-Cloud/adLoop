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
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.connection) ? sp.connection[0] : sp.connection;
  // نتيجة الربط كانت تُعرض في الإعدادات؛ بعد نقل التحويل إلى هنا يجب أن
  // تُعرض هنا وإلا فشل الربط بصمت والمستخدم لا يعرف لماذا.
  const connectionResult =
    raw === "cancelled" ? "connCancelled"
    : raw === "missing_refresh_token" ? "connMissingRefresh"
    : raw === "error" ? "connError"
    // حدّ الباقة: الرمز وحده لا يقول شيئاً للمستخدم، فيبقى واقفاً أمام
    // ربطٍ لم يتمّ بلا سبب معلَن.
    : raw === "plan_limit" ? "connPlanLimit"
    : null;
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";

  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>
    );
  }

  const workspace = await getActiveWorkspace(user.id);
  if (!workspace) {
    return (
      <EmptyState
        title={t(locale, "common.noWorkspace")}
        description={t(locale, "common.noWorkspaceHint")}
      />
    );
  }

  const overview = await getIntegrationsOverview(workspace.id, user.id);

  return (
    <>
      {connectionResult && (
        <div className="btn btn-danger mx-auto mb-4 max-w-[1400px] border border-critical/35 bg-critical/[0.06] p-4 leading-relaxed text-text-primary">
          {t(locale, `integrations.${connectionResult}`)}
        </div>
      )}
      <IntegrationsView overview={overview} workspaceId={workspace.id} locale={locale} />
    </>
  );
}
