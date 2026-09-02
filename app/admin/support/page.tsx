// app/admin/support/page.tsx - لوحة المالك للرد على رسائل الدعم
// (الوصول محمي عبر app/admin/layout.tsx)
//
// 🔴 **كانت الصفحة الوحيدة في اللوحة بلا عنوان.** ولا `AdminPageHeader`
// ولا حتى `<h1>` - لا في فرع القائمة ولا في الفرع الفاضي. والفرع الفاضي
// أسوأ: `AdminSupportClient` بيرجع كارت واحد مكتوب فيه سطر ويخرج، فالصفحة
// تبان **مكسورة** لا فاضية - ومحدش يعرف إنّه في المكان الصح أصلاً.
//
// والعنوان مكانه هنا لا جوّه المكوّن: لو اتحطّ جوّاه لازم يتكرر في الفرعين،
// وأوّل ما حد يعدّل فرع من غير التاني بيرجع الاختلاف. هنا بيغطّي الاتنين
// لأنّه برّاهم.

import { LifeBuoy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "../components/AdminUI";
import { AdminSupportClient } from "./AdminSupportClient";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread } = await searchParams;
  const threads = await prisma.supportThread.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    take: 100,
  });

  // العدّ على الحالة لا على طول القائمة: القائمة مقصوصة على ١٠٠، فعرض
  // "١٠٠ مفتوحة" وإحنا عارفين إنّ فيه أكتر رقم غلط في لوحة بيتاخد عليها قرار.
  const open = await prisma.supportThread.count({ where: { status: "OPEN" } });

  return (
    <div>
      <AdminPageHeader
        title="Support"
        subtitle={
          open > 0
            ? `${open} conversation${open === 1 ? "" : "s"} waiting for a reply`
            : "No conversation is waiting for a reply"
        }
        icon={LifeBuoy}
      />
      <AdminSupportClient
        threads={JSON.parse(JSON.stringify(threads))}
        initialThreadId={thread}
      />
    </div>
  );
}
