// lib/syncTikTokAds.ts
//
// المزامنة الأساسية لتيك توك - نفس مبدأ جوجل وميتا (بيانات يومية في
// MetricSnapshot)، لكن عبر endpoint مختلف تماماً: /report/integrated/get
// (مؤكد من مثال عملي شغال، مش توثيق نظري بس) بدل GAQL أو Graph API.
//
// فرق معماري مهم: تيك توك بتدمج "التقرير" و"البيانات اليومية" في نداء
// واحد عبر dimensions=["campaign_id","stat_time_day"] - مفيش فصل بين
// "structure" و"insights" زي ميتا، ولا GAQL منفصل زي جوجل.

import { prisma } from "@/lib/prisma";
import type { CampaignLink, ConnectedPlatform } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";

const TIKTOK_API_VERSION = "v1.3";

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export async function syncTikTokAdsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const params = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
        // conversion هنا معناها "أحداث التحسين" المُعرّفة في الحملة نفسها
        // (زي جوجل وميتا بالظبط - رقم مش موحّد المعنى عبر كل الحملات
        // إلا لو كلهم بنفس هدف التحسين)
        metrics: JSON.stringify(["spend", "impressions", "clicks", "conversion"]),
        filtering: JSON.stringify([
          { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
        ]),
        start_date: fromStr,
        end_date: todayStr,
        page_size: "1000",
      });

      const res = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`,
        { headers }
      );
      const data = await res.json();

      if (data.code !== 0) {
        console.error(`فشلت مزامنة تيك توك للحساب ${advertiserId}:`, data.message);
        continue;
      }

      for (const row of data.data?.list ?? []) {
        const campaignId = String(row.dimensions?.campaign_id);
        const date = new Date(row.dimensions?.stat_time_day);
        const m = row.metrics ?? {};

        await prisma.metricSnapshot.upsert({
          where: {
            workspaceId_platform_campaignId_date_placementBreakdown_placementDetail: {
              workspaceId, platform: "TIKTOK_ADS", campaignId, date,
              placementBreakdown: "ALL", placementDetail: "ALL",
            },
          },
          create: {
            workspaceId, platform: "TIKTOK_ADS", campaignId, date,
            placementBreakdown: "ALL", placementDetail: "ALL",
            impressions: Number(m.impressions ?? 0),
            clicks: Number(m.clicks ?? 0),
            cost: Number(m.spend ?? 0),
            rawConversions: Number(m.conversion ?? 0),
            verifiedConversions: 0, // قيمة ابتدائية صحيحة - بتتزود فعلياً وقت التحقق الحقيقي عبر /api/attribution/mark-matched
          },
          update: {
            impressions: Number(m.impressions ?? 0),
            clicks: Number(m.clicks ?? 0),
            cost: Number(m.spend ?? 0),
            rawConversions: Number(m.conversion ?? 0),
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة حملات تيك توك للحساب ${advertiserId}:`, err);
    }
  }
}

// ==================== معدل الخطّاف ومعدل الإكمال (مستوى الإعلان) ====================
// أهم مؤشر جودة فيديو خاص بتيك توك، مفيش له مكافئ مباشر في جوجل/ميتا.
// حقول مؤكدة من مصدر تقني موثوق (Fivetran - شركة ETL محترفة لازم توثّق
// الحقول الحقيقية بدقة): video_watched_2s (الخطّاف)، video_watched_6s
// (مشاهدة متفاعلة - تيك توك نفسها بتستخدم عتبة الـ6 ثواني دي للتحويل
// المُسند من غير كليك)، video_views_p25/p50/p75/p100 (منحنى الإكمال).
export async function syncTikTokVideoMetricsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const params = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        // identity_type بُعد ثابت لكل إعلان (مش بيتغيّر يومياً) - بنضيفه
        // هنا عشان نصنّف Spark Ads (AUTH_CODE/TT_USER) عن الإعلانات
        // العادية (CUSTOMIZED_USER) بنفس المقاييس اللي عندنا أصلاً
        dimensions: JSON.stringify(["ad_id", "identity_type"]),
        metrics: JSON.stringify([
          "ad_name", "impressions", "video_watched_2s", "video_watched_6s",
          "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100",
        ]),
        filtering: JSON.stringify([
          { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
        ]),
        start_date: fromStr,
        end_date: todayStr,
        page_size: "1000",
      });

      const res = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`,
        { headers }
      );
      const data = await res.json();
      if (data.code !== 0) {
        console.error(`فشلت مزامنة مقاييس فيديو تيك توك للحساب ${advertiserId}:`, data.message);
        continue;
      }

      for (const row of data.data?.list ?? []) {
        const adId = String(row.dimensions?.ad_id);
        const identityType = String(row.dimensions?.identity_type ?? "UNKNOWN");
        const m = row.metrics ?? {};
        const impressions = Number(m.impressions ?? 0);

        await prisma.tikTokVideoMetricSnapshot.upsert({
          where: { workspaceId_adId: { workspaceId, adId } },
          create: {
            workspaceId, adId, identityType,
            adName: m.ad_name ?? null,
            impressions,
            hookRate: impressions > 0 ? Number(m.video_watched_2s ?? 0) / impressions : 0,
            engagedViewRate: impressions > 0 ? Number(m.video_watched_6s ?? 0) / impressions : 0,
            completionRate: impressions > 0 ? Number(m.video_views_p100 ?? 0) / impressions : 0,
            viewsP25: Number(m.video_views_p25 ?? 0),
            viewsP50: Number(m.video_views_p50 ?? 0),
            viewsP75: Number(m.video_views_p75 ?? 0),
            viewsP100: Number(m.video_views_p100 ?? 0),
          },
          update: {
            identityType,
            adName: m.ad_name ?? null,
            impressions,
            hookRate: impressions > 0 ? Number(m.video_watched_2s ?? 0) / impressions : 0,
            engagedViewRate: impressions > 0 ? Number(m.video_watched_6s ?? 0) / impressions : 0,
            completionRate: impressions > 0 ? Number(m.video_views_p100 ?? 0) / impressions : 0,
            viewsP25: Number(m.video_views_p25 ?? 0),
            viewsP50: Number(m.video_views_p50 ?? 0),
            viewsP75: Number(m.video_views_p75 ?? 0),
            viewsP100: Number(m.video_views_p100 ?? 0),
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة مقاييس فيديو تيك توك للحساب ${advertiserId}:`, err);
    }
  }
}

