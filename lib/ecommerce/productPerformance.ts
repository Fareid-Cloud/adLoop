// lib/ecommerce/productPerformance.ts
//
// تحليل أداء المنتجات وتحديد "المنتج الرابح".
//
// المشكلة التي يحلّها: من يختبر عدة منتجات معاً يحكم عادةً بعدد الطلبات
// أو بالإيراد - وكلاهما مضلّل. المنتج الأكثر مبيعاً قد يكون الأكثر خسارة
// إذا ابتلعته المرتجعات أو تكلفة الإعلان. الحكم هنا على **الربح الفعلي
// المتحقق**، مع تصريح واضح بمستوى الثقة حسب حجم العينة.

import { prisma } from "@/lib/prisma";
import { calculateFullPricing } from "@/lib/pricingCalculator";
import { computeReturn, type ReturnResult } from "@/lib/returnMetrics";

export type Confidence = "RELIABLE" | "PRELIMINARY" | "INSUFFICIENT";

export interface ProductPerformance {
  id: string;
  name: string;
  sku: string | null;
  currentPrice: number;

  /** مبيعات فعلية خلال النافذة */
  unitsSold: number;
  unitsReturned: number;
  revenue: number;
  returnRatePct: number;

  /** 🔴 **هل تكلفة البضاعة معروفةٌ أصلاً لهذا المنتج؟**
   *
   *  `cogs` عمودٌ افتراضُه `0`، فـ«غير مضبوطة» و«صفر» قيمةٌ واحدة. وواقعُ
   *  المنصّات أنّ ووكومرس وزد وإيزي أوردرز **لا ترسل حقل تكلفةٍ إطلاقاً**،
   *  وسلّة وشوبيفاي لا ترسلانها قبل أن يشغّل التاجر استيراد التكلفة - أي
   *  أنّ صفراً هو الحالُ الطبيعيّ لمنتجٍ حقيقيٍّ وُصِّل للتوّ. وعندها يُحسَب
   *  السعرُ كلّه ربحاً، فينقلب منتجٌ خاسرٌ إلى «رابح». تُقرأ هذه الراية قبل
   *  أيّ نصيحةٍ تُنفق مالاً. */
  cogsKnown: boolean;

  /** ربح الوحدة الواحدة بعد كل التكاليف الحقيقية */
  profitPerUnit: number;
  /** الربح الإجمالي المتحقق فعلاً (بعد استبعاد المرتجعات) */
  totalProfit: number;
  /** هامش الربح الفعلي */
  marginPct: number;

  /** سرعة البيع: وحدات في اليوم */
  velocity: number;
  /** أيام تبقّت في المخزون بمعدل البيع الحالي */
  stockDaysLeft: number | null;
  stockQuantity: number | null;

  /** 🔴 **الإنفاق الإعلانيّ على هذا المنتج بعينه - `null` يعني «لا نعرف»
   *  لا «صفر».**
   *
   *  والفرق هنا ليس شكلياً. في جدول المنتجات حقلٌ اسمه `avgAdCostPerOrder`
   *  يبدو أنّه يحمل هذا الرقم، **وهو يُكتب يدوياً وحده** - لا شيء في
   *  المشروع كلّه يحدّثه من بيانات حملة رغم أنّ تعليقه يَعِد بذلك. فبناء
   *  عائدٍ عليه يعني قسمة إيرادٍ حقيقيّ على رقمٍ خمّنه المستخدم.
   *
   *  المصدر الحقيقيّ الوحيد على مستوى المنتج هو `shopping_product` من
   *  جوجل: إنفاقٌ ونقراتٌ وتحويلاتٌ لكلّ صنفٍ على حدة. ويُربط بمنتجنا عبر
   *  `sku` ← `item_id` - وهو نفس الجسر الذي يربط مبيعات سلّة بالمنتج
   *  أصلاً، لا اصطلاحٌ جديد.
   *
   *  **وحدُّه معلومٌ ومُعلَن:** حملات التسوّق من جوجل وحدها. ميتا وتيك توك
   *  لا تُرجعان إنفاقاً لكلّ صنف (جدول الكتالوج عندنا على مستوى الحملة لا
   *  المنتج)، ومنتجٌ يُعلَن خارج حملات التسوّق لا إنفاقَ منسوباً له. وفي
   *  الحالتين يبقى `null` وتُقال العلّة، ولا يُخترع صفر. */
  adSpend: number | null;
  /** العائد والاستثمار لهذا المنتج - بالتعريف نفسه المستعمل في كلّ الصفحات */
  returns: ReturnResult;

  confidence: Confidence;
  /** درجة مركّبة للترتيب - ليست معروضة، أساس اختيار الرابح فقط */
  score: number;

