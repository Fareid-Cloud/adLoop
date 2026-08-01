// lib/demoSeed.ts
//
// بذر مساحة العرض التجريبية **بالكامل**.
//
// النسخة الأولى بذرت `MetricSnapshot` وحده، فبدت المساحة فارغة: المنتج
// يقرأ من أربعة عشر جدولاً لا واحد، وكل قسم مبنيّ على جدوله. الديمو
// المقصود منه تصوير كل إمكانية يجب أن يملأها كلّها.
//
// **الأرقام حتمية لا عشوائية:** بذرة معروفة، فالفيديو يعيد نفس الأرقام
// في كل تسجيل، والقصّة نفسها تصل لكل من يراها.

import { prisma } from "@/lib/prisma";

// ==================== القصّة ====================
//
// متجر يبيع منتجات عناية. جوجل البحثية تتحقّق ٨٥٪، ميتا للوعي ٣١٪،
// تيك توك ٢٢٪، وحملة واحدة تصرف بصفر تحقّق. هذه هي الفجوة التي يبيعها
// المنتج، وهي ما يجب أن يراه المشاهد في أوّل ثانيتين.

interface SeedCampaign {
  id: string;
  nameAr: string;
  nameEn: string;
  platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS";
  account: string;
  baseCost: number;
  baseClicks: number;
  baseRaw: number;
  verifyRate: number;
  aov: number;
}

export const DEMO_CAMPAIGNS: SeedCampaign[] = [
  { id: "demo-g-search", nameAr: "بحث — طلب عرض سعر", nameEn: "Search — Request a quote", platform: "GOOGLE_ADS", account: "482-119-7730", baseCost: 640, baseClicks: 148, baseRaw: 21, verifyRate: 0.85, aov: 520 },
  { id: "demo-g-brand", nameAr: "بحث — اسم العلامة", nameEn: "Search — Brand terms", platform: "GOOGLE_ADS", account: "482-119-7730", baseCost: 180, baseClicks: 96, baseRaw: 14, verifyRate: 0.78, aov: 610 },
  { id: "demo-m-retarget", nameAr: "ميتا — إعادة استهداف", nameEn: "Meta — Retargeting", platform: "META_ADS", account: "act_609183472", baseCost: 520, baseClicks: 310, baseRaw: 34, verifyRate: 0.44, aov: 470 },
  { id: "demo-m-awareness", nameAr: "ميتا — وعي بالعلامة", nameEn: "Meta — Brand awareness", platform: "META_ADS", account: "act_609183472", baseCost: 730, baseClicks: 690, baseRaw: 58, verifyRate: 0.31, aov: 390 },
  { id: "demo-t-video", nameAr: "تيك توك — فيديو المنتج", nameEn: "TikTok — Product video", platform: "TIKTOK_ADS", account: "7291043118", baseCost: 410, baseClicks: 540, baseRaw: 46, verifyRate: 0.22, aov: 330 },
  { id: "demo-t-broad", nameAr: "تيك توك — جمهور واسع", nameEn: "TikTok — Broad audience", platform: "TIKTOK_ADS", account: "7291043118", baseCost: 295, baseClicks: 380, baseRaw: 12, verifyRate: 0, aov: 0 },
];

interface SeedAd {
  adId: string;
  campaignId: string;
  nameAr: string;
  nameEn: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT" | "RESPONSIVE";
  /** مضاعِف الأداء مقابل متوسّط الحملة - هنا يعيش قرار التوسيع/الإيقاف */
  perf: number;
  share: number;
}

/**
 * ستّة عشر إعلاناً بأداء متفاوت عمداً: بعضها يستحقّ التوسيع بوضوح،
 * وبعضها يستحقّ الإيقاف — وإلا بقي عمود القرار فارغاً في كل لقطة.
 */
