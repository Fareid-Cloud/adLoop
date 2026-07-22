// lib/syncMetaAds.ts
//
// بيسحب أداء حملات ميتا - بنفس فلسفة syncGoogleAds.ts، لكن بمراعاة فروق
// حقيقية في طريقة عمل ميتا نفسها (اتأكدت منها بالبحث، مش افتراضات):
//
// 1) الأرقام بترجع كنصوص (Strings) من الـ API، لازم تحويل صريح لكل رقم
// 2) البيانات بتتحدث لحد 28 يوم للخلف (نوافذ الإسناد بتقفل تدريجياً) -
//    فالمزامنة اليومية بتعيد سحب آخر 28 يوم كل مرة، مش "إمبارح" بس
// 3) العملة ممكن تختلف من حساب لحساب (شائع في إعدادات الوكالات) - بنسجل
//    عملة كل حساب مع البيانات، مش نفترض عملة واحدة موحّدة
// 4) الليدز بتتقاس عن طريق حقل "actions" بفلتر action_type=lead، مش حقل مستقل مباشر

import { prisma } from "@/lib/prisma";
import type { CampaignLink, ConnectedPlatform } from "@prisma/client";
import { decryptToken } from "@/lib/encryption";
import { pushToActionFeed } from "@/lib/actionFeed";

const META_API_VERSION = "v25.0";
const ROLLING_WINDOW_DAYS = 28; // نفس نافذة إغلاق الإسناد بتاعة ميتا نفسها

// عملات بدون كسور عشرية - ميتا بترجع قيمها المالية كما هي، من غير قسمة
// على 100 (بعكس أغلب العملات اللي بترجع بأصغر وحدة - السنت مثلاً)
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

// ملاحظة أمانة: القائمة دي مؤكدة من مصدر تقني موثوق، لكن معندهاش تفصيل
// صريح عن عملات الكسور الثلاثية (زي الدينار الكويتي KWD بفلوسه الـ3
// أرقام) - افتراضنا إنها بتتصرف زي باقي العملات (قسمة على 100) لحد ما
// نتأكد بتجربة فعلية، مش هنخمّن رقم قاطع
function convertMinorUnitsToCurrency(amount: number, currencyCode: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) return amount;
  return amount / 100;
}

export async function syncMetaAdsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "META_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) return;

  // التوكن بتاع ميتا بينتهي بعد ~60 يوم بدون تجديد صامت (مختلف عن جوجل) -
  // لو منتهي، بنسجل تحذير واضح بدل ما نفشل بصمت
  if (connection.expiresAt && connection.expiresAt < new Date()) {
    console.error(`توكن ميتا منتهي للـ Workspace ${workspaceId} - محتاج إعادة ربط الحساب`);
    return;
  }

  const byAccount = groupBy(links, (l: CampaignLink) => l.externalAccountId);

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - ROLLING_WINDOW_DAYS);

  for (const [accountId, accountLinks] of Object.entries(byAccount)) {
    const campaignIds = accountLinks.map((l: CampaignLink) => l.externalCampaignId);

    for (const campaignId of campaignIds) {
      try {
        // 3 مستويات محاولة - من الأدق للأبسط. مصفوفة توافق الـ breakdowns
        // عند ميتا غير موثّقة بالكامل رسمياً، فبنجرب الأدق (منصة + مكان
        // مع بعض) وننزل درجة لو اترفض، بدل ما نفشل المزامنة كلها
        let rows = await fetchMetaInsights(campaignId, decryptToken(connection.accessToken), from, to, "full");
        let breakdownLevel: "full" | "platform_only" | "none" = "full";

        if (rows === null) {
          rows = await fetchMetaInsights(campaignId, decryptToken(connection.accessToken), from, to, "platform_only");
          breakdownLevel = "platform_only";
        }
        if (rows === null) {
          rows = await fetchMetaInsights(campaignId, decryptToken(connection.accessToken), from, to, "none");
          breakdownLevel = "none";
        }

        if (rows === null) {
          console.error(`فشلت مزامنة حملة ميتا ${campaignId} بالكامل (كل مستويات التقسيم)`);
          continue;
        }

        for (const row of rows) {
          // كل الأرقام هنا نصوص فعلياً (String) لازم تحويل صريح - قيد
          // حقيقي من ميتا نفسها، مش سهو في الكود
          const impressions = Number(row.impressions ?? 0);
          const clicks = Number(row.clicks ?? 0);
          const cost = Number(row.spend ?? 0);

          // الليدز بتتقاس من حقل "actions" بفلتر action_type - مش رقم مستقل
          const leadAction = (row.actions ?? []).find((a: any) => a.action_type === "lead");
          const rawConversions = leadAction ? Number(leadAction.value ?? 0) : 0;

          const date = new Date(row.date_start);
          const placementBreakdown =
            breakdownLevel !== "none" ? String(row.publisher_platform ?? "ALL").toUpperCase() : "ALL";
          const placementDetail =
            breakdownLevel === "full" ? String(row.placement ?? "ALL").toUpperCase() : "ALL";

          await prisma.metricSnapshot.upsert({
            where: {
              workspaceId_platform_campaignId_date_placementBreakdown_placementDetail: {
                workspaceId, platform: "META_ADS", campaignId, date, placementBreakdown, placementDetail,
              },
            },
            create: {
              workspaceId, platform: "META_ADS", campaignId, date, placementBreakdown, placementDetail,
              impressions, clicks, cost, rawConversions,
              verifiedConversions: 0, // قيمة ابتدائية صحيحة - بتتزود فعلياً وقت التحقق الحقيقي عبر /api/attribution/mark-matched (كانت التعليقة القديمة هنا غلط، مكانش فيه تحديث فعلي قبل كده)
            },
            update: { impressions, clicks, cost, rawConversions },
          });
        }
      } catch (err) {
        console.error(`فشلت مزامنة حملة ميتا ${campaignId}:`, err);
      }
    }
  }
}

