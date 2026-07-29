// app/dashboard/integrations/page.tsx
//
// قسم التكاملات - نقطة واحدة لكل مصادر البيانات، بدل تفرّقها بين الإعدادات
// وصفحات المنصّات وشاشة الإعداد الأولي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getIntegrationsOverview } from "@/lib/integrationsStatus";
import { IntegrationsView } from "./IntegrationsView";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return (
      <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>
    );
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return (
      <EmptyState
        title="لا توجد مساحة عمل بعد"
        description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل."
      />
    );
  }

  const overview = await getIntegrationsOverview(workspace.id, user.id);

  return <IntegrationsView overview={overview} workspaceId={workspace.id} />;
}
