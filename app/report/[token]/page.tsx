// app/report/[token]/page.tsx
//
// صفحة عامة (بدون تسجيل دخول) - العميل النهائي بيوصلها بالرابط بس، من
// غير ما يحتاج حساب على AdLoop. الحماية الوحيدة هي طول الـ token نفسه
// (cuid عشوائي طويل، صعب التخمين) - نفس مبدأ روابط المشاركة في Google Docs.

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.sharedReportLink.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!link || !link.active) notFound();
  if (link.expiresAt && link.expiresAt < new Date()) notFound();

  const workspace = link.workspace;
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
  const cplVerified = totals.verified > 0 ? Math.round((totals.cost / totals.verified) * 100) / 100 : 0;

  return (
    <div dir="rtl" data-accent="blue" data-mode="dark" className="min-h-screen bg-bg p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-1 text-[13px] text-text-muted">تقرير أداء</div>
        <h1 className="mb-6 text-[26px] font-semibold text-text-primary">{workspace.name}</h1>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-5">
            <div className="mb-2 text-xs text-text-muted">إجمالي الإنفاق (30 يوم)</div>
            <div className="font-mono text-2xl text-text-primary">
              {totals.cost.toLocaleString()} {workspace.currency}
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-5">
            <div className="mb-2 text-xs text-text-muted">تكلفة العميل الحقيقية</div>
            <div className="font-mono text-2xl text-verified">{cplVerified}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-5">
          <div className="mb-2 text-xs text-text-muted">المحادثات الموثّقة مقابل المعلنة</div>
          <div className="font-mono text-sm">
            <span className="text-verified">{totals.verified} متحقق</span>
            {" / "}
            <span className="text-gap">{totals.raw} معلن</span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-text-faint">تم إنشاء هذا التقرير بواسطة AdLoop</p>
      </div>
    </div>
  );
}