// ==================== أداء المجموعات الإعلانية والجمهور (Lookalike) ====================
// ميتا مالهاش "عرض جمهور" منفصل زي جوجل - الاستهداف (بما فيه Lookalike)
// بيتحدد على مستوى المجموعة الإعلانية (Ad Set) نفسها. فبنجيب كل Ad Set +
// وصف استهدافه (لوك-الايك، جمهور مخصص، أو أساسي)، ونربطه بأدائه الفعلي.
export async function syncMetaAdSetsForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "META_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) return;

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - ROLLING_WINDOW_DAYS);

  for (const link of links) {
    try {
      // bid_strategy على مستوى الحملة نفسها (مش المجموعة الإعلانية) -
      // بنجيبها مرة واحدة لكل حملة، ونطبّقها على كل مجموعاتها الإعلانية.
      // بنجيب عملة الحساب الفعلية هنا كمان - مش بنفترضها من عملة العرض
      // بتاعة الـ Workspace (ممكن تكون مختلفة فعلياً، خصوصاً في حسابات وكالات)
      const campaignRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${link.externalCampaignId}` +
          `?fields=bid_strategy,account{currency}&access_token=${decryptToken(connection.accessToken)}`
      );
      const campaignData = await campaignRes.json();
      const bidStrategyType: string | null = campaignRes.ok ? (campaignData.bid_strategy ?? null) : null;
      const accountCurrency: string = campaignData.account?.currency ?? "USD";

      // بنجيب المجموعات الإعلانية تحت الحملة دي + نوع استهدافها + bid_amount
      // (القيمة الفعلية للمزايدة - دي على مستوى المجموعة، مش الحملة)
      const adSetsRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${link.externalCampaignId}/adsets` +
          `?fields=id,name,targeting,bid_amount&access_token=${decryptToken(connection.accessToken)}`
      );
      const adSetsData = await adSetsRes.json();
      if (!adSetsRes.ok) continue;

      for (const adSet of adSetsData.data ?? []) {
        const targetingType = classifyTargeting(adSet.targeting);

        const insightsParams = new URLSearchParams({
          access_token: decryptToken(connection.accessToken),
          time_range: JSON.stringify({
            since: from.toISOString().slice(0, 10),
            until: to.toISOString().slice(0, 10),
          }),
          fields: "impressions,clicks,spend,actions",
        });

        const insightsRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${adSet.id}/insights?${insightsParams.toString()}`
        );
        const insightsData = await insightsRes.json();
        if (!insightsRes.ok) continue;

        const row = insightsData.data?.[0];
        if (!row) continue;

        const leadAction = (row.actions ?? []).find((a: any) => a.action_type === "lead");

        const bidAmount = adSet.bid_amount
          ? convertMinorUnitsToCurrency(Number(adSet.bid_amount), accountCurrency)
          : null;

        await prisma.metaAdSetSnapshot.upsert({
          where: {
            workspaceId_campaignId_adSetId: {
              workspaceId, campaignId: link.externalCampaignId, adSetId: adSet.id,
            },
          },
          create: {
            workspaceId, campaignId: link.externalCampaignId,
            adSetId: adSet.id, adSetName: adSet.name, targetingType,
            bidStrategyType, bidAmount,
            impressions: Number(row.impressions ?? 0),
            clicks: Number(row.clicks ?? 0),
            cost: Number(row.spend ?? 0),
            conversions: leadAction ? Number(leadAction.value ?? 0) : 0,
          },
          update: {
            targetingType,
            bidStrategyType, bidAmount,
            impressions: Number(row.impressions ?? 0),
            clicks: Number(row.clicks ?? 0),
            cost: Number(row.spend ?? 0),
            conversions: leadAction ? Number(leadAction.value ?? 0) : 0,
          },
        });

        // طلب منفصل بتفصيل يومي (time_increment=1) - بس آخر 7 أيام،
        // مخصوص لحساب فترة التعلّم بدقة حقيقية بدل تقريب من رقم 28 يوم
        try {
          const dailyParams = new URLSearchParams({
            access_token: decryptToken(connection.accessToken),
            time_range: JSON.stringify({
              since: (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })(),
              until: new Date().toISOString().slice(0, 10),
            }),
            time_increment: "1",
            fields: "actions",
          });

          const dailyRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${adSet.id}/insights?${dailyParams.toString()}`
          );
          const dailyData = await dailyRes.json();

          if (dailyRes.ok) {
            for (const dayRow of dailyData.data ?? []) {
              const dayLead = (dayRow.actions ?? []).find((a: any) => a.action_type === "lead");
              const date = new Date(dayRow.date_start);

              await prisma.adSetDailyConversions.upsert({
                where: { workspaceId_adSetId_date: { workspaceId, adSetId: adSet.id, date } },
                create: { workspaceId, adSetId: adSet.id, date, conversions: dayLead ? Number(dayLead.value ?? 0) : 0 },
                update: { conversions: dayLead ? Number(dayLead.value ?? 0) : 0 },
              });
            }
          }
        } catch (err) {
          console.error(`فشلت مزامنة التفصيل اليومي للمجموعة الإعلانية ${adSet.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`فشلت مزامنة المجموعات الإعلانية للحملة ${link.externalCampaignId}:`, err);
    }
  }
}

// بنستنتج نوع الاستهداف من بنية كائن targeting - ميتا مبترجعش "النوع" كنص
// جاهز، بترجع تفاصيل الاستهداف الخام، فبنفسّرها بنفسنا
function classifyTargeting(targeting: any): "LOOKALIKE" | "CUSTOM_AUDIENCE" | "CORE" | "UNKNOWN" {
  if (!targeting) return "UNKNOWN";
  const specs = [...(targeting.custom_audiences ?? []), ...(targeting.excluded_custom_audiences ?? [])];
  if (specs.some((s: any) => s.subtype === "LOOKALIKE")) return "LOOKALIKE";
  if (specs.length > 0) return "CUSTOM_AUDIENCE";
  return "CORE"; // استهداف أساسي (اهتمامات/ديموغرافيا) من غير جمهور مخصص
}

// ==================== أداء الإعلانات الفردية (Creative-Level) ====================
// بيستخدم نفس جدول CreativeSnapshot اللي بنيناه لجوجل - كان مصمم من الأول
// يدعم أي منصة (فيه حقل platform)، فمفيش داعي لجدول جديد. ده بالظبط اللي
// بيخلي imageQualityAudit.ts (اللي بيقبل META_ADS كباراميتر من زمان) يشتغل
// فوراً من غير أي تعديل إضافي.
export async function syncMetaCreativesForWorkspace(workspaceId: string) {
  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "META_ADS" },
  });
  if (links.length === 0) return;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) return;

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - ROLLING_WINDOW_DAYS);

  for (const link of links) {
    try {
      // creative{...} بيجيب تفاصيل الإعلان (صورة، عنوان) في نفس الطلب،
      // بدل استعلام منفصل لكل إعلان - أوفر على حصة الـ API
      const adsRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${link.externalCampaignId}/ads` +
          `?fields=id,name,creative{thumbnail_url,object_story_spec}&access_token=${decryptToken(connection.accessToken)}`
      );
      const adsData = await adsRes.json();
      if (!adsRes.ok) continue;

      for (const ad of adsData.data ?? []) {
        const insightsParams = new URLSearchParams({
          access_token: decryptToken(connection.accessToken),
          time_range: JSON.stringify({
            since: from.toISOString().slice(0, 10),
            until: to.toISOString().slice(0, 10),
          }),
          time_increment: "1",
          fields: "impressions,clicks,spend,actions,action_values",
        });

        const insightsRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${ad.id}/insights?${insightsParams.toString()}`
        );
        if (!insightsRes.ok) continue;
        const insightsData = await insightsRes.json();

        const thumbnailUrl = ad.creative?.thumbnail_url ?? null;
        const headline = ad.creative?.object_story_spec?.link_data?.name ?? null;

        for (const row of insightsData.data ?? []) {
          const leadAction = (row.actions ?? []).find((a: any) => a.action_type === "lead");
          // نفس منطق مطابقة "purchase"/"omni_purchase" المستخدم في أماكن
          // تانية بالمشروع (الكتالوج مثلاً) - action_values حقل رسمي
          // موثّق من ميتا نفسها (اتأكدنا منه في مثال حقيقي في توثيقهم)
          const purchaseValue = (row.action_values ?? []).find(
            (a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase"
          );
          const date = new Date(row.date_start);

          await prisma.creativeSnapshot.upsert({
            where: {
              workspaceId_platform_campaignId_adId_date: {
                workspaceId, platform: "META_ADS", campaignId: link.externalCampaignId, adId: ad.id, date,
              },
            },
            create: {
              workspaceId, platform: "META_ADS", campaignId: link.externalCampaignId, adId: ad.id,
              adName: ad.name ?? null, creativeType: "IMAGE", // ميتا مبترجعش نوع مبسّط زي جوجل - IMAGE افتراضي، هيتظبط لاحقاً لو فيه فيديو
              headline, thumbnailUrl, date,
              impressions: Number(row.impressions ?? 0),
              clicks: Number(row.clicks ?? 0),
              cost: Number(row.spend ?? 0),
              rawConversions: leadAction ? Number(leadAction.value ?? 0) : 0,
              conversionsValue: purchaseValue ? Number(purchaseValue.value ?? 0) : 0,
            },
            update: {
              impressions: Number(row.impressions ?? 0),
              clicks: Number(row.clicks ?? 0),
              cost: Number(row.spend ?? 0),
              rawConversions: leadAction ? Number(leadAction.value ?? 0) : 0,
              conversionsValue: purchaseValue ? Number(purchaseValue.value ?? 0) : 0,
            },
          });
        }
      }
    } catch (err) {
      console.error(`فشلت مزامنة إعلانات ميتا للحملة ${link.externalCampaignId}:`, err);
    }
  }
}

// بيجيب بيانات الأداء، بتقسيم المكان (فيسبوك/إنستجرام) أو من غيره حسب
// الباراميتر - بيرجع null لو فشل، عشان المستدعي يقدر يجرب البديل بدل ما
// يفشل خالص (نفس المبدأ من المراجعة الشاملة: فشل جزئي يتعامل معاه جزئياً)
async function fetchMetaInsights(
  campaignId: string,
  accessToken: string,
  from: Date,
  to: Date,
  breakdownLevel: "full" | "platform_only" | "none"
): Promise<any[] | null> {
  const params = new URLSearchParams({
    access_token: accessToken,
    level: "campaign",
    time_range: JSON.stringify({
      since: from.toISOString().slice(0, 10),
      until: to.toISOString().slice(0, 10),
    }),
    time_increment: "1", // صف منفصل لكل يوم، مش رقم مجمّع للفترة كلها
    fields: "impressions,clicks,spend,actions,account_currency",
  });

  // "full" = المنصة (فيسبوك/إنستجرام) + المكان التفصيلي (Feed/Stories/
  // Reels) مع بعض - أدق مستوى. "platform_only" = المنصة بس، fallback
  // أول لو الدمج اترفض. "none" = بيانات مجمّعة، fallback أخير
  if (breakdownLevel === "full") {
    params.set("breakdowns", "publisher_platform,placement");
  } else if (breakdownLevel === "platform_only") {
    params.set("breakdowns", "publisher_platform");
  }

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${campaignId}/insights?${params.toString()}`
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data.data ?? [];
}

// ==================== حالة رفض الإعلانات وقيود الإنفاق ====================
// "إعلاناتي اترفضت أو اتوقفت من ميتا بسبب مخالفة سياسة؟" و"حسابي فيه قيد
// إنفاق بيحد من النمو؟" - عبر effective_status (حالة موثّقة قياسية) و
// spend_cap/amount_spent على مستوى الحساب (مؤكدين من منتدى مطوري ميتا
// الرسمي). ملاحظة أمانة: حقل تفاصيل سبب الرفض بالضبط (issues_info) لم
// نتأكد منه بثقة كافية، فمبنيناش عليه - effective_status بس كافي يوضح
// "فيه مشكلة" حتى لو مش موضّح السبب بالتفصيل.
export async function syncMetaAccountHealthForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) return;

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "META_ADS" },
  });
  if (links.length === 0) return;

  const accountIds = [...new Set(links.map((l: CampaignLink) => l.externalAccountId))];
  const accessToken = decryptToken(connection.accessToken);

  for (const accountId of accountIds) {
    try {
      // قيود الإنفاق على مستوى الحساب
      const accountRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/act_${accountId}?fields=spend_cap,amount_spent,currency&access_token=${accessToken}`
      );
      const accountData = await accountRes.json();

      if (accountRes.ok && accountData.spend_cap) {
        const spendCap = Number(accountData.spend_cap) / 100; // سنت → وحدة أساسية
        const amountSpent = Number(accountData.amount_spent) / 100;
        const usagePct = spendCap > 0 ? Math.round((amountSpent / spendCap) * 100) : 0;

        if (usagePct >= 90) {
          await pushToActionFeed({
            workspaceId,
            type: "ALERT",
            severity: usagePct >= 98 ? "URGENT" : "HIGH",
            title: `حساب ميتا وصل ${usagePct}% من قيد الإنفاق`,
            description: `الحد الأقصى المسموح ${spendCap.toLocaleString()}، المصروف فعلياً ${amountSpent.toLocaleString()} - هيوقف تسليم الإعلانات لو وصل 100%.`,
          });
        }
      }

      // حالة الإعلانات - أي إعلان في حالة DISAPPROVED
      const adsRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/act_${accountId}/ads?fields=id,name,effective_status&effective_status=["DISAPPROVED"]&access_token=${accessToken}`
      );
      const adsData = await adsRes.json();

      if (adsRes.ok && Array.isArray(adsData.data) && adsData.data.length > 0) {
        await pushToActionFeed({
          workspaceId,
          type: "ALERT",
          severity: "HIGH",
          title: `${adsData.data.length} إعلان مرفوض من ميتا لمخالفة سياسة`,
          description: `راجع تفاصيل الرفض من داخل Ads Manager نفسه - السبب الدقيق مش متاح عن طريق الواجهة البرمجية بثقة كافية.`,
        });
      }
    } catch (err) {
      console.error(`فشل فحص صحة حساب ميتا ${accountId}:`, err);
    }
  }
}

