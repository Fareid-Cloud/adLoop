// app/dashboard/automation/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { AutomationClient } from "./AutomationClient";
import { RuleCatalogBrowser } from "./RuleCatalogBrowser";

export default async function AutomationPage() {
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

  const [rules, campaignLinks] = await Promise.all([
    prisma.automationRule.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaignLink.findMany({
      where: { workspaceId: workspace.id },
      select: { externalCampaignId: true, campaignName: true, platform: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-6 text-[26px] font-semibold text-text-primary">التشغيل الذكي</h1>

      {!workspace.enableAutomationRules && (
        <div className="mb-4 rounded-2xl bg-gap/10 p-4 text-xs text-gap">
          الأتمتة متوقفة من الإعدادات لمساحة العمل دي - القواعد هتفضل مسجّلة بس مش هتتنفذ.
        </div>
      )}

      {/* القواعد المفعّلة حالياً */}
      <AutomationClient
        workspaceId={workspace.id}
        rules={rules.map((r: any) => ({
          id: r.id,
          name: r.name,
          metric: r.metric,
          operator: r.operator,
          threshold: r.threshold,
          action: r.action,
          actionValue: r.actionValue,
          enabled: r.enabled,
          requireApproval: r.requireApproval,
        }))}
      />

      {/* كتالوج القرارات: منصة ← فئة ← قرار ← نطاق الحملات */}
      <section className="mt-10">
        <h2 className="mb-1 text-[18px] font-semibold text-text-primary">أضف قراراً جديداً</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          اختر المنصة ثم الفئة، وحدّد العتبة ونطاق الحملات التي تُطبَّق عليها القاعدة.
        </p>
        <RuleCatalogBrowser
          workspaceId={workspace.id}
          currency={workspace.currency}
          campaigns={campaignLinks.map((c: any) => ({
            id: c.externalCampaignId,
            name: c.campaignName,
            platform: c.platform,
          }))}
        />
      </section>
    </div>
  );
}
