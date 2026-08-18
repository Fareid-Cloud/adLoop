// lib/ecommerce/customerCohorts.ts
//
// ثلاثة أسئلةٍ عن العميل لا تجيب عنها شاشةٌ اليوم: قيمتُه العمرية حسب
// القناة، وسلوكُ فوجه، ورحلتُه هو بعينها.
//
// **ولماذا هنا لا داخل `lib/mcp/tools.ts`:** قاعدةُ ملفّ الأدوات أن يكون
// كلُّ أداةٍ غلافاً رفيعاً لا مصدراً ثانياً لرقم. فالحساب يسكن مع بقيّة
// حسابات المتجر، وMCP يغلّفه - ويوم تُبنى شاشةٌ للأفواج تقرأ من هنا، لا
// من نسخةٍ ثانية تفترق عن هذه بعد شهر.
//
// ── حدٌّ يجب أن يُقال في كلّ جواب ──────────────────────────────────
// **«القناة» هنا منصّةُ أوّل طلبٍ اشتراه العميل، لا أوّلُ لمسةٍ في رحلته.**
// عميلٌ رآك على ميتا ثمّ اشترى بعد رسالة بريد يُحسَب على قناة الطلب. وهذا
// فرقٌ حقيقيّ لا تفصيلة، ولا يجوز أن يقرأه ذكاءُ المشترك إسناداً كاملاً -
// لذلك يُرَدّ مع كلّ جواب في الحقل `basis`، لا في وثيقةٍ بعيدة.

import { prisma } from "@/lib/prisma";
import type { Platform } from "@prisma/client";

/** الطلب الملغى لا يُعَدّ - كما في بقيّة حسابات المتجر. */
const LIVE_ORDER = { state: { not: "CANCELLED" as const } };

const BASIS =
  "channel = the platform of the customer's first purchase, not first touch; " +
  "a customer who discovered you on Meta and bought after an email counts to the order's channel";

async function currencyOf(workspaceId: string): Promise<string> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { currency: true },
  });
  return w?.currency ?? "SAR";
}

// ══════════════ القيمة العمرية حسب القناة ══════════════

export interface ChannelLtv {
  platform: Platform;
  customers: number;
  /** إجماليّ ما أنفقه هؤلاء العملاء **طوال حياتهم**، لا في نافذة الاكتساب */
  lifetimeRevenue: number;
  avgLtv: number;
  avgOrdersPerCustomer: number;
  repeatRatePct: number;
  /** إنفاقٌ إعلانيّ على القناة في المدّة نفسها ÷ عملاء اكتُسبوا فيها */
  cac: number | null;
  /** القيمة العمرية ÷ تكلفة الاكتساب - أقلّ من ١ يعني القناة تخسر */
  ltvToCac: number | null;
}

export async function getLtvByChannel(
  workspaceId: string,
  days = 365
): Promise<{ channels: ChannelLtv[]; currency: string; basis: string; hasData: boolean }> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // أوّل طلبٍ لكلّ عميل: هو ما يحدّد قناته
  const orders = await prisma.order.findMany({
    where: { workspaceId, customerId: { not: null }, ...LIVE_ORDER },
    select: { customerId: true, platform: true, orderedAt: true, total: true },
    orderBy: { orderedAt: "asc" },
  });

  const firstOf = new Map<string, { platform: Platform; at: Date }>();
  const totals = new Map<string, { spent: number; n: number }>();
  for (const o of orders) {
    const id = o.customerId!;
    if (!firstOf.has(id)) firstOf.set(id, { platform: o.platform, at: o.orderedAt });
    const t = totals.get(id) ?? { spent: 0, n: 0 };
    t.spent += o.total;
    t.n += 1;
    totals.set(id, t);
  }

  // الإنفاق الإعلانيّ لكلّ منصّة في المدّة - لتكلفة الاكتساب
  const spendRows = await prisma.metricSnapshot.groupBy({
    by: ["platform"],
    where: { workspaceId, date: { gte: since } },
    _sum: { cost: true },
  });
  const spendOf = new Map<Platform, number>(
    spendRows.map((r) => [r.platform, r._sum.cost ?? 0])
  );

  const byPlatform = new Map<Platform, { all: string[]; acquiredInWindow: number }>();
  for (const [id, first] of firstOf) {
    const acc = byPlatform.get(first.platform) ?? { all: [], acquiredInWindow: 0 };
    acc.all.push(id);
    if (first.at >= since) acc.acquiredInWindow += 1;
    byPlatform.set(first.platform, acc);
  }

  const channels: ChannelLtv[] = [];
  for (const [platform, acc] of byPlatform) {
    const lifetimeRevenue = acc.all.reduce((s, id) => s + (totals.get(id)?.spent ?? 0), 0);
    const orderCount = acc.all.reduce((s, id) => s + (totals.get(id)?.n ?? 0), 0);
    const repeat = acc.all.filter((id) => (totals.get(id)?.n ?? 0) > 1).length;
    const avgLtv = lifetimeRevenue / acc.all.length;

    // تكلفة الاكتساب تُقسَم على مَن اكتُسب **في المدّة** لا على الكلّ:
    // قسمةُ إنفاق سنةٍ على عملاء خمس سنوات تُظهر تكلفةً خُمسَ الحقيقة.
    const spend = spendOf.get(platform);
    const cac = spend != null && acc.acquiredInWindow > 0 ? spend / acc.acquiredInWindow : null;

    channels.push({
      platform,
      customers: acc.all.length,
      lifetimeRevenue: Math.round(lifetimeRevenue * 100) / 100,
      avgLtv: Math.round(avgLtv * 100) / 100,
      avgOrdersPerCustomer: Math.round((orderCount / acc.all.length) * 100) / 100,
      repeatRatePct: Math.round((repeat / acc.all.length) * 1000) / 10,
      cac: cac == null ? null : Math.round(cac * 100) / 100,
      ltvToCac: cac == null || cac === 0 ? null : Math.round((avgLtv / cac) * 100) / 100,
    });
  }

  channels.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);
  return {
    channels,
    currency: await currencyOf(workspaceId),
    basis: BASIS,
    hasData: channels.length > 0,
  };
}