// ==================== تقدير الخروج من فترة التعلّم ====================
// "لو زودت الميزانية، هخرج بره فترة التعلّم قد إيه؟" - بدل الاعتماد على
// حقل ميتا (learning_stage_info) اللي صفحة توثيقه معطّلة فعلياً وقت
// الفحص، بنستخدم القاعدة نفسها اللي ميتا بتوضحها علناً (مش سرية):
// محتاجة ~50 حدث تحسين (تحويل) خلال 7 أيام عشان تخرج من فترة التعلّم.
// بنحسبها من بيانات التحويلات بتاعتنا احنا مباشرة - صفر اعتماد على حقل API غامض.
export interface LearningPhaseEstimate {
  adSetId: string;
  adSetName: string | null;
  conversionsLast7Days: number;
  status: "LIKELY_STABLE" | "LEARNING" | "LEARNING_LIMITED";
  message: string;
}

const OPTIMIZATION_EVENTS_NEEDED = 50; // القاعدة الموثّقة علناً من ميتا

// ملاحظة أمانة: القاعدة الرسمية بتتوقف من "آخر تعديل مهم" (ميزانية،
// استهداف، إبداعي) - إحنا مش بنسجّل تاريخ آخر تعديل حالياً، فبنقيس آخر
// 7 أيام كاملة كتقريب معقول، مش من تاريخ تعديل فعلي. لو المجموعة الإعلانية
// اتعدّلت النص الأسبوع، الرقم هيبقى متفائل شوية عن الواقع
export function estimateLearningPhase(
  adSetId: string,
  adSetName: string | null,
  conversionsLast7Days: number
): LearningPhaseEstimate {
  const base = { adSetId, adSetName, conversionsLast7Days };

  if (conversionsLast7Days >= OPTIMIZATION_EVENTS_NEEDED) {
    return {
      ...base, status: "LIKELY_STABLE",
      message: `${conversionsLast7Days} تحويل خلال آخر 7 أيام - على الأرجح خارج فترة التعلّم فعلاً.`,
    };
  }

  const gapNeeded = OPTIMIZATION_EVENTS_NEEDED - conversionsLast7Days;
  return {
    ...base,
    status: conversionsLast7Days < OPTIMIZATION_EVENTS_NEEDED / 2 ? "LEARNING_LIMITED" : "LEARNING",
    message: `${conversionsLast7Days} تحويل خلال آخر 7 أيام - محتاجة ${gapNeeded} تحويل إضافي في الأسبوع عشان توصل للـ${OPTIMIZATION_EVENTS_NEEDED} المطلوبين وتخرج من فترة التعلّم بثبات.`,
  };
}

