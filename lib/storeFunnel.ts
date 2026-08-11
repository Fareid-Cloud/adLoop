// lib/storeFunnel.ts
//
// مسار الشراء - **من الظهور إلى طلبٍ بقي.**
//
// 🔴 **صدقٌ عن المراحل قبل أيّ شيء:** القوالب الجاهزة لهذا الرسم تعرض
// «زائر ← مشاهدة ← إضافة للسلّة ← بدء الدفع ← طلب». ونحن **لا نجمع**
// حدثَي السلّة والدفع: لا كود تتبّعٍ لدينا على صفحة المنتج ولا على صفحة
// الدفع، ولا ويب هوك من المنصّات يرسلهما. فرسمُهما يعني اختراع رقمين في
// وسط مسارٍ بقيّته حقيقية - وهو أسوأ من عدم عرض المسار أصلاً، لأنّ
// الرقمين المخترعين يكتسبان مصداقية جيرانهما الصادقين.
//
// المراحل هنا خمسٌ كلّها من جداول قائمة:
//
//   ظهور        `MetricSnapshot.impressions`  - المنصّة عرضت الإعلان
//   نقرة        `MetricSnapshot.clicks`       - أحدهم ضغط
//   تواصل       `CtaClickEvent`               - وصل موقعك وضغط زرّ تواصل
//   طلب         `MetricSnapshot.ordersCount`  - من ويب هوك المتجر
//   طلبٌ بقي    ناقص `returnedOrdersCount`    - بعد المرتجعات
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
  /** نسبة الباقين من المرحلة التي قبلها - `null` للأولى فلا شيء قبلها */
  keptFromPrevPct: number | null;
  /** نسبة الباقين من أوّل المسار - يقيس المسار كلّه لا خطوةً منه */
  keptFromTopPct: number | null;
}

export interface StoreFunnel {
  stages: FunnelStage[];
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
): Promise<StoreFunnel> {
  // الفترة السابقة بالطول نفسه تماماً - مقارنةُ ثلاثين يوماً بسبعة تعطي
  // هبوطاً وهمياً في كلّ مرحلة.
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const sums = { impressions: true, clicks: true, ordersCount: true, returnedOrdersCount: true } as const;

  const [ads, ctas, prevAds, prevCtas] = await Promise.all([
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: from, lte: to } },
      _sum: sums,
    }),
    prisma.ctaClickEvent.count({ where: { workspaceId, clickedAt: { gte: from, lte: to } } }),
    prisma.metricSnapshot.aggregate({
      where: { workspaceId, date: { gte: prevFrom, lte: prevTo } },
      _sum: sums,
    }),
    prisma.ctaClickEvent.count({
      where: { workspaceId, clickedAt: { gte: prevFrom, lte: prevTo } },
    }),
  ]);

  interface Sums {
    impressions: number | null;
    clicks: number | null;
    ordersCount: number | null;
    returnedOrdersCount: number | null;
  }
  const pick = (sum: Sums, contacts: number) => {
    const orders = sum.ordersCount ?? 0;
    const returned = sum.returnedOrdersCount ?? 0;
    return [
      { key: "impressions", value: sum.impressions ?? 0 },
      { key: "clicks", value: sum.clicks ?? 0 },
      { key: "contacts", value: contacts },
      { key: "orders", value: orders },
      { key: "kept", value: Math.max(0, orders - returned) },
    ];
  };

  const now = pick(ads._sum, ctas);
  const prev = pick(prevAds._sum, prevCtas);

  // «موصول» يعني وصلَنا منه طلبٌ فعلاً في هذه الفترة. غيابُ الطلبات مع
  // وجود نقرات حالةٌ مختلفة تماماً عن غياب الربط، ولا يجوز خلطهما.
  const storeConnected = (ads._sum.ordersCount ?? 0) > 0 || (ads._sum.returnedOrdersCount ?? 0) > 0;

  const top = now[0].value;
  const stages: FunnelStage[] = now.map((s, i) => {
    const before = i > 0 ? now[i - 1].value : 0;
    const p = prev[i].value;
    return {
      key: s.key,
      value: s.value,
      prevValue: p,
      changePct: p === 0 ? null : ((s.value - p) / p) * 100,
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

  return { stages, weakestStepKey, storeConnected };
}
