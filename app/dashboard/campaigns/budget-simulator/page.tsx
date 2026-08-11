// app/dashboard/campaigns/budget-simulator/page.tsx
//
// "ماذا لو نقلنا ميزانية من منصة إلى أخرى؟" - نستخدم تكلفة العميل
// الحقيقية الفعلية لكل منصة (لا المُعلنة)، ونحاكي: لو نُقل مبلغ معيّن،
// كم عميلاً حقيقياً إضافياً أو أقلّ يُتوقّع الحصول عليه.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";


export default async function BudgetSimulatorPage({
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


  const byPlatform = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId: workspace.id, date: bounds },
    _sum: { cost: true, verifiedConversions: true },
  });

  interface PlatformCpa {
    platform: string;
    cost: number;
    conversions: number;
    cpa: number | null;
  }

  const platforms = byPlatform
    .map((p: any): PlatformCpa => {
      const cost = p._sum.cost ?? 0;
      const conv = p._sum.verifiedConversions ?? 0;
      return {
        platform: p.platform as string,
        cost,
        conversions: conv,
        cpa: conv > 0 ? cost / conv : null,
      };
    })
    // type predicate صريح - كي يتتبّع TypeScript فعلياً أن هذا الفلتر
    // يزيل القيم null، لا وقت التشغيل وحده. بدونه يبقى النوع المستنتَج
    // `number | null` حتى بعد الفلترة، وهو ما كان يسبّب خطأ البناء
    // (قسمة على قيمة قد تكون null نظرياً بحسب الأنواع)
    .filter((p: PlatformCpa): p is PlatformCpa & { cpa: number } => p.cpa !== null)
    .sort((a: PlatformCpa & { cpa: number }, b: PlatformCpa & { cpa: number }) => a.cpa - b.cpa);

  const SIMULATION_AMOUNT = 1000;

  return (
    <div>
      <PageHeader
        icon={Calculator}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.simTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
      <p className="mb-6 text-xs text-text-faint">{t(locale, "campPages.simIntro")}</p>

      {platforms.length < 2 ? (
        <EmptyState
          title={t(locale, "campPages.simNeedTwoTitle")}
          description={t(locale, "campPages.simNeedTwoBody")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="card p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">{t(locale, "campPages.simCurrentCpa")}</div>
            {platforms.map((p: any) => (
              <div key={p.platform} className="flex items-center justify-between py-1 text-xs text-text-faint">
                <span>{platformLabel(locale, p.platform)}</span>
                <span className="font-mono text-verified">{Math.round(p.cpa)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-gap/10 p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              {t(locale, "campPages.simIfMoved", { amount: SIMULATION_AMOUNT.toLocaleString() })}
            </div>
            {(() => {
              const cheapest = platforms[0];
              const mostExpensive = platforms[platforms.length - 1];
              if (cheapest.platform === mostExpensive.platform) return null;

              const lostCustomers = SIMULATION_AMOUNT / mostExpensive.cpa;
              const gainedCustomers = SIMULATION_AMOUNT / cheapest.cpa;
              const netDiff = Math.round((gainedCustomers - lostCustomers) * 10) / 10;

              return (
                <p className="text-xs text-text-muted">
                  {t(locale, "campPages.simSentence", {
                    amount: SIMULATION_AMOUNT.toLocaleString(),
                    from: platformLabel(locale, mostExpensive.platform),
                    to: platformLabel(locale, cheapest.platform),
                    lost: Math.round(lostCustomers * 10) / 10,
                    gained: Math.round(gainedCustomers * 10) / 10,
                    net: `${netDiff > 0 ? "+" : ""}${netDiff}`,
                  })}
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
