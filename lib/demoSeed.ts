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
import { Prisma, type Platform, type TouchpointChannel } from "@prisma/client";
import { demoCurrencyScale, roundForCurrency } from "@/lib/demoCurrency";
// النصّ الاحتياطيّ وحده يُبنى هنا؛ المفاتيح تُترجَم عند القراءة.
import { t } from "@/lib/i18n/dictionary";

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
  /**
   * أيّ قناة بيعٍ تشتري هذه الحملة؟ `null` تعني حملةً لم تُنسب بعد -
   * وهي حالةٌ حقيقية يجب أن يراها الزائر: إنفاقٌ لا يدخل عائد أيّ قناة
   * لأنّ نسبته تخمين. ولولا واحدةٌ كذلك لظهرت لافتة «إنفاق غير منسوب»
   * ميّتةً في الديمو.
   */
  store?: "retail" | "wholesale";
}

/**
 * 🔴 لماذا أُعيدت معايرة هذه الأرقام (٨ أغسطس ٢٠٢٦):
 *
 * كانت مساحة العرض تُظهر **صافي ربح -٦٢٬١٨٥ ريالاً** و«متجرك يخسر بعد
 * احتساب كلّ التكاليف». والسبب لم يكن رقماً واحداً خاطئاً، بل **عالمين
 * منفصلين في البذرة نفسها**:
 *
 *   • الحملات كانت تُنتج ~٧٢ تحويلاً متحقَّقاً في اليوم وتصرف ٢٬٧٧٥ ريالاً.
 *   • والمتجر كان يُبذَر بمئة وستّين طلباً موزّعةً على ستّين يوماً - أي
 *     **٢٫٧ طلبات في اليوم**.
 *
 * و`getProfitJourney` تأخذ الإيراد من **الطلبات** (لأنّها موجودة) والإنفاق
 * الإعلانيّ من **لقطات الحملات**. فتُقارَن ميزانية حسابٍ كبير بإيراد متجرٍ
 * صغير: إنفاقٌ يفوق إيراد المتجر كلّه ضعفين وثلثاً. الخسارة كانت نتيجةً
 * حسابيةً صحيحة لمُدخَلات لا يمكن أن تتعايش.
 *
 * **المعايرة تربط العالمين بدل أن ترفع رقماً:** حجم الحملات نزل إلى ثلثه
 * فصار يُنتج ~٢٤ تحويلاً في اليوم، وعدد الطلبات ارتفع ليطابقه - فالطلب
 * الآن نتيجةُ تحويلٍ لا رقمٌ موازٍ له. والتحقّق من الترابط: إيراد لقطات
 * الحملات (التحويلات × متوسّط قيمة الطلب) ≈ ١١٬٢٤٠ في اليوم، وإيراد
 * الطلبات ≈ ١٠٬٩٠٠ - رقمان يصفان الشيء نفسه فيتقاربان كما يجب.
 *
 * **وتبقى المشكلات القابلة للإصلاح كما هي، فهي المنتج:** «جمهور واسع»
 * يصرف بصفر تحويل متحقَّق، وفجوة التضخيم قائمة، ومنتج يُباع بخسارة. ما
 * تغيّر أنّ المحصّلة صارت حساباً رابحاً فيه ما يُحسَّن - لا حساباً ينزف
 * مبلغاً لا يصبر عليه أحد.
 */
export const DEMO_CAMPAIGNS: SeedCampaign[] = [
  { id: "demo-g-search", nameAr: "جوجل — طلب عرض سعر", nameEn: "Google — Request a quote", platform: "GOOGLE_ADS", account: "482-119-7730", baseCost: 530, baseClicks: 148, baseRaw: 7, verifyRate: 0.85, aov: 520 , store: "retail" },
  { id: "demo-g-brand", nameAr: "جوجل — اسم العلامة", nameEn: "Google — Brand terms", platform: "GOOGLE_ADS", account: "482-119-7730", baseCost: 150, baseClicks: 96, baseRaw: 5, verifyRate: 0.78, aov: 610 , store: "wholesale" },
  { id: "demo-m-retarget", nameAr: "ميتا — إعادة استهداف", nameEn: "Meta — Retargeting", platform: "META_ADS", account: "act_609183472", baseCost: 430, baseClicks: 310, baseRaw: 11, verifyRate: 0.44, aov: 470 , store: "retail" },
  { id: "demo-m-awareness", nameAr: "ميتا — وعي بالعلامة", nameEn: "Meta — Brand awareness", platform: "META_ADS", account: "act_609183472", baseCost: 605, baseClicks: 690, baseRaw: 19, verifyRate: 0.31, aov: 390 , store: "retail" },
  { id: "demo-t-video", nameAr: "تيك توك — فيديو المنتج", nameEn: "TikTok — Product video", platform: "TIKTOK_ADS", account: "7291043118", baseCost: 340, baseClicks: 540, baseRaw: 15, verifyRate: 0.22, aov: 330 , store: "wholesale" },
  // الحملة الخاسرة عمداً: تصرف بلا تحويل متحقَّق واحد. تبقى كما هي - هي
  // نفسها ما يبيعه المنتج، وحذفها يجعل الديمو حساباً لا مشكلة فيه.
  { id: "demo-t-broad", nameAr: "تيك توك — جمهور واسع", nameEn: "TikTok — Broad audience", platform: "TIKTOK_ADS", account: "7291043118", baseCost: 245, baseClicks: 380, baseRaw: 4, verifyRate: 0, aov: 0 },
];

/**
 * عدد الطلبات اليوميّ في المتجر - **مشتقّ من التحويلات المتحقَّقة أعلاه
 * لا مختار**. مجموع (`baseRaw` × `verifyRate`) للحملات الستّ ≈ ٢٤، والطلب
 * هو نتيجة التحويل، فالرقمان واحد.
 *
 * أيّ تعديل على أرقام الحملات يجب أن يمرّ على هذا الرقم، وإلّا عاد
 * الانفصال الذي أنتج خسارة الستّين ألفاً.
 */
const ORDERS_PER_DAY = 24;
/** أفق الطلبات - أوسع من نافذة العرض (٣٠ يوماً) لتصحّ المقارنة بالفترة السابقة */
const ORDER_DAYS = 60;

