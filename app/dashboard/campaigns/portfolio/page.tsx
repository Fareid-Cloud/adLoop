// app/dashboard/campaigns/portfolio/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { computeOptimalAllocation } from "@/lib/portfolioAllocation";

export default async function PortfolioPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [campaignLinks, agg] = await Promise.all([
    prisma.campaignLink.findMany({ where: { workspaceId: workspace.id } }),
    prisma.metricSnapshot.groupBy({
      by: ["platform", "campaignId"],
      where: { workspaceId: workspace.id, date: { gte: sevenDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    }),
  ]);

  if (campaignLinks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="mb-6 text-[26px] font-semibold text-text-primary">توزيع المحفظة</h1>
        <EmptyState title="لا توجد حملات مربوطة بعد" description="اربط حملاتك من الإعدادات أولاً." />
      </div>
    );
  }

  interface AggValue { cost: number; verified: number; }

  const aggMap = new Map<string, AggValue>(
    agg.map((a: any) => [`${a.platform}::${a.campaignId}`, { cost: a._sum.cost ?? 0, verified: a._sum.verifiedConversions ?? 0 }])
  );

  // ملاحظة صريحة: "الميزانية الحالية" هنا بتفترض إن الإنفاق آخر 7 أيام
  // موزّع بالتساوي كتقدير للميزانية اليومية الفعلية - النظام لسه مش بيسحب
  // "الميزانية المضبوطة" الحقيقية من إعدادات الحملة في جوجل نفسها (فجوة
  // معروفة، محتاجة حقل ميزانية إضافي في المزامنة لاحقاً)
  const input = campaignLinks.map((link: any) => {
    const key = `${link.platform}::${link.externalCampaignId}`;
    const data: AggValue = aggMap.get(key) ?? { cost: 0, verified: 0 };
    return {
      campaignId: link.externalCampaignId,
      campaignName: link.campaignName,
      currentBudget: round2(data.cost / 7),
      verifiedConversions: data.verified,
      cost: data.cost,
    };
  });

  const result = computeOptimalAllocation(input);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">توزيع المحفظة</h1>
      <p className="mb-6 text-xs text-text-faint">
        اقتراح إعادة توزيع الميزانية اليومية التقديرية بين الحملات بناءً على الكفاءة النسبية آخر 7 أيام - مش تنفيذ تلقائي، اقتراح بس.
      </p>

      <div className="flex flex-col gap-2">
        {result.allocations.map((a) => (
          <div key={a.campaignId} className="rounded-2xl bg-surface p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-text-primary">{a.campaignName}</span>
              <span
                className={`font-mono text-sm ${
                  a.changePct > 0 ? "text-verified" : a.changePct < 0 ? "text-critical" : "text-text-faint"
                }`}
              >
                {a.changePct > 0 ? "+" : ""}
                {a.changePct}%
              </span>
            </div>
            <p className="text-xs text-text-faint">{a.reasoning}</p>
            <div className="mt-2 flex gap-4 font-mono text-xs text-text-muted">
              <span>الحالية: {a.currentBudget}</span>
              <span>المقترحة: {a.suggestedBudget}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
