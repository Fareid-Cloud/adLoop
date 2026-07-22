// app/dashboard/campaigns/catalog-ads/page.tsx
//
// "أداء الإعلانات الديناميكية المرتبطة بالكتالوج؟" - أداء الحملة ككل.
// ملاحظة أمانة: أداء منتج بعينه جوه الحملة مش متاح كرؤية أصلية عند ميتا
// خالص، محتاج نظام بيانات منفصل كامل - موضّح صراحة هنا، مش مخفي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

export default async function CatalogAdsPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى لمحة لإنشاء أول مساحة عمل." />;
  }

  const campaigns = await prisma.catalogCampaignSnapshot.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { cost: "desc" },
  });

  const campaignNames = await prisma.campaignLink.findMany({
    where: { workspaceId: workspace.id, platform: "META_ADS" },
    select: { externalCampaignId: true, campaignName: true },
  });
  const nameMap = new Map<string, string>(
    campaignNames.map((c: any) => [c.externalCampaignId, c.campaignName])
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">الإعلانات الديناميكية (كتالوج)</h1>
      <p className="mb-6 text-xs text-text-faint">
        أداء الحملة ككل. ملاحظة صريحة: أداء منتج بعينه جوه الحملة (أي منتج بالضبط بيتحوّل) غير متاح
        كرؤية أصلية عند ميتا خالص - محتاج نظام بيانات منفصل بربط عدة مصادر يدوياً، مش سحب بيانات بسيط.
      </p>

      {campaigns.length === 0 ? (
        <EmptyState
          title="لا توجد حملات كتالوج بعد"
          description="إما لا توجد حملات ديناميكية مرتبطة بكتالوج، أو لم تُسحب البيانات بعد."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {campaigns.map((c: any) => (
            <div key={c.campaignId} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {nameMap.get(c.campaignId) ?? c.campaignId}
                </span>
                <span className="font-mono text-sm text-verified">{c.purchases} عملية شراء</span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>{c.clicks.toLocaleString()} كليكة</span>
                <span>{c.cost.toLocaleString()} تكلفة</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
