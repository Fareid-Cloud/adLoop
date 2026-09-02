// app/admin/agent/page.tsx
//
// **مراجعةُ المساعد - القراءة نفسها فعلٌ مسجَّل.**
//
// الصفحةُ دي بتعرض نصَّ محادثاتِ عملاء، وده أثقلُ شيء تعرضه اللوحة كلها:
// مش أرقاماً مجمَّعة، بل أسئلةَ صاحبِ حسابٍ عن شغله وأرقامَ صرفه بالاسم.
// فبتلتزم بتلاتة:
//
//   ١. صلاحيةٌ مستقلّة (`agent.review`) للمالك وحده - الدعم مايشوفهاش.
//   ٢. **كلُّ فتحةٍ تُكتب في سجلّ التدقيق.** ده اللي بتعد به سياسةُ
//      الخصوصية حرفياً («وكل اطلاع من هذا النوع مقيد في سجل تدقيق»)،
//      فغيابُه مايبقاش نقصَ ميزة - يبقى وعداً مكتوباً غير منفَّذ.
//   ٣. الغرضُ مكتوبٌ على الشاشة - التقييم والتحسين، لا الاطّلاع.

import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { lastNDays } from "@/lib/admin/shared";
import { getAgentReview, type ReviewFilter } from "@/lib/admin/agentReview";
import { logAdminAction } from "@/lib/adminAudit";
import { AdminPageHeader } from "../components/AdminUI";
import { AgentReviewClient } from "./AgentReviewClient";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: ReviewFilter; label: string }> = [
  { key: "queue", label: "Not reviewed" },
  { key: "thumbsdown", label: "Rated bad" },
  { key: "reasked", label: "Asked again" },
  { key: "reviewed", label: "Reviewed" },
  { key: "all", label: "All" },
];

export default async function AgentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "queue") as ReviewFilter;

  const user = await getSessionUserFromCookies();
  // اللايوت بيحرس اللوحة كلها؛ الفحص هنا للصلاحية دي بعينها، وهي مش
  // ممنوحة لكلّ أدمن.
  if (!user || !adminCapabilities(resolveAdminRole(user)).includes("agent.review")) {
    redirect("/admin");
  }

  const range = lastNDays(days);
  const { rows, summary } = await getAgentReview(range, filter);

  // بعد الجلب لا قبله: تسجيلُ فتحةٍ فشل تحميلُها بيملا السجلّ بضجيج.
  // وبيتسجّل العدد لا المحتوى - السجلّ بيقول "قرأ" مش بيعيد نسخ اللي قرأه.
  await logAdminAction({
    adminUserId: user.id,
    action: "AGENT_CONVERSATIONS_VIEWED",
    details: `filter=${filter} · last ${days}d · ${rows.length} answers shown`,
  }).catch(() => {});

  return (
    <div>
      <AdminPageHeader
        title="Agent review"
        subtitle="Customer conversations, read to judge answer quality — every view here is logged"
        icon={Bot}
      />
      <AgentReviewClient
        rows={JSON.parse(JSON.stringify(rows))}
        summary={summary}
        filters={FILTERS}
        activeFilter={filter}
        days={days}
      />
    </div>
  );
}
