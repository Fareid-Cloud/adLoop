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
    _sum: { rawConversions: true, verifiedConversions: true },
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
      where: { workspaceId, title: { contains: "فجوة كبيرة بين" }, description: { contains: p.platform }, createdAt: { gte: cooldownStart } },
    });
    if (recentSimilar) continue;

    const platformNote = p.platform === "TIKTOK_ADS"
      ? " تيك توك معروف عندها معدل ترافيك مزيّف أعلى من المنصات التانية بطبيعتها (بحث موثّق: 13-25%)، فالعتبة هنا أعلى عمداً - يعني الرقم ده فعلاً يستاهل انتباه، مش تحذير عادي."
      : "";

    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: "HIGH",
      title: `فجوة كبيرة بين تحويلات ${p.platform} المُبلّغة والمؤكدة`,
      description: `المنصة بتقول ${raw} تحويل، لكن اتأكد منهم فعلياً ${verified} بس (فجوة ${gapPct}%).${platformNote} القرارات المبنية على الرقم المُبلّغ وحده ممكن تكون مضلِّلة.`,
      linkUrl: "/dashboard/reports",
    });
  }
}