// بند 2 من خطة action-layer-retrofit-plan.md - نفس منطق التقدير اللي
// فوق، لكن هنا بيتحول لتنبيه فعلي بدل ما يفضل عرض بس في صفحة منفصلة
export async function checkMetaLearningPhaseAlertsForWorkspace(workspaceId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailyRows = await prisma.adSetDailyConversions.groupBy({
    by: ["adSetId"],
    where: { workspaceId, date: { gte: sevenDaysAgo } },
    _sum: { conversions: true },
  });

  const adSetNames = await prisma.metaAdSetSnapshot.findMany({
    where: { workspaceId },
    select: { adSetId: true, adSetName: true },
  });
  const nameMap = new Map<string, string | null>(adSetNames.map((a: any) => [a.adSetId, a.adSetName]));

  for (const row of dailyRows) {
    const result = estimateLearningPhase(row.adSetId, nameMap.get(row.adSetId) ?? null, row._sum.conversions ?? 0);

    if (result.status === "LEARNING_LIMITED") {
      await pushToActionFeed({
        workspaceId,
        type: "ALERT",
        severity: "MEDIUM",
        title: `${result.adSetName ?? result.adSetId}: بعيدة عن الخروج من فترة التعلّم`,
        description: result.message,
        linkUrl: "/dashboard/campaigns/learning-phase",
      });
    }
  }
}

