// app/dashboard/automation/page.tsx

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { ActiveRulesList } from "./ActiveRulesList";
import { RuleCatalogBrowser } from "./RuleCatalogBrowser";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Bot } from "lucide-react";

export default async function AutomationPage() {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
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
      <PageHeader
        icon={Bot}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "autoPage.title")}
      />

      {!workspace.enableAutomationRules && (
        <div className="mb-4 rounded-2xl bg-gap/10 p-4 text-xs text-gap">
          {t(locale, "autoPage.disabledNote")}
        </div>
      )}

      {/* القواعد المفعّلة: تشغيل/إيقاف، تعديل، حذف */}
      <ActiveRulesList
        locale={locale}
        workspaceId={workspace.id}
        campaigns={campaignLinks.map((c: any) => ({
          id: c.externalCampaignId, name: c.campaignName, platform: c.platform,
        }))}
        rules={rules.map((r: any) => ({
          id: r.id, name: r.name, metric: r.metric, operator: r.operator,
          threshold: r.threshold, action: r.action, actionValue: r.actionValue,
          enabled: r.enabled, requireApproval: r.requireApproval,
          platform: r.platform, appliesTo: r.appliesTo,
          specificCampaignIds: r.specificCampaignIds ?? [],
          consecutiveDays: r.consecutiveDays,
        }))}
      />

      {/* كتالوج القرارات: منصة ← فئة ← قرار ← نطاق الحملات */}
      <section className="mt-10">
        <h2 className="mb-1 text-[18px] font-semibold text-text-primary">{t(locale, "autoPage.addNew")}</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          {t(locale, "autoPage.addNewHint")}
        </p>
        <RuleCatalogBrowser
          locale={locale}
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
