// app/dashboard/campaigns/budget-simulator/page.tsx
//
// "محاكاة نقل ميزانية من منصة تانية لتيك توك؟" - بنستخدم تكلفة العميل
// الحقيقية الفعلية لكل منصة (مش المُعلنة)، ونحاكي: لو نقلت مبلغ معين،
// كام عميل حقيقي إضافي/أقل متوقّع تحصل عليه.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "جوجل",
  META_ADS: "ميتا",
  TIKTOK_ADS: "تيك توك",
};

export default async function BudgetSimulatorPage() {
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const byPlatform = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId: workspace.id, date: { gte: thirtyDaysAgo } },
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
    // type predicate صريح - عشان TypeScript يتتبّع فعلياً إن الفلتر ده
    // بيشيل القيم null، مش بس وقت التشغيل. من غيره، النوع المُستنتج
    // بيفضل `number | null` حتى بعد الفلترة، وده اللي كان بيسبب خطأ
    // البناء (قسمة على قيمة ممكن تكون null نظرياً حسب الأنواع)
    .filter((p: PlatformCpa): p is PlatformCpa & { cpa: number } => p.cpa !== null)
    .sort((a: PlatformCpa & { cpa: number }, b: PlatformCpa & { cpa: number }) => a.cpa - b.cpa);

  const SIMULATION_AMOUNT = 1000;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">محاكاة نقل الميزانية</h1>
      <p className="mb-6 text-xs text-text-faint">
        بناءً على تكلفة العميل الحقيقية الفعلية لكل منصة آخر 30 يوم - مش المُعلنة. المحاكاة تفترض
        استمرار نفس الأداء الحالي، وهذا افتراض قد لا يصمد عند زيادة الميزانية بشكل كبير جداً.
      </p>

      {platforms.length < 2 ? (
        <EmptyState
          title="محتاجة منصتين على الأقل ببيانات تحويل حقيقية"
          description="اربط أكتر من منصة وسيب البيانات تتراكم عشان المحاكاة تبقى ممكنة."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">تكلفة العميل الحقيقية الحالية</div>
            {platforms.map((p: any) => (
              <div key={p.platform} className="flex items-center justify-between py-1 text-xs text-text-faint">
                <span>{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
                <span className="font-mono text-verified">{Math.round(p.cpa)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-gap/10 p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              لو نقلت {SIMULATION_AMOUNT.toLocaleString()} من الأغلى للأرخص
            </div>
            {(() => {
              const cheapest = platforms[0];
              const mostExpensive = platforms[platforms.length - 1];
              if (cheapest.platform === mostExpensive.platform) return null;

              const lostCustomers = SIMULATION_AMOUNT / mostExpensive.cpa;
              const gainedCustomers = SIMULATION_AMOUNT / cheapest.cpa;
              const netDiff = Math.round((gainedCustomers - lostCustomers) * 10) / 10;

              return (
                <p className="text-xs text-text-muted">
                  نقل {SIMULATION_AMOUNT.toLocaleString()} من {PLATFORM_LABELS[mostExpensive.platform]} لـ{PLATFORM_LABELS[cheapest.platform]}:
                  متوقّع تخسر ~{Math.round(lostCustomers * 10) / 10} عميل من {PLATFORM_LABELS[mostExpensive.platform]}،
                  وتكسب ~{Math.round(gainedCustomers * 10) / 10} عميل من {PLATFORM_LABELS[cheapest.platform]} -
                  فرق صافي {netDiff > 0 ? "+" : ""}{netDiff} عميل.
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