// ==================== كشف "تعب" الفيديو (أسبوع مقابل أسبوع) ====================
// مبني على تحقق من 6 مصادر مختلفة - معظمها متفق على إشارة واحدة دقيقة:
// انخفاض معدل المشاهدة المتفاعلة (6 ثواني) أسبوع عن أسبوع >15% = بداية
// تعب الخطّاف. تحت 45% خالص = تعب حقيقي محتاج تجديد فوري.
//
// أمانة عن Frequency كإشارة مساندة: المصادر مختلفة على رقم واحد (بعضها
// >2-3، بعضها >5-6) - "مفيش عتبة عالمية" حسب أكتر من مصدر صراحة. بنستخدمها
// كإشارة مساندة بس، مش الحكم الوحيد - نفس منطق "الاتجاه مش الرقم المطلق"
// اللي المصادر بتأكده.
export async function syncTikTokWeeklyEngagementForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  // آخر 14 يوم بالظبط (أسبوعين) - بنجمّعهم يدوياً لأسبوعين منفصلين، مش
  // معتمدين على بُعد "أسبوعي" جاهز من تيك توك (مش مؤكد وجوده أصلاً)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fromStr = fourteenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const params = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
        metrics: JSON.stringify(["impressions", "video_watched_6s", "frequency"]),
        filtering: JSON.stringify([
          { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
        ]),
        start_date: fromStr,
        end_date: todayStr,
        page_size: "1000",
      });

      const res = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`,
        { headers }
      );
      const data = await res.json();
      if (data.code !== 0) continue;

      // بنجمّع يدوياً لأسبوعين، لكل إعلان على حدة
      const weekly = new Map<string, { impressions: number; watched6s: number; frequencySum: number; days: number }>();

      for (const row of data.data?.list ?? []) {
        const adId = String(row.dimensions?.ad_id);
        const date = new Date(row.dimensions?.stat_time_day);
        const weekStart = date >= thisWeekStart ? thisWeekStart : lastWeekStart;
        const key = `${adId}::${weekStart.toISOString()}`;

        const m = row.metrics ?? {};
        const existing = weekly.get(key) ?? { impressions: 0, watched6s: 0, frequencySum: 0, days: 0 };
        existing.impressions += Number(m.impressions ?? 0);
        existing.watched6s += Number(m.video_watched_6s ?? 0);
        existing.frequencySum += Number(m.frequency ?? 0);
        existing.days += 1;
        weekly.set(key, existing);
      }

      for (const [key, agg] of weekly.entries()) {
        const [adId, weekStartIso] = key.split("::");
        const weekStart = new Date(weekStartIso);

        await prisma.tikTokWeeklyEngagement.upsert({
          where: { workspaceId_adId_weekStart: { workspaceId, adId, weekStart } },
          create: {
            workspaceId, adId, weekStart,
            engagedViewRate: agg.impressions > 0 ? agg.watched6s / agg.impressions : 0,
            frequency: agg.days > 0 ? agg.frequencySum / agg.days : 0,
          },
          update: {
            engagedViewRate: agg.impressions > 0 ? agg.watched6s / agg.impressions : 0,
            frequency: agg.days > 0 ? agg.frequencySum / agg.days : 0,
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة التعب الأسبوعي لإعلانات تيك توك للحساب ${advertiserId}:`, err);
    }
  }
}

export interface TikTokFatigueResult {
  adId: string;
  weekOverWeekDeclinePct: number | null;
  currentEngagedViewRate: number;
  currentFrequency: number;
  status: "HEALTHY" | "EARLY_FATIGUE" | "SEVERE_FATIGUE" | "INSUFFICIENT_DATA";
  message: string;
}

