// app/dashboard/actions/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ActionsClient } from "./ActionsClient";

export default async function ActionsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لسه معملتش مساحة عمل" description="ارجع لـ لمحة عشان تنشئ أول مساحة عمل." />;
  }

  const items = await prisma.actionFeedItem.findMany({
    where: { workspaceId: workspace.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-6 text-[26px] font-semibold text-text-primary">القرارات</h1>

      <ActionsClient
        items={items.map((i: any) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          title: i.title,
          description: i.description,
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
