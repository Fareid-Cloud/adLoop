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
}

export interface StoreFunnel {
  stages: FunnelStage[];
  /** عملة المساحة - تكلفةُ المرحلة مبلغٌ، والمبلغ بلا عملته رقمٌ مجهول */
  currency: string;
  /** أضعف انتقالٍ في المسار: أين يُفقد أكبر عددٍ نسبةً إلى ما قبله.
   *  لا يُحتسب من المرحلة الأولى (الظهور ← النقرة يسقط دائماً بالجملة). */
  weakestStepKey: string | null;
  /** هل المتجر موصول أصلاً؟ بدونه المرحلتان الأخيرتان صفرٌ لا معنى له،
   *  فتُعرَض الحقيقة: «غير موصول» لا «صفر طلبات». */
  storeConnected: boolean;
}

export async function getStoreFunnel(
  workspaceId: string,
  from: Date,
  to: Date,
  currency: string,
): Promise<StoreFunnel> {
  // الفترة السابقة بالطول نفسه تماماً - مقارنةُ ثلاثين يوماً بسبعة تعطي
  // هبوطاً وهمياً في كلّ مرحلة.
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const sums = {
    impressions: true, clicks: true, ordersCount: true, returnedOrdersCount: true,
    addToCart: true, checkoutsStarted: true, cost: true,
  } as const;

  const [ads, prevAds] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: from, lte: to } },
      _sum: sums,
    }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: prevFrom, lte: prevTo } },
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
  }
  const pick = (sum: Sums) => {
    const orders = sum.ordersCount ?? 0;
    const returned = sum.returnedOrdersCount ?? 0;
    return [
      { key: "impressions", value: sum.impressions ?? 0 },
      { key: "clicks", value: sum.clicks ?? 0 },
      { key: "addToCart", value: sum.addToCart ?? 0 },
      { key: "checkout", value: sum.checkoutsStarted ?? 0 },
      { key: "kept", value: Math.max(0, orders - returned) },
    ];
  };

  const now = pick(ads._sum);
  const prev = pick(prevAds._sum);

  // «موصول» يعني وصلَنا منه طلبٌ فعلاً في هذه الفترة. غيابُ الطلبات مع
  // وجود نقرات حالةٌ مختلفة تماماً عن غياب الربط، ولا يجوز خلطهما.
  const storeConnected = (ads._sum.ordersCount ?? 0) > 0 || (ads._sum.returnedOrdersCount ?? 0) > 0;

  const top = now[0].value;
  const spend = ads._sum.cost ?? 0;
  const stages: FunnelStage[] = now.map((s, i) => {
    const before = i > 0 ? now[i - 1].value : 0;
    const p = prev[i].value;
    return {
      key: s.key,
      value: s.value,
      prevValue: p,
      changePct: p === 0 ? null : ((s.value - p) / p) * 100,
      // الظهور لا تكلفةَ «لكلّ واحدةٍ» له تُفهَم (تكلفة الألف شيءٌ آخر)،
      // فيُترك بلا رقمٍ بدل أن يُعطى رقماً بكسورٍ لا تُقرأ.
      costPer: i === 0 || s.value === 0 || spend === 0 ? null : spend / s.value,
      keptFromPrevPct: i === 0 || before === 0 ? null : (s.value / before) * 100,
      keptFromTopPct: i === 0 || top === 0 ? null : (s.value / top) * 100,
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

  return { stages, weakestStepKey, storeConnected, currency };
}