interface SeedAd {
  adId: string;
  campaignId: string;
  nameAr: string;
  nameEn: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT" | "RESPONSIVE";
  /** مضاعِف الأداء مقابل متوسّط الحملة - هنا يعيش قرار التوسيع/الإيقاف */
  perf: number;
  share: number;
  /**
   * مسار الإعلان عبر الأيام: `up` يتحسّن، `flat` مستقرّ، `down` يتدهور.
   * بدونه تتطابق منحنيات كل الإعلانات فيَسِمها كاشف الإجهاد جميعاً.
   */
  trend: "up" | "flat" | "down";
}

/**
 * ستّة عشر إعلاناً بأداء متفاوت عمداً: بعضها يستحقّ التوسيع بوضوح،
 * وبعضها يستحقّ الإيقاف — وإلا بقي عمود القرار فارغاً في كل لقطة.
 */
export const DEMO_ADS: SeedAd[] = [
  { adId: "ad-g1", campaignId: "demo-g-search", nameAr: "عرض الخصم — نصّ", nameEn: "Discount offer — text", type: "RESPONSIVE", perf: 1.45, share: 0.42, trend: "up" },
  { adId: "ad-g2", campaignId: "demo-g-search", nameAr: "شحن مجاني — نصّ", nameEn: "Free shipping — text", type: "RESPONSIVE", perf: 1.05, share: 0.34, trend: "flat" },
  { adId: "ad-g3", campaignId: "demo-g-search", nameAr: "ضمان الاسترجاع", nameEn: "Money-back guarantee", type: "RESPONSIVE", perf: 0.62, share: 0.24, trend: "down" },
  { adId: "ad-g4", campaignId: "demo-g-brand", nameAr: "الاسم التجاري", nameEn: "Brand name", type: "RESPONSIVE", perf: 1.2, share: 1, trend: "up" },
  { adId: "ad-m1", campaignId: "demo-m-retarget", nameAr: "سلة متروكة — صورة", nameEn: "Abandoned cart — image", type: "IMAGE", perf: 1.6, share: 0.38, trend: "up" },
  { adId: "ad-m2", campaignId: "demo-m-retarget", nameAr: "شهادات العملاء — كاروسيل", nameEn: "Testimonials — carousel", type: "CAROUSEL", perf: 1.1, share: 0.35, trend: "flat" },
  { adId: "ad-m3", campaignId: "demo-m-retarget", nameAr: "خصم ٢٤ ساعة", nameEn: "24-hour discount", type: "IMAGE", perf: 0.55, share: 0.27, trend: "down" },
  { adId: "ad-m4", campaignId: "demo-m-awareness", nameAr: "قصّة العلامة — ريلز", nameEn: "Brand story — Reels", type: "VIDEO", perf: 1.15, share: 0.45, trend: "flat" },
  { adId: "ad-m5", campaignId: "demo-m-awareness", nameAr: "قبل وبعد — صورة", nameEn: "Before and after — image", type: "IMAGE", perf: 0.78, share: 0.33, trend: "flat" },
  { adId: "ad-m6", campaignId: "demo-m-awareness", nameAr: "إعلان عام — صورة", nameEn: "Generic — image", type: "IMAGE", perf: 0.41, share: 0.22, trend: "down" },
  { adId: "ad-t1", campaignId: "demo-t-video", nameAr: "استخدام المنتج — ١٥ث", nameEn: "Product in use — 15s", type: "VIDEO", perf: 1.35, share: 0.4, trend: "up" },
  { adId: "ad-t2", campaignId: "demo-t-video", nameAr: "تجربة عميلة", nameEn: "Customer experience", type: "VIDEO", perf: 1.0, share: 0.35, trend: "flat" },
  { adId: "ad-t3", campaignId: "demo-t-video", nameAr: "فكّ التغليف", nameEn: "Unboxing", type: "VIDEO", perf: 0.6, share: 0.25, trend: "flat" },
  { adId: "ad-t4", campaignId: "demo-t-broad", nameAr: "جمهور واسع — أ", nameEn: "Broad — A", type: "VIDEO", perf: 0.9, share: 0.5, trend: "flat" },
  { adId: "ad-t5", campaignId: "demo-t-broad", nameAr: "جمهور واسع — ب", nameEn: "Broad — B", type: "VIDEO", perf: 0.7, share: 0.5, trend: "flat" },
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

/**
 * إصدار البذرة. **يُرفَع مع أيّ تعديل على أرقامها** - أسماءً كانت أو
 * أحجاماً أو معادلات. `seedDemoWorkspace` تقارنه بالمخزَّن على المساحة
 * وتُعيد البذر عند الاختلاف، فيصل التصحيح إلى من أنشأ ديموه قبله.
 *
 * ٢ = معايرة الربحية (٨ أغسطس ٢٠٢٦): ربط عدد الطلبات بالتحويلات المتحقَّقة
 *     بعد أن كان صافي الربح -٦٢ ألفاً لانفصالهما.
 *
 * ٤ = أسماء حملات جوجل تحمل منصّتها (٩ أغسطس ٢٠٢٦): كانت «بحث — …»
 *     وحدها بلا اسم منصّتها بين ستّ حملات تحمله، فبقي صفّاها بلا شعار في
 *     جداول الوكيل - وشعارٌ في أربعة صفوف وفراغٌ في اثنين يُقرأ إهمالاً.
 *
 * ٣ = تحويل العملة (٩ أغسطس ٢٠٢٦): صارت كلّ مبالغ البذرة تمرّ بمحوّلٍ
 *     يتبع عملة المساحة، بعد أن كان تبديل العملة يبدّل اللافتة وحدها.
 *     الرفع لازم هنا لا اختياريّ: المساحات القائمة `demoCurrency` فيها
 *     فارغة، فلا يلتقط فحصُ العملة اختلافاً ويبقى أصحابها على أرقامٍ
 *     بعملةٍ واحدة إلى الأبد.
 */
export const DEMO_SEED_VERSION = 4;

const DAYS = 90;

function wave(day: number, seed: number): number {
  return 1 + Math.sin((day + seed) * 0.7) * 0.18 + Math.sin((day + seed) * 0.23) * 0.11;
}

function weekend(d: Date): number {
  const w = d.getDay();
  return w === 5 || w === 6 ? 0.72 : 1;
}

// ==================== البذر ====================

export async function seedDemoData(
  workspaceId: string,
  locale: "ar" | "en",
  currency = "SAR",
): Promise<void> {
  const ar = locale === "ar";
  const name = <T extends { nameAr: string; nameEn: string }>(x: T) => (ar ? x.nameAr : x.nameEn);

  // ---------- العملة ----------
  //
  // 🔴 **العلّة التي عالجها هذا:** تبديل العملة في الإعدادات كان يبدّل
  // اللافتة وحدها - يقرأ المستخدم «69,000 ج.م» والرقم ريالات كما هو. أي
  // أنّنا كنّا نُعيد تسمية المال لا تحويله، وهو أسوأ من منع التبديل أصلاً.
  //
  // ومساحة العرض وحدها هي التي **تُحوَّل** فعلاً، لأنّ أرقامها من صنعنا.
  // الحساب الحقيقيّ لا يمرّ من هنا: عملته عملة حسابه الإعلانيّ، تأتي من
  // المنصّة ولا نختارها له - راجع `dataCurrency` في `SettingsClient`.
  const m = (v: number) => roundForCurrency(v * demoCurrencyScale(currency), currency);
  /** الرقم مكتوباً بعملته - لنصوص البذرة التي تذكر مبلغاً داخل جملة.
   *  `Intl` يعطي اسم العملة الصحيح للّغة، فلا يُكتب «ريال» في نصٍّ بالجنيه. */
  const fmt = (v: number) =>
    new Intl.NumberFormat(ar ? "ar-EG-u-nu-latn" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

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
  const snapshots: Prisma.MetricSnapshotCreateManyInput[] = [];
  const creatives: Prisma.CreativeSnapshotCreateManyInput[] = [];

  for (let i = DAYS; i >= 1; i--) {
    const date = day(i);
    const wf = weekend(date);

    DEMO_CAMPAIGNS.forEach((c, ci) => {
      const w = wave(i, ci * 3) * wf;
      const cost = m(c.baseCost * w);
      const clicks = Math.round(c.baseClicks * w);
      const raw = Math.max(0, Math.round(c.baseRaw * w));
      const verified = Math.round(raw * c.verifyRate);
      // 🔴 **الديمو يحاكي المصدرَين كما هما في الواقع، لا رقماً واحداً.**
      //
      // كان يكتب رقماً واحداً في `revenue` لكلّ منصّة، فيُظهر قدرةً لم تكن
      // موجودة: لا مزامنةَ إعلانيةٍ تملأ ذلك الحقل أصلاً. الآن:
      //
      //   `revenue`      ← ما تنسبه المنصّة لإعلانها (كـ`conversions_value`)
      //   `storeRevenue` ← مبيعات المتجر كلّها، وهي **أكبر** لأنّها تشمل
      //                     العضويّ والمباشر والمتكرّر
      //
      // والفارق بينهما مقصود: هو ما يجعل «عائد الإعلان» أقلّ من «مبيعاتك
      // ÷ إنفاقك» - وهو الفرق الذي بُني المنتج ليُظهره.
      const revenue = verified > 0 ? m(verified * c.aov) : null;
      // نحو ٤٠٪ فوق إيراد الإعلان: نسبةٌ شائعةٌ لما يأتي من غير الإعلان.
      const storeRevenue = revenue !== null ? m(revenue * 1.4) : null;

      snapshots.push({
        workspaceId, platform: c.platform, campaignId: c.id, date,
        impressions: clicks * 34, clicks, cost,
        rawConversions: raw, verifiedConversions: verified,
        revenue, storeRevenue, ordersCount: verified > 0 ? verified : null,
        returnedOrdersCount: verified > 0 ? Math.round(verified * 0.11) : null,
        // مرحلتا المسار بين النقرة والطلب. النسب ليست اعتباطية: نحو ثُمن
        // النقرات يضيف للسلّة، ونحو نصف هؤلاء يبدأ الدفع - وهو المدى الشائع
        // في متاجر التجزئة، فيبقى المخروط في مساحة العرض معقولاً لا مثالياً.
        addToCart: Math.max(1, Math.round(clicks * 0.12)),
        checkoutsStarted: Math.max(1, Math.round(clicks * 0.12 * 0.55)),
        cogs: revenue ? Math.round(revenue * 0.36) : null, // نسبة من إيرادٍ محوَّل أصلاً
        shippingCost: verified > 0 ? m(verified * 22) : null,
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
        const adCost = Math.round(cost * ad.share); // حصّة من تكلفةٍ محوَّلة
        const adClicks = Math.round(clicks * ad.share);
        // `i` عدد الأيام إلى الوراء، فـ`recency` صفر عند أقدم يوم وواحد
        // عند اليوم. الاتجاه ينحرف بها ±٣٥٪ - قدر يكفي ليقرأه كاشف
        // الإجهاد كاتجاه حقيقي، ولا يكفي ليقلب ترتيب الإعلانات رأساً.
        const recency = Math.max(0, Math.min(1, (30 - i) / 30));
        const trendFactor =
          ad.trend === "up" ? 0.82 + recency * 0.35
            : ad.trend === "down" ? 1.18 - recency * 0.35
              : 1;
        const adRaw = Math.max(0, Math.round(raw * ad.share * ad.perf * trendFactor));
        creatives.push({
          workspaceId, platform: c.platform, campaignId: c.id,
          adId: ad.adId, adName: name(ad), creativeType: ad.type,
          adGroupId: c.platform === "GOOGLE_ADS" ? `${c.id}-ag` : null,
          adSetId: c.platform !== "GOOGLE_ADS" ? `${c.id}-set` : null,
          headline: name(ad),
          finalUrl: "https://example-store.com/products",
          // **الظهور يتحرّك مستقلّاً عن النقر.** كان `adClicks * 34` ثابتاً،
          // أي أن نسبة النقر تساوي ١÷٣٤ في كل يوم ولكل إعلان: سلسلة
          // انحرافها المعياري صفر. كاشف الإجهاد يقيس شذوذ نسبة النقر
          // بالدرجة المعيارية، والقسمة على انحراف صفري تجعل أي فرق ضئيل
          // شذوذاً هائلاً - فوُسِمت كل الإعلانات «متعبة» واستُبعدت جميعاً
          // من ترشيح «أفضل إعلان»، فبدا القسم فارغاً بلا سبب مفهوم.
          date,
          impressions: Math.max(1, Math.round(adClicks * (34 / trendFactor) * (1 + Math.sin(i * 0.9 + ad.adId.length) * 0.12))),
          clicks: adClicks, cost: adCost,
          rawConversions: adRaw,
          verifiedConversions: Math.round(adRaw * c.verifyRate),
          conversionsValue: c.aov > 0 ? m(adRaw * c.verifyRate * c.aov) : null,
        });
      }
    });
  }

  await Promise.all([
    prisma.metricSnapshot.createMany({ data: snapshots, skipDuplicates: true }),
    prisma.creativeSnapshot.createMany({ data: creatives, skipDuplicates: true }),
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
        cost: m(96 * (1 + ti * 0.18)),
        conversions: Math.round(6 * (q as number)),
      }))
    ),
    skipDuplicates: true,
  });

  // ---------- المنتجات ----------
  await prisma.product.createMany({
    data: DEMO_PRODUCTS.map((p) => ({
      workspaceId, name: name(p), sku: p.sku,
      currentPrice: m(p.price), cogs: m(p.cogs),
      outboundShippingCost: m(p.ship), returnShippingCost: m(p.ship),
      avgAdCostPerOrder: m(46), rtoRatePct: p.rto,
      // النسبة لا تُحوَّل، والرسم الثابت يُحوَّل - وهذا الفرق بعينه
      paymentGatewayFeePct: 2.75, paymentGatewayFixedFee: m(1),
      desiredMarginPct: p.margin,
    })),
    skipDuplicates: true,
  });

  // ---------- إعدادات مستقلّة: تُكتب معاً ----------
  await Promise.all([
    // 🔴 **متجرٌ واحد كان يجعل صفحة المقارنة تعرض نفسها فارغة.** والأسوأ
    // أنّ نتيجة الإنشاء كانت تُرمى (`.catch(() => {})` بلا التقاط
    // المعرّف)، فالطلبات تُكتب بلا `connectionId` - فتقول بطاقة التكاملات
    // «1284 طلباً» وتقول صفحة المقارنة «0» عن المتجر نفسه، ويظهر الكلّ
    // تحت «غير منسوب». رقمان متناقضان لمتجرٍ واحد في شاشتين.
    //
    // ومتجران لا واحد لأنّ الميزة نفسها هي المقارنة: ديمو بمتجرٍ واحد
    // يعرض صفحةً تشرح أنّها لا تعمل.
    prisma.ecommerceConnection.createMany({
      data: [
        {
          workspaceId, platform: "SALLA",
          storeName: ar ? "متجر النخبة" : "Elite Store",
          storeUrl: "https://elite-store.example",
          active: true, lastOrderAt: day(0), ordersReceived: 899,
        },
        {
          // متجر الجملة: متوسّط طلبٍ أعلى وهامشٌ أقلّ - فيخرج الأعلى
          // إيراداً والأقلّ ربحاً. وهو بالضبط ما وُجدت الصفحة لتكشفه.
          workspaceId, platform: "SALLA",
          storeName: ar ? "النخبة للجملة" : "Elite Wholesale",
          storeUrl: "https://elite-wholesale.example",
          active: true, lastOrderAt: day(1), ordersReceived: 385,
        },
      ],
      skipDuplicates: true,
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
    ),
    skipDuplicates: true,
  });

  // ---------- قرارات معلّقة ----------
  //
  // 🔴 **مفتاحٌ ومتغيّراته لا نصّاً مبنيّاً.** كانت البطاقات تُبذَر
  // بلغة إنشاء المساحة (`ar ? ... : ...`)، فمن بذر ديمو بالإنجليزية ثمّ
  // بدّل واجهته للعربية يقرأ أربع بطاقاتٍ إنجليزية وسط صفحةٍ عربية -
  // ولا سبيل لإصلاحها بعدها لأنّ النصّ محفوظٌ لا محسوب.
  const feed = (k: string) => `demoFeed.${k}`;
  await prisma.actionFeedItem.createMany({
    data: [
      {
        workspaceId, type: "SUGGESTION" as const, severity: "HIGH" as const,
        titleKey: feed("broadTitle"),
        descKey: feed("broadBody"),
        // الأرقام تُحوَّل بالعملة كما يُحوَّل كلّ رقمٍ آخر - راجع `fmt`/`m`
        descVars: { daily: fmt(m(295)), monthly: fmt(m(8850)) },
        title: t(locale, "demoFeed.broadTitle"),
        description: t(locale, "demoFeed.broadBody", { daily: fmt(m(295)), monthly: fmt(m(8850)) }),
        linkUrl: "/dashboard/campaigns/creatives",
      },
      {
        workspaceId, type: "SUGGESTION" as const, severity: "MEDIUM" as const,
        titleKey: feed("scaleTitle"),
        descKey: feed("scaleBody"),
        title: t(locale, "demoFeed.scaleTitle"),
        description: t(locale, "demoFeed.scaleBody"),
        linkUrl: "/dashboard/campaigns/creatives",
      },
      {
        workspaceId, type: "ALERT" as const, severity: "URGENT" as const,
        titleKey: feed("inflationTitle"),
        descKey: feed("inflationBody"),
        title: t(locale, "demoFeed.inflationTitle"),
        description: t(locale, "demoFeed.inflationBody"),
        linkUrl: "/dashboard/truth",
      },
      {
        workspaceId, type: "ALERT" as const, severity: "HIGH" as const,
        titleKey: feed("lossTitle"),
        descKey: feed("lossBody"),
        descVars: { gap: m(41), currency },
        title: t(locale, "demoFeed.lossTitle"),
        description: t(locale, "demoFeed.lossBody", { gap: m(41), currency }),
        linkUrl: "/dashboard/pricing",
      },
    ],
    skipDuplicates: true,
  });


  // ---------- طبقة اللمسات: تُغذّي نماذج الإسناد الثمانية ----------
  //
  // بدونها يبقى «مركز الحقيقة» فارغاً تماماً: النماذج تُحسب من مسار
  // اللمسات لا من لقطات الأداء. الرحلات هنا متعدّدة المنصّات عمداً -
  // وهي بالضبط ما لا تستطيع أي لوحة منصّة منفردة أن تراه.
  const touchpoints: Prisma.TouchpointCreateManyInput[] = [];
  const conversions: Prisma.ConversionEventCreateManyInput[] = [];

  // المنصّة والقناة نوعان مُعدّدان لا نصّان حرّان: كتابتهما `string` هي
  // ما سمح لخطأ حقلٍ غير موجود بأن يمرّ إلى وقت التشغيل من قبل.
  const JOURNEYS: Array<{ path: Array<[Platform, string]>; value: number }> = [
    { path: [["META_ADS", "demo-m-awareness"], ["GOOGLE_ADS", "demo-g-brand"]], value: m(520) },
    { path: [["TIKTOK_ADS", "demo-t-video"], ["META_ADS", "demo-m-retarget"], ["GOOGLE_ADS", "demo-g-brand"]], value: m(690) },
    { path: [["GOOGLE_ADS", "demo-g-search"]], value: m(480) },
    { path: [["META_ADS", "demo-m-retarget"]], value: m(410) },
    { path: [["META_ADS", "demo-m-awareness"], ["META_ADS", "demo-m-retarget"]], value: m(455) },
    { path: [["TIKTOK_ADS", "demo-t-video"], ["GOOGLE_ADS", "demo-g-search"]], value: m(610) },
  ];

  const CHANNEL: Partial<Record<Platform, TouchpointChannel>> = {
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
          channel: CHANNEL[platform] ?? "OTHER",
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
        // 🔴 كانت `"SAR"` ثابتةً. فمساحةٌ أُعيد بذرها بالجنيه تُنتج صفوف
        // تحويلٍ موسومةً بالريال - قيمةٌ محوَّلة تحمل لافتة العملة القديمة.
        currency,
        verified: true,
        matchQualityScore: 7 + (ji % 3),
      });
    });
  }

  await Promise.all([
    prisma.touchpoint.createMany({ data: touchpoints, skipDuplicates: true }),
    prisma.conversionEvent.createMany({ data: conversions, skipDuplicates: true }),
  ]);

  // ---------- المتجر: عملاء وطلبات ومبيعات لكل منتج ----------
  const products = await prisma.product.findMany({
    where: { workspaceId },
    select: { id: true, sku: true, currentPrice: true },
  });

  // المتجران اللذان أُنشئا أعلاه - بترتيب إنشائهما، فالأوّل التجزئة.
  const demoStores = await prisma.ecommerceConnection.findMany({
    where: { workspaceId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const retailStoreId = demoStores[0]?.id ?? null;
  const wholesaleStoreId = demoStores[1]?.id ?? retailStoreId;

  // 🔴 **الحملات تُنسب إلى قنواتها هنا لا عند إنشائها**، لأنّ المتجرين
  // يُنشآن بعدها فلا معرّف لهما وقتَ كتابة الروابط.
  //
  // وبغير هذه النسبة يبقى «العائد على الإنفاق لكلّ قناة» شرطةً في كلّ
  // شاشة: الطلبات تعرف متجرها والإنفاق لا يعرف، فلا يُقسَم - وهو رفضٌ
  // صحيح، لكنّ ديمو يعرضه على كلّ صفٍّ يبدو ميزةً معطّلة لا امتناعاً
  // مقصوداً. و«جمهور واسع» تبقى بلا قناة عمداً: لافتة «إنفاقٌ غير منسوب»
  // نفسها ميزةٌ يجب أن تُرى وهي تعمل.
  if (retailStoreId && wholesaleStoreId) {
    await Promise.all(
      DEMO_CAMPAIGNS.filter((c) => c.store).map((c) =>
        prisma.campaignLink.updateMany({
          where: { workspaceId, externalCampaignId: c.id },
          data: { connectionId: c.store === "wholesale" ? wholesaleStoreId : retailStoreId },
        })
      )
    );
  }

  const CITIES = ar
    ? ["الرياض", "جدة", "الدمام", "مكة", "المدينة"]
    : ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina"];

  // 🔴 كانوا أربعين عميلاً لمئة وستّين طلباً. بعد معايرة حجم المتجر صاروا
  // يحملون ألفاً وأربعمئة طلب - ستّة وثلاثون طلباً للعميل الواحد في شهرين،
  // وهو رقمٌ لا يوجد في متجر حقيقيّ. العدد يتبع الطلبات: ~٣ طلبات لكلّ
  // عميل، وهو معدّل تكرارٍ معقول لمتجر عناية بالبشرة.
  //
  // 🔴 **والتوزيع غير متساوٍ عمداً.** كان كلّ عميل يأخذ العدد نفسه
  // (`oi % العدد`)، فيخرج كلّ عملاء المتجر مشترين متكرّرين: «نسبة الشراء
  // المتكرّر ١٠٠٪»، وشريحة «اشترى مرّةً» فارغة، و«العميل العائد يساوي…»
  // شرطةً لأنّ لا مشترِيَ مرّةٍ واحدة يُقاس عليه. والمتجر الحقيقيّ ذيلٌ
  // طويل: أغلبهم مرّة، وقلّةٌ تحمل الإيراد.
  const REPEAT_SHAPE: Array<{ share: number; orders: number }> = [
    { share: 0.60, orders: 1 },
    { share: 0.20, orders: 2 },
    { share: 0.12, orders: 3 },
    { share: 0.06, orders: 5 },
    { share: 0.02, orders: 10 },
  ];
  const ORDERS_PER_CUSTOMER = REPEAT_SHAPE.reduce((s, r) => s + r.share * r.orders, 0);
  const CUSTOMER_COUNT = Math.round((ORDERS_PER_DAY * ORDER_DAYS) / ORDERS_PER_CUSTOMER);
  const customers = Array.from({ length: CUSTOMER_COUNT }, (_, ci) => ({
    workspaceId,
    platform: "SALLA" as const,
    externalCustomerId: `demo-cust-${ci}`,
    displayName: ar ? `عميل ${ci + 1}` : `Customer ${ci + 1}`,
    city: CITIES[ci % CITIES.length],
    country: "SA",
    // المجاميع تُشتقّ من الطلبات بعد كتابتها - راجع التجميع أسفل
    ordersCount: 0,
    totalSpent: 0,
    // `60 - ci` كان يصير سالباً بعد العميل الستّين، أي تاريخ أوّل طلب في
    // **المستقبل**. الباقي يبقيه داخل الأفق مهما كبر العدد.
    firstOrderAt: day(ORDER_DAYS - (ci % ORDER_DAYS)),
    lastOrderAt: day(ci % 20),
  }));
  await prisma.customer.createMany({ data: customers, skipDuplicates: true });

  const savedCustomers = await prisma.customer.findMany({
    where: { workspaceId },
    select: { id: true, externalCustomerId: true },
  });

  // 🔴 **كان `oi % ORDER_DAYS`: العدد نفسه في كلّ يومٍ بالضبط.**
  //
  // ومتجرٌ يبيع الرقم نفسه ستّين يوماً لا وجود له. وأثرُه ليس تجميلياً:
  // خطّ الاتّجاه داخل بطاقة «الطلبات» يرفض الرسم على سلسلةٍ مسطّحة -
  // وهو رفضٌ صحيح - فتبقى ميزةٌ مبنيّة غير مرئيّةٍ في الديمو كلّه.
  //
  // الشكل هنا حتميٌّ لا عشوائيّ (البذرة نفسها تُنتج الأرقام نفسها في كلّ
  // تشغيل): موجةٌ أسبوعية - نهاية الأسبوع أعلى - مع تموّجٍ خفيفٍ فوقها.
  const dayWeights = Array.from({ length: ORDER_DAYS }, (_, d) => {
    const dow = d % 7;
    const weekend = dow === 5 || dow === 6 ? 1.35 : dow === 0 ? 1.1 : 0.88;
    // تموّجٌ لطيف يمنع تكرار الأسبوع حرفياً سبع مرّات
    return weekend * (1 + 0.18 * Math.sin(d / 3.1));
  });
  const weightSum = dayWeights.reduce((a, b) => a + b, 0);
  const TOTAL_ORDERS = ORDERS_PER_DAY * ORDER_DAYS;
  /** يوم الطلب رقم `oi` - يتبع الأوزان أعلاه، ومجموع الطلبات لا يتغيّر. */
  const dayOfOrder: number[] = [];
  {
    let assigned = 0;
    dayWeights.forEach((w, d) => {
      const n = Math.round((w / weightSum) * TOTAL_ORDERS);
      for (let k = 0; k < n && assigned < TOTAL_ORDERS; k++, assigned++) dayOfOrder.push(d);
    });
    // ما تبقّى بعد التقريب يُلحق باليوم الأحدث
    while (dayOfOrder.length < TOTAL_ORDERS) dayOfOrder.push(0);
  }
  const orderDayFor = (oi: number) => dayOfOrder[oi % dayOfOrder.length];

  const orders: Prisma.OrderCreateManyInput[] = [];
  // العدد مشتقّ لا مكتوب: `ORDERS_PER_DAY` تتبع التحويلات المتحقَّقة من
  // الحملات، و`oi % ORDER_DAYS` توزّعها بالتساوي على الأفق - فيخرج بالضبط
  // ما تُنتجه الحملات في اليوم، لا رقماً موازياً لها.
  // خانةٌ لكلّ طلبٍ يحملها صاحبه: عميلٌ بعشرة طلبات يظهر عشر مرّات.
  // فتتبع القسمةُ الذيلَ أعلاه بدل أن توزّع بالتساوي.
  const customerSlots: number[] = [];
  {
    let ci = 0;
    for (const band of REPEAT_SHAPE) {
      const n = Math.round(savedCustomers.length * band.share);
      for (let k = 0; k < n && ci < savedCustomers.length; k++, ci++) {
        for (let r = 0; r < band.orders; r++) customerSlots.push(ci);
      }
    }
    // ما تبقّى بعد التقريب يُلحق بالمشترين مرّةً واحدة
    for (; ci < savedCustomers.length; ci++) customerSlots.push(ci);
  }

  for (let oi = 0; oi < ORDERS_PER_DAY * ORDER_DAYS; oi++) {
    const cust = savedCustomers[customerSlots[oi % customerSlots.length]];
    const p = products[oi % products.length];
    const qty = (oi % 3) + 1;
    const total = Math.round(p.currentPrice * qty);
    // نحو أحد عشر بالمئة مرتجعات - نفس النسبة في لقطات الأداء
    const returned = oi % 9 === 0;
    // سبعون بالمئة للتجزئة والباقي للجملة - نسبةٌ غير متساوية عمداً:
    // متجران متطابقان لا يُنتجان فائزاً، فلا تُظهر الصفحة ما بُنيت له.
    const isWholesale = oi % 10 >= 7;
    orders.push({
      workspaceId, platform: "SALLA",
      connectionId: isWholesale ? wholesaleStoreId : retailStoreId,
      externalOrderId: `demo-order-${oi}`,
      customerId: cust.id,
      orderedAt: day(orderDayFor(oi)),
      total, shippingCost: m(22), currency,
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
  await prisma.order.createMany({ data: orders, skipDuplicates: true });

  // 🔴 **مجاميع العميل تُشتقّ من طلباته لا تُكتب صفراً.**
  //
  // كان صفّ العميل يُنشأ بـ`totalSpent: 0`، فتقرأ صفحة العملاء كلّها
  // أصفاراً: «متوسّط قيمة العميل ٠»، وكلّ شريحة بإيراد ٠، ومضاعِف
  // العميل المتكرّر بلا معنى - بينما الطلبات تحته تقول مئات الآلاف.
  // والمسار الحقيقيّ (`upsertCustomer`) يزيدها مع كلّ طلب، فالديمو وحده
  // كان يخالفه. تُبنى هنا من الطلبات نفسها التي كُتبت للتوّ، فيتّفق
  // الرقمان لأنّهما صارا رقماً واحداً.
  const orderRollup = new Map<string, { n: number; spent: number; returned: number }>();
  for (const o of orders) {
    const id = o.customerId as string;
    if (!id) continue;
    const acc = orderRollup.get(id) ?? { n: 0, spent: 0, returned: 0 };
    acc.n++;
    acc.spent += o.total as number;
    if (o.isReturned) acc.returned++;
    orderRollup.set(id, acc);
  }
  await Promise.all(
    [...orderRollup].map(([id, acc]) =>
      prisma.customer.update({
        where: { id },
        data: { ordersCount: acc.n, totalSpent: acc.spent, returnedOrdersCount: acc.returned },
      })
    )
  );

  // نصف المنتجات لكلّ متجر. وبدون هذا النسب يرفض `priceSync` تعديل أيّ
  // سعر حين يكون للمساحة أكثر من متجرٍ قابلٍ للكتابة - وهو رفضٌ صحيح، لكن
  // ديمو يعرضه على كلّ منتج يبدو معطّلاً.
  if (retailStoreId && wholesaleStoreId) {
    const half = Math.ceil(products.length / 2);
    await Promise.all([
      prisma.product.updateMany({
        where: { id: { in: products.slice(0, half).map((x) => x.id) } },
        data: { connectionId: retailStoreId },
      }),
      prisma.product.updateMany({
        where: { id: { in: products.slice(half).map((x) => x.id) } },
        data: { connectionId: wholesaleStoreId },
      }),
    ]);
  }

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
    }),
    skipDuplicates: true,
  });


  // ==================== الأقسام الداخلية ====================
  //
  // البذر الأول غطّى الصفحة الرئيسية وحدها، فبدت عشرات الصفحات الداخلية
  // فارغة داخل ديمو يُفترض أن يُصوَّر منه فيديو لكل قدرة في المنتج. كل
  // جدول هنا يقف خلفه قسم حقيقي، والأرقام تتبع القصّة نفسها: جوجل تتحقّق،
  // ميتا أقلّ، وتيك توك الأضعف.

  const gCampaigns = ["demo-g-search", "demo-g-brand"];

  // ---------- درجة الجودة (جوجل) ----------
  const KEYWORDS = ar
    ? ["خدمات تنظيف", "شركة تنظيف منازل", "تنظيف مكيفات", "عرض سعر تنظيف", "تنظيف بعد البناء", "تنظيف سجاد"]
    : ["cleaning services", "home cleaning company", "ac cleaning", "cleaning quote", "post-construction cleaning", "carpet cleaning"];
  await prisma.qualityScoreSnapshot.createMany({
    data: KEYWORDS.map((kw, i) => ({
      workspaceId,
      campaignId: gCampaigns[i % gCampaigns.length],
      criterionId: `demo-kw-${i}`,
      keywordText: kw,
      // مدى ٤-٩ عمداً: درجة جودة كلّها ممتازة لا تُظهر القسم أصلاً
      qualityScore: [9, 8, 6, 7, 4, 5][i],
      adRelevance: i % 3 === 2 ? "BELOW_AVERAGE" : "ABOVE_AVERAGE",
      landingPageExperience: i === 4 ? "BELOW_AVERAGE" : "AVERAGE",
      expectedCtr: i % 2 === 0 ? "ABOVE_AVERAGE" : "AVERAGE",
    })),
    skipDuplicates: true,
  });

  // ---------- منتجات التسوّق ----------
  //
  // 🔴 **كان الإنفاق رقماً ثابتاً (`640 + i*130`) لا علاقة له بمبيعات
  // المنتج، فأنتج عائداً خرافياً: ١١٢ ضعفاً وعائد استثمار ‎+٤٤٥٨٪‎.**
  //
  // ولم يكن خطأً وقت كُتب: هذا الحقل كان يغذّي تنبيه «منتج يصرف بلا
  // مبيعات» وحده، وهناك يهمّ أن يتجاوز عتبةً لا أن يكون متناسباً. ثمّ صار
  // **مقاماً** لعائد المنتج، فظهر عُواره: مبيعاتٌ بـ‎٧١٬٧١٢‎ مقابل إنفاقٍ
  // بـ‎٦٤٠‎ رقمان لا يجتمعان في متجرٍ حقيقيّ.
  //
  // فيُشتقّ الإنفاق الآن **من مبيعات كلّ منتج فعلاً**، بعائدٍ مستهدَفٍ
  // يروي قصّة المنتج نفسها التي تحكيها بقيّة البذرة - ويُقارَن بنقطة
  // التعادل الحقيقية لهامشه (١ ÷ الهامش) لا برقمٍ عامّ:
  //
  //   سيروم فيتامين سي  ٤٫٦× مقابل تعادلٍ عند ٢٫٩×  → رابحٌ بوضوح
  //   كريم مرطّب        ٣٫٦× مقابل ٣٫٣×             → ربحٌ ضئيل
  //   المجموعة الكاملة  ١٫٩× مقابل ٣٫١×             → خسارةٌ فعلية (مقصودة)
  //   غسول لطيف         ٤٫١× مقابل ٢٫٥×             → رابح
  //   واقي شمس          ٢٫٦× مقابل ٢٫٨×             → تحت التعادل بقليل
  const TARGET_ROAS = [4.6, 3.6, 1.9, 4.1, 2.6];

  const saleAgg = await prisma.productSaleEvent.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { revenue: true },
  });
  const revenueByProductId = new Map(saleAgg.map((r) => [r.productId, r._sum.revenue ?? 0]));
  // الربط بالـSKU هو نفسه الذي يستعمله عائد المنتج في الإنتاج
  // (`sku` ← `item_id`)، فالبذرة تختبر الجسر الحقيقيّ لا تلتفّ حوله.
  const revenueBySku = new Map(
    products.map((p) => [p.sku ?? "", revenueByProductId.get(p.id) ?? 0])
  );

  await prisma.shoppingProductSnapshot.createMany({
    data: DEMO_PRODUCTS.map((p, i) => {
      // المبيعات محوَّلةٌ للعملة بالفعل (سعر المنتج مرّ على `m`)، فلا
      // تُحوَّل مرّةً ثانية - والقسمة على العائد تبقيها في العملة نفسها.
      const revenue = revenueBySku.get(p.sku) ?? 0;
      const cost = revenue > 0 ? Math.round(revenue / TARGET_ROAS[i]) : m(320);
      return {
        workspaceId,
        accountId: "demo-google-1",
        itemId: p.sku,
        title: ar ? p.nameAr : p.nameEn,
        feedLabel: "SA",
        hasIssues: i === 2,
        issuesDetail: i === 2 ? (ar ? "صورة مفقودة" : "Missing image") : null,
        clicks: 210 + i * 45,
        impressions: 4_800 + i * 900,
        conversions: i === 2 ? 0 : 12 + i * 4,
        cost,
      };
    }),
    skipDuplicates: true,
  });

  // ---------- أماكن الظهور / الجهاز / الموقع / يوتيوب / الجمهور ----------
  const placements: Prisma.DisplayPlacementSnapshotCreateManyInput[] = [];
  const devices: Prisma.DevicePerformanceSnapshotCreateManyInput[] = [];
  const geos: Prisma.GeoPerformanceSnapshotCreateManyInput[] = [];
  const youtube: Prisma.YoutubeMetricSnapshotCreateManyInput[] = [];
  const audiences: Prisma.AudienceSegmentSnapshotCreateManyInput[] = [];
  const matchTypes: Prisma.MatchTypeSnapshotCreateManyInput[] = [];
  const pmax: Prisma.PmaxChannelSnapshotCreateManyInput[] = [];

  const PLACEMENTS = [
    { id: "youtube.com", name: "YouTube", type: "YOUTUBE_CHANNEL", q: 1.0 },
    { id: "news-app-1", name: ar ? "تطبيق أخبار" : "News app", type: "MOBILE_APPLICATION", q: 0.28 },
    { id: "game-app-7", name: ar ? "لعبة جوّال" : "Mobile game", type: "MOBILE_APPLICATION", q: 0.1 },
    { id: "recipes.example", name: ar ? "موقع وصفات" : "Recipes site", type: "WEBSITE", q: 0.72 },
  ];
  const DEVICES = [
    { d: "MOBILE", share: 0.62, q: 0.82 },
    { d: "DESKTOP", share: 0.29, q: 1.15 },
    { d: "TABLET", share: 0.09, q: 0.55 },
  ];
  const GEOS = ar
    ? [{ g: "الرياض", s: 0.44 }, { g: "جدة", s: 0.27 }, { g: "الدمام", s: 0.17 }, { g: "أبها", s: 0.12 }]
    : [{ g: "Riyadh", s: 0.44 }, { g: "Jeddah", s: 0.27 }, { g: "Dammam", s: 0.17 }, { g: "Abha", s: 0.12 }];
  const MATCH = [
    { m: "EXACT", s: 0.3, q: 1.35 },
    { m: "PHRASE", s: 0.38, q: 0.95 },
    { m: "BROAD", s: 0.32, q: 0.48 },
  ];
  const PMAX_CHANNELS = ["SEARCH", "SHOPPING", "DISPLAY", "YOUTUBE"];

  // أربعة عشر يوماً تكفي كل هذه الأقسام - نطاقها الزمني في الواجهة أقصر
  for (let d = 14; d >= 1; d--) {
    const when = day(d);
    // نهاية الأسبوع أهدأ - نفس معامل بقيّة البذر، محسوباً موضعياً
    const w = when.getDay() === 5 || when.getDay() === 6 ? 0.72 : 1;

    for (const p of PLACEMENTS) {
      placements.push({
        workspaceId, campaignId: "demo-g-brand", placement: p.id, displayName: p.name,
        placementType: p.type, date: when,
        impressions: Math.round(2_400 * w * (0.5 + p.q)),
        clicks: Math.round(60 * w * (0.5 + p.q)),
        cost: m(95 * w * (1.4 - p.q * 0.5)),
        conversions: Math.round(6 * w * p.q),
      });
    }

    for (const dev of DEVICES) {
      devices.push({
        workspaceId, campaignId: "demo-g-search", date: when, device: dev.d,
        impressions: Math.round(5_200 * dev.share * w),
        clicks: Math.round(190 * dev.share * w),
        cost: m(430 * dev.share * w),
        conversions: Math.round(22 * dev.share * dev.q * w),
      });
    }

    for (const g of GEOS) {
      geos.push({
        workspaceId, campaignId: "demo-g-search", date: when, geoTarget: g.g,
        impressions: Math.round(5_200 * g.s * w),
        clicks: Math.round(190 * g.s * w),
        cost: m(430 * g.s * w),
        conversions: Math.round(22 * g.s * w),
      });
    }

    youtube.push({
      workspaceId, campaignId: "demo-g-brand", date: when,
      impressions: Math.round(9_400 * w),
      videoViews: Math.round(3_100 * w),
      videoViewRate: 0.33,
      engagementRate: 0.041,
      cost: m(210 * w),
      conversions: Math.round(7 * w),
    });

    for (const [ai, name] of (ar
      ? ["مهتمّون بالتنظيف", "زوّار الموقع", "عملاء سابقون"]
      : ["Cleaning intenders", "Site visitors", "Past customers"]).entries()) {
      audiences.push({
        workspaceId, campaignId: "demo-g-brand", criterionId: `demo-aud-${ai}`,
        criterionType: name, date: when,
        impressions: Math.round(3_200 * w * (1 - ai * 0.22)),
        clicks: Math.round(105 * w * (1 - ai * 0.2)),
        cost: m(140 * w * (1 - ai * 0.18)),
        conversions: Math.round(9 * w * (1 + ai * 0.35)),
      });
    }

    // `mt` لا `m`: الأخيرة صارت محوّل العملة أعلى الدالة، واسمُ متغيّر
    // الحلقة كان يحجبها هنا وحدها - فيمرّ الرقم بلا تحويل بلا خطأ أنواع.
    for (const mt of MATCH) {
      matchTypes.push({
        workspaceId, campaignId: "demo-g-search", matchType: mt.m, date: when,
        impressions: Math.round(5_200 * mt.s * w),
        clicks: Math.round(190 * mt.s * w),
        cost: m(430 * mt.s * w),
        conversions: Math.round(22 * mt.s * mt.q * w),
      });
    }

    PMAX_CHANNELS.forEach((ch, ci) => {
      pmax.push({
        workspaceId, campaignId: "demo-g-brand", date: when, channel: ch,
        impressions: Math.round(4_100 * w * (1 - ci * 0.18)),
        clicks: Math.round(130 * w * (1 - ci * 0.2)),
        cost: m(180 * w * (1 - ci * 0.15)),
        conversions: Math.round(8 * w * (1 - ci * 0.22)),
      });
    });
  }

  await Promise.all([
    prisma.displayPlacementSnapshot.createMany({ data: placements, skipDuplicates: true }),
    prisma.devicePerformanceSnapshot.createMany({ data: devices, skipDuplicates: true }),
    prisma.geoPerformanceSnapshot.createMany({ data: geos, skipDuplicates: true }),
    prisma.youtubeMetricSnapshot.createMany({ data: youtube, skipDuplicates: true }),
    prisma.audienceSegmentSnapshot.createMany({ data: audiences, skipDuplicates: true }),
    prisma.matchTypeSnapshot.createMany({ data: matchTypes, skipDuplicates: true }),
    prisma.pmaxChannelSnapshot.createMany({ data: pmax, skipDuplicates: true }),
  ]);

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
          cost: { before: m(8960), after: m(10740), changePct: 19.9 },
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
    ],
    skipDuplicates: true,
  });
}
