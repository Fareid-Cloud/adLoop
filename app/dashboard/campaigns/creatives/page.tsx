// app/dashboard/campaigns/creatives/page.tsx
//
// "أنهي إعلان بالذات بيجيب النتيجة؟" - أول سؤال طلع من تحليل الفجوات
// (docs/user-questions-gap-analysis.md، سؤال 20) ومكانش له إجابة قبل كده.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { rankCreatives, selectTopTwoCreatives, CreativePerformance, getWorkspaceCreativePerformances } from "@/lib/creativeAnalysis";
import { BestAdPair } from "@/app/components/BestAdPair";
import { ImageQualityButton } from "./ImageQualityButton";
import { detectCreativeFatigue } from "@/lib/aiInsights";
import { buildAdDecisions } from "@/lib/adDecisions";
import { AdDecisionTable } from "@/app/components/AdDecisionTable";
import { getFrequencyByPlatform } from "@/lib/frequencyCheck";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { PeriodBar } from "@/app/components/ui/PeriodBar";
import { periodFromParams } from "@/lib/dateRange";
import { toDateBoundsForUser } from "@/lib/historyWindow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { costPerVerified } from "@/lib/kpiEngine";
import { Image } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";

export default async function CreativesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `creativesPage.${k}`, vars);
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

  const { performances, daysActiveByAdId, historicalCtrByAdId, fatiguedAdIds } =
    await getWorkspaceCreativePerformances(workspace.id);

  // إصلاح فجوة حقيقية: detectCreativeFatigue كانت مبنية ومعزولة تماماً -
  // إشارة تعب مكمّلة لـrankCreatives (اللي بتعتمد على نسبة النقر) -
  // هنا بتعتمد على تكلفة العميل الحقيقية، ممكن تلتقط تعب متأخر عن
  // النقر (الإعلان لسه بيتنقّط عليه، لكن العملاء اللي بييجوا بقوا أغلى)
  const dailySnapshotsForFatigue = await prisma.creativeSnapshot.findMany({
    where: { workspaceId: workspace.id, date: bounds },
    select: { adId: true, date: true, cost: true, verifiedConversions: true },
  });
  const dailyCplByAdId = new Map<string, { date: string; value: number }[]>();
  for (const row of dailySnapshotsForFatigue) {
    if (!row.verifiedConversions || row.verifiedConversions === 0) continue; // مفيش CPL نقدر نحسبه من غير تحويلات
    const arr = dailyCplByAdId.get(row.adId) ?? [];
    // 🔴 كانت قسمة بلا حارس: إعلان أنفق ولم يتحقّق له عميل ينتج
    // `Infinity` يدخل سلسلة الاتجاه ويسمّم كلّ حساب تعب مبنيّ عليها.
    const cpl = costPerVerified(row.cost, row.verifiedConversions);
    if (cpl !== null) arr.push({ date: row.date.toISOString().slice(0, 10), value: cpl });
    dailyCplByAdId.set(row.adId, arr);
  }
  const cplFatiguedAdIds = new Set<string>();
  for (const [adId, series] of dailyCplByAdId.entries()) {
    if (detectCreativeFatigue(series).isFatigued) cplFatiguedAdIds.add(adId);
  }

  if (performances.length === 0) {
    return (
      <div className="max-w-4xl">
      <PageHeader
        icon={Image}
        tone="accent"
        eyebrow={workspace.name}
        title={t(locale, "campPages.crTitle")}
        actions={<PeriodBar locale={locale} preset={period.preset} range={period.range} compare={period.compare} />}
      />
        <EmptyState
          title={t(locale, "campPages.crNone")}
          description={t(locale, "campPages.crNoneBody")}
        />
      </div>
    );
  }

  const ranking = rankCreatives(performances, historicalCtrByAdId);

  // معدّل التكرار إشارة حيّة من المنصة (ميتا نداء مباشر، تيك توك من بيانات
  // مخزّنة). فشلها لا يجوز أن يُسقط الصفحة - القرار يبقى صالحاً بدونها،
  // فقط دون طبقة التشبّع.
  let frequencyByPlatform: Record<string, number> = {};
  try {
    frequencyByPlatform = await getFrequencyByPlatform(workspace.id);
  } catch (err) {
    console.error("تعذّر جلب معدّل التكرار:", err);
  }

  const adDecisions = await buildAdDecisions({
    workspaceId: workspace.id,
    frequencyByPlatform,
  });

  return (
    <div className="max-w-6xl">
      <PageHeader icon={Image} tone="accent" eyebrow={workspace.name} title={tr("title")} />

      {/* أفضل إعلانين **عبر المنصّات مجتمعةً**. كانت البطاقة تُعرض داخل
          صفحة كلّ منصّة وحدها، فيعرف المستخدم أفضل إعلان في جوجل وأفضل
          إعلان في ميتا ولا يعرف أيّهما أفضل فعلاً - وهو السؤال الذي يقرّر
          أين تذهب الميزانية. المعيار واحد (تكلفة العميل المتحقَّقة)،
          فالمقارنة عبر المنصّات صحيحة لا مجازية. */}
      <div className="mb-8">
        <BestAdPair
          pick={selectTopTwoCreatives(performances, daysActiveByAdId, fatiguedAdIds)}
          currency={workspace.currency}
          scopeLabel={t(locale, "campNav.crossPlatform")}
          locale={locale}
        />
      </div>

      <SectionTitle>{t(locale, "campPages.crDecision")}</SectionTitle>
      <p className="mb-3 text-xs text-text-faint">
        {t(locale, "campPages.crIntro2")}
      </p>
      <div className="mb-8">
        <AdDecisionTable
          locale={locale}
          decisions={adDecisions}
          workspaceId={workspace.id}
          currency={workspace.currency}
        />
      </div>

      <SectionTitle>{tr("best")}</SectionTitle>
      <CreativeGrid items={ranking.best} accentColor="verified" locale={locale} workspaceId={workspace.id} />

      <SectionTitle>{tr("worst")}</SectionTitle>
      <CreativeGrid items={ranking.worst} accentColor="critical" locale={locale} workspaceId={workspace.id} />

      {ranking.fatigued.length > 0 && (
        <>
          <SectionTitle>{tr("fatigued")}</SectionTitle>
          <CreativeGrid items={ranking.fatigued} accentColor="gap" locale={locale} workspaceId={workspace.id} />
        </>
      )}

      {cplFatiguedAdIds.size > 0 && (
        <>
          <SectionTitle>{tr("lateFatigue")}</SectionTitle>
          <CreativeGrid items={performances.filter((p) => cplFatiguedAdIds.has(p.adId))} accentColor="gap" locale={locale} workspaceId={workspace.id} />
        </>
      )}
    </div>
  );
}

