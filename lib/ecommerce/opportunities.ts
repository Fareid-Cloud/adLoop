// lib/ecommerce/opportunities.ts
//
// محرّك الفرص: كل ما يمكن فعله الآن لزيادة الربح، مرتَّباً بالأثر المالي.
//
// هذه الصفحة هي ما يفصل "أداة تحليل" عن "مستشار". اللوحة تعرض أن هامشك
// انخفض؛ المستشار يقول: ارفع سعر هذا المنتج ٨٪ فتكسب ٤٢٠٠ ريال شهرياً،
// وثقتي في ذلك متوسطة، والتنفيذ ضغطة واحدة.
//
// ثلاث قواعد صارمة لكل فرصة:
//   ١) أثر مالي مقدَّر برقم، لا "قد يتحسّن الأداء"
//   ٢) درجة ثقة مبنية على حجم العينة، لا رقم تجميلي
//   ٣) صعوبة صريحة - المستخدم يستحقّ معرفة ما سيكلّفه التنفيذ من وقت
//
// الفرصة التي لا نستطيع تقدير أثرها بالمال لا تُعرض. "حسّن صفحة الهبوط"
// بلا رقم نصيحة عامة، وهي بالضبط ما لا يحتاجه أحد.

import { prisma } from "@/lib/prisma";
import { getEcommerceOverview } from "./productPerformance";
import { getInventoryAnalysis } from "./inventoryIntelligence";
import { getCustomerAnalytics, getProfitJourney } from "./storeIntelligence";

export type OpportunityType =
  | "RAISE_PRICE"
  | "LOWER_PRICE"
  | "PAUSE_ADS"
  | "INCREASE_BUDGET"
  | "RESTOCK"
  | "BUNDLE"
  | "CROSS_SELL"
  | "WIN_BACK"
  | "REDUCE_RETURNS";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

/**
 * نص قابل للترجمة: مفتاح في القاموس مع متغيّراته، لا جملة مكتملة بلغة
 * واحدة. المحرّك يحسب الأرقام ويقرّر المعنى، والواجهة تصوغ الجملة باللغة
 * المطلوبة. قبل ذلك كان المحرّك يُرجع عربية جاهزة، فتبقى الجُمل التحليلية
 * عربية حتى بعد تبديل الواجهة كاملةً إلى الإنجليزية.
 */
export interface LocalizedText {
  key: string;
  vars?: Record<string, string | number>;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: LocalizedText;
  /** لماذا هذه فرصة - السبب بالأرقام لا بالوصف */
  reason: LocalizedText;
  /** ماذا يفعل المستخدم بالضبط */
  action: LocalizedText;
  /** الربح الشهري المقدَّر من التنفيذ */
  estimatedMonthlyProfit: number;
  confidence: Confidence;
  /** ما يجعل الثقة بهذا المستوى - لا درجة بلا تفسير */
  confidenceReason: LocalizedText;
  difficulty: Difficulty;
  /** المنتج/العميل المرتبط، إن وُجد */
  entityId?: string;
  entityName?: string;
  /** رابط الصفحة التي تُنفَّذ منها */
  actionHref?: string;
  /** هل يمكن تنفيذها بضغطة واحدة من هنا */
  oneClick: boolean;
}

export interface OpportunitiesResult {
  opportunities: Opportunity[];
  totalPotentialProfit: number;
  currency: string;
  hasData: boolean;
  /** ما يمنعنا من رؤية فرص أكثر - نقول للمستخدم كيف يوسّع الرؤية */
  blindSpots: LocalizedText[];
}

