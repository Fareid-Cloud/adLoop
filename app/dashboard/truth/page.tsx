// app/dashboard/truth/page.tsx
//
// قسم الحقيقة: الفجوة بين ما تعلنه كل منصة وما تحقّق فعلاً - جوهر المنتج
// في صفحة واحدة. كانت هذه المقارنة موزّعة على صفحات متفرقة، فلم يرَ
// المستخدم الصورة الكاملة في أي مكان.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TruthView, type PlatformTruth } from "./TruthView";

export const dynamic = "force-dynamic";

const PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const;

export default async function TruthPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  if (!user) {
    return <div className="py-20 text-center text-text-muted">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) {
    return <EmptyState title="لا توجد مساحة عمل بعد" description="ارجع إلى «لمحة» لإنشاء أول مساحة عمل." />;
  }

  const since = new Date(); since.setDate(since.getDate() - days);
  const prevSince = new Date(); prevSince.setDate(prevSince.getDate() - days * 2);

  const [current, previous] = await Promise.all([
    prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id, date: { gte: since } },
      select: {
        date: true, platform: true, cost: true, clicks: true, impressions: true,
        rawConversions: true, verifiedConversions: true, revenue: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id, date: { gte: prevSince, lt: since } },
      select: { platform: true, cost: true, rawConversions: true, verifiedConversions: true },
    }),
  ]);

  function summarize(rows: any[]) {
    return rows.reduce(
      (a, r) => ({
        cost: a.cost + (r.cost ?? 0),
        clicks: a.clicks + (r.clicks ?? 0),
        impressions: a.impressions + (r.impressions ?? 0),
        raw: a.raw + (r.rawConversions ?? 0),
        verified: a.verified + (r.verifiedConversions ?? 0),
        revenue: a.revenue + (r.revenue ?? 0),
      }),
      { cost: 0, clicks: 0, impressions: 0, raw: 0, verified: 0, revenue: 0 }
    );
  }

  const platforms: PlatformTruth[] = PLATFORMS.map((p) => {
    const rows = current.filter((r) => r.platform === p);
    const prevRows = previous.filter((r) => r.platform === p);
    const t = summarize(rows);
    const pt = summarize(prevRows);

    const verificationRate = t.raw > 0 ? (t.verified / t.raw) * 100 : 0;
    const prevVerification = pt.raw > 0 ? (pt.verified / pt.raw) * 100 : 0;

    // سلسلة يومية لفجوة المُعلن مقابل المحقّق
    const byDay = new Map<string, { raw: number; verified: number }>();
    for (const r of rows) {
      const k = r.date.toISOString().slice(0, 10);
      const cur = byDay.get(k) ?? { raw: 0, verified: 0 };
      cur.raw += r.rawConversions;
      cur.verified += r.verifiedConversions;
      byDay.set(k, cur);
    }
    const dayKeys = [...byDay.keys()].sort();

    return {
      platform: p,
      hasData: rows.length > 0,
      cost: Math.round(t.cost),
      clicks: t.clicks,
      impressions: t.impressions,
      reported: t.raw,
      verified: t.verified,
      revenue: Math.round(t.revenue),
      verificationRate: Math.round(verificationRate * 10) / 10,
      verificationChange: prevVerification > 0
        ? Math.round((verificationRate - prevVerification) * 10) / 10
        : null,
      inflationRate: t.raw > 0 ? Math.round(((t.raw - t.verified) / t.raw) * 1000) / 10 : 0,
      cplReported: t.raw > 0 ? Math.round((t.cost / t.raw) * 100) / 100 : null,
      cplVerified: t.verified > 0 ? Math.round((t.cost / t.verified) * 100) / 100 : null,
      wastedSpend: t.raw > 0 ? Math.round(t.cost * (1 - t.verified / t.raw)) : 0,
      reportedSeries: dayKeys.map((k) => byDay.get(k)!.raw),
      verifiedSeries: dayKeys.map((k) => byDay.get(k)!.verified),
    };
  });

  return (
    <TruthView
      workspaceName={workspace.name}
      currency={workspace.currency}
      days={days}
      platforms={platforms}
    />
  );
}
