import * as Icons from "lucide-react";
// app/dashboard/campaigns/PlatformHub.tsx
//
// صفحة "رئيسية" لكل منصة على حدة - نفس محرك Scale/Kill/Watch المستخدم
// في "أداء الإعلانات الفردية" الشامل، لكن مفلتر لمنصة واحدة بس. الهدف:
// تقييم ومقارنة الإعلانات داخل نفس المنصة، مقابل الصفحة الشاملة اللي
// بتقارن بين المنصات مع بعضها. الاتنين موجودين مع بعض، مفيش حاجة اتلغت.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { getConnectStates } from "@/lib/connectionState";
import { ConnectSinglePlatform } from "@/app/components/ConnectPlatforms";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { getWorkspaceCreativePerformances, selectTopTwoCreatives } from "@/lib/creativeAnalysis";
import { buildAdDecisions } from "@/lib/adDecisions";
import { AdDecisionTable } from "@/app/components/AdDecisionTable";
import { getFrequencyByPlatform } from "@/lib/frequencyCheck";
import { BestAdPair } from "@/app/components/BestAdPair";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { HealthGauge } from "@/app/components/ui/HealthGauge";
import { PerformanceFunnel } from "@/app/components/PerformanceFunnel";
import { TrendChart } from "@/app/components/TrendChart";
import { computeHealthScore } from "@/lib/healthScore";
import { compareMetric } from "@/lib/periodComparison";
import { costPerVerified } from "@/lib/kpiEngine";

// ألوان رسمية حقيقية (مؤكدة من مصادر العلامات التجارية) - شارة لونية
// بدل الشعار الفعلي (ملف صورة محمي بحقوق ملكية مش متاح لينا). ملاحظة:
// جوجل مالهاش لون واحد رسمي (شعارها 4 ألوان)، بنستخدم أزرقها الأساسي.
// تيك توك مالهاش أصفر في هويتها أصلاً (ده لون سناب شات) - أحمر/سماوي هما الحقيقيين.
// أيقونة تعبّر عن نوع التحليل - مشتقّة من مسار الصفحة نفسه، بدل سهم
// مكرّر على كل رابط لا يضيف أي معنى
function iconForLink(href: string) {
  if (href.includes("creative")) return Icons.Image;
  if (href.includes("audience")) return Icons.Users;
  if (href.includes("placement")) return Icons.LayoutGrid;
  if (href.includes("bid")) return Icons.Gavel;
  if (href.includes("budget")) return Icons.Wallet;
  if (href.includes("catalog") || href.includes("shopping")) return Icons.ShoppingCart;
  if (href.includes("lead")) return Icons.ClipboardList;
  if (href.includes("video")) return Icons.PlayCircle;
  if (href.includes("search-terms")) return Icons.Search;
  if (href.includes("quality")) return Icons.Star;
  if (href.includes("competitor")) return Icons.Radar;
  if (href.includes("attribution")) return Icons.GitBranch;
  if (href.includes("content")) return Icons.Sparkles;
  if (href.includes("learning")) return Icons.GraduationCap;
  if (href.includes("spark")) return Icons.Flame;
  if (href.includes("device") || href.includes("geo")) return Icons.MapPin;
  return Icons.BarChart3;
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
  GOOGLE_ADS: { bg: "#4285F4", text: "#ffffff" },
  META_ADS: { bg: "#0866FF", text: "#ffffff" },
  TIKTOK_ADS: { bg: "#FE2C55", text: "#ffffff" },
};

