// app/admin/support/page.tsx - لوحة المالك للرد على رسائل الدعم
// (الوصول محمي عبر app/admin/layout.tsx)
import { prisma } from "@/lib/prisma";
import { AdminSupportClient } from "./AdminSupportClient";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const threads = await prisma.supportThread.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    take: 100,
  });
  return <AdminSupportClient threads={JSON.parse(JSON.stringify(threads))} />;
}