const CONFIDENCE_RANK: Record<Confidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export async function buildOpportunities(
  workspaceId: string,
  windowDays = 30,
  /** متجرٌ بعينه، أو `null` لكلّ المتاجر - يُمرَّر كما هو إلى كلّ مصدرٍ
   *  تُبنى منه الفرصة، فلا يخرج اقتراحٌ من أرقام متجرٍ لا يقرأه المستخدم. */
  storeId: string | null = null
): Promise<OpportunitiesResult> {
  const [overview, inventory, customers, journey, workspace] = await Promise.all([
    getEcommerceOverview(workspaceId, windowDays, storeId),
    getInventoryAnalysis(workspaceId, windowDays, storeId),
    getCustomerAnalytics(workspaceId, storeId),
    getProfitJourney(workspaceId, windowDays, storeId),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { currency: true } }),
  ]);

  const currency = workspace?.currency ?? "SAR";
  const opportunities: Opportunity[] = [];
  const blindSpots: LocalizedText[] = [];
  const monthlyFactor = 30 / windowDays;

  // ==== ١) منتجات تخسر: رفع السعر أو إيقاف الإعلان ====
  for (const p of overview.products) {
    if (p.verdict !== "LOSING" || p.unitsSold <= 0) continue;

    // الخسارة الشهرية الفعلية = خسارة الوحدة × الوحدات المتوقّعة شهرياً
    const monthlyLoss = Math.abs(p.profitPerUnit) * p.unitsSold * monthlyFactor;
    if (monthlyLoss < 1) continue;

    // الرفع المطلوب للوصول إلى التعادل، مع هامش أمان بسيط
    const neededIncrease = Math.abs(p.profitPerUnit) * 1.1;
    const increasePct = p.currentPrice > 0 ? (neededIncrease / p.currentPrice) * 100 : 0;

    opportunities.push({
      id: `raise-${p.id}`,
      type: "RAISE_PRICE",
      title: { key: "raisePrice.title", vars: { name: p.name } },
      reason: {
        key: "raisePrice.reason",
        vars: {
          perUnit: `${fmt(Math.abs(p.profitPerUnit))} ${currency}`,
          units: p.unitsSold,
          days: windowDays,
          monthly: `${fmt(monthlyLoss)} ${currency}`,
        },
      },
      action:
        increasePct <= 25
          ? {
              key: "raisePrice.actionDoable",
              vars: {
                pct: Math.ceil(increasePct),
                from: fmt(p.currentPrice),
                to: `${fmt(p.currentPrice + neededIncrease)} ${currency}`,
              },
            }
          : { key: "raisePrice.actionTooHigh", vars: { pct: Math.ceil(increasePct) } },
      estimatedMonthlyProfit: Math.round(monthlyLoss),
      confidence: p.confidence === "RELIABLE" ? "HIGH" : p.confidence === "PRELIMINARY" ? "MEDIUM" : "LOW",
      confidenceReason: { key: "sampleBased", vars: { units: p.unitsSold, days: windowDays } },
      difficulty: "EASY",
      entityId: p.id,
      entityName: p.name,
      actionHref: "/dashboard/pricing",
      oneClick: true,
    });
  }

  // ==== ٢) رابح مؤكَّد: زيادة الميزانية ====
  //
  // 🔴 **ولا يُقال «مؤكَّد» عن ربحٍ لم تُطرَح منه تكلفةُ البضاعة.**
  //
  // `cogs` افتراضُه صفر، و«غير مضبوطة» تساوي «صفر» بالضبط - وهي الحال
  // الطبيعية لمنتجٍ حقيقيّ: ثلاثٌ من الخمس منصّات لا ترسل التكلفة أصلاً.
  // فيُحسَب السعرُ كلّه ربحاً، فينقلب الخاسرُ «رابحاً مؤكَّداً»، ثمّ **يُنصَح
  // صاحبُه بزيادة إنفاقه الإعلانيّ عليه**. وهي أسوأ نصيحةٍ ممكنة: تُضاعف
  // خسارةً بوصفها ربحاً، ولا تصلح نفسها حتى يُدخِل التاجر التكلفة يدوياً.
  // فالمجهولُ تكلفتُه يُستبعَد من هذه التوصية - يبقى في الجدول برقمه، ولا
  // يُبنى عليه قرارُ صرف.
  const scalable = overview.products
    .filter((p) => p.cogsKnown && p.verdict === "WINNER" && p.confidence === "RELIABLE" && p.totalProfit > 0)
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 3);

  for (const p of scalable) {
    // ٢٠٪ زيادة آمنة - نفس السقف المعتمد في محرّك قرارات الإعلانات، وبافتراض
    // متحفّظ أن العائد ينمو بنصف نسبة الزيادة لا بكاملها (تشبّع الجمهور)
    const upside = p.totalProfit * monthlyFactor * 0.1;
    if (upside < 1) continue;

    opportunities.push({
      id: `scale-${p.id}`,
      type: "INCREASE_BUDGET",
      title: { key: "scale.title", vars: { name: p.name } },
      reason: {
        key: "scale.reason",
        vars: {
          profit: `${fmt(p.totalProfit)} ${currency}`,
          margin: p.marginPct,
          returns: p.returnRatePct,
          units: p.unitsSold,
        },
      },
      action: { key: "scale.action" },
      estimatedMonthlyProfit: Math.round(upside),
      confidence: "MEDIUM",
      confidenceReason: { key: "scale.confidence" },
      difficulty: "EASY",
      entityId: p.id,
      entityName: p.name,
      actionHref: "/dashboard/campaigns/creatives",
      oneClick: false,
    });
  }

  // ==== ٣) نفد أو على وشك: إيقاف الإعلان أو إعادة الطلب ====
  const outOfStock = inventory.buckets.find((b) => b.key === "outOfStock");
  if (outOfStock && outOfStock.items.length > 0) {
    // الهدر = ما ينفقه الإعلان يومياً على منتج لا يمكن تسليمه
    const dailyAdSpend = journey.stages.find((s) => s.key === "advertising");
    const wastePerDay = dailyAdSpend ? Math.abs(dailyAdSpend.amount) / windowDays : 0;
    const shareOfCatalog = overview.products.length > 0 ? outOfStock.items.length / overview.products.length : 0;
    const monthlyWaste = wastePerDay * 30 * shareOfCatalog;

    if (monthlyWaste >= 1) {
      opportunities.push({
        id: "pause-oos",
        type: "PAUSE_ADS",
        title: { key: "pauseOos.title", vars: { count: outOfStock.items.length } },
        reason: {
          key: "pauseOos.reason",
          vars: {
            names: outOfStock.items.map((i) => i.name).slice(0, 3).join("، "),
            more: outOfStock.items.length > 3 ? outOfStock.items.length - 3 : 0,
          },
        },
        action: { key: "pauseOos.action" },
        estimatedMonthlyProfit: Math.round(monthlyWaste),
        confidence: "MEDIUM",
        confidenceReason: { key: "pauseOos.confidence" },
        difficulty: "EASY",
        actionHref: "/dashboard/automation",
        oneClick: false,
      });
    }
  }

  const runningOut = inventory.buckets.find((b) => b.key === "runningOut");
  if (runningOut && runningOut.items.length > 0) {
    const top = runningOut.items[0];
    // الربح المفقود = ما كان سيبيعه لو لم ينفد، لبقية الشهر
    const match = overview.products.find((p) => p.id === top.id);
    const lostDays = Math.max(0, 30 - (top.daysLeft ?? 0));
    const lost = match ? match.profitPerUnit * top.velocity * lostDays : 0;

    if (lost >= 1) {
      opportunities.push({
        id: `restock-${top.id}`,
        type: "RESTOCK",
        title: { key: "restock.title", vars: { name: top.name } },
        reason: { key: "restock.reason", vars: { velocity: top.velocity, days: top.daysLeft ?? 0 } },
        action: { key: "restock.action", vars: { units: Math.ceil(top.velocity * 45) } },
        estimatedMonthlyProfit: Math.round(lost),
        confidence: "HIGH",
        confidenceReason: { key: "restock.confidence", vars: { days: windowDays } },
        difficulty: "MEDIUM",
        entityId: top.id,
        entityName: top.name,
        actionHref: "/dashboard/ecommerce/inventory",
        oneClick: false,
      });
    }
  }

  // ==== ٤) مخزون ميّت: باقة لتحرير رأس المال ====
  const dead = inventory.buckets.find((b) => b.key === "dead");
  if (dead && dead.capitalImpact > 0) {
    opportunities.push({
      id: "bundle-dead",
      type: "BUNDLE",
      title: { key: "bundle.title", vars: { amount: `${fmt(dead.capitalImpact)} ${currency}` } },
      reason: { key: "bundle.reason", vars: { count: dead.items.length, pct: inventory.deadCapitalPct } },
      action: { key: "bundle.action" },
      // افتراض متحفّظ صريح: استرداد نصف رأس المال المجمّد
      estimatedMonthlyProfit: Math.round(dead.capitalImpact * 0.5),
      confidence: "LOW",
      confidenceReason: { key: "bundle.confidence" },
      difficulty: "MEDIUM",
      actionHref: "/dashboard/ecommerce/inventory",
      oneClick: false,
    });
  }

  // ==== ٥) استرجاع العملاء المعرَّضين للفقد ====
  const atRisk = customers.segments.find((s) => s.key === "atRisk" || s.key === "vipAtRisk");
  if (atRisk && atRisk.count > 0 && customers.avgLtv) {
    // افتراض متحفّظ: حملة استرجاع تُعيد ١٥% منهم
    const recovered = atRisk.count * 0.15 * customers.avgLtv;
    if (recovered >= 1) {
      opportunities.push({
        id: "winback",
        type: "WIN_BACK",
        title: { key: "winBack.title", vars: { count: atRisk.count } },
        reason: { key: "winBack.reason", vars: { ltv: `${fmt(customers.avgLtv)} ${currency}` } },
        action: { key: "winBack.action" },
        estimatedMonthlyProfit: Math.round(recovered),
        confidence: "LOW",
        confidenceReason: { key: "winBack.confidence" },
        difficulty: "MEDIUM",
        actionHref: "/dashboard/ecommerce/customers",
        oneClick: false,
      });
    }
  }

  // ==== ٦) خفض المرتجعات ====
  const returnsStage = journey.stages.find((s) => s.key === "returns");
  if (returnsStage && Math.abs(returnsStage.amount) > 0 && returnsStage.pctOfRevenue >= 8) {
    // خفض الثلث هدف واقعي لتحسينات الوصف والصور والمقاسات
    const saving = Math.abs(returnsStage.amount) * monthlyFactor * 0.33;
    opportunities.push({
      id: "reduce-returns",
      type: "REDUCE_RETURNS",
      title: { key: "reduceReturns.title" },
      reason: { key: "reduceReturns.reason", vars: { pct: returnsStage.pctOfRevenue } },
      action: { key: "reduceReturns.action" },
      estimatedMonthlyProfit: Math.round(saving),
      confidence: "MEDIUM",
      confidenceReason: { key: "reduceReturns.confidence" },
      difficulty: "HARD",
      actionHref: "/dashboard/ecommerce/products",
      oneClick: false,
    });
  }

  // ==== نقاط عمياء - ما يمنعنا من رؤية فرص أكثر ====
  if (!overview.hasStoreConnection) {
    blindSpots.push({ key: "blind.noStore" });
  }
  if (inventory.untrackedProducts > 0) {
    blindSpots.push({ key: "blind.untracked", vars: { count: inventory.untrackedProducts } });
  }
  if (!customers.hasData) {
    blindSpots.push({ key: "blind.noCustomers" });
  }
  // تكاليف غير مقروءة: نص جاهز من محرّك الربح، يُمرَّر بمفتاح شفّاف
  for (const m of journey.missingCosts) blindSpots.push(m);

  // الترتيب: الأثر المالي أولاً، والثقة تفصل بين المتقاربين. عرض فرصة
  // ضخمة منخفضة الثقة فوق فرصة مؤكَّدة أصغر يُفقد الثقة في القائمة كلها.
  opportunities.sort((a, b) => {
    const impact = b.estimatedMonthlyProfit - a.estimatedMonthlyProfit;
    if (Math.abs(impact) > Math.max(a.estimatedMonthlyProfit, b.estimatedMonthlyProfit) * 0.15) return impact;
    return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
  });

  return {
    opportunities,
    totalPotentialProfit: opportunities.reduce((s, o) => s + o.estimatedMonthlyProfit, 0),
    currency,
    hasData: opportunities.length > 0,
    blindSpots,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