export function detectTikTokFatigue(
  adId: string,
  thisWeek: { engagedViewRate: number; frequency: number } | null,
  lastWeek: { engagedViewRate: number } | null
): TikTokFatigueResult {
  if (!thisWeek) {
    return {
      adId, weekOverWeekDeclinePct: null, currentEngagedViewRate: 0, currentFrequency: 0,
      status: "INSUFFICIENT_DATA", message: "لا توجد بيانات كافية لهذا الأسبوع بعد.",
    };
  }

  const base = {
    adId,
    currentEngagedViewRate: thisWeek.engagedViewRate,
    currentFrequency: thisWeek.frequency,
  };

  // إشارة الحسم الأولى: الرقم المطلق تحت 45% - تعب حقيقي بغض النظر عن
  // الاتجاه (حتى لو أول أسبوع، رقم بهذا الانخفاض مقلق في حد ذاته)
  if (thisWeek.engagedViewRate < 0.38) {
    return {
      ...base, weekOverWeekDeclinePct: null, status: "SEVERE_FATIGUE",
      message: `معدل المشاهدة المتفاعلة ${Math.round(thisWeek.engagedViewRate * 1000) / 10}% - تحت الحد الحرج (38%). محتاج تجديد إبداعي فوري.`,
    };
  }

  if (!lastWeek) {
    return {
      ...base, weekOverWeekDeclinePct: null,
      status: thisWeek.engagedViewRate < 0.45 ? "EARLY_FATIGUE" : "HEALTHY",
      message: thisWeek.engagedViewRate < 0.45
        ? `معدل المشاهدة المتفاعلة ${Math.round(thisWeek.engagedViewRate * 1000) / 10}% - تحت 45%، يستاهل مراقبة.`
        : "لا توجد بيانات أسبوع سابق للمقارنة، لكن الرقم الحالي صحي.",
    };
  }

  const declinePct = lastWeek.engagedViewRate > 0
    ? Math.round(((lastWeek.engagedViewRate - thisWeek.engagedViewRate) / lastWeek.engagedViewRate) * 100)
    : 0;

  if (declinePct > 15) {
    return {
      ...base, weekOverWeekDeclinePct: declinePct, status: "EARLY_FATIGUE",
      message: `معدل المشاهدة المتفاعلة نزل ${declinePct}% عن الأسبوع اللي فات${
        thisWeek.frequency > 3 ? ` (والتكرار وصل ${Math.round(thisWeek.frequency * 10) / 10} - إشارة مساندة على نفس الاتجاه)` : ""
      } - تعب الخطّاف بدأ يظهر.`,
    };
  }

  return {
    ...base, weekOverWeekDeclinePct: declinePct, status: "HEALTHY",
    message: "معدل المشاهدة المتفاعلة مستقر أو بيتحسّن مقارنة بالأسبوع اللي فات.",
  };
}

// ==================== إغلاق الحلقة - من "أرقام" لـ"تنبيه فعلي" ====================
// نفس الفجوة اللي اكتشفناها في ميتا: كنا بنجاوب على السؤال بأرقام صح،
// لكن محدش كان بيدفع النتيجة كتنبيه استباقي - المستخدم لازم يدخل
// الصفحة بنفسه كل مرة. الدالة دي بتقفل الحلقة لإشارتين من تيك توك
// (تعب، خطّاف ضعيف)، تتشغّل يومياً في الكرون.
export async function checkTikTokAlertsForWorkspace(workspaceId: string) {
  const { pushToActionFeed } = await import("@/lib/actionFeed");

  // 1) تعب الفيديو - أهم إشارة، بتتشغّل على بيانات الأسبوعين الأخيرين
  const weeklyData = await prisma.tikTokWeeklyEngagement.findMany({
    where: { workspaceId },
    orderBy: { weekStart: "desc" },
  });
  const byAd = new Map<string, typeof weeklyData>();
  for (const row of weeklyData) {
    const arr = byAd.get(row.adId) ?? [];
    arr.push(row);
    byAd.set(row.adId, arr);
  }

  const videoNames = await prisma.tikTokVideoMetricSnapshot.findMany({
    where: { workspaceId },
  });
  const nameMap = new Map<string, string | null>(videoNames.map((v: any) => [v.adId, v.adName]));

  for (const [adId, weeks] of byAd.entries()) {
    const sorted = weeks.sort((a: any, b: any) => b.weekStart.getTime() - a.weekStart.getTime());
    const result = detectTikTokFatigue(adId, sorted[0] ?? null, sorted[1] ?? null);

    if (result.status === "SEVERE_FATIGUE" || result.status === "EARLY_FATIGUE") {
      await pushToActionFeed({
        workspaceId,
        type: "ALERT",
        severity: result.status === "SEVERE_FATIGUE" ? "HIGH" : "MEDIUM",
        title: `${nameMap.get(adId) ?? adId}: ${result.status === "SEVERE_FATIGUE" ? "تعب حقيقي" : "بداية تعب"}`,
        description: result.message,
      });
    }
  }

  // 2) خطّاف ضعيف جداً - إعلانات بظهور كافٍ لكن خطّاف تحت 15% (ضعيف
  // مقارنة بالمعيار المذكور في التوثيق: خطّاف قوي فوق 30%)
  const weakHooks = videoNames.filter((v: any) => v.impressions > 500 && v.hookRate < 0.15);
  for (const v of weakHooks) {
    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: "MEDIUM",
      title: `${v.adName ?? v.adId}: خطّاف ضعيف`,
      description: `${Math.round(v.hookRate * 1000) / 10}% بس من المشاهدين كملوا ثانيتين - أقل من المعيار الصحي (30%+). أول 2 ثانية من الفيديو محتاجة إعادة تصميم.`,
    });
  }
}