// ==================== أداء الإعلانات الديناميكية المرتبطة بالكتالوج ====================
// "أداء الإعلانات الديناميكية المرتبطة بالكتالوج؟" - عبر نفس نمط
// الـ Insights القياسي، فلتر لحملات مرتبطة بـ promoted_object.product_set_id.
// أمانة مهمة (مؤكدة من مصدر متخصص): أداء منتج بعينه *جوه* حملة ديناميكية
// واحدة مش متاح أصلاً كرؤية أصلية عند ميتا - بيحتاج نظام بيانات منفصل
// كامل (Data Warehouse) بربط Insights API مع Catalog API يدوياً، مش دالة
// مزامنة بسيطة. اللي هنا أداء الحملة الديناميكية ككل بس، مش تفصيل منتج.
export async function syncCatalogCampaignsForWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) return;

  const links = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "META_ADS" },
  });
  if (links.length === 0) return;

  const accessToken = decryptToken(connection.accessToken);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const link of links) {
    try {
      // بنتأكد الأول إن الحملة دي فعلاً مرتبطة بكتالوج - لو مفيهاش
      // promoted_object.product_set_id، مبنسجلهاش هنا (مش حملة تسوق)
      const campaignRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${link.externalCampaignId}` +
          `?fields=promoted_object&access_token=${accessToken}`
      );
      const campaignData = await campaignRes.json();
      const productSetId = campaignData.promoted_object?.product_set_id;
      if (!productSetId) continue;

      const insightsParams = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({
          since: thirtyDaysAgo.toISOString().slice(0, 10),
          until: new Date().toISOString().slice(0, 10),
        }),
        fields: "impressions,clicks,spend,actions",
      });

      const insightsRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${link.externalCampaignId}/insights?${insightsParams.toString()}`
      );
      const insightsData = await insightsRes.json();
      if (!insightsRes.ok) continue;

      const row = insightsData.data?.[0];
      if (!row) continue;

      const purchaseAction = (row.actions ?? []).find((a: any) => a.action_type === "purchase" || a.action_type === "omni_purchase");

      await prisma.catalogCampaignSnapshot.upsert({
        where: { workspaceId_campaignId: { workspaceId, campaignId: link.externalCampaignId } },
        create: {
          workspaceId, campaignId: link.externalCampaignId, productSetId,
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          cost: Number(row.spend ?? 0),
          purchases: purchaseAction ? Number(purchaseAction.value ?? 0) : 0,
        },
        update: {
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          cost: Number(row.spend ?? 0),
          purchases: purchaseAction ? Number(purchaseAction.value ?? 0) : 0,
        },
      });
    } catch (err) {
      console.error(`فشلت مزامنة أداء الكتالوج للحملة ${link.externalCampaignId}:`, err);
    }
  }
}