  /** سبب واضح لتصنيف هذا المنتج */
  verdictKey: string;
  verdictVars: Record<string, string | number>;
  verdict: "WINNER" | "PROMISING" | "WATCH" | "LOSING" | "NO_DATA";
}

export interface EcommerceOverview {
  products: ProductPerformance[];
  winner: ProductPerformance | null;
  runnerUp: ProductPerformance | null;
  losing: ProductPerformance[];
  totals: { revenue: number; profit: number; units: number; returnRatePct: number };
  windowDays: number;
  hasStoreConnection: boolean;
  storePlatform: string | null;
  currency: string;
  /** لماذا قد يكون عمود الإنفاق فارغاً في كلّ الصفوف - سببٌ واحدٌ يُقال
   *  مرّةً فوق الجدول، أفضل من شرطةٍ مكرَّرةٍ في كلّ سطرٍ بلا تفسير:
   *
   *    OK              - اللقطة موجودة والنافذة مطابقة
   *    WINDOW_MISMATCH - المستخدم اختار ٧ أو ٩٠ يوماً، ولقطة التسوّق ٣٠
   *    NO_SHOPPING_DATA - لا حملات تسوّقٍ من جوجل أصلاً في هذا الحساب */
  adSpendAvailability: "OK" | "WINDOW_MISMATCH" | "NO_SHOPPING_DATA";
}

// عتبات العينة: مبنية على نفس منطق الثقة المستخدم في المعمل - قرار
// مبني على 3 طلبات ليس قراراً، بل صدفة.
const RELIABLE_UNITS = 25;
const PRELIMINARY_UNITS = 8;

/** نافذة لقطة التسوّق في `syncShoppingProductsForWorkspace` - مثبَّتة هناك،
 *  ومكرَّرة هنا لأنّ الرقمين يجب أن يتطابقا وإلّا صار العائد مقسوماً على
 *  مدّةٍ غير مدّة بسطه. */
const SHOPPING_SNAPSHOT_WINDOW_DAYS = 30;

