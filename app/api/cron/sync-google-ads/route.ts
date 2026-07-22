// app/api/cron/sync-google-ads/route.ts
//
// ده الـ endpoint اللي Vercel Cron بينده عليه يومياً (شوف vercel.json).
// الدالة syncGoogleAdsForWorkspace كانت مكتوبة من الأول لكن مفيش حاجة
// فعلياً بتشغّلها - ده الربط الناقص.
//
// أمان: محمي بـ CRON_SECRET عشان محدش تاني يقدر يستدعي الـ endpoint ده
// ويشغّل مزامنة يدوياً بره الجدول (ده ممكن يستهلك quota الـ API بتاع
// Google Ads من غير داعي، أو حتى يسبب استدعاءات مكررة لو اتنادى بسرعة).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncGoogleAdsForWorkspace, syncCreativesForWorkspace, syncSearchTermsForWorkspace, syncBiddingStrategyForWorkspace, syncAudiencePerformanceForWorkspace, syncQualityScoreForWorkspace, syncShoppingProductsForWorkspace, syncPerformanceMaxChannelsForWorkspace, syncYoutubeMetricsForWorkspace, syncDeviceAndGeoPerformanceForWorkspace, syncMatchTypePerformanceForWorkspace, syncDisplayPlacementsForWorkspace, checkShoppingSpendAlertsForWorkspace, syncGoogleLeadFormsForWorkspace } from "@/lib/syncGoogleAds";
import { checkBidStrategyAlertsForWorkspace, checkGoogleLearningPhaseAlertsForWorkspace } from "@/lib/bidStrategyAudit";
import { checkBidStrategyProgressionForWorkspace } from "@/lib/bidStrategyProgression";
import { checkConversionGapAlertForWorkspace } from "@/lib/conversionGapAlert";
import { checkTrafficQualityForWorkspace } from "@/lib/trafficQualityCheck";
import { assessAndVerifyMessengerConversationsForWorkspace } from "@/lib/messengerLeadQuality";
import { syncMetaAdsForWorkspace, syncMetaAdSetsForWorkspace, syncMetaCreativesForWorkspace, syncMetaAccountHealthForWorkspace, syncCatalogCampaignsForWorkspace, checkMetaLearningPhaseAlertsForWorkspace, checkCatalogSpendAlertsForWorkspace, checkMetaBidStrategyProgressionForWorkspace } from "@/lib/syncMetaAds";
import { checkMonthlyForecastAlertForWorkspace } from "@/lib/monthlyForecastAlert";
import { checkContentFormatSuggestionForWorkspace } from "@/lib/contentFormatSuggestion";
import { checkCostTrendAlertForWorkspace } from "@/lib/costTrendAlert";
import { checkAttributionPathAlertForWorkspace } from "@/lib/attributionPathAlert";
import { checkSubscriptionExpiryForWorkspace } from "@/lib/subscriptionAlerts";
import { checkScaleKillDecisionsForWorkspace } from "@/lib/scaleKillAlerts";
import { syncTikTokAdsForWorkspace, syncTikTokVideoMetricsForWorkspace, syncTikTokWeeklyEngagementForWorkspace, checkTikTokAlertsForWorkspace, syncTikTokBidCapForWorkspace, syncTikTokLearningPhaseForWorkspace, syncTikTokLookalikeComparisonForWorkspace, syncTikTokSparkAdsCommentsForWorkspace, syncTikTokLeadFormsForWorkspace, syncTikTokCreativesForWorkspace, checkTikTokBidStrategyProgressionForWorkspace } from "@/lib/syncTikTokAds";
import { checkMetaBidStrategyAlertsForWorkspace } from "@/lib/metaBidStrategyAudit";
import { fetchAndStoreExchangeRate } from "@/lib/marketContext";
import { runDailyDiagnosticsForWorkspace } from "@/lib/dailyTasks";
import { runAutomationForWorkspace } from "@/lib/automationRules";
import { checkExpiringConnections } from "@/lib/connectionHealthCheck";
import { purgeExpiredData } from "@/lib/dataRetention";

