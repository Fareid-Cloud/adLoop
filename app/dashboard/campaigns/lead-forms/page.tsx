// app/dashboard/campaigns/lead-forms/page.tsx
//
// "جودة عملاء فورم المنصات الداخلي مقارنة بفورم موقعي؟" - عدد الليدز
// من كل مصدر (جوجل/ميتا/تيك توك الداخلي، فورم موقعك)، جنب بعض.
// ميتا محتاجة تفعيل صلاحيات (activation-checklist.md قسم 4هـ).

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { countGenuineLeads } from "@/lib/messengerLeadQuality";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { MessageCircle, MousePointerClick, Clock } from "lucide-react";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function LeadFormsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = periodFromParams(await searchParams);
  const bounds = await toDateBoundsForUser(period.range);

  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }


  const [byPlatform, websiteFormCount, messengerConversations] = await Promise.all([
    prisma.leadFormSubmission.groupBy({
      by: ["platform"],
      where: { workspaceId: workspace.id, submittedAt: { gte: bounds.gte } },
      _count: true,
    }),
    prisma.ctaClickEvent.count({
      where: { workspaceId: workspace.id, ctaType: "FORM", clickedAt: { gte: bounds.gte } },
    }),
    prisma.messengerConversation.findMany({
      where: { workspaceId: workspace.id, firstMessageAt: { gte: bounds.gte } },
    }),
  ]);

  // إصلاح فجوة حقيقية: countGenuineLeads كانت مبنية ومعزولة تماماً -
  // أول استخدام حقيقي ليها هنا، بتعطي ملخص واضح "كام تواصل حقيقي مقابل
  // ضغطة بالخطأ" بدل ما تفضل الأرقام دي مدفونة في قاعدة البيانات بس
  const messengerBreakdown = messengerConversations.length > 0
    ? countGenuineLeads(
        messengerConversations.map((c: any) => ({
          conversationId: c.id,
          hasAutomatedGreeting: true,
          humanRepliesCount: Math.max(0, c.messageCount - 1),
          minutesSinceLastActivity: (Date.now() - c.lastMessageAt.getTime()) / 60000,
        })),
        workspace.messengerInactivityThresholdMinutes
      )
    : null;

  const googleCount = byPlatform.find((p: any) => p.platform === "GOOGLE_ADS")?._count ?? 0;
  const metaCount = byPlatform.find((p: any) => p.platform === "META_ADS")?._count ?? 0;
  const tiktokCount = byPlatform.find((p: any) => p.platform === "TIKTOK_ADS")?._count ?? 0;
  const hasAnyData = googleCount > 0 || metaCount > 0 || tiktokCount > 0 || websiteFormCount > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={ClipboardList}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.lfTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
      <p className="mb-6 text-xs text-text-faint">
        {t(locale, "campPages.lfIntro")}
      </p>

      {!hasAnyData ? (
        <EmptyState
          title={t(locale, "campPages.lfNone")}
          description={t(locale, "campPages.lfNoneBody")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{googleCount}</div>
            <div className="mt-1 text-xs text-text-faint">{t(locale, "campPages.lfGoogle")}</div>
          </div>
          <div className="card p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{metaCount}</div>
            <div className="mt-1 text-xs text-text-faint">{t(locale, "campPages.lfMeta")}</div>
          </div>
          <div className="card p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{tiktokCount}</div>
            <div className="mt-1 text-xs text-text-faint">{t(locale, "campPages.lfTiktok")}</div>
          </div>
          <div className="card p-5 text-center">
            <div className="font-mono text-3xl text-text-primary">{websiteFormCount}</div>
            <div className="mt-1 text-xs text-text-faint">{t(locale, "campPages.lfSite")}</div>
          </div>
        </div>
      )}

      {messengerBreakdown && (
        <>
          <div className="mb-2 mt-8 text-[13px] text-text-muted">{t(locale, "campPages.lfQualityTitle", { days: "30" })}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label={t(locale, "campPages.lfGenuine")}
              value={messengerBreakdown.genuineCount}
              icon={MessageCircle}
              tone="verified"
              verified
              explainKey="genuineContact"
              locale={locale}
            />
            <MetricCard
              label={t(locale, "campPages.lfAccidental")}
              value={messengerBreakdown.likelyAccidentalCount}
              icon={MousePointerClick}
              tone="critical"
              caption={{ text: t(locale, "campPages.lfCountsAsConv"), tone: "negative" }}
              explainKey="accidentalTap"
              locale={locale}
            />
            <MetricCard
              label={t(locale, "campPages.lfNeedsTime")}
              value={messengerBreakdown.pendingCount}
              icon={Clock}
              tone="neutral"
              explainKey="needsTime"
              locale={locale}
            />
          </div>
        </>
      )}
    </div>
  );
}