export const DEMO_ADS: SeedAd[] = [
  { adId: "ad-g1", campaignId: "demo-g-search", nameAr: "عرض الخصم — نصّ", nameEn: "Discount offer — text", type: "RESPONSIVE", perf: 1.45, share: 0.42 },
  { adId: "ad-g2", campaignId: "demo-g-search", nameAr: "شحن مجاني — نصّ", nameEn: "Free shipping — text", type: "RESPONSIVE", perf: 1.05, share: 0.34 },
  { adId: "ad-g3", campaignId: "demo-g-search", nameAr: "ضمان الاسترجاع", nameEn: "Money-back guarantee", type: "RESPONSIVE", perf: 0.62, share: 0.24 },
  { adId: "ad-g4", campaignId: "demo-g-brand", nameAr: "الاسم التجاري", nameEn: "Brand name", type: "RESPONSIVE", perf: 1.2, share: 1 },
  { adId: "ad-m1", campaignId: "demo-m-retarget", nameAr: "سلة متروكة — صورة", nameEn: "Abandoned cart — image", type: "IMAGE", perf: 1.6, share: 0.38 },
  { adId: "ad-m2", campaignId: "demo-m-retarget", nameAr: "شهادات العملاء — كاروسيل", nameEn: "Testimonials — carousel", type: "CAROUSEL", perf: 1.1, share: 0.35 },
  { adId: "ad-m3", campaignId: "demo-m-retarget", nameAr: "خصم ٢٤ ساعة", nameEn: "24-hour discount", type: "IMAGE", perf: 0.55, share: 0.27 },
  { adId: "ad-m4", campaignId: "demo-m-awareness", nameAr: "قصّة العلامة — ريلز", nameEn: "Brand story — Reels", type: "VIDEO", perf: 1.15, share: 0.45 },
  { adId: "ad-m5", campaignId: "demo-m-awareness", nameAr: "قبل وبعد — صورة", nameEn: "Before and after — image", type: "IMAGE", perf: 0.78, share: 0.33 },
  { adId: "ad-m6", campaignId: "demo-m-awareness", nameAr: "إعلان عام — صورة", nameEn: "Generic — image", type: "IMAGE", perf: 0.41, share: 0.22 },
  { adId: "ad-t1", campaignId: "demo-t-video", nameAr: "استخدام المنتج — ١٥ث", nameEn: "Product in use — 15s", type: "VIDEO", perf: 1.35, share: 0.4 },
  { adId: "ad-t2", campaignId: "demo-t-video", nameAr: "تجربة عميلة", nameEn: "Customer experience", type: "VIDEO", perf: 1.0, share: 0.35 },
  { adId: "ad-t3", campaignId: "demo-t-video", nameAr: "فكّ التغليف", nameEn: "Unboxing", type: "VIDEO", perf: 0.6, share: 0.25 },
  { adId: "ad-t4", campaignId: "demo-t-broad", nameAr: "جمهور واسع — أ", nameEn: "Broad — A", type: "VIDEO", perf: 0.9, share: 0.5 },
  { adId: "ad-t5", campaignId: "demo-t-broad", nameAr: "جمهور واسع — ب", nameEn: "Broad — B", type: "VIDEO", perf: 0.7, share: 0.5 },
];

export const DEMO_PRODUCTS = [
  { sku: "SKU-101", nameAr: "سيروم فيتامين سي", nameEn: "Vitamin C serum", price: 249, cogs: 78, ship: 22, rto: 8, margin: 35 },
  { sku: "SKU-102", nameAr: "كريم مرطّب ليلي", nameEn: "Night moisturiser", price: 189, cogs: 96, ship: 22, rto: 14, margin: 30 },
  // خاسر عمداً: التكلفة والشحن والمرتجعات تتجاوز السعر - يُظهر تنبيه
  // «يُباع بخسارة» الأحمر الذي يبيعه قسم التسعير
  { sku: "SKU-103", nameAr: "مجموعة العناية الكاملة", nameEn: "Complete care set", price: 399, cogs: 268, ship: 35, rto: 22, margin: 32 },
  { sku: "SKU-104", nameAr: "غسول لطيف", nameEn: "Gentle cleanser", price: 129, cogs: 41, ship: 18, rto: 6, margin: 40 },
  { sku: "SKU-105", nameAr: "واقي شمس ٥٠", nameEn: "SPF 50 sunscreen", price: 169, cogs: 62, ship: 18, rto: 9, margin: 36 },
];

const DAYS = 90;

function wave(day: number, seed: number): number {
  return 1 + Math.sin((day + seed) * 0.7) * 0.18 + Math.sin((day + seed) * 0.23) * 0.11;
}

function weekend(d: Date): number {
  const w = d.getDay();
  return w === 5 || w === 6 ? 0.72 : 1;
}

// ==================== البذر ====================

