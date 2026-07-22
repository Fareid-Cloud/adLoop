// lib/syncGoogleAds.ts
//
// بيتشغل يومياً (عن طريق cron job - Vercel Cron مثلاً) لكل Workspace،
// بيسحب أداء الكامبينز المختارة بس، ويحطها في MetricSnapshot.
// بعد كده بيدمج معاها الـ verifiedConversions من نظام تتبع الواتساب
// (المشروع اللي بنيناه الأول - wa-conversion-tracker).
//
// نفس الدالة بتخدم غرضين: المزامنة اليومية (يوم واحد بس) واسترجاع
// البيانات القديمة (Backfill) لأول مرة يربط فيها المستخدم حساب فيه
// كامبينز شغالة من زمان - مش هيبدأ من صفر، هيجيب تاريخها الفعلي.

import { GoogleAdsApi } from "google-ads-api";
import { prisma } from "@/lib/prisma";
import type { CampaignLink, ConnectedPlatform } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";

// حقول جودة الإعلان بترجع من Google API كـ enum (رقم/سلسلة)، وحقول Prisma
// نوعها String? - بنحوّلها لنص، ونسيب null زي ما هي
const enumToStr = (v: unknown): string | null => (v == null ? null : String(v));

export async function syncGoogleAdsForWorkspace(
  workspaceId: string,
  dateRange?: { from: string; to: string } // YYYY-MM-DD - لو مش موجودة، بتتزامن "إمبارح" بس (المزامنة اليومية العادية)
) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const from = dateRange?.from ?? yesterdayStr;
  const to = dateRange?.to ?? yesterdayStr;

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    // استعلام واحد بمدى تاريخ كامل (مش لوب على كل يوم لوحده) - جوجل
    // بترجع صف لكل يوم لكل كامبين تلقائياً لو استخدمنا segments.date
    // في نطاق زمني، وده أسرع وأقل استهلاكاً لحصة الـ API من تكرار الاستعلام
    const rows = await customer.query(`
      SELECT
        campaign.id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.id IN (${campaignIds.join(",")})
    `);

    for (const row of rows) {
      const campaignId = String(row.campaign?.id);
      const rowDate = String(row.segments?.date);

      const verifiedCount = await getVerifiedConversionsCount(campaignId, rowDate);

      await prisma.metricSnapshot.upsert({
        where: {
          workspaceId_platform_campaignId_date_placementBreakdown_placementDetail: {
            workspaceId,
            platform: "GOOGLE_ADS",
            campaignId,
            date: new Date(rowDate),
            placementBreakdown: "ALL",
            placementDetail: "ALL",
          },
        },
        create: {
          workspaceId,
          platform: "GOOGLE_ADS",
          campaignId,
          date: new Date(rowDate),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          rawConversions: Number(row.metrics?.conversions ?? 0),
          verifiedConversions: verifiedCount,
        },
        update: {
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          rawConversions: Number(row.metrics?.conversions ?? 0),
          // ملاحظة: لو ده Backfill لبيانات قديمة، مفيش verified conversions
          // حقيقية من واتساب لتواريخ قبل ما نظام التتبع يتفعّل - بنسيب
          // القيمة القديمة المخزنة زي ما هي بدل ما نصفّرها بالغلط
        },
      });
    }
  }
}

// بتُستدعى مرة واحدة بس - أول ما المستخدم يربط كامبينز فيها تاريخ فعلي،
// عشان الحساب ميبدأش من صفر. بيانات العميل القديمة أهم حاجة عندنا،
// مش تفصيلة ثانوية - فبنسحب أقصى مدى تسمح بيه جوجل نفسها فعلياً.
//
// الحد الحقيقي (مش افتراض مني): جوجل حدّدت من يونيو 2026 إن البيانات
// اليومية التفصيلية متاحة عن طريق الـ API لـ 37 شهر بس (بعدها البيانات
// المتاحة شهرية/سنوية مجمّعة، مش يومية) - فده أقصى مدى فعلي ممكن نطلبه،
// مش رقم تعسفي. المدى بيتقسّم لدفعات كل واحدة 6 شهور، بتتنفذ بالتتابع
// (مش كلها مرة واحدة) عشان نتجنب استعلام ضخم واحد ممكن يفشل أو يبطّئ.
export async function backfillHistoricalData(workspaceId: string) {
  const MAX_MONTHS = 37;
  const CHUNK_MONTHS = 6;

  const overallTo = new Date();
  overallTo.setDate(overallTo.getDate() - 1);

  const overallFrom = new Date();
  overallFrom.setMonth(overallFrom.getMonth() - MAX_MONTHS);

  let chunkTo = new Date(overallTo);

  while (chunkTo > overallFrom) {
    const chunkFrom = new Date(chunkTo);
    chunkFrom.setMonth(chunkFrom.getMonth() - CHUNK_MONTHS);
    const effectiveFrom = chunkFrom < overallFrom ? overallFrom : chunkFrom;

    await syncGoogleAdsForWorkspace(workspaceId, {
      from: effectiveFrom.toISOString().slice(0, 10),
      to: chunkTo.toISOString().slice(0, 10),
    });

    chunkTo = new Date(effectiveFrom);
    chunkTo.setDate(chunkTo.getDate() - 1);
  }
}

