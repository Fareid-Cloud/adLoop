// app/dashboard/campaigns/creatives/page.tsx
//
// "أنهي إعلان بالذات بيجيب النتيجة؟" - أول سؤال طلع من تحليل الفجوات
// (docs/user-questions-gap-analysis.md، سؤال 20) ومكانش له إجابة قبل كده.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { computeCreativePerformance, rankCreatives, classifyScaleKillWatch, CreativePerformance, getWorkspaceCreativePerformances } from "@/lib/creativeAnalysis";
import { ImageQualityButton } from "./ImageQualityButton";
import { detectCreativeFatigue } from "@/lib/aiInsights";

export default async function CreativesPage() {
  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">الجلسة انتهت، برجاء تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!workspace) {
    return <EmptyState title="لسه معملتش مساحة عمل" description="ارجع لـ لمحة عشان تنشئ أول مساحة عمل." />;
  }

  const { performances, daysActiveByAdId, historicalCtrByAdId, fatiguedAdIds } =
    await getWorkspaceCreativePerformances(workspace.id);

  // إصلاح فجوة حقيقية: detectCreativeFatigue كانت مبنية ومعزولة تماماً -
  // إشارة تعب مكمّلة لـrankCreatives (اللي بتعتمد على نسبة النقر) -
  // هنا بتعتمد على تكلفة العميل الحقيقية، ممكن تلتقط تعب متأخر عن
  // النقر (الإعلان لسه بيتنقّط عليه، لكن العملاء اللي بييجوا بقوا أغلى)
  const thirtyDaysAgoForFatigue = new Date();
  thirtyDaysAgoForFatigue.setDate(thirtyDaysAgoForFatigue.getDate() - 30);
  const dailySnapshotsForFatigue = await prisma.creativeSnapshot.findMany({
    where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgoForFatigue } },
    select: { adId: true, date: true, cost: true, verifiedConversions: true },
  });
  const dailyCplByAdId = new Map<string, { date: string; value: number }[]>();
  for (const row of dailySnapshotsForFatigue) {
    if (!row.verifiedConversions || row.verifiedConversions === 0) continue; // مفيش CPL نقدر نحسبه من غير تحويلات
    const arr = dailyCplByAdId.get(row.adId) ?? [];
    arr.push({ date: row.date.toISOString().slice(0, 10), value: row.cost / row.verifiedConversions });
    dailyCplByAdId.set(row.adId, arr);
  }
  const cplFatiguedAdIds = new Set<string>();
  for (const [adId, series] of dailyCplByAdId.entries()) {
    if (detectCreativeFatigue(series).isFatigued) cplFatiguedAdIds.add(adId);
  }

  if (performances.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
        <h1 className="mb-6 text-[26px] font-semibold text-text-primary">أداء الإعلانات الفردية</h1>
        <EmptyState
          title="مفيش بيانات على مستوى الإعلان لسه"
          description="بتتحدث تلقائياً مع المزامنة اليومية بعد ربط الحملات."
        />
      </div>
    );
  }

  const ranking = rankCreatives(performances, historicalCtrByAdId);
  const decisions = classifyScaleKillWatch(performances, daysActiveByAdId, fatiguedAdIds, workspace.profitMarginPct);
  const actionableDecisions = decisions
    .filter((d) => d.decision === "SCALE" || d.decision === "KILL")
    .sort((a, b) => Math.abs(b.divergencePct) - Math.abs(a.divergencePct));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-6 text-[26px] font-semibold text-text-primary">أداء الإعلانات الفردية</h1>

      {actionableDecisions.length > 0 && (
        <>
          <SectionTitle>القرار — Scale ولا Kill؟</SectionTitle>
          <p className="mb-3 text-xs text-text-faint">
            مقارنة بمتوسط تكلفة العميل في حسابك أنت (مش معيار خارجي) - محتاجة عينة 5 تحويلات على الأقل.
          </p>
          <div className="mb-6 flex flex-col gap-2">
            {actionableDecisions.map((d) => (
              <div
                key={d.adId}
                className={`rounded-2xl p-4 ${d.decision === "SCALE" ? "bg-verified/10" : "bg-critical/10"}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{d.adName ?? d.adId}</span>
                  <span className={`text-xs font-semibold ${d.decision === "SCALE" ? "text-verified" : "text-critical"}`}>
                    {d.decision === "SCALE" ? "Scale ↑" : "Kill ✕"}
                  </span>
                </div>
                <p className="text-xs text-text-faint">{d.reason}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>الأفضل أداءً</SectionTitle>
      <CreativeGrid items={ranking.best} accentColor="verified" />

      <SectionTitle>الأضعف أداءً (بميزانية معتبرة)</SectionTitle>
      <CreativeGrid items={ranking.worst} accentColor="critical" />

      {ranking.fatigued.length > 0 && (
        <>
          <SectionTitle>إعلانات متعبة (أداء يتراجع إحصائياً)</SectionTitle>
          <CreativeGrid items={ranking.fatigued} accentColor="gap" />
        </>
      )}

      {cplFatiguedAdIds.size > 0 && (
        <>
          <SectionTitle>تكلفة العميل بتزيد (تعب متأخر - النقر لسه كويس، لكن العملاء بقوا أغلى)</SectionTitle>
          <CreativeGrid items={performances.filter((p) => cplFatiguedAdIds.has(p.adId))} accentColor="gap" />
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold text-text-primary">{children}</h2>;
}

function CreativeGrid({
  items,
  accentColor,
}: {
  items: CreativePerformance[];
  accentColor: "verified" | "critical" | "gap";
}) {
  if (items.length === 0) {
    return <p className="mb-4 text-xs text-text-faint">لا توجد بيانات كافية.</p>;
  }

  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.adId} className="rounded-2xl bg-surface p-3">
          {item.headline && (
            <p className="mb-2 line-clamp-2 text-xs text-text-primary">{item.headline}</p>
          )}
          <div className={`font-mono text-sm text-${accentColor}`}>{item.cpa || "—"}</div>
          <div className="text-[10px] text-text-faint">تكلفة التحويل {!item.usingVerifiedData && "(معلنة)"}</div>
          <div className="mt-1 text-[10px] text-text-faint">CTR: {item.ctr}%</div>
          {item.thumbnailUrl && (
            <ImageQualityButton imageUrl={item.thumbnailUrl} platform={item.platform} />
          )}
        </div>
      ))}
    </div>
  );
}
