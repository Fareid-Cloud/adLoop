// lib/admin/customers.ts
//
// قائمة العملاء وصفحة العميل الواحد - **استعلام واحد بيخدم التلاتة:**
// الجدول، والتصدير CSV، وأي فلتر جاي من رابط. تكرار الاستعلام في كل
// موضع كان معناه إن التصدير يرجّع صفوف غير اللي المالك شايفها قدّامه.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { billingCurrencyFor } from "@/lib/plans";
import { monthlyRecurringOf, monthKey, pctChange, toUsd, type DateRange } from "./shared";

/** بلا دخول أسبوعين = إشارة خطر، مش حكم نهائيّ. نفس عتبة الرئيسية. */
export const AT_RISK_DAYS = 14;

export function atRiskThreshold(): Date {
  const d = new Date();
  d.setDate(d.getDate() - AT_RISK_DAYS);
  return d;
}

// ==================== الفلاتر ====================

export interface CustomerFilters {
  q?: string;
  plan?: string;
  status?: string;
  country?: string;
  businessScale?: string;
  vip?: boolean;
  atRisk?: boolean;
  suspended?: boolean;
}

/** قراءة الفلاتر من رابط - نقطة واحدة، فالصفحة والتصدير بيقروا نفس الشيء */
export function parseCustomerFilters(sp: URLSearchParams): CustomerFilters {
  const val = (k: string) => sp.get(k)?.trim() || undefined;
  return {
    q: val("q"),
    plan: val("plan"),
    status: val("status"),
    country: val("country"),
    businessScale: val("scale"),
    vip: sp.get("vip") === "1",
    atRisk: sp.get("atRisk") === "1",
    suspended: sp.get("suspended") === "1",
  };
}

export function customerWhere(f: CustomerFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const and: Prisma.UserWhereInput[] = [];

  if (f.q) {
    and.push({
      OR: [
        { email: { contains: f.q, mode: "insensitive" } },
        { name: { contains: f.q, mode: "insensitive" } },
        { companyName: { contains: f.q, mode: "insensitive" } },
        { username: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  // "free" مش قيمة مخزّنة: الحساب اللي مالوش اشتراك بيبقى `null`، فطلب
  // المجّانيين لازم يسأل عن الغياب مش عن النصّ.
  if (f.plan === "free") and.push({ subscriptionPlan: null });
  else if (f.plan) and.push({ subscriptionPlan: f.plan });

  if (f.status) and.push({ subscriptionStatus: f.status as never });
  if (f.country) and.push({ country: f.country });
  if (f.businessScale) and.push({ businessScale: f.businessScale });
  if (f.vip) and.push({ isVip: true });
  if (f.suspended) and.push({ isSuspended: true });
  if (f.atRisk) {
    and.push({ OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: atRiskThreshold() } }] });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

// ==================== صفّ القائمة ====================

const LIST_SELECT = {
  id: true, email: true, name: true, companyName: true, country: true,
  businessScale: true, createdAt: true, lastLoginAt: true, lastActiveAt: true,
  emailVerified: true, isSuspended: true, isVip: true, adminTags: true,
  subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true,
  customPriceOverrideCents: true, customPriceCurrency: true,
  aiRefreshMonthlyCount: true, imageQualityMonthlyCount: true, siteScanMonthlyCount: true,
  aiCreditsPurchased: true, usageSpendUsd: true, usageVerifiedConv: true,
  planLimitOverrides: true, featureOverrides: true,
  workspaces: { select: { id: true, currency: true }, orderBy: { createdAt: "asc" } },
  _count: { select: { workspaces: true, connectedPlatforms: true } },
} satisfies Prisma.UserSelect;

export type CustomerRowRaw = Prisma.UserGetPayload<{ select: typeof LIST_SELECT }>;

export interface CustomerRow {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  country: string | null;
  businessScale: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  emailVerified: boolean;
  isSuspended: boolean;
  isVip: boolean;
  adminTags: string[];
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  /** القيمة الشهرية بعملة الحساب نفسه - `null` لغير المشترك */
  mrrCents: number | null;
  mrrCurrency: string | null;
  hasOverrides: boolean;
  workspaceCount: number;
  platformCount: number;
  aiUsedThisMonth: number;
  atRisk: boolean;
}

function toRow(u: CustomerRowRaw, threshold: Date): CustomerRow {
  const fallback = billingCurrencyFor(u.workspaces[0]?.currency ?? "USD");
  const mrr = monthlyRecurringOf(u, fallback);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    companyName: u.companyName,
    country: u.country,
    businessScale: u.businessScale,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    lastActiveAt: u.lastActiveAt,
    emailVerified: u.emailVerified,
    isSuspended: u.isSuspended,
    isVip: u.isVip,
    adminTags: u.adminTags,
    plan: u.subscriptionPlan ?? "free",
    status: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    mrrCents: mrr?.cents ?? null,
    mrrCurrency: mrr?.currency ?? null,
    hasOverrides: !!u.planLimitOverrides || !!u.featureOverrides || !!u.customPriceOverrideCents,
    workspaceCount: u._count.workspaces,
    platformCount: u._count.connectedPlatforms,
    aiUsedThisMonth: u.aiRefreshMonthlyCount + u.imageQualityMonthlyCount + u.siteScanMonthlyCount,
    atRisk: !u.lastLoginAt || u.lastLoginAt < threshold,
  };
}

export async function listCustomers(
  filters: CustomerFilters,
  opts: { skip?: number; take?: number } = {}
): Promise<{ rows: CustomerRow[]; total: number }> {
  const where = customerWhere(filters);
  const [raw, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
    }),
    prisma.user.count({ where }),
  ]);
  const threshold = atRiskThreshold();
  return { rows: raw.map((u) => toRow(u, threshold)), total };
}