// بند 3 من خطة action-layer-retrofit-plan.md - حملة كتالوج بتصرف فلوس
// حقيقية من غير أي عملية شراء واحدة لمدة كافية.
//
// إصلاح باگ حقيقي: العتبة كانت رقم ثابت (20) من غير وعي بالعملة - يعني
// 20 جنيه مصري (تافهة) و20 دولار (مبلغ حقيقي) و20 ريال كانوا بيتعاملوا
// بنفس المعيار بالظبط. الحل مش جدول تحويل عملات (هيحتاج تحديث مستمر مع
// تغيّر أسعار الصرف)، الحل إن العتبة تبقى **نسبية لصرف الحساب نفسه** -
// نفس العملة، صفر تحويل، بيتكيف تلقائياً مع حجم الحساب وعملته.
const MIN_SPEND_PCT_OF_WORKSPACE_TOTAL = 0.02; // 2% من إجمالي صرف الـWorkspace آخر 30 يوم
const MIN_ABSOLUTE_SAMPLE = 5; // حد أدنى مطلق بسيط لمنع التنبيه على مبالغ تافهة حتى لو نسبتها كبيرة (حساب صغير جداً)

export async function checkCatalogSpendAlertsForWorkspace(workspaceId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const workspaceTotalAgg = await prisma.metricSnapshot.aggregate({
    where: { workspaceId, date: { gte: thirtyDaysAgo } },
    _sum: { cost: true },
  });
  const workspaceTotalSpend = workspaceTotalAgg._sum.cost ?? 0;
  if (workspaceTotalSpend <= 0) return;

  const relativeThreshold = Math.max(
    workspaceTotalSpend * MIN_SPEND_PCT_OF_WORKSPACE_TOTAL,
    MIN_ABSOLUTE_SAMPLE
  );

  const campaigns = await prisma.catalogCampaignSnapshot.findMany({
    where: { workspaceId, cost: { gt: relativeThreshold }, purchases: 0 },
  });

  const campaignNames = await prisma.campaignLink.findMany({
    where: { workspaceId, platform: "META_ADS" },
    select: { externalCampaignId: true, campaignName: true },
  });
  const nameMap = new Map<string, string>(campaignNames.map((c: any) => [c.externalCampaignId, c.campaignName]));

  for (const c of campaigns) {
    await pushToActionFeed({
      workspaceId,
      type: "ALERT",
      severity: "MEDIUM",
      title: `${nameMap.get(c.campaignId) ?? c.campaignId}: كتالوج بيصرف من غير مبيعات`,
      description: `صرفت ${Math.round(c.cost).toLocaleString()} على الحملة الديناميكية دي آخر 30 يوم من غير أي عملية شراء واحدة.`,
      linkUrl: "/dashboard/campaigns/catalog-ads",
    });
  }
}