// أزواج العملات المدعومة في اختيار "العملة" بصفحة الإعدادات - بنسجل
// سعرها يومياً كلهم مع بعض، بدل ما نحاول نحدد عملة فوترة كل حساب Google
// Ads بالظبط (مش متتبّعة عندنا حالياً - تبسيط واعٍ، مش خطأ سهو)
const CURRENCY_PAIRS: Array<[string, string]> = [
  ["USD", "SAR"], ["USD", "EGP"], ["USD", "AED"], ["USD", "KWD"],
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  // فحص واحد لكل تشغيل، مش لكل Workspace - الفحص نفسه بيدوّر على كل
  // الروابط المنتهية قريباً مرة واحدة
  await checkExpiringConnections(7);

  // تنظيف البيانات الخام منتهية الصلاحية - سياسة احتفاظ حقيقية، مش
  // تراكم بلا حد (فجوة كانت موثّقة في SECURITY.md)
  await purgeExpiredData();

  // تسجيل سعر الصرف اليومي - بيبني الأرشيف اللي محتاجينه لاحقاً للمقارنة
  // (الـ API المجاني معندوش بيانات تاريخية، فلازم نبنيها بنفسنا من النهاردة)
  for (const [from, to] of CURRENCY_PAIRS) {
    try {
      await fetchAndStoreExchangeRate(from, to);
    } catch (err) {
      console.error(`فشل تسجيل سعر الصرف ${from}/${to}:`, err);
    }
  }

  // بس الـ Workspaces اللي فعلاً عندها ربط Google Ads نشتغل عليها
  const workspaceIds = await prisma.campaignLink.findMany({
    where: { platform: { in: ["GOOGLE_ADS", "META_ADS"] } },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  const results: Array<{ workspaceId: string; status: "ok" | "failed"; error?: string }> = [];

  // بالتتابع مش بالتوازي - عشان منضربش Google Ads API بحمل زيادة، وعشان
  // لو حساب واحد فشل، الباقي يكمل عادي من غير ما نستهلك كل الوقت المتاح
  // للـ function في محاولات فاشلة متوازية
  for (const { workspaceId } of workspaceIds) {
    try {
      // الترتيب مهم: المزامنة الأول (بيانات جديدة)، بعدين التشخيص (بيبني
      // على البيانات دي)، بعدين الأتمتة (بتبني على نتيجة التشخيص أحياناً)
      await syncGoogleAdsForWorkspace(workspaceId);
      await syncMetaAdsForWorkspace(workspaceId);
      await syncMetaAdSetsForWorkspace(workspaceId);
      await checkMetaBidStrategyAlertsForWorkspace(workspaceId);
      await syncMetaAccountHealthForWorkspace(workspaceId);
      await syncCatalogCampaignsForWorkspace(workspaceId);
      await checkMetaLearningPhaseAlertsForWorkspace(workspaceId);
      await checkMetaBidStrategyProgressionForWorkspace(workspaceId);
      await checkCatalogSpendAlertsForWorkspace(workspaceId);
      await syncTikTokAdsForWorkspace(workspaceId);
      await syncTikTokVideoMetricsForWorkspace(workspaceId);
      await syncTikTokSparkAdsCommentsForWorkspace(workspaceId);
      await syncTikTokLeadFormsForWorkspace(workspaceId);
      await syncTikTokCreativesForWorkspace(workspaceId);
      await syncTikTokWeeklyEngagementForWorkspace(workspaceId);
      await checkTikTokAlertsForWorkspace(workspaceId);
      await syncTikTokBidCapForWorkspace(workspaceId);
      await checkTikTokBidStrategyProgressionForWorkspace(workspaceId);
      await syncTikTokLearningPhaseForWorkspace(workspaceId);
      await syncTikTokLookalikeComparisonForWorkspace(workspaceId);
      await syncMetaCreativesForWorkspace(workspaceId);
      await syncCreativesForWorkspace(workspaceId);
      await syncSearchTermsForWorkspace(workspaceId);
      await syncAudiencePerformanceForWorkspace(workspaceId);
      await syncQualityScoreForWorkspace(workspaceId);
      await syncShoppingProductsForWorkspace(workspaceId);
      await checkShoppingSpendAlertsForWorkspace(workspaceId);
      await syncGoogleLeadFormsForWorkspace(workspaceId);
      await checkBidStrategyProgressionForWorkspace(workspaceId);
      await syncPerformanceMaxChannelsForWorkspace(workspaceId);
      await syncYoutubeMetricsForWorkspace(workspaceId);
      await syncDeviceAndGeoPerformanceForWorkspace(workspaceId);
      await syncMatchTypePerformanceForWorkspace(workspaceId);
      await syncDisplayPlacementsForWorkspace(workspaceId);

      const bidData = await syncBiddingStrategyForWorkspace(workspaceId);
      for (const b of bidData) {
        await prisma.campaignLink.updateMany({
          where: { workspaceId, platform: "GOOGLE_ADS", externalCampaignId: b.campaignId },
          data: {
            biddingStrategyType: b.biddingStrategyType,
            targetCpa: b.targetCpa,
            targetRoas: b.targetRoas,
            biddingDataUpdatedAt: new Date(),
          },
        });
      }
      await checkBidStrategyAlertsForWorkspace(workspaceId);
      await checkGoogleLearningPhaseAlertsForWorkspace(workspaceId);

      await runDailyDiagnosticsForWorkspace(workspaceId);
      await checkMonthlyForecastAlertForWorkspace(workspaceId);
      await checkConversionGapAlertForWorkspace(workspaceId);
      await checkTrafficQualityForWorkspace(workspaceId);
      await assessAndVerifyMessengerConversationsForWorkspace(workspaceId);
      await checkContentFormatSuggestionForWorkspace(workspaceId);
      await checkCostTrendAlertForWorkspace(workspaceId);
      await checkAttributionPathAlertForWorkspace(workspaceId);
      await checkSubscriptionExpiryForWorkspace(workspaceId);
      await checkScaleKillDecisionsForWorkspace(workspaceId);
      await runAutomationForWorkspace(workspaceId);
      results.push({ workspaceId, status: "ok" });
    } catch (err) {
      console.error(`فشلت المعالجة اليومية للـ Workspace ${workspaceId}:`, err);
      results.push({
        workspaceId,
        status: "failed",
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "failed").length;

  await prisma.cronRunLog.create({
    data: {
      totalWorkspaces: results.length,
      succeeded,
      failed,
      durationMs: Date.now() - startTime,
      errors: failed > 0
        ? JSON.stringify(results.filter((r) => r.status === "failed").map((r) => ({ workspaceId: r.workspaceId, error: r.error })))
        : null,
    },
  });

  return NextResponse.json({ processed: results.length, results });
}