// ==================== أداء مستوى الإعلان الفردي (Creative-Level) ====================
// بتسحب أداء كل إعلان لوحده (مش تجميع على مستوى الحملة). ملاحظة مهمة:
// جوجل بتدّي أداء "الإعلان ككل" بشكل موثوق، لكن أداء كل عنصر فرعي جوه
// الإعلان (عنوان معين من ضمن 15 عنوان في Responsive Search Ad مثلاً)
// مش متاح بشكل موثوق حتى من جوجل نفسها لمعظم أنواع الإعلانات - قيد حقيقي
// من المنصة، مش قصور في الكود.
export async function syncCreativesForWorkspace(
  workspaceId: string,
  dateRange?: { from: string; to: string }
) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const from = dateRange?.from ?? yesterdayStr;
  const to = dateRange?.to ?? yesterdayStr;

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    const rows = await customer.query(`
      SELECT
        campaign.id,
        ad_group.id,
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.type,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.image_ad.image_url,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.id IN (${campaignIds.join(",")})
        AND ad_group_ad.status != 'REMOVED'
    `);

    for (const row of rows) {
      const campaignId = String(row.campaign?.id);
      const adGroupId = String(row.ad_group?.id ?? "");
      const adId = String(row.ad_group_ad?.ad?.id);
      const rowDate = String(row.segments?.date);
      const adType = String(row.ad_group_ad?.ad?.type ?? "");

      // العنوان التمثيلي - أول عنوان متاح في القائمة لو Responsive Search Ad،
      // مش كل العناوين (نفس القيد اللي شرحناه فوق)
      const headlines = row.ad_group_ad?.ad?.responsive_search_ad?.headlines as
        | Array<{ text?: string }>
        | undefined;
      const headline = headlines?.[0]?.text ?? null;
      const thumbnailUrl = row.ad_group_ad?.ad?.image_ad?.image_url ?? null;
      const finalUrls = row.ad_group_ad?.ad?.final_urls as string[] | undefined;
      const finalUrl = finalUrls?.[0] ?? null;

      await prisma.creativeSnapshot.upsert({
        where: {
          workspaceId_platform_campaignId_adId_date: {
            workspaceId, platform: "GOOGLE_ADS", campaignId, adId, date: new Date(rowDate),
          },
        },
        create: {
          workspaceId, platform: "GOOGLE_ADS", campaignId, adId, adGroupId,
          adName: row.ad_group_ad?.ad?.name ?? null,
          creativeType: mapAdType(adType),
          headline, thumbnailUrl, finalUrl,
          date: new Date(rowDate),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          rawConversions: Number(row.metrics?.conversions ?? 0),
          conversionsValue: Number(row.metrics?.conversions_value ?? 0),
        },
        update: {
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          rawConversions: Number(row.metrics?.conversions ?? 0),
          conversionsValue: Number(row.metrics?.conversions_value ?? 0),
          finalUrl, // ممكن يتغيّر لو المستخدم عدّل رابط الوجهة في جوجل نفسها
        },
      });
    }
  }
}

// ==================== مصطلحات البحث الفعلية (Search Terms) ====================
export async function syncSearchTermsForWorkspace(
  workspaceId: string,
  dateRange?: { from: string; to: string }
) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const from = dateRange?.from ?? yesterdayStr;
  const to = dateRange?.to ?? yesterdayStr;

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    const rows = await customer.query(`
      SELECT
        campaign.id,
        search_term_view.search_term,
        segments.keyword.info.text,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.id IN (${campaignIds.join(",")})
    `);

    for (const row of rows) {
      const campaignId = String(row.campaign?.id);
      const searchTerm = String(row.search_term_view?.search_term ?? "");
      const rowDate = String(row.segments?.date);
      if (!searchTerm) continue;

      await prisma.searchTermSnapshot.upsert({
        where: {
          workspaceId_campaignId_searchTerm_date: {
            workspaceId, campaignId, searchTerm, date: new Date(rowDate),
          },
        },
        create: {
          workspaceId, campaignId, searchTerm,
          matchedKeyword: row.segments?.keyword?.info?.text ?? null,
          date: new Date(rowDate),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          conversions: Number(row.metrics?.conversions ?? 0),
        },
        update: {
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          conversions: Number(row.metrics?.conversions ?? 0),
        },
      });
    }
  }
}

