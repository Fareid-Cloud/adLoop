// app/dashboard/pricing/page.tsx
//
// عرض صحة تسعير الكتالوج. الحساب كله في lib/pricingHealth.ts (نقطة حقيقة
// واحدة) - نفس الدالة اللي بيستخدمها الكرون اليومي للتنبيه الاستباقي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PricingClient } from "./PricingClient";
import { getWorkspacePricing } from "@/lib/pricingHealth";

export default async function PricingPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
  }

  const { rows, roasGapInsight } = await getWorkspacePricing(workspace.id, workspace.currency);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-6 text-[26px] font-semibold text-text-primary">التسعير</h1>

      {roasGapInsight && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4 text-[13px] text-text-muted">
          💡 {roasGapInsight}
        </div>
      )}
      <PricingClient workspaceId={workspace.id} products={rows} />
    </div>
  );
}
