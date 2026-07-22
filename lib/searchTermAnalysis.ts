// lib/searchTermAnalysis.ts
//
// "فين أضيع فلوس فعلياً؟" - على مستوى مصطلح البحث الفعلي، مش الحملة.

export interface SearchTermWaste {
  searchTerm: string;
  matchedKeyword: string | null;
  cost: number;
  clicks: number;
  conversions: number;
}

// إصلاح باگ مشابه لباقي الأماكن في النظام: كان الرقم ثابت (15) من غير
// وعي بالعملة - 15 جنيه مصري تافهة، 15 دولار أو ريال مبلغ حقيقي.
// العتبة بقت نسبية: متوسط تكلفة الكليك في نفس مجموعة المصطلحات - نفس
// العملة تلقائياً، صفر تحويل، بيتكيف مع حجم الحساب
export function findWastefulSearchTerms(
  terms: SearchTermWaste[]
): { wasteful: SearchTermWaste[]; totalWastedCost: number } {
  const termsWithClicks = terms.filter((t) => t.clicks > 0);
  const avgCostPerClick = termsWithClicks.length > 0
    ? termsWithClicks.reduce((sum, t) => sum + t.cost / t.clicks, 0) / termsWithClicks.length
    : 0;
  // لازم يكون صرف على الأقل 3 كليكات بمتوسط السعر - عينة أقل من كده
  // مش كافية نحكم عليها إنها "مهدرة" بثقة
  const minCostToFlag = avgCostPerClick * 3;

  const wasteful = terms
    .filter((t) => t.conversions === 0 && t.cost >= minCostToFlag)
    .sort((a, b) => b.cost - a.cost);

  const totalWastedCost = round2(wasteful.reduce((sum, t) => sum + t.cost, 0));

  return { wasteful, totalWastedCost };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