// ==================== منطقية استراتيجية المزايدة ====================
// السؤال: "أنا حاطط Target CPA في جوجل بـ50 جنيه - لسه الرقم ده منطقي
// بناءً على تكلفة العميل الحقيقية الفعلية عندي، ولا المنصة بتحسّن نحو
// رقم بعيد عن الواقع؟" - جوجل بتحسّن نحو الهدف اللي انت حطيته، مش نحو
// الحقيقة، فلو الهدف نفسه غلط، التحسين كله غلط من الأساس.
export async function syncBiddingStrategyForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return [];

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return [];

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);
  const results: Array<{
    campaignId: string; biddingStrategyType: string;
    targetCpa: number | null; targetRoas: number | null;
  }> = [];

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    // بنجيب الهدف من أي مكان ممكن يكون متسجّل فيه (TargetCpa المباشرة، أو
    // MaximizeConversions اللي حاطط عليها هدف) - نفس المبدأ لـ ROAS
    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.bidding_strategy_type,
        campaign.target_cpa.target_cpa_micros,
        campaign.maximize_conversions.target_cpa_micros,
        campaign.target_roas.target_roas,
        campaign.maximize_conversion_value.target_roas
      FROM campaign
      WHERE campaign.id IN (${campaignIds.join(",")})
        AND campaign.status != 'REMOVED'
    `);

    for (const row of rows) {
      const targetCpaMicros =
        row.campaign?.target_cpa?.target_cpa_micros ?? row.campaign?.maximize_conversions?.target_cpa_micros;
      const targetRoas =
        row.campaign?.target_roas?.target_roas ?? row.campaign?.maximize_conversion_value?.target_roas;

      results.push({
        campaignId: String(row.campaign?.id),
        biddingStrategyType: String(row.campaign?.bidding_strategy_type ?? ""),
        targetCpa: targetCpaMicros ? Number(targetCpaMicros) / 1_000_000 : null,
        targetRoas: targetRoas ? Number(targetRoas) : null,
      });
    }
  }

  return results;
}

// ==================== أداء شرائح الجمهور ====================
// قيد حقيقي من جوجل نفسها (اتأكدت منه بالبحث): بيانات الجمهور موثوقة بس
// لحملات Display/YouTube/RLSA. حملات Search العادية الجمهور فيها "مراقبة"
// بس (مش استهداف مقيّد)، فالـ API بترجع بيانات فاضية ليها - مش قصور في
// الكود، قيد في المنصة نفسها. الدالة دي بترجع بس اللي فعلاً موجود، وبتوضح
// أي حملة اتفحصت وأي حملة اتخطّت.
export async function syncAudiencePerformanceForWorkspace(
  workspaceId: string,
  dateRange?: { from: string; to: string }
) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return { synced: [], skipped: [] };

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return { synced: [], skipped: [] };

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const from = dateRange?.from ?? yesterdayStr;
  const to = dateRange?.to ?? yesterdayStr;

  const synced: string[] = [];
  const skipped: string[] = [];

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    // campaign_audience_view بترجع صفوف بس للحملات اللي فعلاً عندها
    // بيانات جمهور موثوقة - مش هنفلتر بأنفسنا نوع الحملة مقدماً، بنسيب
    // الـ API نفسها ترجع اللي عندها بيانات فعلياً بس
    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign_criterion.criterion_id,
        campaign_criterion.type,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign_audience_view
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.id IN (${campaignIds.join(",")})
    `);

    const campaignsWithData = new Set<string>();

    for (const row of rows) {
      const campaignId = String(row.campaign?.id);
      campaignsWithData.add(campaignId);

      await prisma.audienceSegmentSnapshot.upsert({
        where: {
          workspaceId_campaignId_criterionId_date: {
            workspaceId, campaignId,
            criterionId: String(row.campaign_criterion?.criterion_id),
            date: new Date(String(row.segments?.date)),
          },
        },
        create: {
          workspaceId, campaignId,
          criterionId: String(row.campaign_criterion?.criterion_id),
          criterionType: String(row.campaign_criterion?.type ?? ""),
          date: new Date(String(row.segments?.date)),
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          conversions: Number(row.metrics?.conversions ?? 0),
        },
        update: {
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          conversions: Number(row.metrics?.conversions ?? 0),
        },
      });
    }

    for (const campaignId of campaignIds) {
      if (campaignsWithData.has(campaignId)) synced.push(campaignId);
      else skipped.push(campaignId); // على الأغلب حملة Search عادية - قيد منصة، مش خطأ
    }
  }

  return { synced, skipped };
}

// ==================== مكوّنات درجة الجودة (Quality Score) ====================
// "الجودة منخفضة" مش إجابة كافية - اتأكدنا من مصادر متعددة إن الـ API
// بيدّي 4 مكوّنات منفصلة عن طريق keyword_view: الدرجة الكلية، صلة
// الإعلان (creative_quality_score)، تجربة صفحة الهبوط (post_click)،
// ونسبة النقر المتوقعة (search_predicted_ctr) - كل واحد بيحدد السبب
// الفعلي بالتحديد بدل ما نقول "حسّن الجودة" من غير توجيه.
export async function syncQualityScoreForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    // بنستبعد الكلمات اللي معندهاش درجة جودة لسه (حديثة جداً أو ظهور
    // قليل - جوجل ماحسبتش الدرجة بعد، مش صفر حقيقي)
    const rows = await customer.query(`
      SELECT
        campaign.id,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr
      FROM keyword_view
      WHERE campaign.id IN (${campaignIds.join(",")})
        AND ad_group_criterion.status = 'ENABLED'
        AND ad_group_criterion.quality_info.quality_score IS NOT NULL
    `);

    for (const row of rows) {
      const campaignId = String(row.campaign?.id);
      const criterionId = String(row.ad_group_criterion?.criterion_id);

      await prisma.qualityScoreSnapshot.upsert({
        where: {
          workspaceId_campaignId_criterionId: { workspaceId, campaignId, criterionId },
        },
        create: {
          workspaceId, campaignId, criterionId,
          keywordText: row.ad_group_criterion?.keyword?.text ?? null,
          qualityScore: row.ad_group_criterion?.quality_info?.quality_score ?? null,
          // المكوّنات الفرعية بترجع كـ enum نصي (ABOVE_AVERAGE/AVERAGE/BELOW_AVERAGE)
          // مش رقم - جوجل بتخفي الدقة الفعلية، بتدّي تصنيف بس
          adRelevance: enumToStr(row.ad_group_criterion?.quality_info?.creative_quality_score),
          landingPageExperience: enumToStr(row.ad_group_criterion?.quality_info?.post_click_quality_score),
          expectedCtr: enumToStr(row.ad_group_criterion?.quality_info?.search_predicted_ctr),
        },
        update: {
          qualityScore: row.ad_group_criterion?.quality_info?.quality_score ?? null,
          adRelevance: enumToStr(row.ad_group_criterion?.quality_info?.creative_quality_score),
          landingPageExperience: enumToStr(row.ad_group_criterion?.quality_info?.post_click_quality_score),
          expectedCtr: enumToStr(row.ad_group_criterion?.quality_info?.search_predicted_ctr),
        },
      });
    }
  }
}

