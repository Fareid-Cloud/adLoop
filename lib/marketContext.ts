// lib/marketContext.ts
//
// بيتعامل مع بندين مرتبطين من تحليل الفجوات:
// 1) هل سعر الصرف أثر على تكلفتي الحقيقية؟
// 2) هل القرار اللي النظام هياخده له سبب خارجي (منافسة عامة في السوق)،
//    مش مشكلة في الحملة نفسها؟ - منع إيقاف حملة غلط بسبب ظرف خارجي

import { prisma } from "@/lib/prisma";

// ==================== حساب تغيّر تكلفة العميل الحقيقية لكل حملة ====================
// دالة مشتركة - كانت هتتحسب مرتين منفصلتين (صفحة التشخيص + محرك الأتمتة)
// لو مبنيناهاش هنا مرة واحدة، بالظبط نفس مشكلة تكرار RULE_TEMPLATES اللي
// صلحناها قبل كده. مصدر حقيقة واحد بس.
export async function computeCampaignCplChanges(workspaceId: string): Promise<CampaignCostChange[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [recentByCampaign, priorByCampaign] = await Promise.all([
    prisma.metricSnapshot.groupBy({
      by: ["campaignId"],
      where: { workspaceId, date: { gte: sevenDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    }),
    prisma.metricSnapshot.groupBy({
      by: ["campaignId"],
      where: { workspaceId, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _sum: { cost: true, verifiedConversions: true },
    }),
  ]);

  const priorMap = new Map(priorByCampaign.map((p: any) => [p.campaignId, p]));

  return recentByCampaign
    .map((r: any) => {
      const prior: any = priorMap.get(r.campaignId);
      const recentVerified = r._sum.verifiedConversions ?? 0;
      const recentCost = r._sum.cost ?? 0;
      const priorVerified = prior?._sum.verifiedConversions ?? 0;
      const priorCost = prior?._sum.cost ?? 0;

      const recentCpl = recentVerified > 0 ? recentCost / recentVerified : null;
      const priorCpl = priorVerified > 0 ? priorCost / priorVerified : null;
      if (recentCpl === null || priorCpl === null || priorCpl === 0) return null;

      return { campaignId: r.campaignId, cplChangePct: ((recentCpl - priorCpl) / priorCpl) * 100 };
    })
    .filter((c: any): c is CampaignCostChange => c !== null);
}

// ==================== جلب وتخزين سعر الصرف اليومي ====================
// open.er-api.com مجاني وبدون مفتاح، لكن معندوش بيانات تاريخية - فبنبني
// الأرشيف بنفسنا (تسجيل يومي عن طريق cron)، مش بنفترض إننا نقدر نسأله
// عن الماضي.

export async function fetchAndStoreExchangeRate(fromCurrency: string, toCurrency: string) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
  if (!res.ok) throw new Error(`فشل جلب سعر الصرف: ${res.status}`);

  const data = await res.json();
  const rate = data.rates?.[toCurrency];
  if (!rate) throw new Error(`مفيش سعر صرف متاح لـ ${fromCurrency} إلى ${toCurrency}`);

  const today = new Date(new Date().toISOString().slice(0, 10));

  await prisma.exchangeRateSnapshot.upsert({
    where: { fromCurrency_toCurrency_date: { fromCurrency, toCurrency, date: today } },
    create: { fromCurrency, toCurrency, rate, date: today },
    update: { rate },
  });
}

// ==================== سعر الصرف - التأثير الفعلي ====================

export interface ExchangeRateImpact {
  hasEnoughHistory: boolean; // محتاجين على الأقل بداية الشهر مسجّلة عشان نقارن
  rateChangePct: number;
  impactExplanation: string;
}

export async function getExchangeRateImpact(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateImpact> {
  if (fromCurrency === toCurrency) {
    return { hasEnoughHistory: true, rateChangePct: 0, impactExplanation: "نفس العملة - مفيش تأثير صرف." };
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [monthStartRate, latestRate] = await Promise.all([
    prisma.exchangeRateSnapshot.findFirst({
      where: { fromCurrency, toCurrency, date: { gte: startOfMonth } },
      orderBy: { date: "asc" },
    }),
    prisma.exchangeRateSnapshot.findFirst({
      where: { fromCurrency, toCurrency },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!monthStartRate || !latestRate) {
    return {
      hasEnoughHistory: false,
      rateChangePct: 0,
      impactExplanation: "لا يوجد تاريخ كافٍ لسعر الصرف بعد (يتم تسجيله يومياً من الآن) - ستتوفر المقارنة قريباً.",
    };
  }

  const rateChangePct = round2(((latestRate.rate - monthStartRate.rate) / monthStartRate.rate) * 100);

  const impactExplanation =
    Math.abs(rateChangePct) < 1
      ? "سعر الصرف مستقر تقريباً الشهر ده - مأثرش على تكلفتك الحقيقية بشكل ملحوظ."
      : rateChangePct > 0
      ? `سعر الصرف اتحرك ${rateChangePct}% منذ بداية الشهر - نفس الإنفاق بقى يكلفك أكتر فعلياً، مش بس أرقام الحملة اتغيرت.`
      : `سعر الصرف اتحرك ${rateChangePct}% لصالحك منذ بداية الشهر - جزء من "التحسّن" الظاهر ممكن يكون سببه الصرف مش أداء الحملة نفسها.`;

  return { hasEnoughHistory: true, rateChangePct, impactExplanation };
}

// ==================== ضغط السوق العام (Market-Wide Move) ====================
// لو كل الحملات (مش واحدة بس) اترفعت تكلفتها مع بعض في نفس الوقت، السبب
// الأرجح منافسة زادت في السوق كله - مش مشكلة في حملة بعينها. منع إيقاف
// حملة كويسة غلط بسبب ظرف خارجي عام.

export interface CampaignCostChange {
  campaignId: string;
  cplChangePct: number; // % التغيّر في تكلفة العميل مقارنة بالفترة اللي فاتت
}

export interface MarketWideMoveResult {
  isMarketWide: boolean;
  affectedCampaignsPct: number;
  explanation: string;
}

const MARKET_WIDE_THRESHOLD_PCT = 60; // لو 60% أو أكتر من الحملات اتأثرت بنفس الاتجاه، الاحتمال الأقوى سبب خارجي عام

export function detectMarketWideMove(changes: CampaignCostChange[]): MarketWideMoveResult {
  if (changes.length < 3) {
    // عينة صغيرة جداً (أقل من 3 حملات) - مفيش معنى إحصائي لمفهوم "عام" هنا
    return { isMarketWide: false, affectedCampaignsPct: 0, explanation: "" };
  }

  const risingCount = changes.filter((c) => c.cplChangePct > 15).length;
  const affectedCampaignsPct = Math.round((risingCount / changes.length) * 100);

  const isMarketWide = affectedCampaignsPct >= MARKET_WIDE_THRESHOLD_PCT;

  return {
    isMarketWide,
    affectedCampaignsPct,
    explanation: isMarketWide
      ? `${affectedCampaignsPct}% من حملاتك ارتفعت تكلفتها مع بعض في نفس الفترة - الاحتمال الأقوى ضغط سوق عام (منافسة زادت)، مش مشكلة في حملة بعينها.`
      : "",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
