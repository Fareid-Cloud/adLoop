// app/dashboard/agent/page.tsx
//
// حاوية الوكيل. السجلّ يُجلب على الخادم فيظهر مع أوّل رسم بدل ومضةٍ
// فارغةٍ ثمّ امتلاء - القائمة الجانبية أوّل ما تقع عليه العين هنا.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { AgentClient } from "./AgentClient";
import { type Locale } from "@/lib/i18n/dictionary";

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

  // 🔴 **قسمُ المحادثة يملأ الإطار، ولا يجلس في عمودٍ وسط صفحة.**
  //
  // كان هنا `max-w-6xl` وترويسةُ صفحةٍ فوقه، فتُقتطع من الارتفاع مساحةٌ
  // ثابتة ويبقى الحوار في شريطٍ ضيّق - بينما كلّ تطبيق محادثةٍ يعرفه
  // الناس (Claude، ChatGPT) يعطي المحادثة الشاشةَ كلَّها. والترويسةُ
  // نفسها كانت تكرّر ما تقوله القائمة الجانبية: الاسم والوصف.
  //
  // الارتفاع محسوبٌ من ارتفاع رأس اللوحة (٦٨ بكسلاً) لا مُخمَّن، فلا
  // يظهر شريطُ تمريرٍ ثانٍ للصفحة كلّها تحت شريط المحادثة.
  return (
    <div className="h-[calc(100dvh-68px)] p-3 sm:p-4">
      {/* `useSearchParams` داخل `AgentClient` (لقراءة `?chat=`) يُلزم
          Next.js بحدّ Suspense - وبدونه يفشل البناء لا التشغيل، فلا
          يظهر الخطأ إلّا عند النشر. */}
      <Suspense fallback={null}>
        <AgentClient
          locale={locale}
          workspaceName={workspace?.name ?? null}
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
