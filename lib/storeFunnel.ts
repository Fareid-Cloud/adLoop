// lib/storeFunnel.ts
//
// مسار الشراء - **من الظهور إلى طلبٍ بقي.**
//
// 🔴 **تصحيحٌ لموقفٍ سابقٍ كان خطأً:** كُتب هنا أنّ «إضافة للسلّة» و«بدء
// الدفع» غير متاحتين لأنّ ويب هوك الطلب لا يرسلهما. صحيحٌ أنّه لا يرسلهما،
// وغيرُ ذي صلة: **المنصّات الإعلانية نفسها تبلّغ عنهما** كأحداث تحويلٍ لها
// تكلفتها المستقلّة، ولهذا تظهران في لوحة جوجل وميتا مع «تكلفة الإضافة
// للسلّة». والمالك أشار إلى ذلك، والوثائق أكّدته:
//
//   جوجل: `ADD_TO_CART` و`BEGIN_CHECKOUT` فئتا تحويلٍ رسميّتان، تُقرآن
//          بتقسيم `metrics.conversions` على `segments.conversion_action`.
//   ميتا:  `add_to_cart` و`initiate_checkout` داخل مصفوفة `actions` التي
//          كنّا نقرؤها **بالفعل** لاستخراج الليدز.
//
// المراحل خمسٌ كلّها من مصادر حقيقية:
//
//   ظهور        `MetricSnapshot.impressions`       - المنصّة عرضت الإعلان
//   نقرة        `MetricSnapshot.clicks`            - أحدهم ضغط
//   سلّة        `MetricSnapshot.addToCart`         - من المنصّة الإعلانية
//   دفع         `MetricSnapshot.checkoutsStarted`  - من المنصّة الإعلانية
//   طلبٌ بقي    `ordersCount` ناقص `returnedOrdersCount`
//
// **والمرحلة الأخيرة هي المقصودة.** بقيّة الأدوات تنتهي عند «طلب» وتحسبه
// نجاحاً؛ ومَن يبيع بالدفع عند الاستلام يعرف أنّ الطلب ليس بيعاً حتى
// يُستلَم. الفارق بين الرابعة والخامسة هو ما لا تريه لوحةُ أيّ منصّة.

import { prisma } from "@/lib/prisma";

export interface FunnelStage {
  /** مفتاح الترجمة - لا نصّ: المرحلة تُقرأ بلغة الواجهة */
  key: string;
  value: number;
  /** قيمة المرحلة نفسها في الفترة **السابقة** مباشرةً وبالطول نفسه.
   *  رقمٌ بلا سابقه لا يُقرأ منه اتّجاه: ٢٠ ألف طلب جيّدةٌ أم سيّئة؟ */
  prevValue: number;
  /** التغيّر عن الفترة السابقة - `null` حين لا سابق له (صفر) فالقسمة عليه
   *  تعطي ما لا نهاية، و«+∞٪» ليست معلومة. */
  changePct: number | null;
  /** تكلفة الوصول إلى هذه المرحلة مرّةً واحدة: الصرف ÷ عدد المرّات.
   *  وهو ما تسمّيه المنصّات «تكلفة الإضافة للسلّة» وأخواتِها - رقمُ قرارٍ
   *  لا رقمُ عرض: به يُعرَف أين يغلو المسار قبل أن يصل إلى بيع. */
  costPer: number | null;
  /** نسبة الباقين من المرحلة التي قبلها - `null` للأولى فلا شيء قبلها */
  keptFromPrevPct: number | null;
  /** نسبة الباقين من أوّل المسار - يقيس المسار كلّه لا خطوةً منه */
  keptFromTopPct: number | null;
  /** 🔴 **هل هذه المرحلة مقيسةٌ أصلاً؟**
   *
   *  المالك رأى «إضافة للسلّة: صفر» بينما في الحساب طلباتٌ فعلاً - وهو
   *  مستحيلٌ منطقاً: لا يصل أحدٌ إلى طلبٍ دون أن يمرّ بالسلّة. والسبب أنّ
   *  الحساب لا يبلّغ عن هذه الفئة (لم تُعرَّف عنده كإجراء تحويل)، فيصل
   *  المجموع `null` ويُعرَض صفراً.
   *
   *  والصفر كذبٌ هنا: يُقرأ «لم يضف أحدٌ للسلّة»، والحقيقة «لا نقيس ذلك».
   *  فتُميَّز الحالتان، ويُعرَض الغياب غياباً. */
  measured: boolean;
}

