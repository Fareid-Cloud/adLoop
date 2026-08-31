// app/report/[token]/page.tsx
//
// صفحة عامة (بدون تسجيل دخول) - العميل النهائي بيوصلها بالرابط بس، من
// غير ما يحتاج حساب على AdLoop. الحماية الوحيدة هي طول الـ token نفسه
// (cuid عشوائي طويل، صعب التخمين) - نفس مبدأ روابط المشاركة في Google Docs.

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Wallet, Users } from "lucide-react";
import { costPerVerified } from "@/lib/kpiEngine";
import { t, type Locale } from "@/lib/i18n/dictionary";

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // لغة صاحب التقرير هي لغة التقرير: هو من شاركه، ولا يملك المتلقّي
  // حساباً ولا تفضيلاً. الصفحة كانت عربية مثبّتة باتّجاه مثبّت.
  const link = await prisma.sharedReportLink.findUnique({
    where: { token },
    include: { workspace: { include: { user: { select: { preferredLocale: true } } } } },
  });

  if (!link || !link.active) notFound();
  if (link.expiresAt && link.expiresAt < new Date()) notFound();

  const workspace = link.workspace;
  const locale: Locale = (workspace.user?.preferredLocale as Locale) ?? "en";
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const totalsAgg = await prisma.metricSnapshot.aggregate({
    where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
    _sum: { clicks: true, cost: true, rawConversions: true, verifiedConversions: true },
  });

  const totals = {
    clicks: totalsAgg._sum.clicks ?? 0,
    cost: totalsAgg._sum.cost ?? 0,
    raw: totalsAgg._sum.rawConversions ?? 0,
    verified: totalsAgg._sum.verifiedConversions ?? 0,
  };
  const cplVerified = costPerVerified(totals.cost, totals.verified);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} data-accent="blue" data-mode="dark" className="min-h-screen bg-bg p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-1 text-[13px] text-text-muted">{t(locale, "publicReport.kicker")}</div>
        <h1 className="mb-6 page-title">{workspace.name}</h1>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <MetricCard
            label={t(locale, "publicReport.spend")}
            value={Math.round(totals.cost).toLocaleString("en-US")}
            unit={workspace.currency}
            icon={Wallet}
            tone="accent"
            explainKey="cost"
            locale={locale}
            />
          <MetricCard
            label={t(locale, "publicReport.cpaVerified")}
            value={cplVerified ?? "—"}
            icon={Users}
            tone="verified"
            verified
            explainKey="cpaVerified"
            locale={locale}
            />
        </div>

        <div className="card pad-md">
          <div className="mb-2 text-xs text-text-muted">{t(locale, "publicReport.compareTitle")}</div>
          <div className="font-mono text-sm">
            <span className="text-verified">{totals.verified} {t(locale, "publicReport.verifiedWord")}</span>
            {" / "}
            <span className="text-gap">{totals.raw} {t(locale, "publicReport.reportedWord")}</span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-text-faint">{t(locale, "publicReport.madeBy")}</p>
      </div>
    </div>
  );
}