export async function getEcommerceOverview(
  workspaceId: string,
  windowDays = 30,
  /** متجرٌ بعينه، أو `null` لكلّ المتاجر. المنتج يحمل متجره
   *  (`Product.connectionId`)، فيكفي تضييقه ليتبعه كلّ ما يُحسب منه. */
  storeId: string | null = null
): Promise<EcommerceOverview> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });
  const currency = workspace?.currency ?? "SAR";

  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const [products, connection] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId, ...(storeId ? { connectionId: storeId } : {}) },
    }),
    prisma.ecommerceConnection.findFirst({
      where: { workspaceId, active: true },
      select: { platform: true },
    }),
  ]);

  if (products.length === 0) {
    return {
      products: [], winner: null, runnerUp: null, losing: [],
      totals: { revenue: 0, profit: 0, units: 0, returnRatePct: 0 },
      windowDays, hasStoreConnection: !!connection,
      storePlatform: connection?.platform ?? null, currency,
      adSpendAvailability: "NO_SHOPPING_DATA",
    };
  }

  const [events, shopping] = await Promise.all([
    prisma.productSaleEvent.findMany({
      where: { productId: { in: products.map((p: any) => p.id) }, occurredAt: { gte: since } },
      select: { productId: true, quantity: true, revenue: true, returned: true },
    }),
    // لقطة التسوّق تُحدَّث بالمزامنة اليومية على نافذة **ثلاثين يوماً** ثابتة
    // (`syncShoppingProductsForWorkspace`)، وهي نافذة هذه الدالة الافتراضية
    // نفسها. فإن طُلبت نافذةٌ أخرى، لم يعد البسط والمقام يقيسان المدّة
    // نفسها - ونسبةٌ طرفاها من مدّتين مختلفتين رقمٌ خاطئ لا رقمٌ تقريبيّ،
    // فيُسكت عن الإنفاق بدل عرضه. لا يُصلَح هذا إلّا بتخزين اللقطة مؤرَّخةً
    // يوماً بيوم كبقيّة الجداول، وهو تغييرُ بنيةٍ لا حساب.
    windowDays === SHOPPING_SNAPSHOT_WINDOW_DAYS
      ? prisma.shoppingProductSnapshot.findMany({
          where: { workspaceId },
          select: { itemId: true, cost: true },
        })
      : Promise.resolve([]),
  ]);

  // معرّف الصنف في ميرشنت سنتر هو ما يضعه التاجر، وأشهرُ ما يضعه هو الـSKU.
  // والمقارنة بلا حساسية حالةٍ لأنّ التطابق يفشل صمتاً لو اختلف حرفٌ كبير.
  const spendBySku = new Map<string, number>();
  for (const row of shopping) {
    const key = row.itemId.trim().toLowerCase();
    spendBySku.set(key, (spendBySku.get(key) ?? 0) + row.cost);
  }

  const byProduct = new Map<string, { units: number; returned: number; revenue: number }>();
  for (const e of events) {
    const cur = byProduct.get(e.productId) ?? { units: 0, returned: 0, revenue: 0 };
    cur.units += e.quantity;
    cur.revenue += e.revenue;
    if (e.returned) cur.returned += e.quantity;
    byProduct.set(e.productId, cur);
  }

  const analyzed: ProductPerformance[] = products.map((p: any) => {
    const sales = byProduct.get(p.id) ?? { units: 0, returned: 0, revenue: 0 };
    const returnRatePct = sales.units > 0 ? (sales.returned / sales.units) * 100 : p.rtoRatePct;

    // نستخدم نسبة المرتجعات **الفعلية** إن توفّرت بدل المُدخلة يدوياً -
    // الرقم الحقيقي أصدق من التقدير دائماً.
    const pricing = calculateFullPricing(p.currentPrice, {
      cogs: p.cogs,
      outboundShippingCost: p.outboundShippingCost,
      returnShippingCost: p.returnShippingCost || p.outboundShippingCost,
      packagingCost: p.packagingCost,
      handlingCost: p.handlingCost,
      avgAdCostPerOrder: p.avgAdCostPerOrder,
      rtoRatePct: sales.units > 0 ? returnRatePct : p.rtoRatePct,
      restockingLossPct: p.restockingLossPct,
      paymentGatewayFeePct: p.paymentGatewayFeePct,
      paymentGatewayFixedFee: p.paymentGatewayFixedFee,
      codFeePct: p.codFeePct,
      desiredMarginPct: p.desiredMarginPct,
    });

    const successfulUnits = Math.max(sales.units - sales.returned, 0);

    // 🔴 **إعلانٌ واحدٌ يُخصم مرّةً واحدة - وكان يُخصم برقمين مختلفين في
    // السطر الواحد.**
    //
    // `profitAtCurrentPrice` يطرح سطر «تكلفة الإعلان» المبنيّ على
    // `avgAdCostPerOrder` اليدويّ، بينما عمود العائد يقسم على الإنفاق
    // الحقيقيّ من حملات التسوّق. فكان «الربح الحقيقي» و«العائد على
    // الاستثمار» في السطر نفسه يحاسبان الإعلان بمبلغين مختلفين، ويظهر
    // الربح أعلى ممّا هو بفارق ما بين التقدير والحقيقة.
    //
    // فحيث يوجد إنفاقٌ حقيقيّ لهذا الصنف يُردّ التقدير ويحلّ محلّه، وحيث
    // لا يوجد يبقى التقدير كما هو ويُسكَت عن العائد. والأساس مُعلَنٌ في
    // العمود إمّا بالرقم وإمّا بسبب غيابه.
    const manualAdCostPerUnit = pricing.lines.find((l) => l.key === "ad")?.amount ?? 0;
    const profitBeforeAds =
      Math.round((pricing.profitAtCurrentPrice + manualAdCostPerUnit) * successfulUnits * 100) / 100;

    const skuKey = p.sku?.trim().toLowerCase();
    const adSpend = skuKey ? spendBySku.get(skuKey) ?? null : null;

    const totalProfit =
      adSpend !== null
        ? Math.round((profitBeforeAds - adSpend) * 100) / 100
        : Math.round(pricing.profitAtCurrentPrice * successfulUnits * 100) / 100;
    const profitPerUnit =
      adSpend !== null && successfulUnits > 0
        ? Math.round((totalProfit / successfulUnits) * 100) / 100
        : pricing.profitAtCurrentPrice;

    const velocity = Math.round((sales.units / windowDays) * 100) / 100;
    const stockDaysLeft =
      p.stockQuantity !== null && velocity > 0 ? Math.floor(p.stockQuantity / velocity) : null;

    const confidence: Confidence =
      sales.units >= RELIABLE_UNITS ? "RELIABLE"
      : sales.units >= PRELIMINARY_UNITS ? "PRELIMINARY"
      : "INSUFFICIENT";

    // الدرجة: الربح الإجمالي هو الأساس، معدّلاً بمعدل المرتجعات وسرعة البيع.
    // لا نكافئ الإيراد وحده - منتج يبيع كثيراً بخسارة يجب أن يهبط لا يرتفع.
    const returnPenalty = 1 - Math.min(returnRatePct, 80) / 100;
    const score = totalProfit * returnPenalty * (1 + Math.min(velocity, 10) / 20);

    // 🔴 **الحكم كان يُبنى نصّاً عربياً هنا، فيصل إلى شاشةٍ إنجليزية عربياً
    // وبخطٍّ ليس خطّنا** (الحرف العربيّ يسقط إلى خطّ النظام حين تكون الصفحة
    // إنجليزية). والقاعدة المتّبعة في المنتج: **ما يُبنى في الخادم يُخزَّن
    // مفتاحاً ومتغيّراته**، ويُترجَم عند العرض حيث تُعرَف لغة القارئ.
    let verdict: ProductPerformance["verdict"];
    let verdictKey: string;
    let verdictVars: Record<string, string | number> = {};

    if (sales.units === 0) {
      verdict = "NO_DATA";
      verdictKey = "noSales";
    } else if (pricing.profitAtCurrentPrice < 0) {
      verdict = "LOSING";
      verdictKey = "losing";
      verdictVars = { amount: Math.abs(pricing.profitAtCurrentPrice), currency };
    } else if (confidence === "INSUFFICIENT") {
      verdict = "WATCH";
      verdictKey = "smallSample";
      verdictVars = { units: sales.units };
    } else if (returnRatePct > 35) {
      verdict = "WATCH";
      verdictKey = "returnsEatIt";
      verdictVars = { pct: Math.round(returnRatePct) };
    } else if (confidence === "RELIABLE") {
      verdict = "WINNER";
      verdictKey = "confirmedProfit";
      verdictVars = { amount: Math.round(totalProfit), currency, units: successfulUnits };
    } else {
      verdict = "PROMISING";
      verdictKey = "earlySignal";
      verdictVars = { amount: Math.round(totalProfit), currency, units: sales.units };
    }

    const returns = computeReturn({
      adSpend,
      revenue: sales.revenue,
      grossProfit: profitBeforeAds,
      revenueBasis: "STORE_TOTAL",
      profitBasis: "REAL_COSTS",
    });

    return {
      id: p.id, name: p.name, sku: p.sku, currentPrice: p.currentPrice,
      unitsSold: sales.units, unitsReturned: sales.returned,
      revenue: Math.round(sales.revenue),
      adSpend: adSpend === null ? null : Math.round(adSpend),
      returns,
      returnRatePct: Math.round(returnRatePct * 10) / 10,
      cogsKnown: (p.cogs ?? 0) > 0,
      profitPerUnit,
      totalProfit,
      // الهامش يتبع الربح المعروض: لو حُوسب الإعلان بالإنفاق الحقيقيّ،
      // فهامشٌ محسوبٌ على التقدير يناقض الربح الذي بجانبه في السطر نفسه.
      marginPct:
        adSpend !== null && sales.revenue > 0
          ? Math.round((totalProfit / sales.revenue) * 1000) / 10
          : pricing.actualMarginPct,
      velocity,
      stockDaysLeft,
      stockQuantity: p.stockQuantity,
      confidence, score,
      verdict, verdictKey, verdictVars,
    };
  });

  analyzed.sort((a, b) => b.score - a.score);

  // الرابح: أعلى درجة **بشرط** ثقة كافية وربح موجب. لا نتوّج منتجاً
  // بناءً على عينة صغيرة - ذلك أسوأ من عدم الترشيح أصلاً.
  const eligible = analyzed.filter(
    (p) => p.totalProfit > 0 && p.confidence !== "INSUFFICIENT" && p.returnRatePct <= 35
  );
  const winner = eligible[0] ?? null;
  const runnerUp = eligible[1] ?? null;
  const losing = analyzed.filter((p) => p.verdict === "LOSING");

  const totals = analyzed.reduce(
    (a, p) => ({
      revenue: a.revenue + p.revenue,
      profit: a.profit + p.totalProfit,
      units: a.units + p.unitsSold,
      returned: a.returned + p.unitsReturned,
    }),
    { revenue: 0, profit: 0, units: 0, returned: 0 }
  );

  return {
    products: analyzed,
    winner, runnerUp, losing,
    totals: {
      revenue: Math.round(totals.revenue),
      profit: Math.round(totals.profit),
      units: totals.units,
      returnRatePct: totals.units > 0 ? Math.round((totals.returned / totals.units) * 1000) / 10 : 0,
    },
    windowDays,
    hasStoreConnection: !!connection,
    storePlatform: connection?.platform ?? null,
    currency,
    adSpendAvailability:
      windowDays !== SHOPPING_SNAPSHOT_WINDOW_DAYS ? "WINDOW_MISMATCH"
      : spendBySku.size === 0 ? "NO_SHOPPING_DATA"
      : "OK",
  };
}