export async function PlatformHub({
  platform,
  platformLabel,
  deepDiveLinks,
}: {
  platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";
  platformLabel: string;
  deepDiveLinks: Array<{ href: string; label: string }>;
}) {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "ar";
  if (!user) {
    return <div className="py-20 text-center text-text-muted">{t(locale, "common.sessionExpired")}</div>;
  }

  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <EmptyState title={t(locale, "common.noWorkspace")} description={t(locale, "common.noWorkspaceHint")} />;
  }

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId: workspace.id, platform },
  });

  if (links.length === 0) {
    // كارت ربط المنصة نفسها هنا مباشرة - مش "روح للإعدادات"
    const states = await getConnectStates(workspace.id, user.id);
    const state = states.find((s) => s.platform === platform) ?? { platform, connected: false, campaignCount: 0 };
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="mb-6 flex items-center gap-2.5 page-title">
          <PlatformLogo platform={platform} size={24} />
          {platformLabel}
        </h1>
        <ConnectSinglePlatform state={state} workspaceId={workspace.id} locale={locale} />
      </div>
    );
  }

  const { performances, daysActiveByAdId, fatiguedAdIds } =
    await getWorkspaceCreativePerformances(workspace.id, platform);

  const topPick = selectTopTwoCreatives(performances, daysActiveByAdId, fatiguedAdIds);

  // معدّل التكرار إشارة حيّة - فشلها لا يجوز أن يُسقط الصفحة
  let frequencyByPlatform: Record<string, number> = {};
  try {
    frequencyByPlatform = await getFrequencyByPlatform(workspace.id);
  } catch (err) {
    console.error("تعذّر جلب معدّل التكرار:", err);
  }

  const adDecisions = await buildAdDecisions({
    workspaceId: workspace.id,
    platform,
    frequencyByPlatform,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [totalsAgg, prevAgg, daily] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, platform, date: { gte: thirtyDaysAgo } },
      _sum: { cost: true, verifiedConversions: true, rawConversions: true, clicks: true, impressions: true },
    }),
    // الفترة السابقة مباشرةً - بدونها كل رقم لقطة بلا اتجاه
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, platform, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    }),
    prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id, platform, date: { gte: fourteenDaysAgo } },
      select: { date: true, rawConversions: true, verifiedConversions: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const cost = totalsAgg._sum.cost ?? 0;
  const verified = totalsAgg._sum.verifiedConversions ?? 0;
  const rawConv = totalsAgg._sum.rawConversions ?? 0;
  const clicks = totalsAgg._sum.clicks ?? 0;
  const impressions = totalsAgg._sum.impressions ?? 0;
  const cpa = costPerVerified(cost, verified);

  const prevVerified = prevAgg._sum.verifiedConversions ?? 0;
  const prevCpa = prevVerified > 0 ? (prevAgg._sum.cost ?? 0) / prevVerified : 0;
  const cpaChange = cpa !== null && prevCpa > 0 ? compareMetric(cpa, prevCpa) : null;

  // درجة صحة المنصّة: نفس عدّاد صحة الحساب بنفس العتبات، محسوباً على هذه
  // المنصّة وحدها. المكوّن الوحيد المتاح هنا هو دقّة التتبّع - تُمرَّر
  // البقيّة `null` فتُعاد الترجيح عليها وحدها بدل اختلاق رقم.
  const platformAccuracy = rawConv > 0 ? Math.round((verified / rawConv) * 100) : 0;
  const platformHealth = computeHealthScore({
    tracking: rawConv > 0 ? platformAccuracy : null,
    landing: null, ads: null, audience: null, creatives: null,
  });

  const trendData = Array.from(
    daily
      .reduce((m: Map<string, { verified: number; reported: number }>, s) => {
        const k = s.date.toISOString().slice(5, 10);
        const e = m.get(k) ?? { verified: 0, reported: 0 };
        e.verified += s.verifiedConversions;
        e.reported += s.rawConversions;
        m.set(k, e);
        return m;
      }, new Map())
      .entries()
  ).map(([date, x]) => ({ date, ...x }));


  return (
    <div className="mx-auto max-w-6xl">
      {/* ---------- الرأس: هويّة المنصّة + درجة صحّتها ---------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
          <h1 className="flex items-center gap-2.5 text-[26px] font-semibold tracking-tight text-text-primary">
            <PlatformLogo platform={platform} size={26} />
            {platformLabel}
          </h1>
          <p className="mt-1 text-[12.5px] text-text-muted">
            {t(locale, "campPages.hubSubtitle", { platform: platformLabel })}
          </p>
        </div>

        {/* نفس عدّاد صحة الحساب - عنصر هوية واحد لكل درجة في المنتج */}
        <div className="flex shrink-0 items-center gap-3 card px-4 py-3">
          <HealthGauge score={platformHealth.overallScore} size="md" />
          <div className="leading-tight">
            <div className="text-[13px] font-medium text-text-primary">
              {t(locale, "campPages.hubHealth", { platform: platformLabel })}
            </div>
            <div className="text-[11.5px] text-text-muted">{t(locale, "home.healthPartial")}</div>
          </div>
        </div>
      </div>

      {/* ---------- ١) المؤشّرات ---------- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={t(locale, "campPages.hubSpend")}
          explainKey="cost"
          locale={locale}
          value={Math.round(cost).toLocaleString("en-US")}
          unit={workspace.currency}
          icon={Icons.Wallet}
          tone="accent"
        />
        <MetricCard
          label={t(locale, "campPages.hubVerified")}
          explainKey="verifiedConversions"
          locale={locale}
          value={verified.toLocaleString("en-US")}
          icon={Icons.ShieldCheck}
          tone="verified"
          verified
        />
        <MetricCard
          label={t(locale, "campPages.hubCpa")}
          explainKey="cpaVerified"
          locale={locale}
          value={cpa ? Math.round(cpa).toLocaleString("en-US") : "—"}
          unit={cpa ? workspace.currency : undefined}
          icon={Icons.Target}
          tone="default"
          verified={!!cpa}
          trend={
            cpaChange?.changePct != null ? (
              <span className={`text-xs ${cpaChange.changePct < 0 ? "text-verified" : "text-critical"}`}>
                {cpaChange.changePct < 0 ? "▼" : "▲"} {Math.abs(cpaChange.changePct)}% {t(locale, "home.vsPrevPeriod")}
              </span>
            ) : undefined
          }
          caption={cpa ? undefined : { text: t(locale, "campPages.hubNoCpa"), tone: "muted" }}
        />
      </div>

      {/* ---------- ٢) أفضل إعلان وثانيه ---------- */}
      <div className="mb-4">
        <BestAdPair pick={topPick} currency={workspace.currency} scopeLabel={platformLabel} locale={locale} />
      </div>

      {/* ---------- ٣) القمع + ٤) الاتجاه، جنباً إلى جنب ----------
          القمع يقول «أين يتسرّب العميل»، والاتجاه يقول «هل يتّسع التسرّب
          أم يضيق» - سؤالان متتاليان يُقرآن معاً لا في موضعين متباعدين. */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <PerformanceFunnel
          impressions={impressions}
          clicks={clicks}
          reported={rawConv}
          verified={verified}
          locale={locale}
        />

        {trendData.length > 1 ? (
          <section className="card pad-md">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-text-muted">{t(locale, "home.trend14")}</span>
              <span className="flex items-center gap-4 text-[12px]">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span className="h-2 w-2 rounded-full bg-gap" />
                  {t(locale, "home.reportedByPlatforms")}
                </span>
                <span className="flex items-center gap-1.5 text-verified">
                  <span className="h-2 w-2 rounded-full bg-verified" />
                  {t(locale, "home.actuallyVerified")}
                </span>
              </span>
            </div>
            <TrendChart
              data={trendData}
              labels={{
                verified: t(locale, "home.actuallyVerified"),
                reported: t(locale, "home.reportedByPlatforms"),
              }}
            />
          </section>
        ) : (
          <section className="card-shadow flex items-center justify-center card pad-md text-[12.5px] text-text-muted">
            {t(locale, "campPages.hubNoTrend")}
          </section>
        )}
      </div>

      {/* ---------- ٥) القرار لكل إعلان ---------- */}
      <div className="mb-4">
        <div className="mb-2.5 section-title">
          {t(locale, "campPages.hubDecisions", { platform: platformLabel })}
        </div>
        <AdDecisionTable
          locale={locale}
          decisions={adDecisions}
          workspaceId={workspace.id}
          currency={workspace.currency}
          showPlatform={false}
        />
      </div>

      {/* ---------- ٦) التحليلات التفصيلية ---------- */}
      <div className="mb-2.5 section-title">
        {t(locale, "campPages.hubDeepDives", { platform: platformLabel })}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {deepDiveLinks.map((link) => {
          const Icon = iconForLink(link.href);
          return (
            <a
              key={link.href}
              href={link.href}
              className="card-shadow flex items-center gap-2.5 card px-3.5 py-3 text-[12.5px] text-text-primary no-underline"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in srgb, ${PLATFORM_COLORS[platform].bg} 13%, transparent)` }}
              >
                <Icon size={15} style={{ color: PLATFORM_COLORS[platform].bg }} />
              </span>
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