function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ==================== نصيحة تدرّج استراتيجية المزايدة - ميتا ====================
// نفس مبدأ جوجل بالظبط، بس أرقام ميتا مختلفة (بحث مؤكد من مصادر متعددة
// متفقة): Lowest Cost/Maximum Delivery → Cost Cap لما توصل **50 تحويل**
// (مش 30 زي جوجل - رقم مختلف عمداً لكل منصة)، والسقف المقترح **فوق
// المتوسط الفعلي بـ10-20%** (استخدمنا 15% - نص النطاق).
// ملاحظة: ميتا معندهاش "مرحلة تالتة" واضحة زي Target CPA بتاعة جوجل -
// Bid Cap اختياري ومتقدم، مش خطوة تالية حتمية، فمش بنقترحه هنا.
const META_MIN_CONVERSIONS_FOR_COST_CAP = 50;
const META_COST_CAP_SAFETY_MARGIN_PCT = 15;

export async function checkMetaBidStrategyProgressionForWorkspace(workspaceId: string) {
  const { pushToActionFeed } = await import("@/lib/actionFeed");

  const adSets = await prisma.metaAdSetSnapshot.findMany({
    where: { workspaceId, OR: [{ bidStrategyType: null }, { bidStrategyType: "" }] },
  });

  for (const adSet of adSets) {
    if (adSet.conversions < META_MIN_CONVERSIONS_FOR_COST_CAP || adSet.cost <= 0) continue;

    const avgCpa = adSet.cost / adSet.conversions;
    const suggestedCostCap = Math.round(avgCpa * (1 + META_COST_CAP_SAFETY_MARGIN_PCT / 100));

    const cooldownStart = new Date();
    cooldownStart.setDate(cooldownStart.getDate() - 14);
    const recentSimilar = await prisma.actionFeedItem.findFirst({
      where: { workspaceId, title: { contains: adSet.adSetName ?? adSet.adSetId }, createdAt: { gte: cooldownStart } },
    });
    if (recentSimilar) continue;

    await pushToActionFeed({
      workspaceId,
      type: "SUGGESTION",
      severity: "MEDIUM",
      title: `${adSet.adSetName ?? adSet.adSetId}: جاهزة لتحديد Cost Cap`,
      description: `${adSet.conversions} تحويل بمتوسط تكلفة ${Math.round(avgCpa)} - نقترح Cost Cap عند ${suggestedCostCap} (فوق متوسطك الفعلي بـ${META_COST_CAP_SAFETY_MARGIN_PCT}% - رقم أقل بيقيّد التوصيل بشدة).`,
      linkUrl: "/dashboard/diagnostics",
      actionType: "SET_BID_STRATEGY_META",
      actionPayload: { adSetId: adSet.adSetId, bidAmountCents: suggestedCostCap, changePct: META_COST_CAP_SAFETY_MARGIN_PCT },
    });
  }
}

