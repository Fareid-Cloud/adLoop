// app/dashboard/campaigns/tiktok-spark-ads/page.tsx
//
// "Spark Ads فعلاً بتجيب نتيجة أحسن، ولا مجرد كلام تسويقي؟" - مصادر
// الصناعة نفسها مختلفة (37% مقابل 48% تحسّن حسب المصدر)، فبدل ما نصدّق
// رقم عام، بنقارن بيانات حسابك الحقيقية: Spark ضد الإعلان العادي (Dark
// Post) بنفس المقاييس اللي عندنا أصلاً (خطّاف، إكمال) - مش رقم مستورد.

import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/app/components/ui/EmptyState";

function classify(identityType: string | null): "SPARK" | "DARK_POST" | "UNKNOWN" {
  if (identityType === "AUTH_CODE" || identityType === "TT_USER") return "SPARK";
  if (identityType === "CUSTOMIZED_USER") return "DARK_POST";
  return "UNKNOWN";
}

export default async function TikTokSparkAdsPage() {
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
  });

  const groups = { SPARK: [] as typeof videos, DARK_POST: [] as typeof videos };
  for (const v of videos) {
    const category = classify(v.identityType);
    if (category === "SPARK") groups.SPARK.push(v);
    else if (category === "DARK_POST") groups.DARK_POST.push(v);
  }

  function avg(arr: typeof videos, field: "hookRate" | "engagedViewRate" | "completionRate") {
    if (arr.length === 0) return null;
    return arr.reduce((s: number, v: (typeof arr)[number]) => s + (v[field] as number), 0) / arr.length;
  }

  const hasComparison = groups.SPARK.length > 0 && groups.DARK_POST.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 text-[13px] text-text-muted">{workspace.name}</div>
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">Spark Ads مقابل الإعلان العادي</h1>
      <p className="mb-6 text-xs text-text-faint">
        مصادر الصناعة مختلفة على رقم التحسّن (37% إلى 48% حسب المصدر) - بدل ما نصدّق رقماً عاماً،
        دي مقارنة حقيقية من بيانات حسابك أنت بالذات، بنفس مقاييس الخطّاف والإكمال المعتادة.
        عدد التعليقات ونسبة السبام (بقواعد ثابتة، بدون ذكاء اصطناعي) جزء من الصورة لـSpark Ads تحديداً -
        التفاعل العضوي هنا جزء من المنتج نفسه، مش موضوع سمعة منفصل.
      </p>

      {!hasComparison ? (
        <EmptyState
          title="لا توجد بيانات كافية للمقارنة بعد"
          description="محتاجة إعلانات من النوعين (Spark وعادي) بظهور كافٍ لكل منهما."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(["SPARK", "DARK_POST"] as const).map((type) => (
            <div key={type} className="rounded-2xl bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {type === "SPARK" ? "Spark Ads" : "إعلان عادي (Dark Post)"}
                </span>
                <span className="text-xs text-text-faint">{groups[type].length} إعلان</span>
              </div>
              <div className="flex gap-4 text-xs text-text-faint">
                <span>خطّاف: {Math.round((avg(groups[type], "hookRate") ?? 0) * 1000) / 10}%</span>
                <span>متفاعل: {Math.round((avg(groups[type], "engagedViewRate") ?? 0) * 1000) / 10}%</span>
                <span>إكمال: {Math.round((avg(groups[type], "completionRate") ?? 0) * 1000) / 10}%</span>
                {type === "SPARK" && (
                  <span>
                    تعليقات: {groups.SPARK.reduce((s: number, v: any) => s + v.totalComments, 0)}
                    {" "}(سبام: {groups.SPARK.reduce((s: number, v: any) => s + v.flaggedComments, 0)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
