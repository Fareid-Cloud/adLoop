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
import { denyUnlessCron } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { finishCronRun } from "@/lib/cronRun";
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
import { checkPricingHealthAlertsForWorkspace } from "@/lib/pricingHealth";
import { checkStockGuardForWorkspace } from "@/lib/stockGuard";
import { measurePendingExperiments } from "@/lib/experimentEngine";
import { syncTikTokAdsForWorkspace, syncTikTokVideoMetricsForWorkspace, syncTikTokWeeklyEngagementForWorkspace, checkTikTokAlertsForWorkspace, syncTikTokBidCapForWorkspace, syncTikTokLearningPhaseForWorkspace, syncTikTokLookalikeComparisonForWorkspace, syncTikTokSparkAdsCommentsForWorkspace, syncTikTokLeadFormsForWorkspace, syncTikTokCreativesForWorkspace, checkTikTokBidStrategyProgressionForWorkspace } from "@/lib/syncTikTokAds";
import { checkMetaBidStrategyAlertsForWorkspace } from "@/lib/metaBidStrategyAudit";
import { fetchAndStoreExchangeRate } from "@/lib/marketContext";
import { runDailyDiagnosticsForWorkspace } from "@/lib/dailyTasks";
import { runAutomationForWorkspace } from "@/lib/automationRules";
import { checkExpiringConnections } from "@/lib/connectionHealthCheck";
import { purgeExpiredData } from "@/lib/dataRetention";
import { ownerLocaleFor } from "@/lib/workspaceLocale";
import { isSyncBlocked, refreshUsageAndNotify } from "@/lib/usageCaps";
import { ownerNotSuspended } from "@/lib/accountActive";
import { loadFeatureFlags, type FeatureFlagKey } from "@/lib/featureFlags";
import { captureUsageSnapshots } from "@/lib/admin/usage";
import { sendUsageAnomalyAlert } from "@/lib/usageAlertEmail";

// أزواج العملات المدعومة في اختيار "العملة" بصفحة الإعدادات - بنسجل
// سعرها يومياً كلهم مع بعض، بدل ما نحاول نحدد عملة فوترة كل حساب Google
// Ads بالظبط (مش متتبّعة عندنا حالياً - تبسيط واعٍ، مش خطأ سهو)
const CURRENCY_PAIRS: Array<[string, string]> = [
  ["USD", "SAR"], ["USD", "EGP"], ["USD", "AED"], ["USD", "KWD"],
];

