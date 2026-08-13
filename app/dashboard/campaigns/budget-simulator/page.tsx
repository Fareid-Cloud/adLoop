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
import { PlatformLogo } from "@/app/components/PlatformLogo";


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
      ) : (() => {
        // 🔴 **الصفحة كانت أسطراً نصّية متتابعة، والرقم المقصود مدفونٌ في
        // جملة.** ومَن يفتح محاكاةَ ميزانيةٍ يسأل سؤالاً واحداً: «أنقل أم
        // لا؟» - وجوابُه رقمٌ واحد: كم عميلاً أكسب. فيُرفَع إلى الأعلى
        // بحجمٍ يُقرأ من بعيد، ويُشرَح تحته لا العكس.
        const cheapest = platforms[0];
        const dearest = platforms[platforms.length - 1];
        const same = cheapest.platform === dearest.platform;

        const lost = SIMULATION_AMOUNT / dearest.cpa;
        const gained = SIMULATION_AMOUNT / cheapest.cpa;
        const net = Math.round((gained - lost) * 10) / 10;
        const worth = net > 0;

        // أغلى منصّةٍ تُقاس عليها الأشرطة: النسبة تُقرأ بالطول قبل الرقم.
        const maxCpa = Math.max(...platforms.map((p: PlatformCpa & { cpa: number }) => p.cpa));

        return (
          <div className="flex flex-col gap-4">
            {/* ═══ الجواب أوّلاً ═══ */}
            {!same && (
              <div className={`card pad-lg ${worth ? "border-verified/35" : "border-border"}`}>
                <div className="mb-1 text-[12.5px] text-text-muted">
                  {t(locale, "campPages.simIfMoved", { amount: SIMULATION_AMOUNT.toLocaleString() })}
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`font-mono text-[38px] font-bold leading-none ${worth ? "text-verified" : "text-critical"}`}>
                    {net > 0 ? "+" : ""}{net}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {t(locale, "campPages.simNetCustomers")}
                  </span>
                </div>

                {/* الطرفان: ما يُفقَد وما يُكسَب - الرقم أعلاه فرقُهما */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface-raised p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-text-muted">
                      <PlatformLogo platform={dearest.platform} size={13} />
                      {t(locale, "campPages.simFrom")}
                    </div>
                    <div className="font-mono text-[19px] font-semibold text-critical">
                      −{Math.round(lost * 10) / 10}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-raised p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-text-muted">
                      <PlatformLogo platform={cheapest.platform} size={13} />
                      {t(locale, "campPages.simTo")}
                    </div>
                    <div className="font-mono text-[19px] font-semibold text-verified">
                      +{Math.round(gained * 10) / 10}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ الأساس الذي بُني عليه ═══ */}
            <div className="card pad-lg">
              <div className="mb-4 text-[13px] font-medium text-text-primary">
                {t(locale, "campPages.simCurrentCpa")}
              </div>
              <div className="flex flex-col gap-3">
                {platforms.map((p: PlatformCpa & { cpa: number }) => {
                  const width = maxCpa > 0 ? (p.cpa / maxCpa) * 100 : 0;
                  const isCheapest = p.platform === cheapest.platform;
                  return (
                    <div key={p.platform}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[12.5px] text-text-primary">
                          <PlatformLogo platform={p.platform} size={14} />
                          {platformLabel(locale, p.platform)}
                        </span>
                        <span className={`font-mono text-[13px] font-semibold ${isCheapest ? "text-verified" : "text-text-primary"}`}>
                          {Math.round(p.cpa)} {workspace.currency}
                        </span>
                      </div>
                      {/* الأرخص بلون التحقّق: هو وجهةُ النقل، فيُميَّز */}
                      <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                        <div
                          className={`h-full rounded-full ${isCheapest ? "bg-verified" : "bg-accent/45"}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ⚠️ حدُّ المحاكاة يُقال في مكانه لا في مقدّمة الصفحة: من يقرأ
                رقماً كبيراً يحتاج أن يعرف عندها ما لا يضمنه. */}
            <p className="text-[11.5px] leading-relaxed text-text-faint">
              {t(locale, "campPages.simCaveat")}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