// ==================== أداء المنتجات (Shopping/Merchant Center) ====================
// بنستخدم shopping_product (جوه Google Ads API نفسها) مش Content API
// القديم لـ Shopping - ده بيتقفل نهائياً 18 أغسطس 2026 (اتأكدنا بالبحث)،
// أقل من شهر من وقت بناء الميزة دي. shopping_product فيها حقل "issues"
// بيوضح سبب رفض/تقييد المنتج بالتحديد، مش بس أرقام أداء.
export async function syncShoppingProductsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);

  for (const [accountId] of Object.entries(byAccount)) {
    try {
      const customer = client.Customer({
        customer_id: accountId,
        login_customer_id: connection.managerAccountId!,
        refresh_token: decryptToken(connection.refreshToken!),
      });

      // لو الحساب مش مربوط بـ Merchant Center خالص، الاستعلام ده بيرجع
      // نتيجة فاضية بهدوء (مش خطأ) - بنتعامل معاها كـ "مفيش بيانات تسوق"
      const rows = await customer.query(`
        SELECT
          shopping_product.item_id,
          shopping_product.feed_label,
          shopping_product.title,
          shopping_product.issues,
          metrics.clicks,
          metrics.impressions,
          metrics.conversions,
          metrics.cost_micros
        FROM shopping_product
        WHERE segments.date >= '${fromStr}'
      `);

      for (const row of rows) {
        const itemId = String(row.shopping_product?.item_id ?? "");
        if (!itemId) continue;

        const issues = row.shopping_product?.issues ?? [];
        const hasIssues = Array.isArray(issues) && issues.length > 0;

        await prisma.shoppingProductSnapshot.upsert({
          where: { workspaceId_accountId_itemId: { workspaceId, accountId, itemId } },
          create: {
            workspaceId, accountId, itemId,
            title: row.shopping_product?.title ?? null,
            feedLabel: row.shopping_product?.feed_label ?? null,
            hasIssues,
            issuesDetail: hasIssues ? JSON.stringify(issues) : null,
            clicks: Number(row.metrics?.clicks ?? 0),
            impressions: Number(row.metrics?.impressions ?? 0),
            conversions: Number(row.metrics?.conversions ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          },
          update: {
            title: row.shopping_product?.title ?? null,
            hasIssues,
            issuesDetail: hasIssues ? JSON.stringify(issues) : null,
            clicks: Number(row.metrics?.clicks ?? 0),
            impressions: Number(row.metrics?.impressions ?? 0),
            conversions: Number(row.metrics?.conversions ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
          },
        });
      }
    } catch (err) {
      // حساب من غير Merchant Center مربوط هيرمي خطأ هنا - بنسجله ونكمل،
      // مش كل الـ Workspaces عندها حملات تسوق أصلاً
      console.error(`فشلت مزامنة منتجات التسوق للحساب ${accountId} (على الأرجح مفيش Merchant Center مربوط):`, err);
    }
  }
}

// ==================== قناة إنفاق Performance Max الفعلية ====================
// PMax تاريخياً كانت "صندوق أسود" - segments.ad_network_type كانت بترجع
// MIXED دايماً. من إصدار v23 (يناير 2026، اتأكدنا من بلوج جوجل الرسمي)
// بقت بترجع القناة الفعلية (بحث، شركاء بحث، Gmail، يوتيوب، Display،
// Discover، Maps) - أول مرة نعرف فيها PMax بتصرف فلوسنا فين بالتحديد.
//
// قيد موثّق مهم: البيانات المفصّلة دي متاحة بس لتواريخ من 1 يونيو 2025
// فصاعداً - أي طلب لتاريخ أقدم من كده هيرجع فاضي أو MIXED.
export async function syncPerformanceMaxChannelsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  // القيد الموثّق - مفيش داعي نطلب قبل 1 يونيو 2025 خالص، هيرجع فاضي
  const CHANNEL_DATA_START = "2025-06-01";
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10) > CHANNEL_DATA_START
    ? thirtyDaysAgo.toISOString().slice(0, 10)
    : CHANNEL_DATA_START;

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const rows = await customer.query(`
        SELECT
          campaign.id,
          segments.ad_network_type,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE campaign.id IN (${campaignIds.join(",")})
          AND campaign.advertising_channel_type = 'PERFORMANCE_MAX'
          AND segments.date >= '${fromStr}'
      `);

      for (const row of rows) {
        const campaignId = String(row.campaign?.id);
        const channel = String(row.segments?.ad_network_type ?? "MIXED");
        const date = new Date(row.segments?.date as string);

        await prisma.pmaxChannelSnapshot.upsert({
          where: {
            workspaceId_campaignId_date_channel: { workspaceId, campaignId, date, channel },
          },
          create: {
            workspaceId, campaignId, date, channel,
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(row.metrics?.conversions ?? 0),
          },
          update: {
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(row.metrics?.conversions ?? 0),
          },
        });
      }
    } catch (err) {
      // لو الحساب مفيهوش حملات PMax أصلاً، أو مكتبة الـ API المستخدمة
      // لسه مثبّتة على إصدار أقدم من v23، بيرمي خطأ هنا - بنسجله ونكمل
      console.error(`فشلت مزامنة قنوات Performance Max للحساب ${accountId}:`, err);
    }
  }
}