export interface StoreFunnel {
  stages: FunnelStage[];
  /** عملة المساحة - تكلفةُ المرحلة مبلغٌ، والمبلغ بلا عملته رقمٌ مجهول */
  currency: string;
  /** أضعف انتقالٍ في المسار: أين يُفقد أكبر عددٍ نسبةً إلى ما قبله.
   *  لا يُحتسب من المرحلة الأولى (الظهور ← النقرة يسقط دائماً بالجملة). */
  weakestStepKey: string | null;
  /** 🔴 **«غير مقيسة» لها سببان مختلفان تماماً، والرسالة كانت تقول واحداً.**
   *
   *  السبب الأوّل: لا تتبّعَ مركَّباً أصلاً - فلا بيكسل ولا وسم على الموقع،
   *  والعلاج تركيبُه (عملُ ساعة).
   *  والثاني: التتبّع يعمل، لكنّ حدث السلّة **لم يُعرَّف كإجراء تحويل** في
   *  الحساب الإعلانيّ - فالبيكسل يرسله والمنصّة لا تعدّه، والعلاج إعدادٌ
   *  في لوحة المنصّة (دقيقة).
   *
   *  والتفرقة بينهما من بياناتٍ عندنا: إن كان الحساب يبلّغ عن **أيّ** تحويل
   *  في الفترة، فالتتبّع حيٌّ ولا ينقص إلّا تعريفُ هذا الحدث بعينه. */
  trackingLive: boolean;
  /** أكبر تسرّب: المرحلة التي فُقد عندها أكبر **عدد** - لا أكبر نسبة.
   *
   *  🔴 والفرق جوهريّ: انتقالٌ يُبقي ٣٪ من مليونٍ يخسر ٩٧٠ ألفاً، وآخرُ
   *  يُبقي ١٥٪ من ألفٍ يخسر ٨٥٠. الثاني أسوأ نسبةً والأوّل أسوأ أثراً -
   *  والقرار يتبع الأثر. */
  biggestLeak: {
    stageKey: string;
    lost: number;
    /** ما كلّفك الوصول بهؤلاء إلى المرحلة السابقة ثمّ فقدهم */
    wastedSpend: number | null;
  } | null;
  /** هل المتجر موصول أصلاً؟ بدونه المرحلتان الأخيرتان صفرٌ لا معنى له،
   *  فتُعرَض الحقيقة: «غير موصول» لا «صفر طلبات». */
  storeConnected: boolean;
}

