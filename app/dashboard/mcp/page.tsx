// app/dashboard/mcp/page.tsx
//
// 🔴 **قسمٌ مستقلّ، لا بطاقةٌ في شبكة ربط المنصّات.**
//
// وضعتُه أوّلاً بطاقةً هناك، وذلك يؤطّره خطأً: شبكةُ الربط مصادرُ بيانات
// نسحب منها - سلّة وجوجل وميتا. وهذا ليس مصدراً نسحب منه، بل **قدرةٌ في
// المنتج نفسه**: قناةٌ يقرأ منها ذكاءُ المشترك أرقامَه. فمكانه قسمٌ يقف
// بذاته.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { McpClient } from "./McpClient";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login");

  const locale = (user.preferredLocale ?? "ar") as Locale;
  const tr = (k: string) => t(locale, `mcp.${k}`);

  const workspaces = await prisma.workspace.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const active = await getActiveWorkspace(user.id);
  const ent = await getEntitlements(user.id);

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const mcpUrl = `${base}/api/mcp`;

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <PageHeader icon={Sparkles} title={tr("title")} description={tr("subtitle")} />

      {!ent.limits.mcp ? (
        // الحدّ يحمل حلّه: أيّ باقةٍ تفتحه، وأين تُرقّى - لا «غير متاح» وصمت.
        <EmptyState
          title={tr("lockedTitle")}
          description={tr("lockedBody")}
          action={
            <a href="/dashboard/billing" className="btn btn-primary">
              {tr("lockedCta")}
            </a>
          }
        />
      ) : workspaces.length === 0 ? (
        <EmptyState title={tr("lockedTitle")} description={tr("lockedBody")} />
      ) : (
        <McpClient
          locale={locale}
          workspaces={workspaces}
          initialWorkspaceId={active?.id ?? workspaces[0].id}
          mcpUrl={mcpUrl}
        />
      )}
    </div>
  );
}