// ==================== أداء حملات يوتيوب (فيديو) ====================
// مقياس النجاح مختلف تماماً عن Search - نسبة مشاهدة كاملة، تفاعل، مش
// نقرات. ملاحظة صادقة (اتأكدنا منها من الدعم الرسمي): "المشاهدات
// العضوية/المكتسبة" (Organic/Earned Views) مش متاحة عن طريق الـ API
// خالص - الأرقام هنا كلها من المشاهدات المدفوعة (Paid) بس.
export async function syncYoutubeMetricsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    try {
      const rows = await customer.query(`
        SELECT
          campaign.id,
          segments.date,
          metrics.impressions,
          metrics.video_views,
          metrics.video_trueview_view_rate,
          metrics.engagement_rate,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE campaign.id IN (${campaignIds.join(",")})
          AND campaign.advertising_channel_type = 'VIDEO'
          AND segments.date >= '${fromStr}'
      `);

      for (const row of rows) {
        const campaignId = String(row.campaign?.id);
        const date = new Date(row.segments?.date as string);
        // video_views و video_trueview_view_rate حقول GAQL صحيحة وموثّقة
        // رسمياً، لكن تعريفات الأنواع في مكتبة google-ads-api ناقصة لهم -
        // فجوة في توثيق المكتبة نفسها، مش خطأ في الاستعلام. بنستخدم as any
        // بأمان هنا لأننا تأكدنا من صحة الحقل في التوثيق الرسمي مباشرة
        const metrics = row.metrics as any;

        await prisma.youtubeMetricSnapshot.upsert({
          where: { workspaceId_campaignId_date: { workspaceId, campaignId, date } },
          create: {
            workspaceId, campaignId, date,
            impressions: Number(metrics?.impressions ?? 0),
            videoViews: Number(metrics?.video_views ?? 0),
            videoViewRate: Number(metrics?.video_trueview_view_rate ?? 0),
            engagementRate: Number(metrics?.engagement_rate ?? 0),
            cost: Number(metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(metrics?.conversions ?? 0),
          },
          update: {
            impressions: Number(metrics?.impressions ?? 0),
            videoViews: Number(metrics?.video_views ?? 0),
            videoViewRate: Number(metrics?.video_trueview_view_rate ?? 0),
            engagementRate: Number(metrics?.engagement_rate ?? 0),
            cost: Number(metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(metrics?.conversions ?? 0),
          },
        });
      }
    } catch (err) {
      // لو الحساب مفيهوش حملات فيديو أصلاً، بيرمي خطأ هنا - بنسجله ونكمل
      console.error(`فشلت مزامنة مقاييس يوتيوب للحساب ${accountId}:`, err);
    }
  }
}