export async function getStoreFunnel(
  workspaceId: string,
  from: Date,
  to: Date,
  currency: string,
  /**
   * قناة البيع المختارة، أو `null` لكلّ القنوات.
   *
   * المسار كلّه - من الظهور إلى الطلب الباقي - يُقرأ من صفوف الحملات،
   * فتضييقه على قناةٍ يكون بتضييق الحملات على حملاتها هي
   * (`CampaignLink.connectionId`). وحملةٌ بلا نسبةٍ لا تدخل مسار قناةٍ
   * بعينها: لا يُعرف لأيّها اشتُريت، وتوزيعُها تخمين.
   */
  storeId: string | null = null,
): Promise<StoreFunnel> {
  // الفترة السابقة بالطول نفسه تماماً - مقارنةُ ثلاثين يوماً بسبعة تعطي
  // هبوطاً وهمياً في كلّ مرحلة.
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const sums = {
    impressions: true, clicks: true, ordersCount: true, returnedOrdersCount: true,
    addToCart: true, checkoutsStarted: true, cost: true, rawConversions: true,
  } as const;

  // معرّفات حملات هذه القناة. وقائمةٌ فارغة تعني «لا حملة منسوبة إليها»،
  // فيخرج المسار أصفاراً صادقة لا أرقام المساحة كلّها منسوبةً إليها ظلماً.
  const scopedCampaignIds = storeId
    ? (
        await prisma.campaignLink.findMany({
          where: { workspaceId, connectionId: storeId },
          select: { externalCampaignId: true },
        })
      ).map((l) => l.externalCampaignId)
    : null;
  const scope = scopedCampaignIds ? { campaignId: { in: scopedCampaignIds } } : {};

  const [ads, prevAds] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: from, lte: to }, ...scope },
      _sum: sums,
    }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: prevFrom, lte: prevTo }, ...scope },
      _sum: sums,
    }),
  ]);

  interface Sums {
    impressions: number | null;
    clicks: number | null;
    ordersCount: number | null;
    returnedOrdersCount: number | null;
    addToCart: number | null;
    checkoutsStarted: number | null;
    cost: number | null;
    rawConversions: number | null;
  }
  const pick = (sum: Sums) => {
    const orders = sum.ordersCount ?? 0;
    const returned = sum.returnedOrdersCount ?? 0;
    // `null` من `_sum` يعني أنّ **كلّ** الصفوف في المدى فارغةٌ في هذا الحقل -
    // أي أنّ المنصّة لا تبلّغ عن الفئة أصلاً، لا أنّ العدّ صفر.
    return [
      { key: "impressions", value: sum.impressions ?? 0, measured: true },
      { key: "clicks", value: sum.clicks ?? 0, measured: true },
      { key: "addToCart", value: sum.addToCart ?? 0, measured: sum.addToCart !== null },
      { key: "checkout", value: sum.checkoutsStarted ?? 0, measured: sum.checkoutsStarted !== null },
      { key: "kept", value: Math.max(0, orders - returned), measured: sum.ordersCount !== null },
    ];
  };

  const now = pick(ads._sum);
  const prev = pick(prevAds._sum);

  // «موصول» يعني وصلَنا منه طلبٌ فعلاً في هذه الفترة. غيابُ الطلبات مع
  // وجود نقرات حالةٌ مختلفة تماماً عن غياب الربط، ولا يجوز خلطهما.
  const storeConnected = (ads._sum.ordersCount ?? 0) > 0 || (ads._sum.returnedOrdersCount ?? 0) > 0;
  // تحويلاتٌ مبلَّغٌ عنها من أيّ نوع = التتبّع يصل إلى المنصّة فعلاً.
  const trackingLive = (ads._sum.rawConversions ?? 0) > 0;

  const top = now[0].value;
  const spend = ads._sum.cost ?? 0;
  const stages: FunnelStage[] = now.map((s, i) => {
    const before = i > 0 ? now[i - 1].value : 0;
    const p = prev[i].value;
    return {
      key: s.key,
      value: s.value,
      measured: s.measured,
      prevValue: p,
      changePct: !s.measured || p === 0 ? null : ((s.value - p) / p) * 100,
      // الظهور لا تكلفةَ «لكلّ واحدةٍ» له تُفهَم (تكلفة الألف شيءٌ آخر)،
      // فيُترك بلا رقمٍ بدل أن يُعطى رقماً بكسورٍ لا تُقرأ.
      costPer: !s.measured || i === 0 || s.value === 0 || spend === 0 ? null : spend / s.value,
      keptFromPrevPct: !s.measured || i === 0 || before === 0 || !now[i - 1].measured
        ? null
        : (s.value / before) * 100,
      keptFromTopPct: !s.measured || i === 0 || top === 0 ? null : (s.value / top) * 100,
    };
  });

  // الظهور ← النقرة يسقط بنسبةٍ هائلة في كلّ حساب إعلانيّ في العالم (٩٩٪+
  // طبيعيّ)، فتسميته «الأضعف» صحيحةٌ حسابياً وعديمةُ الفائدة قراراً.
  // البحث يبدأ من الانتقال الثاني.
  let weakestStepKey: string | null = null;
  let worst = Infinity;
  for (let i = 2; i < stages.length; i++) {
    const pct = stages[i].keptFromPrevPct;
    if (pct !== null && pct < worst) {
      worst = pct;
      weakestStepKey = stages[i].key;
    }
  }

  // أكبر عددٍ مفقود بين مرحلتين متتاليتين - يبدأ من الانتقال الثاني لأنّ
  // الظهور ← النقرة يفقد الملايين في كلّ حساب، فهو صدارةٌ دائمةٌ بلا معنى.
  let biggestLeak: StoreFunnel["biggestLeak"] = null;
  for (let i = 2; i < stages.length; i++) {
    const prevStage = stages[i - 1];
    if (!stages[i].measured || !prevStage.measured) continue;
    const lost = prevStage.value - stages[i].value;
    if (lost <= 0) continue;
    if (biggestLeak === null || lost > biggestLeak.lost) {
      biggestLeak = {
        stageKey: stages[i].key,
        lost,
        // ما دُفع للوصول بهؤلاء إلى المرحلة السابقة: تكلفةُ الواحد فيها × عددُ المفقودين
        wastedSpend: prevStage.costPer !== null ? prevStage.costPer * lost : null,
      };
    }
  }

  return { stages, weakestStepKey, biggestLeak, storeConnected, trackingLive, currency };
}
