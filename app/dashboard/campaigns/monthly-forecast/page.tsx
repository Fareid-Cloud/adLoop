// app/dashboard/campaigns/monthly-forecast/page.tsx
//
// "هوصل لهدفي الشهري بناءً على الأداء الحالي؟" - حساب بسيط: معدل الصرف
// اليومي الفعلي (كل المنصات مع بعض) × الأيام المتبقية في الشهر، مقارنة
// بالهدف المضبوط في الإعدادات. صفر اعتماد على API خارجي.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

export default async function MonthlyForecastPage() {
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

  if (!workspace.monthlyBudgetTarget) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-[26px] font-semibold text-text-primary">التوقّع الشهري</h1>
        <EmptyState
          title="لم تُحدَّد ميزانية شهرية بعد"
          description="اضبط الهدف الشهري من الإعدادات عشان نقدر نتوقّع مسارك الحالي."
        />
      </div>
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = endOfMonth.getDate();
  const daysRemaining = totalDaysInMonth - dayOfMonth;

  const rows = await prisma.metricSnapshot.aggregate({
    where: { workspaceId: workspace.id, date: { gte: startOfMonth, lte: now } },
    _sum: { cost: true },
  });

  const spentSoFar = rows._sum.cost ?? 0;
  const dailyAverage = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;
  const projectedTotal = spentSoFar + dailyAverage * daysRemaining;
  const target = workspace.monthlyBudgetTarget;
  const projectedPct = target > 0 ? Math.round((projectedTotal / target) * 100) : 0;

  const status: "ON_TRACK" | "OVER" | "UNDER" =
    projectedPct > 110 ? "OVER" : projectedPct < 80 ? "UNDER" : "ON_TRACK";

  const statusConfig = {
    ON_TRACK: { color: "text-verified", label: "على المسار الصحيح" },
    OVER: { color: "text-critical", label: "متوقّع تتجاوز الهدف" },
    UNDER: { color: "text-gap", label: "متوقّع تصرف أقل من الهدف" },
  }[status];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">التوقّع الشهري</h1>
      <p className="mb-6 text-xs text-text-faint">
        بناءً على معدل صرفك الفعلي حتى الآن هذا الشهر - مش تنبؤ ذكي، حساب مباشر لاستمرار نفس الوتيرة.
      </p>

      <div className="mb-4 rounded-2xl bg-surface p-5 text-center">
        <div className={`font-mono text-3xl ${statusConfig.color}`}>{projectedPct}%</div>
        <div className={`mt-1 text-sm ${statusConfig.color}`}>{statusConfig.label}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-xs text-text-faint">مصروف حتى الآن</div>
          <div className="font-mono text-lg text-text-primary">{spentSoFar.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-xs text-text-faint">متوقّع نهاية الشهر</div>
          <div className="font-mono text-lg text-text-primary">{Math.round(projectedTotal).toLocaleString()}</div>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-xs text-text-faint">الهدف الشهري</div>
          <div className="font-mono text-lg text-text-primary">{target.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-xs text-text-faint">أيام متبقية</div>
          <div className="font-mono text-lg text-text-primary">{daysRemaining}</div>
        </div>
      </div>
    </div>
  );
}