// ==================== أداء الجهاز والموقع الجغرافي ====================
// اكتشاف حرج من البحث (مؤكد من نقاشات رسمية متعددة في منتدى جوجل):
// دمج segments.device مع segments.geo_target_* في استعلام واحد بيخلي
// جوجل تحذف أي صف مفيهوش بيانات لكل الأبعاد المختارة معاً - المجموع
// النهائي بيبقى أقل من الحقيقي بصمت. الحل: استعلامين منفصلين تماماً،
// مش استعلام واحد مدموج.
export async function syncDeviceAndGeoPerformanceForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const customer = client.Customer({
      customer_id: accountId,
      login_customer_id: connection.managerAccountId!,
      refresh_token: decryptToken(connection.refreshToken!),
    });

    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    // استعلام 1: الجهاز بس - منفصل تماماً عن الموقع الجغرافي
    try {
      const deviceRows = await customer.query(`
        SELECT campaign.id, segments.date, segments.device,
          metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM campaign
        WHERE campaign.id IN (${campaignIds.join(",")}) AND segments.date >= '${fromStr}'
      `);

      for (const row of deviceRows) {
        const campaignId = String(row.campaign?.id);
        const date = new Date(row.segments?.date as string);
        const device = String(row.segments?.device ?? "UNSPECIFIED");

        await prisma.devicePerformanceSnapshot.upsert({
          where: { workspaceId_campaignId_date_device: { workspaceId, campaignId, date, device } },
          create: {
            workspaceId, campaignId, date, device,
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(row.metrics?.conversions ?? 0),
          },
          update: {
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(row.metrics?.conversions ?? 0),
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة أداء الجهاز للحساب ${accountId}:`, err);
    }

    // استعلام 2: الموقع الجغرافي بس (على مستوى الدولة - أقل مخاطرة لحذف
    // صفوف null من التفاصيل الأدق زي المدينة/المنطقة)
    try {
      const geoRows = await customer.query(`
        SELECT campaign.id, segments.date, segments.geo_target_country,
          metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM geographic_view
        WHERE campaign.id IN (${campaignIds.join(",")}) AND segments.date >= '${fromStr}'
      `);

      for (const row of geoRows) {
        const campaignId = String(row.campaign?.id);
        const date = new Date(row.segments?.date as string);
        const geoTarget = String(row.segments?.geo_target_country ?? "UNKNOWN");

        await prisma.geoPerformanceSnapshot.upsert({
          where: { workspaceId_campaignId_date_geoTarget: { workspaceId, campaignId, date, geoTarget } },
          create: {
            workspaceId, campaignId, date, geoTarget,
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(row.metrics?.conversions ?? 0),
          },
          update: {
            impressions: Number(row.metrics?.impressions ?? 0),
            clicks: Number(row.metrics?.clicks ?? 0),
            cost: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
            conversions: Number(row.metrics?.conversions ?? 0),
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة الأداء الجغرافي للحساب ${accountId}:`, err);
    }
  }
}

// ==================== أداء أنواع المطابقة (Broad/Phrase/Exact) ====================
// "المطابقة الواسعة بتاكل ميزانيتي من غير عملاء حقيقيين؟" - نفس الكلمة
// ممكن تكون بأنواع مطابقة مختلفة في نفس الحساب، وأداءها بيختلف جذرياً.
export async function syncMatchTypePerformanceForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    try {
      const customer = client.Customer({
        customer_id: accountId,
        login_customer_id: connection.managerAccountId!,
        refresh_token: decryptToken(connection.refreshToken!),
      });

      const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

      const rows = await customer.query(`
        SELECT
          campaign.id,
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM keyword_view
        WHERE campaign.id IN (${campaignIds.join(",")})
          AND ad_group_criterion.status = 'ENABLED'
          AND segments.date >= '${fromStr}'
      `);

      // بنجمّع يدوياً على مستوى (حملة + نوع مطابقة) بدل ما نخزّن كل
      // كلمة مفتاحية يومياً - الحجم كان هيكبر جداً من غير فايدة إضافية،
      // المهم هنا المقارنة بين الأنواع مش كل كلمة على حدة
      const aggregated = new Map<string, { campaignId: string; matchType: string; impressions: number; clicks: number; cost: number; conversions: number }>();

      for (const row of rows) {
        const campaignId = String(row.campaign?.id);
        const matchType = String(row.ad_group_criterion?.keyword?.match_type ?? "UNKNOWN");
        const key = `${campaignId}::${matchType}`;

        const existing = aggregated.get(key) ?? {
          campaignId, matchType, impressions: 0, clicks: 0, cost: 0, conversions: 0,
        };
        existing.impressions += Number(row.metrics?.impressions ?? 0);
        existing.clicks += Number(row.metrics?.clicks ?? 0);
        existing.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
        existing.conversions += Number(row.metrics?.conversions ?? 0);
        aggregated.set(key, existing);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const agg of aggregated.values()) {
        await prisma.matchTypeSnapshot.upsert({
          where: {
            workspaceId_campaignId_matchType_date: {
              workspaceId, campaignId: agg.campaignId, matchType: agg.matchType, date: today,
            },
          },
          create: { workspaceId, ...agg, date: today },
          update: {
            impressions: agg.impressions, clicks: agg.clicks,
            cost: agg.cost, conversions: agg.conversions,
          },
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة أداء أنواع المطابقة للحساب ${accountId}:`, err);
    }
  }
}

// ==================== أماكن ظهور الشبكة الإعلانية (Display/YouTube) ====================
// "إعلاناتي ظاهرة فين بالظبط في الشبكة الإعلانية؟" - عبر detail_placement_view
// (مؤكد من توثيق جوجل الرسمي). ملاحظة صادقة موثّقة رسمياً: جوجل بتجمّع
// أماكن الظهور منخفضة النشاط في صف واحد اسمه "Other" - مجموع الصفوف
// الفردية ممكن ميساويش المجموع الكلي للحملة، ده سلوك متوقّع من جوجل نفسها.
export async function syncDisplayPlacementsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromStr = thirtyDaysAgo.toISOString().slice(0, 10);

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    try {
      const customer = client.Customer({
        customer_id: accountId,
        login_customer_id: connection.managerAccountId!,
        refresh_token: decryptToken(connection.refreshToken!),
      });

      const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

      const rows = await customer.query(`
        SELECT
          campaign.id,
          detail_placement_view.display_name,
          detail_placement_view.placement,
          detail_placement_view.placement_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM detail_placement_view
        WHERE campaign.id IN (${campaignIds.join(",")})
          AND segments.date >= '${fromStr}'
      `);

      // بنجمّع على مستوى (حملة + مكان ظهور) - نفس منطق أنواع المطابقة،
      // مش سجل يومي لكل مكان (الحجم كان هيكبر جداً)
      const aggregated = new Map<string, { campaignId: string; placement: string; displayName: string; placementType: string; impressions: number; clicks: number; cost: number; conversions: number }>();

      for (const row of rows) {
        const campaignId = String(row.campaign?.id);
        const placement = String(row.detail_placement_view?.placement ?? "unknown");
        const key = `${campaignId}::${placement}`;

        const existing = aggregated.get(key) ?? {
          campaignId, placement,
          displayName: String(row.detail_placement_view?.display_name ?? placement),
          placementType: String(row.detail_placement_view?.placement_type ?? "UNKNOWN"),
          impressions: 0, clicks: 0, cost: 0, conversions: 0,
        };
        existing.impressions += Number(row.metrics?.impressions ?? 0);
        existing.clicks += Number(row.metrics?.clicks ?? 0);
        existing.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
        existing.conversions += Number(row.metrics?.conversions ?? 0);
        aggregated.set(key, existing);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const agg of aggregated.values()) {
        await prisma.displayPlacementSnapshot.upsert({
          where: {
            workspaceId_campaignId_placement_date: {
              workspaceId, campaignId: agg.campaignId, placement: agg.placement, date: today,
            },
          },
          create: { workspaceId, ...agg, date: today },
          update: {
            displayName: agg.displayName, placementType: agg.placementType,
            impressions: agg.impressions, clicks: agg.clicks,
            cost: agg.cost, conversions: agg.conversions,
          },
        });
      }
    } catch (err) {
      // لو الحساب مفيهوش إعلانات شبكة إعلانية أصلاً (Search بس)، بيرمي
      // خطأ هنا - بنسجله ونكمل
      console.error(`فشلت مزامنة أماكن ظهور الشبكة الإعلانية للحساب ${accountId}:`, err);
    }
  }
}

function mapAdType(googleType: string): "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT" | "RESPONSIVE" {
  if (googleType.includes("IMAGE")) return "IMAGE";
  if (googleType.includes("VIDEO")) return "VIDEO";
  if (googleType.includes("RESPONSIVE")) return "RESPONSIVE";
  return "TEXT";
}

// قيمة ابتدائية صحيحة (صفر) وقت المزامنة اليومية - التحقق الحقيقي بيحصل
// لاحقاً وبشكل غير متزامن (رسالة واتساب ممكن توصل بعد ساعات أو أيام من
// الكليك الأصلي)، فمحاولة "حساب" الرقم وقت المزامنة نفسها غلط معمارياً
// أصلاً. الزيادة الحقيقية بتحصل في /api/attribution/mark-matched لحظة
// التحقق الفعلي - نفس الـendpoint شغال للتلاتة منصات مش جوجل بس.
async function getVerifiedConversionsCount(
  campaignId: string,
  date: string
): Promise<number> {
  return 0;
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// بند فجوة تكافؤ منصات - ميتا عندها تنبيه "كتالوج بيصرف من غير مبيعات"
// (checkCatalogSpendAlertsForWorkspace)، جوجل معندهاش المكافئ رغم إن
// نفس المفهوم بالظبط (منتجات Shopping). نفس المنطق بالظبط، منصة مختلفة.
export async function checkShoppingSpendAlertsForWorkspace(workspaceId: string) {
  const { pushToActionFeed } = await import("@/lib/actionFeed");
  const { getRelativeSpendThreshold } = await import("@/lib/relativeSpendThreshold");

  const wastefulThreshold = await getRelativeSpendThreshold(workspaceId);

  const wastefulProducts = await prisma.shoppingProductSnapshot.findMany({
    where: { workspaceId, hasIssues: false, conversions: 0, cost: { gt: wastefulThreshold } },
    orderBy: { cost: "desc" },
    take: 10,
  });

  for (const product of wastefulProducts) {
    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: "MEDIUM",
      title: `${product.title ?? product.itemId}: منتج بيصرف من غير مبيعات`,
      description: `صرفت ${Math.round(product.cost).toLocaleString()} على المنتج ده من غير أي عملية شراء واحدة.`,
      linkUrl: "/dashboard/campaigns/shopping",
    });
  }
}

// ==================== تنفيذ حقيقي - تعديل استراتيجية المزايدة فعلياً ====================
// عملية كتابة حقيقية (مش قراءة) - بتغيّر حملة حقيقية بفلوس حقيقية.
// الصيغة مؤكدة من توثيق المكتبة الرسمية نفسها (github.com/Opteo/google-ads-api).
export async function applyGoogleBidStrategyChange(
  workspaceId: string,
  campaignId: string,
  newStrategy: "MAXIMIZE_CONVERSIONS" | "TARGET_CPA",
  targetCpaValue?: number
) {
  const { ResourceNames } = await import("google-ads-api");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) throw new Error("حساب جوجل مش متصل");

  const link = await prisma.campaignLink.findFirst({
    where: { workspaceId, platform: "GOOGLE_ADS", externalCampaignId: campaignId },
  });
  if (!link) throw new Error("الحملة مش موجودة");

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
  const customer = client.Customer({
    customer_id: link.externalAccountId,
    login_customer_id: connection.managerAccountId!,
    refresh_token: decryptToken(connection.refreshToken!),
  });

  const resource: any = {
    resource_name: ResourceNames.campaign(link.externalAccountId, campaignId),
  };
  if (newStrategy === "MAXIMIZE_CONVERSIONS") {
    resource.maximize_conversions = {};
  } else {
    resource.target_cpa = { target_cpa_micros: Math.round((targetCpaValue ?? 0) * 1_000_000) };
  }

  await customer.mutateResources([{ entity: "campaign", operation: "update", resource }]);
}

// ==================== تنفيذ حقيقي - إيقاف إعلان فردي فعلياً ====================
// "Kill" آمن التنفيذ على مستوى الإعلان الفردي (عكس "Scale" اللي
// الميزانية فيه عادةً على مستوى المجموعة/الحملة، مش الإعلان نفسه -
// تنفيذه غلط ممكن يأثر على إعلانات تانية شريكة في نفس الميزانية).
export async function pauseGoogleAd(workspaceId: string, campaignId: string, adGroupId: string, adId: string) {
  const { ResourceNames } = await import("google-ads-api");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) throw new Error("حساب جوجل مش متصل");

  const link = await prisma.campaignLink.findFirst({
    where: { workspaceId, platform: "GOOGLE_ADS", externalCampaignId: campaignId },
  });
  if (!link) throw new Error("الحملة مش موجودة");

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
  const customer = client.Customer({
    customer_id: link.externalAccountId,
    login_customer_id: connection.managerAccountId!,
    refresh_token: decryptToken(connection.refreshToken!),
  });

  await customer.mutateResources([{
    entity: "ad_group_ad",
    operation: "update",
    resource: {
      // صيغة اسم المصدر مؤكدة رسمياً: customers/{id}/adGroupAds/{adGroupId}~{adId}
      // - محتاجة adGroupId منفصل فعلياً، مش مستنتج من adId (غلطة كانت
      // هتحصل لو مكملتش من غير التأكد)
      resource_name: ResourceNames.adGroupAd(link.externalAccountId, adGroupId, adId),
      status: "PAUSED",
    },
  }]);
}

// ==================== فورم الليد المدمج (Lead Form Extensions) - جوجل ====================
// نفس فكرة الفورم الداخلي بتاعة ميتا وتيك توك بالظبط - العميل بيملى
// بياناته جوه الإعلان نفسه من غير ما يسيب جوجل. اتأكدنا من resource
// lead_form_submission_data من توثيق حقول Google Ads API الرسمي مباشرة
// (developers.google.com/google-ads/api/fields) - نفس جدول LeadFormSubmission
// المشترك مع ميتا/تيك توك، حقل platform بيفرّق بينهم.
export async function syncGoogleLeadFormsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return;

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  for (const [customerId] of Object.entries(byAccount)) {
    try {
      const customer = client.Customer({
        customer_id: customerId,
        login_customer_id: connection.managerAccountId!,
        refresh_token: decryptToken(connection.refreshToken!),
      });

      const rows = await customer.query(`
        SELECT
          lead_form_submission_data.id,
          lead_form_submission_data.asset,
          lead_form_submission_data.ad_group_ad,
          lead_form_submission_data.campaign,
          lead_form_submission_data.submission_date_time,
          lead_form_submission_data.custom_lead_form_submission_fields
        FROM lead_form_submission_data
      `);

      for (const row of rows as any[]) {
        const data = row.lead_form_submission_data;
        const leadgenId = `google_${data.id}`;

        await prisma.leadFormSubmission.upsert({
          where: { leadgenId },
          create: {
            workspaceId,
            platform: "GOOGLE_ADS",
            leadgenId,
            formId: String(data.asset ?? ""),
            adId: data.ad_group_ad ? String(data.ad_group_ad) : null,
            campaignId: data.campaign ? String(data.campaign) : null,
            submittedAt: data.submission_date_time ? new Date(data.submission_date_time) : new Date(),
            fieldData: JSON.stringify(data.custom_lead_form_submission_fields ?? []),
          },
          update: {}, // الليد موجود من قبل، مش هنكرره
        });
      }
    } catch (err) {
      console.error(`فشلت مزامنة فورم الليد لحساب جوجل ${customerId}:`, err);
    }
  }
}

// ==================== عدد الإعلانات المرفوضة ====================
// إشارة عاجلة حقيقية - إعلان مرفوض معناه صفر عرض خالص، مش أداء ضعيف.
// اتأكدت من توثيق جوجل الرسمي: ad_group_ad.policy_summary.approval_status
// = DISAPPROVED. مستخدمة في lib/dailyTasks.ts (كانت 0 ثابت قبل كده).
export async function countDisapprovedGoogleAds(workspaceId: string): Promise<number> {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "GOOGLE_ADS" },
  });
  if (links.length === 0) return 0;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "GOOGLE_ADS"
  );
  if (!connection) return 0;

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);
  let totalDisapproved = 0;

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    try {
      const customer = client.Customer({
        customer_id: accountId,
        login_customer_id: connection.managerAccountId!,
        refresh_token: decryptToken(connection.refreshToken!),
      });

      const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);
      const rows = await customer.query(`
        SELECT ad_group_ad.ad.id
        FROM ad_group_ad
        WHERE ad_group_ad.policy_summary.approval_status = 'DISAPPROVED'
          AND campaign.id IN (${campaignIds.join(",")})
          AND ad_group_ad.status = 'ENABLED'
      `);
      totalDisapproved += rows.length;
    } catch (err) {
      console.error(`فشل فحص الإعلانات المرفوضة للحساب ${accountId}:`, err);
    }
  }

  return totalDisapproved;
}