// ==================== منطقية Cost Cap/Bid Cap (مجموعة إعلانية) ====================
// "أنا حاطط سقف تكلفة معين، هل ده منطقي فعلاً مقارنة بتكلفتي الحقيقية؟"
// نفس مبدأ جوجل وميتا بالظبط - مقارنة الرقم اللي حاططه العميل بالرقم
// الحقيقي الفعلي، مش رقم عالمي مننا. بيستفيد تلقائياً من أي بيانات
// تاريخية موجودة في الـ Workspace أصلاً (مستوردة أو مسحوبة، مفيش فرق).
//
// أمانة عن مستوى الثقة: bid_type و conversion_bid_price مؤكدين وجودهم
// في AdgroupCreateBody الرسمية (GitHub SDK)، لكن مش موثّقين بنفس التفصيل
// الكامل اللي أكدنا بيه حقول تانية النهاردة. أول مزامنة حقيقية هتأكد
// الأسماء دي بالضبط - لو غلط، هيفشل بهدوء (try/catch) مش هيكسر حاجة تانية.
export interface TikTokBidCapInput {
  adGroupId: string;
  adGroupName: string | null;
  bidType: string | null;
  bidPrice: number | null;
  verifiedCpa: number | null;
}

export interface TikTokBidCapResult {
  adGroupId: string;
  adGroupName: string | null;
  status: "ALIGNED" | "DIVERGENT" | "NOT_APPLICABLE";
  divergencePct: number | null;
  message: string;
}

const TIKTOK_DIVERGENCE_THRESHOLD_PCT = 20;
const TIKTOK_MIN_VERIFIED_SAMPLE = 5;

export function auditTikTokBidCap(
  input: TikTokBidCapInput,
  verifiedSampleSize: number
): TikTokBidCapResult {
  const base = { adGroupId: input.adGroupId, adGroupName: input.adGroupName };

  if (!input.bidType || input.bidType === "BID_TYPE_NO_BID") {
    return {
      ...base, status: "NOT_APPLICABLE", divergencePct: null,
      message: "أقصى توصيل (Maximum Delivery) من غير سقف - مفيش هدف مضبوط يتفحص أصلاً.",
    };
  }

  if (input.bidPrice === null || input.verifiedCpa === null || verifiedSampleSize < TIKTOK_MIN_VERIFIED_SAMPLE) {
    return {
      ...base, status: "NOT_APPLICABLE", divergencePct: null,
      message: "لا توجد عينة تحويلات حقيقية كافية للمقارنة بعد.",
    };
  }

  const divergencePct = Math.round(((input.verifiedCpa - input.bidPrice) / input.bidPrice) * 100);
  const isDivergent = Math.abs(divergencePct) > TIKTOK_DIVERGENCE_THRESHOLD_PCT;

  return {
    ...base, status: isDivergent ? "DIVERGENT" : "ALIGNED", divergencePct,
    message: isDivergent
      ? `السقف المضبوط (${input.bidPrice}) بعيد عن تكلفة العميل الحقيقية الفعلية (${Math.round(input.verifiedCpa)}) بنسبة ${Math.abs(divergencePct)}%.`
      : `السقف المضبوط قريب من الواقع الفعلي (فرق ${Math.abs(divergencePct)}% بس) - منطقي.`,
  };
}

