// app/dashboard/truth/page.tsx
//
// قسم الحقيقة: الفجوة بين ما تعلنه كل منصة وما تحقّق فعلاً - جوهر المنتج
// في صفحة واحدة، مع طبقة الإسناد متعدّد اللمسات وحالة إعادة رفع التحويلات.
//
// كل الحساب في lib/truthKpis.ts - هذه الصفحة تتحقّق من الجلسة وتمرّر فقط.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getTruthSnapshot } from "@/lib/truthKpis";
import { TruthView } from "./TruthView";

export const dynamic = "force-dynamic";

export default async function TruthPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

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

  const snapshot = await getTruthSnapshot(workspace.id, days);

  return (
    <TruthView
      workspaceName={workspace.name}
      currency={workspace.currency}
      snapshot={snapshot}
    />
  );
}