// ══════════════ الأفواج ══════════════

export interface Cohort {
  /** شهر أوّل طلب - `YYYY-MM` */
  month: string;
  customers: number;
  revenue: number;
  avgLtv: number;
  repeatRatePct: number;
  /** متوسّط الأيام بين أوّل طلبٍ وثانيه لمن كرّر - سرعةُ العودة */
  avgDaysToSecondOrder: number | null;
}

export async function getCohorts(
  workspaceId: string,
  months = 12
): Promise<{ cohorts: Cohort[]; currency: string; hasData: boolean }> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const orders = await prisma.order.findMany({
    where: { workspaceId, customerId: { not: null }, ...LIVE_ORDER },
    select: { customerId: true, orderedAt: true, total: true },
    orderBy: { orderedAt: "asc" },
  });

  const per = new Map<string, { first: Date; second: Date | null; spent: number; n: number }>();
  for (const o of orders) {
    const id = o.customerId!;
    const cur = per.get(id);
    if (!cur) {
      per.set(id, { first: o.orderedAt, second: null, spent: o.total, n: 1 });
    } else {
      if (cur.n === 1) cur.second = o.orderedAt;
      cur.spent += o.total;
      cur.n += 1;
    }
  }

  const buckets = new Map<string, Array<{ spent: number; n: number; gapDays: number | null }>>();
  for (const c of per.values()) {
    if (c.first < since) continue;
    const key = `${c.first.getUTCFullYear()}-${String(c.first.getUTCMonth() + 1).padStart(2, "0")}`;
    const gapDays =
      c.second == null ? null : Math.round((c.second.getTime() - c.first.getTime()) / 86_400_000);
    const arr = buckets.get(key) ?? [];
    arr.push({ spent: c.spent, n: c.n, gapDays });
    buckets.set(key, arr);
  }

  const cohorts: Cohort[] = [...buckets.entries()]
    .map(([month, rows]) => {
      const revenue = rows.reduce((s, r) => s + r.spent, 0);
      const repeat = rows.filter((r) => r.n > 1);
      const gaps = repeat.map((r) => r.gapDays).filter((g): g is number => g != null);
      return {
        month,
        customers: rows.length,
        revenue: Math.round(revenue * 100) / 100,
        avgLtv: Math.round((revenue / rows.length) * 100) / 100,
        repeatRatePct: Math.round((repeat.length / rows.length) * 1000) / 10,
        avgDaysToSecondOrder:
          gaps.length === 0 ? null : Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length),
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  return { cohorts, currency: await currencyOf(workspaceId), hasData: cohorts.length > 0 };
}

// ══════════════ رحلة عميلٍ بعينه ══════════════

export interface CustomerJourney {
  found: boolean;
  displayName: string | null;
  city: string | null;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  ordersCount: number;
  totalSpent: number;
  totalReturned: number;
  /** القنوات التي اشترى منها فعلاً، مرتّبةً بأوّل شراء */
  channels: Platform[];
  orders: Array<{ orderedAt: Date; platform: Platform; total: number; isReturned: boolean; state: string }>;
  currency: string;
  basis: string;
}

/** بحثٌ بالاسم المعروض وحده.
 *
 *  🔴 **الهاتف والبريد مخزّنان مُجزّأين (hash) بقرار تصميم**، فالبحث بهما
 *  مستحيلٌ بحكم البنية لا بإغفال - وقولُ ذلك أصدق من إرجاع «غير موجود». */
export async function getCustomerJourney(
  workspaceId: string,
  query: string
): Promise<CustomerJourney> {
  const currency = await currencyOf(workspaceId);
  const empty: CustomerJourney = {
    found: false, displayName: null, city: null, firstOrderAt: null, lastOrderAt: null,
    ordersCount: 0, totalSpent: 0, totalReturned: 0, channels: [], orders: [], currency,
    basis: "lookup is by display name only - phone and email are stored hashed by design",
  };
  const q = query.trim();
  if (q.length < 2) return empty;

  const customer = await prisma.customer.findFirst({
    where: { workspaceId, displayName: { contains: q, mode: "insensitive" } },
    select: {
      displayName: true, city: true, firstOrderAt: true, lastOrderAt: true,
      ordersCount: true, totalSpent: true, totalReturned: true,
      orders: {
        where: LIVE_ORDER,
        select: { orderedAt: true, platform: true, total: true, isReturned: true, state: true },
        orderBy: { orderedAt: "asc" },
      },
    },
  });
  if (!customer) return empty;

  const channels: Platform[] = [];
  for (const o of customer.orders) if (!channels.includes(o.platform)) channels.push(o.platform);

  return {
    found: true,
    displayName: customer.displayName,
    city: customer.city,
    firstOrderAt: customer.firstOrderAt,
    lastOrderAt: customer.lastOrderAt,
    ordersCount: customer.ordersCount,
    totalSpent: customer.totalSpent,
    totalReturned: customer.totalReturned,
    channels,
    orders: customer.orders,
    currency,
    basis: BASIS,
  };
}