export async function seedDemoData(workspaceId: string, locale: "ar" | "en"): Promise<void> {
  const ar = locale === "ar";
  const name = <T extends { nameAr: string; nameEn: string }>(x: T) => (ar ? x.nameAr : x.nameEn);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = (back: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    return d;
  };

  // ---------- الحملات ----------
  await prisma.campaignLink.createMany({
    data: DEMO_CAMPAIGNS.map((c) => ({
      workspaceId,
      platform: c.platform,
      externalAccountId: c.account,
      externalCampaignId: c.id,
      campaignName: name(c),
      biddingStrategyType: c.platform === "GOOGLE_ADS" ? "MAXIMIZE_CONVERSIONS" : "LOWEST_COST",
      biddingDataUpdatedAt: new Date(),
    })),
    skipDuplicates: true,
  });

  // ---------- لقطات الأداء اليومية ----------
  const snapshots: Record<string, unknown>[] = [];
  const creatives: Record<string, unknown>[] = [];

  for (let i = DAYS; i >= 1; i--) {
    const date = day(i);
    const wf = weekend(date);

    DEMO_CAMPAIGNS.forEach((c, ci) => {
      const w = wave(i, ci * 3) * wf;
      const cost = Math.round(c.baseCost * w);
      const clicks = Math.round(c.baseClicks * w);
      const raw = Math.max(0, Math.round(c.baseRaw * w));
      const verified = Math.round(raw * c.verifyRate);
      const revenue = verified > 0 ? Math.round(verified * c.aov) : null;

      snapshots.push({
        workspaceId, platform: c.platform, campaignId: c.id, date,
        impressions: clicks * 34, clicks, cost,
        rawConversions: raw, verifiedConversions: verified,
        revenue, ordersCount: verified > 0 ? verified : null,
        returnedOrdersCount: verified > 0 ? Math.round(verified * 0.11) : null,
        cogs: revenue ? Math.round(revenue * 0.36) : null,
        shippingCost: verified > 0 ? verified * 22 : null,
        // مقاييس الفيديو للمنصّات التي تُرجعها فعلاً
        videoViews: c.platform !== "GOOGLE_ADS" ? Math.round(clicks * 8.4 * w) : null,
        videoViewRate: c.platform !== "GOOGLE_ADS" ? Math.round(24 * w * 10) / 10 : null,
        videoThruPlays: c.platform !== "GOOGLE_ADS" ? Math.round(clicks * 2.1 * w) : null,
        videoAvgWatchTimeSec: c.platform !== "GOOGLE_ADS" ? Math.round(6.8 * w * 10) / 10 : null,
      });

      // ---------- الإعلانات الفردية ----------
      // ثلاثون يوماً تكفي: كل قرارات مستوى الإعلان (توسيع/إيقاف/إجهاد)
      // تنظر إلى الأيام الأخيرة، وتسعون منها ثلاثة أضعاف الصفوف بلا فائدة.
      for (const ad of i > 30 ? [] : DEMO_ADS.filter((a) => a.campaignId === c.id)) {
        const adCost = Math.round(cost * ad.share);
        const adClicks = Math.round(clicks * ad.share);
        const adRaw = Math.max(0, Math.round(raw * ad.share * ad.perf));
        creatives.push({
          workspaceId, platform: c.platform, campaignId: c.id,
          adId: ad.adId, adName: name(ad), creativeType: ad.type,
          adGroupId: c.platform === "GOOGLE_ADS" ? `${c.id}-ag` : null,
          adSetId: c.platform !== "GOOGLE_ADS" ? `${c.id}-set` : null,
          headline: name(ad),
          finalUrl: "https://example-store.com/products",
          date, impressions: adClicks * 34, clicks: adClicks, cost: adCost,
          rawConversions: adRaw,
          verifiedConversions: Math.round(adRaw * c.verifyRate),
          conversionsValue: c.aov > 0 ? Math.round(adRaw * c.verifyRate * c.aov) : null,
        });
      }
    });
  }

  await Promise.all([
    prisma.metricSnapshot.createMany({ data: snapshots as never, skipDuplicates: true }),
    prisma.creativeSnapshot.createMany({ data: creatives as never, skipDuplicates: true }),
  ]);

  // ---------- مصطلحات البحث ----------
  const TERMS = ar
    ? [["سيروم فيتامين سي الأصلي", 1.4], ["افضل كريم مرطب", 1.1], ["منتجات عناية بالبشرة", 0.8],
       ["كريم رخيص", 0.15], ["وظائف شركات تجميل", 0], ["تحميل برنامج فوتوشوب", 0]] as const
    : [["original vitamin c serum", 1.4], ["best moisturiser", 1.1], ["skincare products", 0.8],
       ["cheap cream", 0.15], ["cosmetics company jobs", 0], ["download photoshop", 0]] as const;

  await prisma.searchTermSnapshot.createMany({
    data: TERMS.flatMap(([term, q], ti) =>
      [7, 14, 21].map((back) => ({
        workspaceId, campaignId: "demo-g-search",
        searchTerm: term as string,
        matchedKeyword: ar ? "سيروم فيتامين سي" : "vitamin c serum",
        date: day(back),
        impressions: Math.round(420 * (1 + ti * 0.2)),
        clicks: Math.round(38 * (1 + ti * 0.15)),
        cost: Math.round(96 * (1 + ti * 0.18)),
        conversions: Math.round(6 * (q as number)),
      }))
    ) as never,
    skipDuplicates: true,
  });

  // ---------- المنتجات ----------
  await prisma.product.createMany({
    data: DEMO_PRODUCTS.map((p) => ({
      workspaceId, name: name(p), sku: p.sku,
      currentPrice: p.price, cogs: p.cogs,
      outboundShippingCost: p.ship, returnShippingCost: p.ship,
      avgAdCostPerOrder: 46, rtoRatePct: p.rto,
      paymentGatewayFeePct: 2.75, paymentGatewayFixedFee: 1,
      desiredMarginPct: p.margin,
    })) as never,
    skipDuplicates: true,
  });

  // ---------- إعدادات مستقلّة: تُكتب معاً ----------
  await Promise.all([
    prisma.ecommerceConnection.create({
    data: {
      workspaceId, platform: "SALLA",
      storeName: ar ? "متجر النخبة" : "Elite Store",
      storeUrl: "https://elite-store.example",
      active: true,
      lastOrderAt: day(0),
      ordersReceived: 1284,
    },
    }).catch(() => {}),

    prisma.conversionValueConfig.create({
      data: { workspaceId, avgLeadToClientRate: 0.32, avgClientValue: 480 },
    }).catch(() => {}),

    prisma.monitoredPage.create({
    data: {
      workspaceId,
      url: "https://elite-store.example/offer",
      label: ar ? "صفحة العرض الرئيسية" : "Main offer page",
      trackingDetected: true,
      adloopDetected: true,
      detectedSystems: ["adloop", "gtm", "meta_pixel", "tiktok_pixel"],
        lastCheckedAt: day(0),
      },
    }).catch(() => {}),
  ]);

  // ---------- عمليات مزامنة ----------
  await prisma.syncRun.createMany({
    data: (["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const).flatMap((platform, pi) =>
      [0, 1, 2].map((back) => ({
        workspaceId, platform, status: "SUCCESS" as const, trigger: "CRON" as const,
        startedAt: new Date(day(back).getTime() + (4 + pi) * 3_600_000),
        finishedAt: new Date(day(back).getTime() + (4 + pi) * 3_600_000 + 42_000),
        durationMs: 42_000,
        recordsWritten: 120 + pi * 34,
      }))
    ) as never,
    skipDuplicates: true,
  });

  // ---------- قرارات معلّقة ----------
  await prisma.actionFeedItem.createMany({
    data: [
      {
        workspaceId, type: "SUGGESTION" as const, severity: "HIGH" as const,
        title: ar ? "«تيك توك — جمهور واسع» تصرف بلا تحويل مؤكَّد واحد" : "\"TikTok — Broad audience\" is spending with zero confirmed conversions",
        description: ar
          ? "٢٩٥ ريالاً يومياً منذ اثني عشر يوماً، وصفر تحويل متحقّق. الإيقاف يوفّر نحو ٨٬٨٥٠ ريالاً شهرياً."
          : "SAR 295 a day for twelve days, and zero verified conversions. Pausing saves around SAR 8,850 a month.",
        linkUrl: "/dashboard/campaigns/creatives",
      },
      {
        workspaceId, type: "SUGGESTION" as const, severity: "MEDIUM" as const,
        title: ar ? "«سلة متروكة — صورة» يستحقّ زيادة ميزانية" : "\"Abandoned cart — image\" deserves more budget",
        description: ar
          ? "تكلفة العميل أرخص من متوسّط الحساب بـ٣٨٪ عبر تسعة أيام متتالية."
          : "Cost per customer is 38% below the account average across nine consecutive days.",
        linkUrl: "/dashboard/campaigns/creatives",
      },
      {
        workspaceId, type: "ALERT" as const, severity: "URGENT" as const,
        title: ar ? "فجوة تضخيم ٦٩٪ في «ميتا — وعي بالعلامة»" : "69% inflation gap on \"Meta — Brand awareness\"",
        description: ar
          ? "ميتا تعلن ٥٨ تحويلاً يومياً، وما تحقّق منها ١٨ فقط."
          : "Meta reports 58 conversions a day; only 18 were verified.",
        linkUrl: "/dashboard/truth",
      },
      {
        workspaceId, type: "ALERT" as const, severity: "HIGH" as const,
        title: ar ? "«مجموعة العناية الكاملة» تُباع بخسارة" : "\"Complete care set\" is sold at a loss",
        description: ar
          ? "التكلفة الحقيقية للطلب تتجاوز سعر البيع بـ٤١ ريالاً."
          : "The true cost per order exceeds the selling price by SAR 41.",
        linkUrl: "/dashboard/pricing",
      },
    ] as never,
    skipDuplicates: true,
  });


  // ---------- طبقة اللمسات: تُغذّي نماذج الإسناد الثمانية ----------
  //
  // بدونها يبقى «مركز الحقيقة» فارغاً تماماً: النماذج تُحسب من مسار
  // اللمسات لا من لقطات الأداء. الرحلات هنا متعدّدة المنصّات عمداً -
  // وهي بالضبط ما لا تستطيع أي لوحة منصّة منفردة أن تراه.
  const touchpoints: Record<string, unknown>[] = [];
  const conversions: Record<string, unknown>[] = [];

  const JOURNEYS: Array<{ path: Array<[string, string]>; value: number }> = [
    { path: [["META_ADS", "demo-m-awareness"], ["GOOGLE_ADS", "demo-g-brand"]], value: 520 },
    { path: [["TIKTOK_ADS", "demo-t-video"], ["META_ADS", "demo-m-retarget"], ["GOOGLE_ADS", "demo-g-brand"]], value: 690 },
    { path: [["GOOGLE_ADS", "demo-g-search"]], value: 480 },
    { path: [["META_ADS", "demo-m-retarget"]], value: 410 },
    { path: [["META_ADS", "demo-m-awareness"], ["META_ADS", "demo-m-retarget"]], value: 455 },
    { path: [["TIKTOK_ADS", "demo-t-video"], ["GOOGLE_ADS", "demo-g-search"]], value: 610 },
  ];

  const CHANNEL: Record<string, string> = {
    GOOGLE_ADS: "PAID_SEARCH", META_ADS: "PAID_SOCIAL", TIKTOK_ADS: "PAID_VIDEO",
  };

  // ستّ رحلات × ثلاثين يوماً = مئة وثمانون تحويلاً بمسارات حقيقية
  for (let d = 30; d >= 1; d--) {
    JOURNEYS.forEach((j, ji) => {
      const visitorId = `demo-v-${d}-${ji}`;
      const convertedAt = new Date(day(d).getTime() + 14 * 3_600_000);

      j.path.forEach(([platform, campaignId], step) => {
        touchpoints.push({
          workspaceId, visitorId,
          sessionId: `${visitorId}-s${step}`,
          kind: "AD_CLICK",
          channel: CHANNEL[platform],
          platform, campaignId,
          adSetId: `${campaignId}-set`,
          source: platform.toLowerCase(),
          medium: "cpc",
          landingPath: "/offer",
          // اللمسات مرتّبة زمنياً داخل الرحلة - وإلا انهار كل نموذج إسناد
          occurredAt: new Date(convertedAt.getTime() - (j.path.length - step) * 26 * 3_600_000),
        });
      });

      // رسالة واتساب هي لحظة التحقّق - جوهر المنتج
      touchpoints.push({
        workspaceId, visitorId, kind: "MESSAGE", channel: "OTHER",
        occurredAt: new Date(convertedAt.getTime() - 3_600_000),
      });

      conversions.push({
        workspaceId, visitorId,
        externalId: `demo-conv-${d}-${ji}`,
        eventName: "Purchase",
        occurredAt: convertedAt,
        value: j.value,
        currency: "SAR",
        verified: true,
        matchQualityScore: 7 + (ji % 3),
      });
    });
  }

  await Promise.all([
    prisma.touchpoint.createMany({ data: touchpoints as never, skipDuplicates: true }),
    prisma.conversionEvent.createMany({ data: conversions as never, skipDuplicates: true }),
  ]);

  // ---------- المتجر: عملاء وطلبات ومبيعات لكل منتج ----------
  const products = await prisma.product.findMany({
    where: { workspaceId },
    select: { id: true, sku: true, currentPrice: true },
  });

  const CITIES = ar
    ? ["الرياض", "جدة", "الدمام", "مكة", "المدينة"]
    : ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina"];

  const customers = Array.from({ length: 40 }, (_, ci) => ({
    workspaceId,
    platform: "SALLA" as const,
    externalCustomerId: `demo-cust-${ci}`,
    displayName: ar ? `عميل ${ci + 1}` : `Customer ${ci + 1}`,
    city: CITIES[ci % CITIES.length],
    country: "SA",
    // عملاء متكرّرون عمداً: قسم العملاء بلا تكرار لا يعرض شيئاً ذا معنى
    ordersCount: ci % 7 === 0 ? 4 : ci % 3 === 0 ? 2 : 1,
    totalSpent: 0,
    firstOrderAt: day(60 - ci),
    lastOrderAt: day(ci % 20),
  }));
  await prisma.customer.createMany({ data: customers as never, skipDuplicates: true });

  const savedCustomers = await prisma.customer.findMany({
    where: { workspaceId },
    select: { id: true, externalCustomerId: true },
  });

  const orders: Record<string, unknown>[] = [];
  for (let oi = 0; oi < 160; oi++) {
    const cust = savedCustomers[oi % savedCustomers.length];
    const p = products[oi % products.length];
    const qty = (oi % 3) + 1;
    const total = Math.round(p.currentPrice * qty);
    // نحو أحد عشر بالمئة مرتجعات - نفس النسبة في لقطات الأداء
    const returned = oi % 9 === 0;
    orders.push({
      workspaceId, platform: "SALLA",
      externalOrderId: `demo-order-${oi}`,
      customerId: cust.id,
      orderedAt: day(oi % 60),
      total, shippingCost: 22, currency: "SAR",
      state: returned ? "RETURNED" : "FULFILLED",
      isReturned: returned,
      itemCount: qty,
      paymentMethod: oi % 4 === 0 ? "cod" : "card",
      isCod: oi % 4 === 0,
      fraudRiskScore: oi % 4 === 0 ? 34 + (oi % 30) : 8,
      fraudRiskReasons: oi % 4 === 0 && oi % 12 === 0
        ? [ar ? "دفع عند الاستلام + عميل جديد" : "Cash on delivery + new customer"]
        : [],
    });
  }
  await prisma.order.createMany({ data: orders as never, skipDuplicates: true });

  const savedOrders = await prisma.order.findMany({
    where: { workspaceId },
    select: { id: true, externalOrderId: true, orderedAt: true, isReturned: true },
  });

  await prisma.productSaleEvent.createMany({
    data: savedOrders.map((o, oi) => {
      const p = products[oi % products.length];
      const qty = (oi % 3) + 1;
      return {
        // ProductSaleEvent مرتبط بالمنتج والطلب لا بمساحة العمل مباشرةً -
        // مساحة العمل تُستنتج عبرهما. الـ`as never` كان يُخفي هذا عن tsc.
        productId: p.id,
        orderId: o.id,
        quantity: qty,
        revenue: Math.round(p.currentPrice * qty),
        returned: o.isReturned,
        occurredAt: o.orderedAt,
      };
    }) as never,
    skipDuplicates: true,
  });

  // ---------- اختبارات ----------
  await prisma.experimentLog.createMany({
    data: [
      {
        workspaceId, changeType: "BUDGET" as const,
        description: ar ? "زيادة ميزانية «بحث — طلب عرض سعر» بنسبة ٢٠٪" : "Raised \"Search — Request a quote\" budget by 20%",
        changedAt: day(24), relatedCampaignId: "demo-g-search",
        platform: "GOOGLE_ADS" as const, source: "AUTO" as const, status: "MEASURED" as const,
        confidenceLevel: "RELIABLE" as const, windowDays: 14,
        trackedMetrics: ["cost", "conversions_verified", "cpl_verified"],
        metricResults: {
          cost: { before: 8960, after: 10740, changePct: 19.9 },
          conversions_verified: { before: 249, after: 322, changePct: 29.3 },
          cpl_verified: { before: 36, after: 33.4, changePct: -7.2 },
        },
      },
      {
        workspaceId, changeType: "PAUSE" as const,
        description: ar ? "إيقاف «إعلان عام — صورة»" : "Paused \"Generic — image\"",
        changedAt: day(6), relatedCampaignId: "demo-m-awareness",
        platform: "META_ADS" as const, source: "AUTO" as const, status: "RUNNING" as const,
        windowDays: 14, trackedMetrics: ["cost", "cpl_verified"],
      },
    ] as never,
    skipDuplicates: true,
  });
}