// جلب بيانات bid_type/bid_price على مستوى المجموعة الإعلانية + دفع تنبيه
// لو DIVERGENT - نفس نمط جوجل/ميتا اللي أصلحناهم لتوّنا
export async function syncTikTokBidCapForWorkspace(workspaceId: string) {
  const { pushToActionFeed } = await import("@/lib/actionFeed");

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };
  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const adGroupsRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/adgroup/get/` +
          `?advertiser_id=${advertiserId}&filtering=${encodeURIComponent(JSON.stringify({ campaign_ids: campaignIds }))}&page_size=100`,
        { headers }
      );
      const adGroupsData = await adGroupsRes.json();
      if (adGroupsData.code !== 0) continue;

      for (const adGroup of adGroupsData.data?.list ?? []) {
        const adGroupId = String(adGroup.adgroup_id);

        const insightsRes = await fetch(
          `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/` +
            `?advertiser_id=${advertiserId}&report_type=BASIC&data_level=AUCTION_ADGROUP` +
            `&dimensions=${encodeURIComponent(JSON.stringify(["adgroup_id"]))}` +
            `&metrics=${encodeURIComponent(JSON.stringify(["spend", "conversion"]))}` +
            `&filtering=${encodeURIComponent(JSON.stringify([{ field_name: "adgroup_ids", filter_type: "IN", filter_value: JSON.stringify([adGroupId]) }]))}` +
            `&start_date=${fromStr}&end_date=${todayStr}`,
          { headers }
        );
        const insightsData = await insightsRes.json();
        const row = insightsData.data?.list?.[0]?.metrics;
        const spend = Number(row?.spend ?? 0);
        const conversions = Number(row?.conversion ?? 0);

        const result = auditTikTokBidCap(
          {
            adGroupId,
            adGroupName: adGroup.adgroup_name ?? null,
            bidType: adGroup.bid_type ?? null,
            bidPrice: adGroup.conversion_bid_price ? Number(adGroup.conversion_bid_price) : null,
            verifiedCpa: conversions > 0 ? spend / conversions : null,
          },
          conversions
        );

        if (result.status === "DIVERGENT") {
          await pushToActionFeed({
            workspaceId,
            type: "ALERT",
            severity: "MEDIUM",
            title: `${result.adGroupName ?? result.adGroupId}: سقف التكلفة بعيد عن الواقع`,
            description: result.message,
          });
        }
      }
    } catch (err) {
      console.error(`فشلت مزامنة Cost Cap لحساب تيك توك ${advertiserId}:`, err);
    }
  }
}

// ==================== فترة التعلّم بعد تعديل الميزانية (تيك توك) ====================
// "لو زودت الميزانية، هخرج بره فترة التعلّم قد إيه؟" - قاعدة تيك توك
// موثّقة رسمياً (help.tiktok.com): محتاجة ~25 نتيجة أو 7 أيام، أيهما
// أسرع - رقم مختلف عن ميتا (50/7 أيام) عمداً، مش نفس القاعدة بالخطأ.
const TIKTOK_RESULTS_NEEDED = 25;

export interface TikTokLearningPhaseEstimate {
  adGroupId: string;
  adGroupName: string | null;
  conversionsLast7Days: number;
  status: "LIKELY_STABLE" | "LEARNING" | "LEARNING_LIMITED";
  message: string;
}

export function estimateTikTokLearningPhase(
  adGroupId: string,
  adGroupName: string | null,
  conversionsLast7Days: number
): TikTokLearningPhaseEstimate {
  const base = { adGroupId, adGroupName, conversionsLast7Days };

  if (conversionsLast7Days >= TIKTOK_RESULTS_NEEDED) {
    return {
      ...base, status: "LIKELY_STABLE",
      message: `${conversionsLast7Days} نتيجة خلال آخر 7 أيام - على الأرجح خارج فترة التعلّم فعلاً.`,
    };
  }

  const gapNeeded = TIKTOK_RESULTS_NEEDED - conversionsLast7Days;
  return {
    ...base,
    status: conversionsLast7Days < TIKTOK_RESULTS_NEEDED / 2 ? "LEARNING_LIMITED" : "LEARNING",
    message: `${conversionsLast7Days} نتيجة خلال آخر 7 أيام - محتاجة ${gapNeeded} نتيجة إضافية عشان توصل للـ${TIKTOK_RESULTS_NEEDED} المطلوبين وتخرج من فترة التعلّم بثبات.`,
  };
}

export async function syncTikTokLearningPhaseForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };
  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fromStr = sevenDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const params = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_ADGROUP",
        dimensions: JSON.stringify(["adgroup_id"]),
        metrics: JSON.stringify(["adgroup_name", "conversion"]),
        filtering: JSON.stringify([
          { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
        ]),
        start_date: fromStr,
        end_date: todayStr,
        page_size: "1000",
      });

      const res = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`,
        { headers }
      );
      const data = await res.json();
      if (data.code !== 0) continue;

      const { pushToActionFeed } = await import("@/lib/actionFeed");

      for (const row of data.data?.list ?? []) {
        const adGroupId = String(row.dimensions?.adgroup_id);
        const m = row.metrics ?? {};
        const result = estimateTikTokLearningPhase(adGroupId, m.adgroup_name ?? null, Number(m.conversion ?? 0));

        if (result.status === "LEARNING_LIMITED") {
          await pushToActionFeed({
            workspaceId,
            type: "ALERT",
            severity: "MEDIUM",
            title: `${result.adGroupName ?? adGroupId}: بعيدة عن الخروج من فترة التعلّم`,
            description: result.message,
          });
        }
      }
    } catch (err) {
      console.error(`فشلت مزامنة فترة التعلّم لحساب تيك توك ${advertiserId}:`, err);
    }
  }
}

