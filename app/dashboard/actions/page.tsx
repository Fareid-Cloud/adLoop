// app/dashboard/actions/page.tsx
//
// مركز القرارات. يعرض البنود المعلّقة فقط - المُنفَّذ والمُتجاهَل يعيشان
// في سجلّهما، وخلطهما هنا يحوّل مركز قرار إلى أرشيف.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ActionsClient, type ActionItemData } from "./ActionsClient";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";

  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const items = await prisma.actionFeedItem.findMany({
    where: { workspaceId: workspace.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows: ActionItemData[] = items.map((i: {
    id: string; type: string; severity: string; title: string;
    description: string | null; source: string; estimatedImpact: number | null;
    linkUrl: string | null; actionType: string | null; createdAt: Date;
  }) => ({
    id: i.id,
    type: i.type,
    severity: i.severity,
    title: i.title,
    description: i.description,
    source: i.source,
    estimatedImpact: i.estimatedImpact,
    linkUrl: i.linkUrl,
    // التنفيذ الحقيقي مشروط بوجود actionType - بدونه الموافقة تسجيل فقط،
    // وإخفاء ذلك عن المستخدم يجعله يظنّ أن ميزانيته تغيّرت وهي لم تتغيّر.
    executable: i.actionType !== null,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <div className="mb-5">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">{t(locale, "actions.title")}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t(locale, "actions.subtitle")}</p>
      </div>

      <ActionsClient items={rows} currency={workspace.currency} locale={locale} />
    </div>
  );
}
