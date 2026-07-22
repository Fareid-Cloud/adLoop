// app/dashboard/campaigns/seasonal-trend/page.tsx
//
// "الموسم الجاي هيأثر كيف على تكلفة الإعلان؟" - تنبؤ موسمي حقيقي محتاج
// بيانات تاريخية متعددة السنين مفيش عندنا. البديل الصادق: مقارنة تكلفة
// العميل الشهر الحالي بالشهر اللي فات - إشارة واقعية على اتجاه التكلفة،
// مش تنبؤ ذكي، لكن مبنية على بيانات فعلية بدل تخمين.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

export default async function SeasonalTrendPage() {
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

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const comparableEndLastMonth = new Date(startOfLastMonth);
  comparableEndLastMonth.setDate(now.getDate());

  const [thisMonth, lastMonthComparable] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId: workspace.id, date: { gte: startOfThisMonth, lte: now } },
      _sum: { cost: true, rawConversions: true },
    }),
    prisma.metricSnapshot.aggregate({
      where: {
        workspaceId: workspace.id,
        date: { gte: startOfLastMonth, lte: comparableEndLastMonth < endOfLastMonth ? comparableEndLastMonth : endOfLastMonth },
      },
      _sum: { cost: true, rawConversions: true },
    }),
  ]);

  const thisCpa = (thisMonth._sum.rawConversions ?? 0) > 0
    ? (thisMonth._sum.cost ?? 0) / (thisMonth._sum.rawConversions ?? 1)
    : null;
  const lastCpa = (lastMonthComparable._sum.rawConversions ?? 0) > 0
    ? (lastMonthComparable._sum.cost ?? 0) / (lastMonthComparable._sum.rawConversions ?? 1)
    : null;

  const hasComparison = thisCpa !== null && lastCpa !== null;
  const changePct = hasComparison ? Math.round(((thisCpa! - lastCpa!) / lastCpa!) * 100) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">اتجاه التكلفة الشهري</h1>
      <p className="mb-6 text-xs text-text-faint">
        ملاحظة صادقة: تنبؤ موسمي حقيقي محتاج بيانات تاريخية متعددة السنين معندناش.
        هذا مقارنة فعلية للشهر الحالي بالشهر اللي فات (نفس عدد الأيام) - إشارة واقعية على الاتجاه، مش تنبؤ.
      </p>

      {!hasComparison ? (
        <EmptyState
          title="لا توجد بيانات كافية للمقارنة بعد"
          description="محتاجة شهر واحد على الأقل من البيانات التاريخية."
        />
      ) : (
        <div className="rounded-2xl bg-surface p-5 text-center">
          <div className={`font-mono text-3xl ${changePct! > 0 ? "text-critical" : "text-verified"}`}>
            {changePct! > 0 ? "+" : ""}{changePct}%
          </div>
          <div className="mt-1 text-sm text-text-muted">
            تكلفة العميل {changePct! > 0 ? "أعلى" : "أقل"} من نفس الفترة الشهر اللي فات
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-text-faint">
            <div>الشهر الحالي: {Math.round(thisCpa!).toLocaleString()}</div>
            <div>الشهر اللي فات: {Math.round(lastCpa!).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