/** التصدير بيمشي على نفس الفلتر بلا صفحات - العدد محدود بسقف واعٍ */
export const EXPORT_CAP = 5_000;

export async function exportCustomers(filters: CustomerFilters): Promise<CustomerRow[]> {
  const raw = await prisma.user.findMany({
    where: customerWhere(filters),
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: EXPORT_CAP,
  });
  const threshold = atRiskThreshold();
  return raw.map((u) => toRow(u, threshold));
}

/**
 * صفّ CSV.
 *
 * **الأعمدة محصورة في اللي معروض في الواجهة أصلاً** - ولا توكن ولا سرّ
 * ولا هاش كلمة سر. ملفّ واحد بيمشي بره النظام مرّة واحدة، فمحتواه لازم
 * يبقى قرار صريح مش انعكاس لكل حقل في الجدول.
 */
export const CSV_COLUMNS = [
  "email", "name", "company", "country", "businessScale", "plan", "status",
  "mrr", "mrrCurrency", "vip", "suspended", "verified", "workspaces",
  "platforms", "aiUsedThisMonth", "signedUp", "lastLogin", "tags",
] as const;

export function toCsv(rows: CustomerRow[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push([
      r.email, r.name, r.companyName, r.country, r.businessScale, r.plan, r.status,
      r.mrrCents !== null ? (r.mrrCents / 100).toFixed(2) : "", r.mrrCurrency,
      r.isVip ? "yes" : "no", r.isSuspended ? "yes" : "no", r.emailVerified ? "yes" : "no",
      r.workspaceCount, r.platformCount, r.aiUsedThisMonth,
      r.createdAt.toISOString().slice(0, 10),
      r.lastLoginAt ? r.lastLoginAt.toISOString().slice(0, 10) : "",
      r.adminTags.join(" | "),
    ].map(esc).join(","));
  }
  // BOM عشان إكسل يقرا العربي صح - من غيره أي اسم عربي بيتقري رموز
  return `﻿${lines.join("\r\n")}`;
}

// ==================== تحليلات العملاء ====================

export interface CustomerAnalytics {
  total: number;
  paying: number;
  trialing: number;
  free: number;
  suspended: number;
  vip: number;
  atRisk: number;
  newInRange: number;
  newDeltaPct: number | null;
  activeLast7: number;
  activeLast30: number;
  byPlan: Record<string, number>;
  byCountry: Array<{ country: string; count: number }>;
  byScale: Array<{ scale: string; count: number }>;
  /** أفواج التسجيل: شهر التسجيل → كام منهم لسه مشترك دلوقتي */
  cohorts: Array<{ month: string; signups: number; stillPaying: number }>;
  /** أعلى الحسابات قيمة شهرية - اقتراح لوسم VIP، مش بديل عنه */
  topByMrr: Array<{ id: string; email: string; usdCents: number; isVip: boolean }>;
}