// ==================== جودة Lookalike Audience (تيك توك) ====================
// "الجمهور المتشابه بتاعي بيجيب أرخص عميل حقيقي فعلاً؟" - عبر endpoints
// رسمية مؤكدة (/dmp/custom_audience/list، /dmp/custom_audience/get من
// GitHub SDK الرسمي)، بس بنفس مستوى الثقة المتوسط بتاع Cost Cap - اسم
// الحقل اللي بيربط المجموعة الإعلانية بالجمهور (audience_ids) مستنتج
// من سياق التوثيق، مش موثّق حرفياً بنفس دقة حقول تانية اتأكدنا منها.
export async function syncTikTokLookalikeComparisonForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };
  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      // 1) بنجيب كل الجماهير المخصصة، ونحدد أنهي واحد فيهم Lookalike فعلاً
      const audiencesRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/dmp/custom_audience/list/` +
          `?advertiser_id=${advertiserId}&page_size=100`,
        { headers }
      );
      const audiencesData = await audiencesRes.json();
      if (audiencesData.code !== 0) continue;

      const lookalikeIds = new Set(
        (audiencesData.data?.list ?? [])
          .filter((a: any) => a.audience_type === "LOOKALIKE" || a.audience_sub_type === "LOOKALIKE")
          .map((a: any) => String(a.audience_id))
      );
      if (lookalikeIds.size === 0) continue; // مفيش Lookalike أصلاً في الحساب ده

      // 2) بنجيب المجموعات الإعلانية، ونشوف أنهي منهم مستخدم جمهور Lookalike
      const adGroupsRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/adgroup/get/` +
          `?advertiser_id=${advertiserId}&filtering=${encodeURIComponent(JSON.stringify({ campaign_ids: campaignIds }))}&page_size=100`,
        { headers }
      );
      const adGroupsData = await adGroupsRes.json();
      if (adGroupsData.code !== 0) continue;

      const lookalikeAdGroupIds: string[] = [];
      const otherAdGroupIds: string[] = [];
      for (const ag of adGroupsData.data?.list ?? []) {
        const audienceIds: string[] = (ag.audience_ids ?? []).map(String);
        const usesLookalike = audienceIds.some((id) => lookalikeIds.has(id));
        (usesLookalike ? lookalikeAdGroupIds : otherAdGroupIds).push(String(ag.adgroup_id));
      }
      if (lookalikeAdGroupIds.length === 0) continue;

      // 3) بنجيب الأداء الحقيقي للمجموعتين، ونقارن
      async function getGroupCpa(adGroupIds: string[]): Promise<{ cost: number; conversions: number }> {
        if (adGroupIds.length === 0) return { cost: 0, conversions: 0 };
        const params = new URLSearchParams({
          advertiser_id: advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_ADGROUP",
          dimensions: JSON.stringify(["adgroup_id"]),
          metrics: JSON.stringify(["spend", "conversion"]),
          filtering: JSON.stringify([
            { field_name: "adgroup_ids", filter_type: "IN", filter_value: JSON.stringify(adGroupIds) },
          ]),
          start_date: fromStr,
          end_date: todayStr,
          page_size: "1000",
        });
        const res = await fetch(
          `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`,
          { headers }
        );
        const data = await res.json();
        let cost = 0, conversions = 0;
        for (const row of data.data?.list ?? []) {
          cost += Number(row.metrics?.spend ?? 0);
          conversions += Number(row.metrics?.conversion ?? 0);
        }
        return { cost, conversions };
      }

      const lookalikeStats = await getGroupCpa(lookalikeAdGroupIds);
      const otherStats = await getGroupCpa(otherAdGroupIds);

      const lookalikeCpa = lookalikeStats.conversions > 0 ? lookalikeStats.cost / lookalikeStats.conversions : null;
      const otherCpa = otherStats.conversions > 0 ? otherStats.cost / otherStats.conversions : null;

      if (lookalikeCpa !== null && otherCpa !== null && lookalikeStats.conversions >= 5 && otherStats.conversions >= 5) {
        const diffPct = Math.round(((lookalikeCpa - otherCpa) / otherCpa) * 100);
        if (diffPct > 20) {
          const { pushToActionFeed } = await import("@/lib/actionFeed");
          await pushToActionFeed({
            workspaceId,
            type: "ALERT",
            severity: "MEDIUM",
            title: "الجمهور المتشابه أغلى من باقي الاستهداف",
            description: `تكلفة العميل عبر Lookalike (${Math.round(lookalikeCpa)}) أعلى بـ${diffPct}% من باقي الاستهداف (${Math.round(otherCpa)}) - يستاهل مراجعة جودة مصدر الـLookalike.`,
          });
        }
      }
    } catch (err) {
      console.error(`فشلت مقارنة Lookalike لحساب تيك توك ${advertiserId}:`, err);
    }
  }
}

// ==================== جودة التعليقات - جزء من تحليل Spark Ads فقط ====================
// "التفاعل العضوي اللي راكمه البوست قبل التعزيز بيأثر إيجاباً على الأداء؟"
// - بند 12 من قائمة تيك توك. مربوطة عمداً بـSpark Ads بس (مش مراقبة
// تعليقات عامة/مودريشن)، لأن التعليقات هنا جزء من "المنتج" نفسه في
// Spark Ads، مش موضوع سمعة منفصل - بالضبط زي ما اتفقنا.
//
// صفر AI بقرار صريح - قواعد ثابتة (regex) بس لكشف السبام، مش تصنيف
// مشاعر أو أي نموذج لغوي. أبسط وأرخص وأكثر قابلية للتفسير من AI هنا،
// وكافي لهدف "نسبة سبام تقريبية" بدل تحليل مشاعر دقيق.
const SPAM_PATTERNS = [
  /https?:\/\/|www\.|\.(com|net|shop)\b/i, // روابط
  /(.)\1{5,}/, // تكرار حرف واحد أكتر من 5 مرات ("!!!!!!" أو "اااااا")
  /\b(?:whatsapp|واتساب|تواصل معايا|DM me|click here|دخل هنا)\b/i,
  /\+?\d{8,}/, // أرقام هاتف طويلة داخل التعليق
];

function isLikelySpamComment(text: string): boolean {
  return SPAM_PATTERNS.some((pattern) => pattern.test(text));
}

export async function syncTikTokSparkAdsCommentsForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };

  // بس الإعلانات المصنّفة Spark Ads فعلاً - مش كل الإعلانات، زي ما اتفقنا
  const sparkAds = await prisma.tikTokVideoMetricSnapshot.findMany({
    where: {
      workspaceId,
      identityType: { in: ["AUTH_CODE", "TT_USER"] },
    },
  });

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  const advertiserId = links[0]?.externalAccountId;
  if (!advertiserId) return;

  for (const ad of sparkAds) {
    try {
      const commentsRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/comment/list/` +
          `?advertiser_id=${advertiserId}&ad_id=${ad.adId}&page_size=100`,
        { headers }
      );
      const commentsData = await commentsRes.json();
      if (commentsData.code !== 0) continue;

      const comments = commentsData.data?.comments ?? [];
      const flaggedCount = comments.filter((c: any) => isLikelySpamComment(c.text ?? "")).length;

      await prisma.tikTokVideoMetricSnapshot.update({
        where: { workspaceId_adId: { workspaceId, adId: ad.adId } },
        data: { totalComments: comments.length, flaggedComments: flaggedCount },
      });
    } catch (err) {
      console.error(`فشلت مزامنة تعليقات Spark Ad ${ad.adId}:`, err);
    }
  }
}

// ==================== فورم الليد المدمج (Lead Generation) - تيك توك ====================
// "جودة العملاء من فورم تيك توك المدمج؟" - نفس فكرة Instant Forms بتاعة
// ميتا، لكن بمنهج مختلف: بدل ويب هوك (اللي التأكيد الرسمي عليه أضعف من
// المصادر اللي راجعناها)، بنستخدم نمط سحب دوري (polling) عبر endpoint
// مؤكد (leadgen/getLeads) - نفس النمط المستخدم في كل مزامنات تيك توك
// التانية النهاردة. ملاحظة أمانة: تيك توك بتحتفظ ببيانات الليد 90 يوم بس.
export async function syncTikTokLeadFormsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };
  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  for (const [advertiserId] of Object.entries(byAccount)) {
    try {
      // بنجيب قايمة الفورمز الأول - محتاجين form_id لكل نداء ليدز بعده
      const formsRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/page/form/list/` +
          `?advertiser_id=${advertiserId}&page_size=50`,
        { headers }
      );
      const formsData = await formsRes.json();
      if (formsData.code !== 0) continue;

      for (const form of formsData.data?.list ?? []) {
        const formId = String(form.page_id ?? form.form_id);

        const leadsRes = await fetch(
          `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/leadgen/get/` +
            `?advertiser_id=${advertiserId}&form_id=${formId}&page_size=100`,
          { headers }
        );
        const leadsData = await leadsRes.json();
        if (leadsData.code !== 0) continue;

        for (const lead of leadsData.data?.leads ?? []) {
          const leadgenId = String(lead.leadgen_id ?? lead.id);

          await prisma.leadFormSubmission.upsert({
            where: { leadgenId },
            create: {
              workspaceId,
              platform: "TIKTOK_ADS",
              leadgenId,
              formId,
              adId: lead.ad_id ? String(lead.ad_id) : null,
              campaignId: lead.campaign_id ? String(lead.campaign_id) : null,
              submittedAt: lead.create_time ? new Date(lead.create_time) : new Date(),
              fieldData: JSON.stringify(lead.field_data ?? lead.answers ?? []),
            },
            update: {}, // الليد موجود من قبل، مش هنكرر أو نعدّل بيانات وصلت خلاص
          });
        }
      }
    } catch (err) {
      console.error(`فشلت مزامنة فورم الليد لحساب تيك توك ${advertiserId}:`, err);
    }
  }
}

// ==================== أداء الإعلان الفردي (CreativeSnapshot) - تيك توك ====================
// اكتشاف مهم: تيك توك مكنتش بتغذّي جدول CreativeSnapshot خالص - يعني
// إعلانات تيك توك ماكانتش جزء من محرك Scale/Kill/Watch أو صفحة "أداء
// الإعلانات الفردية" من الأساس. هنا بنسدّ الفجوة + نضيف قيمة التحويل
// (total_purchase_value - ثقة متوسطة-عالية، مصادر متقاربة مش توثيق
// رسمي مباشر زي ميتا) عشان تيك توك تدخل حساب ROAS كمان.
export async function syncTikTokCreativesForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };
  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const params = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "ad_name", "impressions", "clicks", "spend", "conversion", "total_purchase_value",
        ]),
        filtering: JSON.stringify([
          { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
        ]),
        start_date: fromStr,
        end_date: todayStr,
        page_size: "1000",
      });

      const res = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/?${params.toString()}`,
        { headers }
      );
      const data = await res.json();
      if (data.code !== 0) {
        console.error(`فشلت مزامنة أداء إعلانات تيك توك للحساب ${advertiserId}:`, data.message);
        continue;
      }

      const fallbackCampaignId = campaignIds[0];

      for (const row of data.data?.list ?? []) {
        const adId = String(row.dimensions?.ad_id);
        const date = new Date(row.dimensions?.stat_time_day);
        const m = row.metrics ?? {};

        await prisma.creativeSnapshot.upsert({
          where: {
            workspaceId_platform_campaignId_adId_date: {
              workspaceId, platform: "TIKTOK_ADS", campaignId: fallbackCampaignId, adId, date,
            },
          },
          create: {
            workspaceId, platform: "TIKTOK_ADS", campaignId: fallbackCampaignId, adId,
            adName: m.ad_name ?? null, creativeType: "VIDEO",
            date,
            impressions: Number(m.impressions ?? 0),
            clicks: Number(m.clicks ?? 0),
            cost: Number(m.spend ?? 0),
            rawConversions: Number(m.conversion ?? 0),
            conversionsValue: Number(m.total_purchase_value ?? 0),
          },
          update: {
            adName: m.ad_name ?? null,
            impressions: Number(m.impressions ?? 0),
            clicks: Number(m.clicks ?? 0),
            cost: Number(m.spend ?? 0),
            rawConversions: Number(m.conversion ?? 0),
            conversionsValue: Number(m.total_purchase_value ?? 0),
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة أداء إعلانات تيك توك للحساب ${advertiserId}:`, err);
    }
  }
}

// ==================== نصيحة تدرّج استراتيجية المزايدة - تيك توك ====================
// نفس مبدأ جوجل وميتا، بس أرقام تيك توك مختلفة (بحث مؤكد من مصادر
// متعددة متفقة تماماً): Maximum Delivery/Lowest Cost → Cost Cap لما
// توصل **50 حدث تحويل** (نفس رقم ميتا تقريباً، مختلف عن جوجل 30).
// نفس هامش الأمان (15%) فوق المتوسط الفعلي - مصادر تيك توك مأكدتش رقم
// مختلف بدقة عن ميتا، فاستخدمنا نفس المنطق المحافظ.
const TIKTOK_MIN_CONVERSIONS_FOR_COST_CAP = 50;
const TIKTOK_COST_CAP_SAFETY_MARGIN_PCT = 15;

export async function checkTikTokBidStrategyProgressionForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "TIKTOK_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) return;

  const accessToken = decryptToken(connection.accessToken);
  const headers = { "Access-Token": accessToken, "Content-Type": "application/json" };
  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const { pushToActionFeed } = await import("@/lib/actionFeed");

  for (const [advertiserId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const adGroupsRes = await fetch(
        `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/adgroup/get/` +
          `?advertiser_id=${advertiserId}&filtering=${encodeURIComponent(JSON.stringify({ campaign_ids: campaignIds }))}&page_size=100`,
        { headers }
      );
      const adGroupsData = await adGroupsRes.json();
      if (adGroupsData.code !== 0) continue;

      for (const adGroup of adGroupsData.data?.list ?? []) {
        if (adGroup.bid_type && adGroup.bid_type !== "BID_TYPE_NO_BID") continue;

        const adGroupId = String(adGroup.adgroup_id);
        const insightsRes = await fetch(
          `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/report/integrated/get/` +
            `?advertiser_id=${advertiserId}&report_type=BASIC&data_level=AUCTION_ADGROUP` +
            `&dimensions=${encodeURIComponent(JSON.stringify(["adgroup_id"]))}` +
            `&metrics=${encodeURIComponent(JSON.stringify(["spend", "conversion"]))}` +
            `&filtering=${encodeURIComponent(JSON.stringify([{ field_name: "adgroup_ids", filter_type: "IN", filter_value: JSON.stringify([adGroupId]) }]))}` +
            `&start_date=${fromStr}&end_date=${todayStr}`,
          { headers }
        );
        const insightsData = await insightsRes.json();
        const row = insightsData.data?.list?.[0]?.metrics;
        const conversions = Number(row?.conversion ?? 0);
        const spend = Number(row?.spend ?? 0);

        if (conversions < TIKTOK_MIN_CONVERSIONS_FOR_COST_CAP || spend <= 0) continue;

        const avgCpa = spend / conversions;
        const suggestedCostCap = Math.round(avgCpa * (1 + TIKTOK_COST_CAP_SAFETY_MARGIN_PCT / 100));

        const cooldownStart = new Date();
        cooldownStart.setDate(cooldownStart.getDate() - 14);
        const recentSimilar = await prisma.actionFeedItem.findFirst({
          where: { workspaceId, title: { contains: adGroup.adgroup_name ?? adGroupId }, createdAt: { gte: cooldownStart } },
        });
        if (recentSimilar) continue;

        await pushToActionFeed({
          workspaceId,
          type: "SUGGESTION",
          severity: "MEDIUM",
          title: `${adGroup.adgroup_name ?? adGroupId}: جاهزة لتحديد Cost Cap`,
          description: `${conversions} تحويل بمتوسط تكلفة ${Math.round(avgCpa)} - نقترح Cost Cap عند ${suggestedCostCap} (فوق متوسطك الفعلي بـ${TIKTOK_COST_CAP_SAFETY_MARGIN_PCT}%).`,
          linkUrl: "/dashboard/diagnostics",
          actionType: "SET_BID_STRATEGY_TIKTOK",
          actionPayload: { advertiserId, adGroupId, bidPrice: suggestedCostCap, changePct: TIKTOK_COST_CAP_SAFETY_MARGIN_PCT },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة نصيحة تدرّج المزايدة لحساب تيك توك ${advertiserId}:`, err);
    }
  }
}

// ==================== تنفيذ حقيقي - تعديل استراتيجية مزايدة تيك توك فعلياً ====================
// عملية كتابة حقيقية - POST مباشر لمجموعة إعلانية حقيقية عند تيك توك.
export async function applyTikTokBidStrategyChange(
  workspaceId: string,
  advertiserId: string,
  adGroupId: string,
  bidPrice: number
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) throw new Error("حساب تيك توك مش متصل");

  const res = await fetch(`https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/adgroup/update/`, {
    method: "POST",
    headers: {
      "Access-Token": decryptToken(connection.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      adgroup_id: adGroupId,
      bid_type: "BID_TYPE_CUSTOM",
      conversion_bid_price: bidPrice,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`فشل تعديل استراتيجية المزايدة عند تيك توك: ${data.message}`);
  }
}

// ==================== تنفيذ حقيقي - إيقاف إعلان فردي عند تيك توك ====================
// ثقة متوسطة (SDK الرسمي بيؤكد وجود endpoint "Ad Status Update" وحقل
// opt_status، بس المسار الدقيق مبني على نمط باقي endpoints تيك توك -
// محتاج تأكيد بأول ربط حقيقي زي حقول تيك توك التانية في المشروع)
export async function pauseTikTokAd(workspaceId: string, advertiserId: string, adId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "TIKTOK_ADS"
  );
  if (!connection) throw new Error("حساب تيك توك مش متصل");

  const res = await fetch(`https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/ad/status/update/`, {
    method: "POST",
    headers: {
      "Access-Token": decryptToken(connection.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      ad_ids: [adId],
      opt_status: "DISABLE",
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`فشل إيقاف الإعلان عند تيك توك: ${data.message}`);
  }
}