const TONE_TEXT: Record<"verified" | "critical" | "gap", string> = {
  verified: "text-verified",
  critical: "text-critical",
  gap: "text-gap",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold text-text-primary">{children}</h2>;
}

function CreativeGrid({
  items,
  accentColor,
  locale,
  workspaceId,
}: {
  items: CreativePerformance[];
  accentColor: "verified" | "critical" | "gap";
  locale: Locale;
  /** يُمرَّر إلى زرّ فحص الجودة: الخادم يحتاجه ليتحقّق من الملكيّة ويمنع
   *  النداء المدفوع في مساحة العرض التجريبية. */
  workspaceId: string;
}) {
  if (items.length === 0) {
    return <p className="mb-4 text-xs text-text-faint">{t(locale, "creativesPage.notEnough")}</p>;
  }

  return (
    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {items.map((item) => {
        // 🔴 **الرقم المُعلَن كان هو البطاقة كلّها.** كانت تطبع `cpa` وتحته
        // «تكلفة التحويل (مُعلنة)» **دائماً** - حتى حين تكون البيانات
        // متحقَّقة فعلاً (`usingVerifiedData`)، فالتسمية تكذب على نصف
        // الحالات. والأسوأ أنّ الرقم المُعلَن هو ما تقوله المنصّة عن
        // نفسها، وهو بالضبط ما يقوم هذا المنتج ليشكّك فيه.
        //
        // البطاقة الآن تقود بالمتحقَّق وتضع المُعلَن بجانبه أصغر - فتُقرأ
        // **الفجوة** بينهما، وهي القيمة التي لا يعطيها أيّ تقرير منصّة.
        // الرقمان محسوبان من حقول موجودة (`cost` و`rawConversions`)، بلا
        // بيانات جديدة.
        const reportedCpa = item.rawConversions > 0 ? item.cost / item.rawConversions : null;
        const gapPct =
          item.usingVerifiedData && reportedCpa && reportedCpa > 0
            ? Math.round(((item.cpa - reportedCpa) / reportedCpa) * 100)
            : null;
        return (
        <div key={item.adId} className="card flex flex-col gap-2 p-3.5">
          {/* الاسم سطرُ سياق لا عنوان: أخفّ وزناً ممّا تحته عمداً */}
          {item.headline && (
            <p className="line-clamp-2 text-[11.5px] leading-snug text-text-muted">{item.headline}</p>
          )}

          {/* التسمية فوق الرقم لا تحته: تُقرأ أوّلاً فيُعرف ما هو الرقم
              قبل رؤيته - وكانت تحته بحجم ١٠px فتُقرأ بعد فوات الأوان. */}
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-wide text-text-faint">
              {t(locale, item.usingVerifiedData ? "campPages.crCpaVerified" : "campPages.crCpaReported")}
            </div>
            <div className={`mt-0.5 font-mono text-[22px] font-semibold leading-none ${TONE_TEXT[accentColor]}`}>
              {item.cpa || "—"}
            </div>
          </div>

          {/* المُعلَن والفجوة - أو اعترافٌ صريح بغياب التحقّق */}
          {item.usingVerifiedData && reportedCpa !== null ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-text-faint">
                {t(locale, "campPages.crReportedAside", { value: Math.round(reportedCpa).toLocaleString("en-US") })}
              </span>
              {gapPct !== null && gapPct > 0 && (
                <span className="rounded-full bg-gap/12 px-1.5 py-0.5 font-medium text-gap">
                  {t(locale, "campPages.crGapPct", { pct: gapPct })}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-text-faint">{t(locale, "campPages.crNoVerifiedYet")}</div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-text-faint">
            <span>CTR {item.ctr}%</span>
            {item.thumbnailUrl && (
              <ImageQualityButton imageUrl={item.thumbnailUrl} platform={item.platform} workspaceId={workspaceId} locale={locale} />
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
