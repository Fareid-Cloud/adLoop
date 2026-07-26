// lib/kpiEngine.ts
//
// محرك مؤشرات الأداء للوحة الرئيسية: يحسب كل مؤشر للفترة المختارة، مع
// مقارنة بالفترة السابقة (نفس الطول) وسلسلة يومية للرسم الصغير تحت البطاقة.
// يدعم الفلترة بمنصة واحدة أو كل المنصات.

import { prisma } from "@/lib/prisma";

export type KpiKey =
  | "cost" | "clicks" | "impressions" | "ctr" | "cpc"
  | "conversions_reported" | "conversions_verified"
  | "cpl_raw" | "cpl_verified" | "verification_rate" | "inflation_rate" | "roas";

export interface KpiDef {
  key: KpiKey;
  labelAr: string;
  labelEn: string;
  /** التحسّن = انخفاض الرقم (التكاليف) */
  lowerIsBetter?: boolean;
  format: "number" | "currency" | "percent" | "decimal";
}

export const KPI_DEFS: KpiDef[] = [
  { key: "cost", labelAr: "الإنفاق", labelEn: "Ad Spend", format: "currency", lowerIsBetter: false },
  { key: "conversions_reported", labelAr: "تحويلات مُعلنة", labelEn: "Reported Conversions", format: "number" },
  { key: "conversions_verified", labelAr: "تحويلات محقّقة", labelEn: "Verified Conversions", format: "number" },
  { key: "verification_rate", labelAr: "نسبة التحقّق", labelEn: "Verification Rate", format: "percent" },
  { key: "cpl_verified", labelAr: "تكلفة العميل الحقيقية", labelEn: "Cost per Verified", format: "currency", lowerIsBetter: true },
  { key: "cpl_raw", labelAr: "تكلفة العميل المعلنة", labelEn: "Cost per Reported", format: "currency", lowerIsBetter: true },
  { key: "clicks", labelAr: "النقرات", labelEn: "Clicks", format: "number" },
  { key: "impressions", labelAr: "مرات الظهور", labelEn: "Impressions", format: "number" },
  { key: "ctr", labelAr: "نسبة النقر (CTR)", labelEn: "CTR", format: "percent" },
  { key: "cpc", labelAr: "تكلفة النقرة", labelEn: "Avg. CPC", format: "currency", lowerIsBetter: true },
  { key: "inflation_rate", labelAr: "تضخيم المنصة", labelEn: "Platform Inflation", format: "percent", lowerIsBetter: true },
  { key: "roas", labelAr: "العائد (ROAS)", labelEn: "ROAS", format: "decimal" },
];

export const DEFAULT_KPIS: KpiKey[] = [
  "cost", "conversions_reported", "conversions_verified", "verification_rate", "cpl_verified",
];

export interface KpiResult {
  key: KpiKey;
  value: number;
  changePct: number | null;
  series: number[]; // سلسلة يومية للرسم الصغير
}

interface Totals {
  cost: number; clicks: number; impressions: number;
  raw: number; verified: number; revenue: number;
}

const EMPTY: Totals = { cost: 0, clicks: 0, impressions: 0, raw: 0, verified: 0, revenue: 0 };

function computeOne(key: KpiKey, t: Totals): number {
  switch (key) {
    case "cost": return t.cost;
    case "clicks": return t.clicks;
    case "impressions": return t.impressions;
    case "conversions_reported": return t.raw;
    case "conversions_verified": return t.verified;
    case "ctr": return t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    case "cpc": return t.clicks > 0 ? t.cost / t.clicks : 0;
    case "cpl_raw": return t.raw > 0 ? t.cost / t.raw : 0;
    case "cpl_verified": return t.verified > 0 ? t.cost / t.verified : 0;
    case "verification_rate": return t.raw > 0 ? (t.verified / t.raw) * 100 : 0;
    case "inflation_rate": return t.raw > 0 ? ((t.raw - t.verified) / t.raw) * 100 : 0;
    case "roas": return t.cost > 0 ? t.revenue / t.cost : 0;
  }
}

function sum(rows: any[]): Totals {
  return rows.reduce(
    (a, r) => ({
      cost: a.cost + (r.cost ?? 0),
      clicks: a.clicks + (r.clicks ?? 0),
      impressions: a.impressions + (r.impressions ?? 0),
      raw: a.raw + (r.rawConversions ?? 0),
      verified: a.verified + (r.verifiedConversions ?? 0),
      revenue: a.revenue + (r.revenue ?? 0),
    }),
    { ...EMPTY }
  );
}

export async function computeKpis(
  workspaceId: string,
  keys: KpiKey[],
  days: number,
  platform?: string | null
): Promise<KpiResult[]> {
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - days);
  const prevStart = new Date(now); prevStart.setDate(prevStart.getDate() - days * 2);

  const where: any = { workspaceId, ...(platform ? { platform: platform as any } : {}) };

  const [current, previous] = await Promise.all([
    prisma.metricSnapshot.findMany({
      where: { ...where, date: { gte: start } },
      select: { date: true, cost: true, clicks: true, impressions: true, rawConversions: true, verifiedConversions: true, revenue: true },
      orderBy: { date: "asc" },
    }),
    prisma.metricSnapshot.findMany({
      where: { ...where, date: { gte: prevStart, lt: start } },
      select: { cost: true, clicks: true, impressions: true, rawConversions: true, verifiedConversions: true, revenue: true },
    }),
  ]);

  // تجميع يومي للرسم الصغير
  const byDay = new Map<string, any[]>();
  for (const r of current) {
    const k = r.date.toISOString().slice(0, 10);
    const arr = byDay.get(k) ?? [];
    arr.push(r);
    byDay.set(k, arr);
  }
  const dayKeys = [...byDay.keys()].sort();

  const curTotals = sum(current);
  const prevTotals = sum(previous);

  return keys.map((key) => {
    const value = computeOne(key, curTotals);
    const prev = computeOne(key, prevTotals);
    const changePct = prev > 0 ? Math.round(((value - prev) / prev) * 1000) / 10 : null;
    const series = dayKeys.map((d) => computeOne(key, sum(byDay.get(d)!)));
    return { key, value: Math.round(value * 100) / 100, changePct, series };
  });
}