// ==================== تنفيذ حقيقي - تعديل استراتيجية مزايدة ميتا فعلياً ====================
// عملية كتابة حقيقية - POST مباشر لمجموعة إعلانية حقيقية عند ميتا.
export async function applyMetaBidStrategyChange(
  workspaceId: string,
  adSetId: string,
  bidAmountCents: number // ميتا بتستقبل bid_amount بالقرش/السنت (أصغر وحدة عملة)
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) throw new Error("حساب ميتا مش متصل");

  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${adSetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bid_strategy: "COST_CAP",
      bid_amount: bidAmountCents,
      access_token: decryptToken(connection.accessToken),
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`فشل تعديل استراتيجية المزايدة عند ميتا: ${errorData.error?.message ?? res.statusText}`);
  }
}

// ==================== تنفيذ حقيقي - إيقاف إعلان فردي عند ميتا ====================
export async function pauseMetaAd(workspaceId: string, adId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { user: { include: { connectedPlatforms: true } } },
  });
  const connection = workspace?.user.connectedPlatforms.find(
    (c: ConnectedPlatform) => c.platform === "META_ADS"
  );
  if (!connection) throw new Error("حساب ميتا مش متصل");

  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${adId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "PAUSED",
      access_token: decryptToken(connection.accessToken),
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`فشل إيقاف الإعلان عند ميتا: ${errorData.error?.message ?? res.statusText}`);
  }
}
