// app/dashboard/campaigns/tiktok-hook-rate/page.tsx
//
// "معدل الخطّاف" - أهم مؤشر جودة فيديو خاص بتيك توك، مفيش له مكافئ في
// أي منصة تانية. فيديو مايخطفش الانتباه في ثانيتين، مهما كان جميل، هيضيع فلوسه.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

function pctColor(rate: number, good: number, bad: number): string {
  if (rate >= good) return "text-verified";
  if (rate <= bad) return "text-critical";
  return "text-gap";
}

export default async function TikTokHookRatePage() {
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

  const videos = await prisma.tikTokVideoMetricSnapshot.findMany({
    where: { workspaceId: workspace.id, impressions: { gt: 100 } },
    orderBy: { hookRate: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">معدل الخطّاف والإكمال</h1>
      <p className="mb-6 text-xs text-text-faint">
        نسبة الأشخاص اللي كملوا مشاهدة ثانيتين (خطّاف قوي)، 6 ثواني (مشاهدة متفاعلة فعلياً - تيك توك
        نفسها بتحتسبها كتحويل مُسند حتى من غير كليك)، ونسبة الإكمال الكامل. معيار: خطّاف قوي فوق 30%.
      </p>

      {videos.length === 0 ? (
        <EmptyState
          title="لا توجد بيانات فيديو كافية بعد"
          description="تحتاج ظهوراً كافياً (100+) لكل إعلان لتصبح النسب موثوقة."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {videos.map((v: any) => (
            <div key={v.adId} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{v.adName ?? v.adId}</span>
                <span className={`font-mono text-lg ${pctColor(v.hookRate, 0.3, 0.15)}`}>
                  {Math.round(v.hookRate * 1000) / 10}%
                </span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>خطّاف: {Math.round(v.hookRate * 1000) / 10}%</span>
                <span>متفاعل (6ث): {Math.round(v.engagedViewRate * 1000) / 10}%</span>
                <span>إكمال كامل: {Math.round(v.completionRate * 1000) / 10}%</span>
                <span>{v.impressions.toLocaleString()} ظهور</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
