// lib/conversionGapAlert.ts
//
// "فيه مكافئ لمشكلة جوجل/ليد كواليتي ميتا في تيك توك؟" - بحثنا ولقينا
// حاجة حقيقية موثّقة **أخطر من الاتنين**: معدل ترافيك مزيّف على تيك توك
// بيوصل 13-25% (مصدرين مستقلين) - تقريباً ضعف جوجل وميتا. المشكلة
// الأخطر: **مبتبانش في لوحة تحكم تيك توك نفسها خالص** - البوتات
// مصممة تتفادى الكشف.
//
// اكتشاف أثناء البناء: نظام "الفجوة" (raw مقابل verified) كان موجود
// كبيانات لكل المنصات بما فيهم تيك توك أصلاً، لكن **مفيش تنبيه استباقي
// ليه لأي منصة خالص** - عرض بس في صفحة التقارير. هنا أول تنبيه فعلي،
// منصة-عامة من الأساس، لكن بعتبة مختلفة لتيك توك عمداً.

import { prisma } from "@/lib/prisma";
import { pushToActionFeed } from "@/lib/actionFeed";
import { platformLabel, t } from "@/lib/i18n/dictionary";

const GAP_THRESHOLD_PCT: Record<string, number> = {
  GOOGLE_ADS: 30,
  META_ADS: 30,
  TIKTOK_ADS: 40,
};

const MIN_RAW_CONVERSIONS_FOR_CONFIDENCE = 10;
const COOLDOWN_DAYS = 7;

export async function checkConversionGapAlertForWorkspace(workspaceId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const byPlatform = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId, date: { gte: thirtyDaysAgo } },
    _sum: { rawConversions: true, verifiedConversions: true, cost: true },
  });

  for (const p of byPlatform) {
    const raw = p._sum.rawConversions ?? 0;
    const verified = p._sum.verifiedConversions ?? 0;
    if (raw < MIN_RAW_CONVERSIONS_FOR_CONFIDENCE) continue;

    const gapPct = Math.round(((raw - verified) / raw) * 100);
    const threshold = GAP_THRESHOLD_PCT[p.platform] ?? 30;
    if (gapPct < threshold) continue;

    const cooldownStart = new Date();
    cooldownStart.setDate(cooldownStart.getDate() - COOLDOWN_DAYS);
    const recentSimilar = await prisma.actionFeedItem.findFirst({
      // الفحص بالمفتاح والمنصّة في المتغيّرات، لا بنصّ العنوان: النصّ
      // يتغيّر مع اللغة فينكسر منع التكرار بصمت.
      where: {
        workspaceId,
        titleKey: "alerts.convGapTitle",
        titleVars: { path: ["platformKey"], equals: p.platform },
        createdAt: { gte: cooldownStart },
      },
    });
    if (recentSimilar) continue;

    const isTiktok = p.platform === "TIKTOK_ADS";
    // اسم المنصّة يُبنى وقت العرض من `platformKey`، فيظهر بلغة القارئ.
    const titleVars = { platform: platformLabel("ar", p.platform), platformKey: p.platform };
    const descVars = {
      raw,
      verified,
      gapPct,
      note: isTiktok ? t("ar", "alerts.convGapTiktokNote") : "",
    };

    await pushToActionFeed({
      workspaceId,
      source: "TRUTH_GAP",
      type: "ALERT",
      severity: "HIGH",
      // اسم المنصّة لا قيمة تعدادها: كان العنوان يظهر للمستخدم
      // كـ«تحويلات GOOGLE_ADS المُبلّغة»
      title: t("ar", "alerts.convGapTitle", titleVars),
      titleKey: "alerts.convGapTitle",
      titleVars,
      description: t("ar", "alerts.convGapBody", descVars),
      descKey: "alerts.convGapBody",
      descVars,
      linkUrl: "/dashboard/reports",
      // حصّة التحويلات غير المؤكَّدة من الإنفاق الفعلي - لا تقدير عام
      estimatedImpact: Math.round((p._sum.cost ?? 0) * ((raw - verified) / raw)),
    });
  }
}