export async function getCustomerAnalytics(range: DateRange): Promise<CustomerAnalytics> {
  const threshold = atRiskThreshold();
  const d7 = new Date(Date.now() - 7 * 86_400_000);
  const d30 = new Date(Date.now() - 30 * 86_400_000);
  const prevFrom = new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime()));

  const [
    total, paying, trialing, suspended, vip, atRisk,
    newInRange, newInPrev, activeLast7, activeLast30, planGroups, countryGroups, scaleGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { subscriptionStatus: "ACTIVE", currentPeriodEnd: { gt: new Date() } } }),
    prisma.user.count({ where: { subscriptionStatus: "TRIALING" } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { isVip: true } }),
    prisma.user.count({ where: { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: threshold } }] } }),
    prisma.user.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: range.from } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: d7 } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: d30 } } }),
    prisma.user.groupBy({ by: ["subscriptionPlan"], _count: true }),
    prisma.user.groupBy({ by: ["country"], _count: true, orderBy: { _count: { country: "desc" } }, take: 12 }),
    prisma.user.groupBy({ by: ["businessScale"], _count: true }),
  ]);

  const byPlan: Record<string, number> = {};
  for (const g of planGroups) byPlan[g.subscriptionPlan ?? "free"] = g._count;

  // الأفواج: صفّ خام واحد لكل مستخدم، والتجميع في الذاكرة. الجدول أصغر
  // من أن يستحقّ استعلاماً خاماً بـ`date_trunc`، والاستعلام الخام
  // بيتكسر بصمت عند أول تغيير في اسم عمود.
  const all = await prisma.user.findMany({
    select: { createdAt: true, subscriptionStatus: true, currentPeriodEnd: true },
  });
  const cohortMap = new Map<string, { signups: number; stillPaying: number }>();
  const now = new Date();
  for (const u of all) {
    const k = monthKey(u.createdAt);
    const c = cohortMap.get(k) ?? { signups: 0, stillPaying: 0 };
    c.signups += 1;
    if (u.subscriptionStatus === "ACTIVE" && u.currentPeriodEnd && u.currentPeriodEnd > now) {
      c.stillPaying += 1;
    }
    cohortMap.set(k, c);
  }
  const cohorts = [...cohortMap.entries()]
    .sort((a, z) => a[0].localeCompare(z[0]))
    .slice(-12)
    .map(([month, c]) => ({ month, ...c }));

  // أعلى الحسابات قيمةً - بيتحسبوا من نفس دالة MRR مش من حسبة تانية
  const payers = await prisma.user.findMany({
    where: { subscriptionStatus: "ACTIVE", currentPeriodEnd: { gt: now } },
    select: {
      id: true, email: true, isVip: true,
      subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true,
      customPriceOverrideCents: true, customPriceCurrency: true,
      workspaces: { select: { currency: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  const ranked: Array<{ id: string; email: string; usdCents: number; isVip: boolean }> = [];
  for (const p of payers) {
    const mrr = monthlyRecurringOf(p, billingCurrencyFor(p.workspaces[0]?.currency ?? "USD"));
    if (!mrr) continue;
    const usd = await toUsd({ [mrr.currency]: mrr.cents });
    ranked.push({ id: p.id, email: p.email, usdCents: usd.usd, isVip: p.isVip });
  }
  ranked.sort((a, z) => z.usdCents - a.usdCents);

  return {
    total,
    paying,
    trialing,
    free: total - paying - trialing,
    suspended,
    vip,
    atRisk,
    newInRange,
    newDeltaPct: pctChange(newInRange, newInPrev),
    activeLast7,
    activeLast30,
    byPlan,
    byCountry: countryGroups.filter((g) => g.country).map((g) => ({ country: g.country!, count: g._count })),
    byScale: scaleGroups.filter((g) => g.businessScale).map((g) => ({ scale: g.businessScale!, count: g._count })),
    cohorts,
    topByMrr: ranked.slice(0, 10),
  };
}
