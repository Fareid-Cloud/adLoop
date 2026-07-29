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

export interface Opportunity {
  id: string;
  type: OpportunityType;
  titleAr: string;
  /** لماذا هذه فرصة - السبب بالأرقام لا بالوصف */
  reasonAr: string;
  /** ماذا يفعل المستخدم بالضبط */
  actionAr: string;
  /** الربح الشهري المقدَّر من التنفيذ */
  estimatedMonthlyProfit: number;
  confidence: Confidence;
  /** ما يجعل الثقة بهذا المستوى - لا درجة بلا تفسير */
  confidenceReasonAr: string;
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
  blindSpotsAr: string[];
}

const CONFIDENCE_RANK: Record<Confidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export async function buildOpportunities(
  workspaceId: string,
  windowDays = 30
): Promise<OpportunitiesResult> {
  const [overview, inventory, customers, journey, workspace] = await Promise.all([
    getEcommerceOverview(workspaceId, windowDays),
    getInventoryAnalysis(workspaceId, windowDays),
    getCustomerAnalytics(workspaceId),
    getProfitJourney(workspaceId, windowDays),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { currency: true } }),
  ]);

  const currency = workspace?.currency ?? "SAR";
  const opportunities: Opportunity[] = [];
  const blindSpots: string[] = [];
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
      titleAr: `ارفع سعر «${p.name}»`,
      reasonAr:
        `يخسر ${fmt(Math.abs(p.profitPerUnit))} ${currency} في كل وحدة بعد كل التكاليف، ` +
        `وباع ${p.unitsSold} وحدة خلال ${windowDays} يوماً — أي نزيف ${fmt(monthlyLoss)} ${currency} شهرياً.`,
      actionAr:
        increasePct <= 25
          ? `ارفع السعر ${Math.ceil(increasePct)}% على الأقل (من ${fmt(p.currentPrice)} إلى ${fmt(p.currentPrice + neededIncrease)} ${currency}) للوصول إلى التعادل.`
          : `الرفع المطلوب (${Math.ceil(increasePct)}%) كبير على السوق غالباً — الأجدى إيقاف إعلانه أو خفض تكلفته.`,
      estimatedMonthlyProfit: Math.round(monthlyLoss),
      confidence: p.confidence === "RELIABLE" ? "HIGH" : p.confidence === "PRELIMINARY" ? "MEDIUM" : "LOW",
      confidenceReasonAr: `مبنيّة على ${p.unitsSold} وحدة مباعة فعلاً خلال ${windowDays} يوماً.`,
      difficulty: "EASY",
      entityId: p.id,
      entityName: p.name,
      actionHref: "/dashboard/pricing",
      oneClick: true,
    });
  }

  // ==== ٢) رابح مؤكَّد: زيادة الميزانية ====
  const scalable = overview.products
    .filter((p) => p.verdict === "WINNER" && p.confidence === "RELIABLE" && p.totalProfit > 0)
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
      titleAr: `وسّع «${p.name}»`,
      reasonAr:
        `ربح ${fmt(p.totalProfit)} ${currency} بهامش ${p.marginPct}% ومعدّل إرجاع ${p.returnRatePct}% ` +
        `عبر ${p.unitsSold} وحدة — أداء مُثبَت لا صدفة.`,
      actionAr: "زِد ميزانية إعلاناته ٢٠% كحدّ أقصى، وانتظر ٤ أيام قبل أي زيادة تالية.",
      estimatedMonthlyProfit: Math.round(upside),
      confidence: "MEDIUM",
      confidenceReasonAr:
        "الأداء الحالي مؤكَّد، لكن استمراره عند ميزانية أعلى ليس مضموناً — الجمهور قد يتشبّع. التقدير متحفّظ عمداً.",
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
        titleAr: `أوقف إعلانات ${outOfStock.items.length} منتج نفد رصيدها`,
        reasonAr:
          `${outOfStock.items.map((i) => i.name).slice(0, 3).join("، ")}` +
          `${outOfStock.items.length > 3 ? ` و${outOfStock.items.length - 3} غيرها` : ""} رصيدها صفر، ` +
          `وأي إنفاق إعلاني عليها الآن بلا مقابل ممكن.`,
        actionAr: "أوقف إعلاناتها حتى يعود الرصيد، أو فعّل قاعدة المخزون لتتولّى ذلك تلقائياً.",
        estimatedMonthlyProfit: Math.round(monthlyWaste),
        confidence: "MEDIUM",
        confidenceReasonAr:
          "الهدر مقدَّر بنصيب هذه المنتجات من الكتالوج، لأن الإنفاق الإعلاني غير موزَّع على مستوى المنتج.",
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
        titleAr: `أعد طلب «${top.name}»`,
        reasonAr:
          `يبيع ${top.velocity} وحدة يومياً ورصيده يكفي ${top.daysLeft} يوماً فقط. ` +
          `النفاد يعني توقّف ربح مؤكَّد.`,
        actionAr: `اطلب ما يكفي ${Math.ceil(top.velocity * 45)} وحدة على الأقل (تغطية ٤٥ يوماً).`,
        estimatedMonthlyProfit: Math.round(lost),
        confidence: "HIGH",
        confidenceReasonAr: `معدّل بيع محسوب من مبيعات فعلية خلال ${windowDays} يوماً.`,
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
      titleAr: `حرّر ${fmt(dead.capitalImpact)} ${currency} من مخزون متوقّف`,
      reasonAr:
        `${dead.items.length} منتج لم يُبَع منه شيء منذ ٩٠ يوماً أو أكثر، ورأس مالك مجمَّد فيه ` +
        `(${inventory.deadCapitalPct}% من قيمة مخزونك).`,
      actionAr: "اربطها في باقة مع منتجك الأسرع بيعاً بخصم محدود. استرداد جزء أفضل من تجميد الكلّ.",
      // افتراض متحفّظ صريح: استرداد نصف رأس المال المجمّد
      estimatedMonthlyProfit: Math.round(dead.capitalImpact * 0.5),
      confidence: "LOW",
      confidenceReasonAr:
        "التقدير يفترض استرداد نصف رأس المال المجمَّد — نسبة النجاح تعتمد على العرض نفسه ولا يمكن حسابها مسبقاً.",
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
        titleAr: `استرجع ${atRisk.count} عميلاً توقّفوا عن الشراء`,
        reasonAr:
          `اشتروا أكثر من مرة ثم توقّفوا، ومتوسط قيمة العميل لديك ${fmt(customers.avgLtv)} ${currency}. ` +
          `استرجاعهم أرخص بكثير من جلب عملاء جدد بالكامل.`,
        actionAr: "حملة موجَّهة لهم بعرض محدود المدة، أو رسالة متابعة شخصية من المتجر.",
        estimatedMonthlyProfit: Math.round(recovered),
        confidence: "LOW",
        confidenceReasonAr:
          "التقدير يفترض استجابة ١٥% — معدّل شائع لحملات الاسترجاع، لكنه لم يُقَس على متجرك بعد.",
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
      titleAr: "اخفض معدّل المرتجعات",
      reasonAr:
        `المرتجعات تلتهم ${returnsStage.pctOfRevenue}% من إيرادك — وهي أغلى أنواع الخسارة ` +
        `لأنك دفعت الإعلان والشحن مرّتين ولم تبع شيئاً.`,
      actionAr:
        "ابدأ بالمنتجات الأعلى إرجاعاً: راجع دقّة الوصف والمقاسات وجودة الصور. أغلب المرتجعات سببها توقّع مختلف لا عيب.",
      estimatedMonthlyProfit: Math.round(saving),
      confidence: "MEDIUM",
      confidenceReasonAr: "التقدير يفترض خفض الثلث — هدف واقعي لتحسينات الوصف، وغير مضمون.",
      difficulty: "HARD",
      actionHref: "/dashboard/ecommerce/products",
      oneClick: false,
    });
  }

  // ==== نقاط عمياء - ما يمنعنا من رؤية فرص أكثر ====
  if (!overview.hasStoreConnection) {
    blindSpots.push("لا يوجد متجر مربوط — بلا طلبات حقيقية لا يمكن حساب ربح ولا مرتجعات ولا عملاء.");
  }
  if (inventory.untrackedProducts > 0) {
    blindSpots.push(
      `${inventory.untrackedProducts} منتج بلا تتبّع مخزون — لا يمكن رصد نفادها ولا رأس المال المجمَّد فيها.`
    );
  }
  if (!customers.hasData) {
    blindSpots.push("لا توجد بيانات عملاء بعد — فرص الاسترجاع والبيع المتكرّر غير مرئية.");
  }
  if (journey.missingCostsAr.length > 0) blindSpots.push(...journey.missingCostsAr);

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
    blindSpotsAr: blindSpots,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
