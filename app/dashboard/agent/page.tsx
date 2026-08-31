// app/dashboard/agent/page.tsx
//
// حاوية الوكيل. السجلّ يُجلب على الخادم فيظهر مع أوّل رسم بدل ومضةٍ
// فارغةٍ ثمّ امتلاء - القائمة الجانبية أوّل ما تقع عليه العين هنا.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { AgentClient } from "./AgentClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login");

  const locale = ((user.preferredLocale as Locale) ?? "en") as Locale;
  const workspace = await getActiveWorkspace(user.id);

  const chats = workspace
    ? await prisma.agentChat.findMany({
        where: { userId: user.id, workspaceId: workspace.id },
        orderBy: { updatedAt: "desc" },
        take: 60,
        select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <PageHeader
        icon={Sparkles}
        tone="accent"
        eyebrow={workspace?.name}
        title={t(locale, "agentPage.title")}
        description={t(locale, "agentPage.subtitle")}
      />
      {/* `useSearchParams` داخل `AgentClient` (لقراءة `?chat=`) يُلزم
          Next.js بحدّ Suspense - وبدونه يفشل البناء لا التشغيل، فلا
          يظهر الخطأ إلّا عند النشر. */}
      <Suspense fallback={null}>
      <AgentClient
        locale={locale}
        initialChats={chats.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
          messageCount: c._count.messages,
        }))}
      />
      </Suspense>
    </div>
  );
}
