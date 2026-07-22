// lib/portfolioAllocation.ts
//
// الفرق عن automationRules.ts: كل قاعدة هناك بتشتغل على حملة واحدة لوحدها
// ("لو الحملة X أداءها ضعيف، وقفها"). السؤال هنا مختلف تماماً: "عندي
// ميزانية إجمالية ثابتة موزّعة على حملات، إزاي أوزّعها بينهم بالشكل
// الأمثل؟" - قرار على مستوى المحفظة كلها مع بعض، مش قرار منعزل لكل حملة.
//
// قرار تصميمي مهم: مش بنستخدم محرك تحسين رياضي معقد (Linear Programming)
// رغم إنه ممكن يدّي نتيجة "أمثل" رياضياً - لأنه هيبقى صندوق أسود مش قادر
// نشرحه للمستخدم ("ليه الخوارزمية قررت كده؟"). بدل كده، بنستخدم منطق
// "الكفاءة النسبية" الأبسط والقابل للشرح بالكامل لكل قرار - يتماشى مع
// مبدأ "كل توصية لازم تفسّر ليه" من الـ ADR.

export interface CampaignAllocationInput {
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  verifiedConversions: number; // آخر 7 أيام
  cost: number; // آخر 7 أيام - نفس فترة verifiedConversions
}

export interface CampaignAllocationResult {
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  suggestedBudget: number;
  changePct: number;
  efficiencyScore: number; // تحويلات موثّقة لكل وحدة إنفاق
  reasoning: string;
}

export interface PortfolioAllocationResult {
  allocations: CampaignAllocationResult[];
  totalBudgetUnchanged: boolean; // تأكيد إن المجموع الكلي متحفظش عليه (مبنزودش الميزانية الكلية، بنعيد توزيعها بس)
}

const MAX_SHIFT_PCT = 20; // نفس سقف "القفزة الواحدة" المستخدم في automationRules.ts - قرار أمان موحّد عبر النظام كله
const MIN_DATA_POINTS_COST = 10; // حد أدنى إنفاق آخر 7 أيام قبل ما نثق في كفاءة الحملة دي كفاية نبني عليها قرار

export function computeOptimalAllocation(
  campaigns: CampaignAllocationInput[]
): PortfolioAllocationResult {
  const totalBudget = campaigns.reduce((sum, c) => sum + c.currentBudget, 0);

  // بنحسب كفاءة كل حملة - بس اللي عندها بيانات كافية (إنفاق حقيقي كفاية)
  // نبني عليها قرار، وإلا القرار هيبقى مبني على عينة صغيرة مضلّلة
  const withEfficiency = campaigns.map((c) => ({
    ...c,
    efficiencyScore: c.cost >= MIN_DATA_POINTS_COST ? c.verifiedConversions / c.cost : null,
  }));

  const eligibleForRealloc = withEfficiency.filter((c) => c.efficiencyScore !== null);
  const portfolioAvgEfficiency =
    eligibleForRealloc.length > 0
      ? eligibleForRealloc.reduce((sum, c) => sum + (c.efficiencyScore ?? 0), 0) / eligibleForRealloc.length
      : 0;

  const allocations: CampaignAllocationResult[] = withEfficiency.map((c) => {
    if (c.efficiencyScore === null || portfolioAvgEfficiency === 0) {
      return {
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        currentBudget: c.currentBudget,
        suggestedBudget: c.currentBudget, // مفيش بيانات كافية - منقترحش تغيير خالص
        changePct: 0,
        efficiencyScore: 0,
        reasoning: "بيانات إنفاق آخر 7 أيام غير كافية لبناء قرار موثوق - الميزانية متسيبة زي ما هي.",
      };
    }

    // النسبة بين كفاءة الحملة دي ومتوسط المحفظة - أعلى من 1 يعني أداء أحسن
    // من المتوسط ويستاهل ميزانية أكتر، أقل من 1 يعني العكس
    const efficiencyRatio = c.efficiencyScore / portfolioAvgEfficiency;

    // بنترجم النسبة لنسبة تغيير في الميزانية، لكن بسقف أقصى (MAX_SHIFT_PCT)
    // عشان مفيش قفزة كبيرة فجأة حتى لو الفرق في الكفاءة ضخم
    const rawShiftPct = (efficiencyRatio - 1) * 50; // معامل تحويل معتدل، مش 1:1 مباشر
    const cappedShiftPct = Math.max(-MAX_SHIFT_PCT, Math.min(MAX_SHIFT_PCT, rawShiftPct));

    const suggestedBudget = round2(c.currentBudget * (1 + cappedShiftPct / 100));

    const reasoning =
      cappedShiftPct > 0
        ? `كفاءتها ${round2(efficiencyRatio)}x من متوسط المحفظة - تستاهل ميزانية أكبر.`
        : cappedShiftPct < 0
        ? `كفاءتها ${round2(efficiencyRatio)}x من متوسط المحفظة - أضعف من الحملات التانية نسبياً.`
        : "أداؤها قريب من متوسط المحفظة - الميزانية متسيبة زي ما هي.";

    return {
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      currentBudget: c.currentBudget,
      suggestedBudget,
      changePct: round2(cappedShiftPct),
      efficiencyScore: round2(c.efficiencyScore),
      reasoning,
    };
  });

  // بنعيد توزيع أي فرق ناتج عن التقريب على الحملات عشان المجموع الكلي
  // يفضل ثابت بالظبط (مش بنزود ولا بنقلل الميزانية الإجمالية، بس بنعيد توزيعها)
  const newTotal = allocations.reduce((sum, a) => sum + a.suggestedBudget, 0);
  const roundingDiff = totalBudget - newTotal;
  if (allocations.length > 0 && Math.abs(roundingDiff) > 0.01) {
    allocations[0].suggestedBudget = round2(allocations[0].suggestedBudget + roundingDiff);
  }

  return {
    allocations,
    totalBudgetUnchanged:
      Math.abs(allocations.reduce((sum, a) => sum + a.suggestedBudget, 0) - totalBudget) < 0.1,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
