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
        <h1 className="mb-6 flex items-center gap-2.5 text-[26px] font-semibold text-text-primary">
          <PlatformLogo platform={platform} size={24} />
          {platformLabel}
        </h1>
        <ConnectSinglePlatform state={state} />
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
  const totalsAgg = await prisma.metricSnapshot.aggregate({
    where: { workspaceId: workspace.id, platform, date: { gte: thirtyDaysAgo } },
    _sum: { cost: true, verifiedConversions: true, rawConversions: true },
  });

  const cost = totalsAgg._sum.cost ?? 0;
  const verified = totalsAgg._sum.verifiedConversions ?? 0;
  const cpa = verified > 0 ? cost / verified : null;


  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 flex items-center gap-2.5 text-[26px] font-semibold text-text-primary">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform].bg }} />
        {platformLabel}
      </h1>
      <p className="mb-6 text-xs text-text-faint">
        مقارنة الإعلانات داخل {platformLabel} فقط — لمقارنة باقي المنصات معاً، استخدم
        "أداء الإعلانات الفردية" في قسم "نظرة شاملة عبر المنصات".
      </p>

      {/* بطاقات المؤشّر الموحّدة - نفس الشكل الهادئ في كل أقسام المنتج */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="الإنفاق (٣٠ يوماً)"
          value={Math.round(cost).toLocaleString("en-US")}
          unit={workspace.currency}
          icon={Icons.Wallet}
          tone="accent"
        />
        <MetricCard
          label="تحويلات متحقّق منها"
          value={verified.toLocaleString("en-US")}
          icon={Icons.ShieldCheck}
          tone="verified"
          verified
        />
        <MetricCard
          label="تكلفة العميل الحقيقية"
          value={cpa ? Math.round(cpa).toLocaleString("en-US") : "—"}
          unit={cpa ? workspace.currency : undefined}
          icon={Icons.Target}
          tone="default"
          caption={
            cpa
              ? undefined
              : { text: "لا توجد تحويلات متحقّق منها بعد لحساب التكلفة الحقيقية.", tone: "muted" }
          }
        />
      </div>

      <div className="mb-6">
        <BestAdPair pick={topPick} currency={workspace.currency} scopeLabel={platformLabel} />
      </div>

      <div className="mb-2 text-[13px] font-medium text-text-muted">
        القرار لكل إعلان داخل {platformLabel}
      </div>
      <div className="mb-6">
        <AdDecisionTable
          decisions={adDecisions}
          workspaceId={workspace.id}
          currency={workspace.currency}
          showPlatform={false}
        />
      </div>

      <div className="mb-2.5 text-[13px] text-text-muted">تحليلات {platformLabel} التفصيلية</div>
      {/* أيقونة معبّرة لكل تحليل بدل سهم مكرّر لا يضيف معنى */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {deepDiveLinks.map((link) => {
          const Icon = iconForLink(link.href);
          return (
            <a
              key={link.href}
              href={link.href}
              className="card-shadow flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-[12.5px] text-text-primary no-underline"
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