// 🔴 **أتقل شغل في المنتج كان شغّال على المهلة الافتراضية.** الدالّة دي
// بتعمل أربعين نداء منصة لكلّ مساحة عمل بالتتابع، وكانت الوحيدة من
// الكرونات التقيلة اللي مابتعلنش مهلتها - يعني ١٥ ثانية (افتراضيّ Pro)
// بدل ٣٠٠. والأسوأ إنّ `CronRunLog` بيتكتب في آخر سطر، فالتشغيل المقطوع
// ما كانش بيسيب أثر أصلاً: مساحات ما اتزامنتش، وسجلّ يقول إنّ الكرون
// عمره ما جرى. الرقم هنا هو سقف Vercel على باقة Pro.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyUnlessCron(req);
  if (denied) return denied;

  const startTime = Date.now();

  // مفاتيح التشغيل العامة تُقرأ **مرّة واحدة لكلّ تشغيل** لا لكلّ مساحة:
  // قراءتها داخل الحلقة تعني استعلاماً لكلّ مساحة × كلّ نداء، وهي قيمة لا
  // تتغيّر أثناء التشغيل الواحد أصلاً.
  const flags = await loadFeatureFlags();

  /**
   * ينفّذ النداء إن كان مفتاحه مفتوحاً.
   *
   * الغرض عمليّ لا تجميليّ: حين تتعطّل منصّة من جهتها، كلّ نداء إليها
   * يُنفق وقتاً ثمّ يفشل - فتطول دورة الكرون كلّها وتمتلئ سجلّات الأخطاء
   * بضجيج يُخفي الأعطال الحقيقية. الإيقاف من اللوحة يوقف الأربعين نداءً
   * للمنصّة، لا نداء المزامنة الأساسيّ وحده.
   */
  async function ifOn(flag: FeatureFlagKey, fn: () => Promise<unknown>) {
    if (!flags[flag]) return;
    await fn();
  }

  const { startSyncRun, finishSyncRun } = await import("@/lib/integrationsStatus");

  /**
   * يشغّل مزامنة منصة ويسجّل نتيجتها. لا يُعيد رمي الخطأ عمداً: فشل منصة
   * واحدة لا يجوز أن يوقف مزامنة الباقي - وهذا هو سلوك الكرون الأصلي،
   * نحافظ عليه ونضيف إليه التسجيل فقط.
   */
  async function trackedSync(workspaceId: string, platform: string, fn: () => Promise<unknown>) {
    const before = await prisma.metricSnapshot.count({
      where: { workspaceId, platform: platform as never },
    });
    const runId = await startSyncRun(workspaceId, platform, "CRON");
    try {
      await fn();
      const after = await prisma.metricSnapshot.count({
        where: { workspaceId, platform: platform as never },
      });
      await finishSyncRun(runId, { ok: true, recordsWritten: Math.max(0, after - before) });
    } catch (err) {
      await finishSyncRun(runId, {
        ok: false,
        // نصّ المنصّة إن وُجد؛ وإلّا يبقى الحقل فارغاً لتكتب الواجهة
        // بديلها بلغة قارئها - راجع `homeActivity.ts`.
        error: err instanceof Error ? err.message.slice(0, 200) : undefined,
      });
      console.error(`فشلت مزامنة ${platform} لمساحة العمل ${workspaceId}:`, err);
    }
  }

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

  // كل مساحة عندها ربط بأي منصة إعلانية. تيك توك كانت مفقودة من القائمة
  // رغم أن المزامنة تحتها تشملها فعلاً - أي مساحة تعمل على تيك توك وحدها
  // لم تكن تُزامَن إطلاقاً.
  let workspaceIds = await prisma.campaignLink.findMany({
    where: { platform: { in: ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] } },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  // مالك كلّ مساحة: سقفا الاستهلاك على المستخدم لا على المساحة (الاشتراك
  // على المستخدم، وباقة الوكالات تجمع خمس عشرة مساحة تحت سقف واحد).
  //
  // استعلام واحد مش واحد لكلّ مساحة: كان `findUnique` جوّه حلقة، يعني مية
  // رحلة لقاعدة البيانات قبل أوّل نداء نافع - وكلّها من الوقت المحدود
  // للدالّة نفسها.
  //
  // و`ownerNotSuspended`: مساحةُ حسابٍ معلَّق لا تدخل الدورة أصلاً - لا
  // سحباً ولا تشخيصاً (صرف Claude) ولا أتمتةً تكتب على حساب إعلاناته.
  const ownerRows = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds.map((w) => w.workspaceId) }, ...ownerNotSuspended },
    select: { id: true, userId: true },
  });
  const owners = new Map(ownerRows.map((w) => [w.id, w.userId]));
  // ما سقط من `owners` هو المعلَّق: يُحذف من الطابور، لا يُترك ليُزامَن
  // بلا فحص سقفٍ (`owners.get` ترجع undefined فيتخطّى الشرط ويكمل).
  workspaceIds = workspaceIds.filter((w) => owners.has(w.workspaceId));

  // ═══ حدّ الخطة الحالية، لا خطة يوم الإنشاء (B-5) ═══
  //
  // 🔴 `buildCheck` في `lib/entitlements.ts` **بوابةُ إنشاءٍ فقط**
  // (`current < limit`)، فلا شيء يضيق حين تنتهي الخطة أو تُخفَّض. مَن دفع
  // شهراً واحداً على خطة الوكالة وأنشأ خمس عشرة مساحةً وربط خمسةً وأربعين
  // حساباً، كان يحتفظ بها **كلّها تُزامَن كلَّ ليلة مجّاناً وإلى الأبد** -
  // على حساب حصّتنا من نداءات المنصّات وبنيتنا التحتية.
  //
  // والاختيار **بالأقدم أوّلاً لا عشوائياً**: تبقى المجموعة نفسها حيّةً كلّ
  // ليلة، فلا يرى المشترك مساحةً تُحدَّث اليوم وتجمد غداً بلا سبب ظاهر.
  // وما فوق الحدّ يبقى مقروءاً في اللوحة - لا يُحذف ولا يُخفى، يتوقّف
  // تحديثه وحده.
  const { getEntitlements } = await import("@/lib/entitlements");
  const byOwner = new Map<string, string[]>();
  for (const { workspaceId } of workspaceIds) {
    const ownerId = owners.get(workspaceId)!;
    (byOwner.get(ownerId) ?? byOwner.set(ownerId, []).get(ownerId)!).push(workspaceId);
  }
  const allowed = new Set<string>();
  for (const [ownerId, ids] of byOwner) {
    try {
      const limit = (await getEntitlements(ownerId)).limits.workspaces;
      // الأقدم إنشاءً أوّلاً - `cuid` ليس مرتَّباً زمنياً، فيُقرأ التاريخ.
      const ordered = await prisma.workspace.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      for (const w of ordered.slice(0, Math.max(0, limit))) allowed.add(w.id);
    } catch (err) {
      // تعذّر حسم الخطة لا يوقف مزامنة صاحبها: الحرمان الخاطئ أسوأ من
      // مزامنةٍ زائدة ليلةً واحدة، ويُسجَّل ليُراجَع.
      console.error(`[cron] تعذّر حسم حدود الخطة للمالك ${ownerId}:`, err);
      for (const id of ids) allowed.add(id);
    }
  }
  workspaceIds = workspaceIds.filter((w) => allowed.has(w.workspaceId));

  // ===== الأقدم نجاحاً الأول =====
  // الترتيب كان ثابتاً (ترتيب ما ترجّعه قاعدة البيانات)، فلو التشغيل انقطع
  // عند المساحة الأربعين، **نفس** الستّين اللي بعدها بيتحرموا بكرة وبعده -
  // مجاعة دايمة لآخر الطابور، مش تأخيرة مرّة واحدة. الترتيب بآخر نجاح
  // تصاعديّاً بيحوّلها لتناوب: اللي فاتته دورة بياخد الأولوية في اللي
  // بعدها، واللي عمره ما اتزامن بياخدها قبل الكلّ.
  //
  // مش بديل عن طابور مهامّ حقيقيّ - بديل عن أن يكون العطل صامتاً وثابتاً.
  const lastSuccess = await prisma.syncRun.groupBy({
    by: ["workspaceId"],
    where: { status: "SUCCESS", workspaceId: { in: workspaceIds.map((w) => w.workspaceId) } },
    _max: { startedAt: true },
  });
  const lastSuccessAt = new Map(lastSuccess.map((r) => [r.workspaceId, r._max.startedAt?.getTime() ?? 0]));
  // مساحة عمرها ما نجحت (مش في الخريطة) بتاخد صفر، يعني أوّل الطابور.
  workspaceIds.sort(
    (a, b) => (lastSuccessAt.get(a.workspaceId) ?? 0) - (lastSuccessAt.get(b.workspaceId) ?? 0)
  );

  const results: Array<{ workspaceId: string; status: "ok" | "failed" | "capped"; error?: string }> = [];

  // بالتتابع مش بالتوازي - عشان منضربش Google Ads API بحمل زيادة، وعشان
  // لو حساب واحد فشل، الباقي يكمل عادي من غير ما نستهلك كل الوقت المتاح
  // للـ function في محاولات فاشلة متوازية
  for (const { workspaceId } of workspaceIds) {
    try {
      // 🛑 سقف الاستهلاك يسبق كلّ شيء: مساحةٌ لمستخدمٍ بلغ سقفه لا تُزامَن
      // إطلاقاً هذه الدورة. الفحص هنا لا داخل كلّ دالّة مزامنة على حدة -
      // فحصٌ واحد يغطّي الأربعين نداءً تحته، ولا يمكن أن يُنسى في نداءٍ
      // جديد يُضاف لاحقاً. القراءة من قيمة مخزَّنة فلا تكلّف تجميعاً.
      const ownerId = owners.get(workspaceId);
      if (ownerId && (await isSyncBlocked(ownerId))) {
        results.push({ workspaceId, status: "capped" });
        continue;
      }

      // الترتيب مهم: المزامنة الأول (بيانات جديدة)، بعدين التشخيص (بيبني
      // على البيانات دي)، بعدين الأتمتة (بتبني على نتيجة التشخيص أحياناً)
      //
      // المزامنة الأساسية للمنصات الثلاث تُسجَّل في SyncRun - وهي مصدر
      // "آخر مزامنة" وصحّة التكامل وسجلّ النشاط في قسم التكاملات. تسجيل
      // اليدوية وحدها كان سيُظهر الحساب "قديم البيانات" رغم عمل الكرون.
      await ifOn("sync.google", () => trackedSync(workspaceId, "GOOGLE_ADS", () => syncGoogleAdsForWorkspace(workspaceId)));
      await ifOn("sync.meta", () => trackedSync(workspaceId, "META_ADS", () => syncMetaAdsForWorkspace(workspaceId)));
      await ifOn("sync.meta", () => syncMetaAdSetsForWorkspace(workspaceId));
      await ifOn("sync.meta", () => checkMetaBidStrategyAlertsForWorkspace(workspaceId));
      await ifOn("sync.meta", () => syncMetaAccountHealthForWorkspace(workspaceId));
      await ifOn("sync.meta", () => syncCatalogCampaignsForWorkspace(workspaceId));
      await ifOn("sync.meta", () => checkMetaLearningPhaseAlertsForWorkspace(workspaceId));
      await ifOn("sync.meta", () => checkMetaBidStrategyProgressionForWorkspace(workspaceId));
      await ifOn("sync.meta", () => checkCatalogSpendAlertsForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => trackedSync(workspaceId, "TIKTOK_ADS", () => syncTikTokAdsForWorkspace(workspaceId)));
      await ifOn("sync.tiktok", () => syncTikTokVideoMetricsForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokSparkAdsCommentsForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokLeadFormsForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokCreativesForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokWeeklyEngagementForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => checkTikTokAlertsForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokBidCapForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => checkTikTokBidStrategyProgressionForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokLearningPhaseForWorkspace(workspaceId));
      await ifOn("sync.tiktok", () => syncTikTokLookalikeComparisonForWorkspace(workspaceId));
      await ifOn("sync.meta", () => syncMetaCreativesForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncCreativesForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncSearchTermsForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncAudiencePerformanceForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncQualityScoreForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncShoppingProductsForWorkspace(workspaceId));
      await ifOn("sync.google", () => checkShoppingSpendAlertsForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncGoogleLeadFormsForWorkspace(workspaceId));
      await ifOn("sync.google", () => checkBidStrategyProgressionForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncPerformanceMaxChannelsForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncYoutubeMetricsForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncDeviceAndGeoPerformanceForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncMatchTypePerformanceForWorkspace(workspaceId));
      await ifOn("sync.google", () => syncDisplayPlacementsForWorkspace(workspaceId));

      const bidData = flags["sync.google"] ? await syncBiddingStrategyForWorkspace(workspaceId) : [];
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
      await ifOn("sync.google", () => checkBidStrategyAlertsForWorkspace(workspaceId));
      await ifOn("sync.google", () => checkGoogleLearningPhaseAlertsForWorkspace(workspaceId));

      await ifOn("ai.insights", () => runDailyDiagnosticsForWorkspace(workspaceId));
      await checkMonthlyForecastAlertForWorkspace(workspaceId);
      await checkConversionGapAlertForWorkspace(workspaceId);
      await checkTrafficQualityForWorkspace(workspaceId);
      await assessAndVerifyMessengerConversationsForWorkspace(workspaceId);
      await checkContentFormatSuggestionForWorkspace(workspaceId);
      await checkCostTrendAlertForWorkspace(workspaceId);
      await checkAttributionPathAlertForWorkspace(workspaceId);
      await checkSubscriptionExpiryForWorkspace(workspaceId);
      await checkScaleKillDecisionsForWorkspace(workspaceId);
      // فحص التسعير لم يعد هنا - يعمل الآن لكل مساحة عندها منتجات، بمعزل
      // عن المنصات الإعلانية (انظر الحلقة المستقلة بعد هذه الحلقة).
      await ifOn("automation.apply", async () => runAutomationForWorkspace(workspaceId, await ownerLocaleFor(workspaceId)));
      // قياس التجارب التي اكتملت نافذتها - نتيجة كل قرار نُفِّذ فعلاً
      await measurePendingExperiments(workspaceId);
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

  // ===== فحص صحة التسعير - مستقل عن المنصات الإعلانية =====
  // كان يعمل داخل الحلقة أعلاه، أي أنه لا يعمل إلا لمساحة مربوطة بحساب
  // إعلاني. لكنه يعتمد على المنتجات وبيانات المبيعات فقط، فمساحة تبيع عبر
  // سلة بلا حملات - أو ربطت تيك توك وحدها - لم تكن تحصل على أي تنبيه تسعير.
  const pricingWorkspaces = await prisma.product.findMany({
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  let pricingChecked = 0;
  for (const { workspaceId } of pricingWorkspaces) {
    try {
      await checkPricingHealthAlertsForWorkspace(workspaceId);
      // حارس المخزون: نفس النطاق (مساحات لها منتجات) - الإنفاق على منتج
      // نافد خسارة كاملة، فالفحص يومي مع فحص التسعير لا منفصلاً عنه.
      await checkStockGuardForWorkspace(workspaceId);
      pricingChecked++;
    } catch (err) {
      console.error(`فشل فحص التسعير للـ Workspace ${workspaceId}:`, err);
    }
  }

  // ===== قياس الاستهلاك الشهريّ =====
  // **بعد المزامنة لا قبلها:** القياس على بيانات ما قبل التشغيل يجعل
  // التجاوز يظهر بعد يومٍ كامل من وقوعه، فيُسحب إنفاق يومٍ زائد عن السقف
  // قبل أن يعرف أحد. وهنا أيضاً تُطلق تنبيهات الاقتراب والتوقّف.
  const uniqueOwners = new Set(owners.values());
  for (const userId of uniqueOwners) {
    try {
      await refreshUsageAndNotify(userId);
    } catch (err) {
      console.error(`فشل قياس استهلاك المستخدم ${userId}:`, err);
    }
  }

  // ===== لقطة الاستهلاك اليومية =====
  // **بعد قياس الاستهلاك فوق مباشرةً وقبل أي تصفير**: دي اللي بتحوّل
  // "الاستهلاك دلوقتي" (عدّادات بتتكتب فوق نفسها) إلى "الاستهلاك عبر
  // الزمن" - من غيرها مافيش ترند ولا كشف شذوذ، لأنّ مافيش ماضي يتقارن به.
  try {
    const snapshots = await captureUsageSnapshots();
    console.log(`[cron] سُجّلت ${snapshots} لقطة استهلاك.`);

    // **التنبيه بعد اللقطة مباشرةً، لا قبلها.** الشذوذ بيتقري من آخر لقطة
    // كاملة، فالنداء هنا بيقارن يوماً منتهياً بمعدّله - قبل الكتابة كان
    // هيقارن يوم إمبارح بنفسه ويسكت دايماً.
    const alert = await sendUsageAnomalyAlert();
    if (alert.anomalies > 0) {
      console.log(`[cron] ${alert.anomalies} حساباً باستهلاك شاذّ - البريد ${alert.sent ? "اتبعت" : "ما اتبعتش"}.`);
    }
  } catch (err) {
    console.error("[cron] فشل تسجيل لقطات الاستهلاك:", err);
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const capped = results.filter((r) => r.status === "capped").length;

  // الصفّ باسم مهمّته، والرمز يتبع النتيجة: مساحاتٌ فشلت كانت تُرَدّ ضمن
  // `200` فتبدو لوحةُ الكرون خضراء ويومُ الفشل مطابقاً ليوم النجاح.
  return finishCronRun(
    {
      job: "sync-google-ads",
      total: results.length,
      succeeded,
      failed,
      startedAt: startTime,
      errors: results.filter((r) => r.status === "failed").map((r) => ({ workspaceId: r.workspaceId, error: r.error })),
    },
    { processed: results.length, capped, pricingChecked, results }
  );
}
