// lib/diagnosticsEngine.ts
//
// محرك التشخيص: يُنتج قائمة فحوصات موحّدة الشكل، لكل فحص فئة وحالة ومصدر
// بيانات صريح وأثر مالي مقدَّر واتجاه زمني.
//
// السياق: كانت الصفحة تعرض شبكة بطاقات مبنية على DailyTask وحده، بلا مصدر
// واضح ولا أثر مقدَّر ولا اتجاه - فبدت "بطاقات فارغة". هنا كل فحص يقول
// من أين جاء رقمه، وماذا يكلّفك، وهل يتحسّن أم يسوء.

import { prisma } from "@/lib/prisma";

export type CheckStatus = "PASS" | "WARNING" | "FAILED" | "UNKNOWN";
export type CheckSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "NONE";

export type CheckCategory =
  | "tracking" | "pricing" | "ads" | "landing" | "performance" | "security" | "budget" | "quality";

export interface DiagnosticCheck {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: CheckSeverity;
  /** ماذا وجدنا بالضبط - جملة واحدة ببيانات حقيقية */
  findingAr?: string;
  findingEn?: string;
  /** الأثر المالي الشهري المقدَّر بعملة مساحة العمل */
  monthlyImpact?: number | null;
  /** اتجاه آخر 14 يوماً للرسم الصغير */
  trend: number[];
  /** المنصة المصدر إن كان الفحص خاصاً بمنصة */
  platform?: string | null;
  lastScanAt: Date;
  actionHref?: string;
}

export const CATEGORY_META: Record<CheckCategory, { ar: string; en: string; color: string }> = {
  tracking: { ar: "التتبع", en: "Tracking", color: "#3B82F6" },
  pricing: { ar: "التسعير", en: "Pricing", color: "#EC4899" },
  ads: { ar: "الإعلانات", en: "Ads", color: "#8B5CF6" },
  landing: { ar: "صفحات الهبوط", en: "Landing pages", color: "#06B6D4" },
  performance: { ar: "الأداء", en: "Performance", color: "#F59E0B" },
  security: { ar: "الأمان", en: "Security", color: "#10B981" },
  budget: { ar: "الميزانية", en: "Budget", color: "#14B8A6" },
  quality: { ar: "الجودة", en: "Quality", color: "#EF4444" },
};

const SEVERITY_WEIGHT: Record<CheckSeverity, number> = {
  CRITICAL: 12, HIGH: 6, MEDIUM: 2, NONE: 0,
};

export interface DiagnosticsReport {
  checks: DiagnosticCheck[];
  healthScore: number;
  scoreTrend: number[];
  counts: { critical: number; high: number; medium: number; passing: number };
  totalMonthlyImpact: number;
  lastScanAt: Date | null;
  currency: string;
}

/** سلسلة يومية لمقياس - أساس الاتجاه الصغير في كل صف. */
function seriesFrom(rows: any[], key: (r: any) => number, days = 14): number[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const k = r.date.toISOString().slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + key(r));
  }
  return [...byDay.keys()].sort().slice(-days).map((k) => byDay.get(k)!);
}

export async function runDiagnostics(workspaceId: string): Promise<DiagnosticsReport> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const currency = workspace?.currency ?? "SAR";
  const now = new Date();

  const since = new Date(now); since.setDate(since.getDate() - 30);
  const since14 = new Date(now); since14.setDate(since14.getDate() - 14);

  const [snapshots, pages, products, connections, campaignLinks, clickEvents, unmatched, tasks] =
    await Promise.all([
      prisma.metricSnapshot.findMany({
        where: { workspaceId, date: { gte: since } },
        select: {
          date: true, platform: true, cost: true, clicks: true, impressions: true,
          rawConversions: true, verifiedConversions: true, revenue: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.monitoredPage.findMany({ where: { workspaceId } }),
      prisma.product.findMany({ where: { workspaceId } }),
      prisma.connectedPlatform.findMany({
        where: { user: { workspaces: { some: { id: workspaceId } } } },
        select: { platform: true, expiresAt: true },
      }),
      prisma.campaignLink.findMany({ where: { workspaceId }, select: { platform: true } }),
      prisma.ctaClickEvent.count({ where: { workspaceId, clickedAt: { gte: since14 } } }),
      prisma.unmatchedClick.count({ where: { workspaceId, clickedAt: { gte: since14 } } }),
      prisma.dailyTask.findMany({ where: { workspaceId, completed: false } }),
    ]);

  const checks: DiagnosticCheck[] = [];
  const push = (c: DiagnosticCheck) => checks.push(c);

  const totals = snapshots.reduce(
    (a, r) => ({
      cost: a.cost + r.cost, clicks: a.clicks + r.clicks,
      impressions: a.impressions + r.impressions,
      raw: a.raw + r.rawConversions, verified: a.verified + r.verifiedConversions,
      revenue: a.revenue + (r.revenue ?? 0),
    }),
    { cost: 0, clicks: 0, impressions: 0, raw: 0, verified: 0, revenue: 0 }
  );
  const monthlySpend = totals.cost;

  // ============ التتبع ============
  const linkedPlatforms = new Set(campaignLinks.map((c: any) => c.platform));
  for (const platform of ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS"] as const) {
    const isLinked = linkedPlatforms.has(platform);
    const rows = snapshots.filter((s) => s.platform === platform);
    const hasData = rows.length > 0;
    const label = platform === "GOOGLE_ADS" ? "Google Ads" : platform === "META_ADS" ? "Meta Ads" : "TikTok Ads";

    push({
      id: `tracking-${platform}`,
      titleAr: `تدفق بيانات ${label}`, titleEn: `${label} data flow`,
      descAr: "نتأكد من وصول بيانات الحملات يومياً دون انقطاع.",
      descEn: "Verifies campaign data arrives daily without gaps.",
      category: "tracking", platform,
      status: !isLinked ? "UNKNOWN" : hasData ? "PASS" : "FAILED",
      severity: !isLinked ? "NONE" : hasData ? "NONE" : "HIGH",
      findingAr: !isLinked ? "لا توجد حملات مرتبطة من هذه المنصة."
        : hasData ? `وصلت بيانات ${rows.length} يوماً خلال آخر 30 يوماً.`
        : "المنصة مرتبطة لكن لم تصل أي بيانات - تحقّق من صلاحيات الحساب.",
      trend: seriesFrom(rows, (r) => r.cost),
      lastScanAt: now,
      actionHref: "/dashboard/settings?tab=workspace",
    });
  }

  // التحقق الحقيقي - جوهر المنتج
  const verificationRate = totals.raw > 0 ? (totals.verified / totals.raw) * 100 : 0;
  const wastedOnUnverified = totals.raw > 0 ? monthlySpend * (1 - totals.verified / totals.raw) : 0;
  push({
    id: "tracking-verification",
    titleAr: "التحقق من التحويلات", titleEn: "Conversion verification",
    descAr: "نسبة التحويلات التي تأكّدت فعلياً من إجمالي ما تعلنه المنصات.",
    descEn: "Share of platform-reported conversions we actually verified.",
    category: "tracking",
    status: totals.raw === 0 ? "UNKNOWN" : verificationRate >= 60 ? "PASS" : verificationRate >= 35 ? "WARNING" : "FAILED",
    severity: totals.raw === 0 ? "NONE" : verificationRate >= 60 ? "NONE" : verificationRate >= 35 ? "MEDIUM" : "CRITICAL",
    findingAr: totals.raw === 0
      ? "لا توجد تحويلات مسجّلة بعد."
      : `${Math.round(verificationRate)}% فقط من التحويلات المُعلنة تأكّدت (${totals.verified} من ${totals.raw}).`,
    monthlyImpact: totals.raw > 0 && verificationRate < 60 ? Math.round(wastedOnUnverified) : null,
    trend: seriesFrom(snapshots, (r) => r.verifiedConversions),
    lastScanAt: now,
    actionHref: "/dashboard/diagnostics/tracking-coverage",
  });

  // وسم الموقع
  const pagesWithAdloop = pages.filter((p: any) => p.adloopDetected === true).length;
  const pagesChecked = pages.filter((p: any) => p.trackingDetected !== null).length;
  push({
    id: "tracking-site-tag",
    titleAr: "وسم التتبع على صفحاتك", titleEn: "Site tracking tag",
    descAr: "وجود وسم AdLoop على صفحات الهبوط - بدونه لا تُربط النقرة بالمحادثة.",
    descEn: "AdLoop's tag on your landing pages — without it clicks can't link to conversations.",
    category: "tracking",
    status: pages.length === 0 ? "UNKNOWN" : pagesWithAdloop === pages.length ? "PASS" : pagesWithAdloop > 0 ? "WARNING" : "FAILED",
    severity: pages.length === 0 ? "NONE" : pagesWithAdloop === pages.length ? "NONE" : "HIGH",
    findingAr: pages.length === 0
      ? "لم تُضف أي صفحة للمراقبة بعد."
      : `${pagesWithAdloop} من ${pages.length} صفحة عليها وسم AdLoop (${pagesChecked} صفحة مفحوصة).`,
    trend: [],
    lastScanAt: pages[0]?.lastCheckedAt ?? now,
    actionHref: "/dashboard/diagnostics/tracking-coverage",
  });

  // إشارة تتبع واردة فعلياً
  const totalSignals = clickEvents + unmatched;
  push({
    id: "tracking-incoming",
    titleAr: "إشارات التتبع الواردة", titleEn: "Incoming tracking signals",
    descAr: "نقارن النقرات التي تعلنها المنصات بما وصلنا فعلياً من موقعك.",
    descEn: "Compares platform-reported clicks with signals actually received from your site.",
    category: "tracking",
    status: totals.clicks === 0 ? "UNKNOWN"
      : totalSignals === 0 ? "FAILED"
      : totalSignals < totals.clicks * 0.2 ? "WARNING" : "PASS",
    severity: totals.clicks === 0 ? "NONE" : totalSignals === 0 ? "CRITICAL" : totalSignals < totals.clicks * 0.2 ? "HIGH" : "NONE",
    findingAr: totals.clicks === 0 ? "لا توجد نقرات مسجّلة بعد."
      : totalSignals === 0 ? "المنصات تُبلّغ عن نقرات لكن لم تصلنا أي إشارة من موقعك - الوسم غالباً غير مثبّت."
      : `${totalSignals} إشارة واردة مقابل ${totals.clicks} نقرة مُعلنة.`,
    trend: seriesFrom(snapshots, (r) => r.clicks),
    lastScanAt: now,
    actionHref: "/dashboard/diagnostics/tracking-coverage",
  });

  // ============ التسعير ============
  for (const p of products) {
    const price = p.currentPrice ?? 0;
    const cost = (p.cogs ?? 0) + (p.outboundShippingCost ?? 0) + (p.avgAdCostPerOrder ?? 0) + (p.packagingCost ?? 0);
    const losing = price > 0 && cost >= price;
    if (!losing && price > 0 && cost < price * 0.75) continue; // صحي - لا نُثقل القائمة

    push({
      id: `pricing-${p.id}`,
      titleAr: `تسعير ${p.name}`, titleEn: `${p.name} pricing`,
      descAr: "مقارنة السعر الحالي بالتكلفة الحقيقية شاملة المرتجعات والإعلان.",
      descEn: "Current price against true cost including returns and ad spend.",
      category: "pricing",
      status: losing ? "FAILED" : "WARNING",
      severity: losing ? "CRITICAL" : "MEDIUM",
      findingAr: losing
        ? `التكلفة الحقيقية ${Math.round(cost)} ${currency} تتجاوز سعر البيع ${Math.round(price)} ${currency}.`
        : `الهامش ضيق: التكلفة ${Math.round(cost)} ${currency} من سعر ${Math.round(price)} ${currency}.`,
      monthlyImpact: losing ? Math.round((cost - price) * 30) : null,
      trend: [],
      lastScanAt: now,
      actionHref: "/dashboard/pricing",
    });
  }

  // ============ الإعلانات ============
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  push({
    id: "ads-ctr",
    titleAr: "معدل النقر", titleEn: "Click-through rate",
    descAr: "هل يجذب إعلانك النقرات مقارنة بعدد مرات ظهوره؟",
    descEn: "Does your ad earn clicks relative to how often it is shown?",
    category: "ads",
    status: totals.impressions === 0 ? "UNKNOWN" : ctr >= 2 ? "PASS" : ctr >= 1 ? "WARNING" : "FAILED",
    severity: totals.impressions === 0 ? "NONE" : ctr >= 2 ? "NONE" : ctr >= 1 ? "MEDIUM" : "HIGH",
    findingAr: totals.impressions === 0 ? "لا توجد بيانات ظهور بعد." : `معدل النقر ${ctr.toFixed(2)}%.`,
    trend: seriesFrom(snapshots, (r) => (r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0)),
    lastScanAt: now,
    actionHref: "/dashboard/campaigns",
  });

  const inflation = totals.raw > 0 ? ((totals.raw - totals.verified) / totals.raw) * 100 : 0;
  push({
    id: "quality-inflation",
    titleAr: "تضخيم المنصات", titleEn: "Platform inflation",
    descAr: "الفارق بين ما تعلنه المنصة وما تحقّق فعلاً - جوهر طبقة الحقيقة.",
    descEn: "The gap between platform-reported and verified results.",
    category: "quality",
    status: totals.raw === 0 ? "UNKNOWN" : inflation <= 25 ? "PASS" : inflation <= 50 ? "WARNING" : "FAILED",
    severity: totals.raw === 0 ? "NONE" : inflation <= 25 ? "NONE" : inflation <= 50 ? "MEDIUM" : "CRITICAL",
    findingAr: totals.raw === 0 ? "لا توجد تحويلات للمقارنة بعد."
      : `المنصات تُبلّغ عن ${Math.round(inflation)}% أكثر مما تأكّد فعلياً.`,
    monthlyImpact: inflation > 25 ? Math.round(monthlySpend * (inflation / 100)) : null,
    trend: seriesFrom(snapshots, (r) => (r.rawConversions > 0 ? ((r.rawConversions - r.verifiedConversions) / r.rawConversions) * 100 : 0)),
    lastScanAt: now,
    actionHref: "/dashboard/reports",
  });

  // ============ الميزانية ============
  const daysWithSpend = new Set(snapshots.filter((s) => s.cost > 0).map((s) => s.date.toISOString().slice(0, 10))).size;
  push({
    id: "budget-continuity",
    titleAr: "استمرارية الإنفاق", titleEn: "Spend continuity",
    descAr: "انقطاع الإنفاق يعيد ضبط تعلّم الخوارزمية ويضرّ الأداء.",
    descEn: "Spend gaps reset algorithm learning and hurt performance.",
    category: "budget",
    status: snapshots.length === 0 ? "UNKNOWN" : daysWithSpend >= 25 ? "PASS" : daysWithSpend >= 15 ? "WARNING" : "FAILED",
    severity: snapshots.length === 0 ? "NONE" : daysWithSpend >= 25 ? "NONE" : "MEDIUM",
    findingAr: snapshots.length === 0 ? "لا توجد بيانات إنفاق بعد."
      : `إنفاق مسجّل في ${daysWithSpend} يوماً من آخر 30.`,
    trend: seriesFrom(snapshots, (r) => r.cost),
    lastScanAt: now,
    actionHref: "/dashboard/campaigns",
  });

  // ============ الأمان وصلاحية الاتصال ============
  for (const c of connections) {
    const daysLeft = c.expiresAt ? Math.floor((c.expiresAt.getTime() - now.getTime()) / 86400000) : null;
    if (daysLeft !== null && daysLeft > 21) continue; // سليم - لا داعي لإظهاره كصف

    push({
      id: `security-conn-${c.platform}`,
      titleAr: `صلاحية الاتصال بـ${c.platform === "GOOGLE_ADS" ? "Google" : c.platform === "META_ADS" ? "Meta" : "TikTok"}`,
      titleEn: `${c.platform} connection validity`,
      descAr: "انتهاء صلاحية الربط يوقف المزامنة تماماً دون إشعار من المنصة.",
      descEn: "An expired connection silently stops all syncing.",
      category: "security", platform: c.platform,
      status: daysLeft === null ? "PASS" : daysLeft <= 0 ? "FAILED" : daysLeft <= 7 ? "WARNING" : "PASS",
      severity: daysLeft === null ? "NONE" : daysLeft <= 0 ? "CRITICAL" : daysLeft <= 7 ? "HIGH" : "NONE",
      findingAr: daysLeft === null ? "الاتصال سليم." : daysLeft <= 0 ? "انتهت الصلاحية - أعد الربط الآن." : `تنتهي الصلاحية خلال ${daysLeft} يوماً.`,
      trend: [],
      lastScanAt: now,
      actionHref: "/dashboard/settings?tab=integrations",
    });
  }

  // ============ صفحات الهبوط ============
  for (const p of pages) {
    if (p.trackingDetected === true && p.adloopDetected === true) continue;
    push({
      id: `landing-${p.id}`,
      titleAr: p.label ?? p.url,
      titleEn: p.label ?? p.url,
      descAr: "فحص وجود وسوم التتبع في مصدر الصفحة.",
      descEn: "Checks tracking tags in the page source.",
      category: "landing",
      status: p.lastError ? "UNKNOWN" : p.trackingDetected === false ? "FAILED" : "WARNING",
      severity: p.lastError ? "NONE" : p.trackingDetected === false ? "HIGH" : "MEDIUM",
      findingAr: p.lastError ?? (p.trackingDetected === false
        ? "لم يُعثر على أي وسم تتبع في مصدر الصفحة."
        : "التتبع موجود لكن وسم AdLoop غير مكتشف."),
      trend: [],
      lastScanAt: p.lastCheckedAt ?? now,
      actionHref: "/dashboard/diagnostics/tracking-coverage",
    });
  }

  // ============ مهام تشخيصية من المزامنة اليومية ============
  for (const t of tasks) {
    push({
      id: `task-${t.id}`,
      titleAr: t.title, titleEn: t.title,
      descAr: "مهمة اكتُشفت خلال الفحص اليومي.",
      descEn: "Detected during the daily scan.",
      category: "performance",
      status: t.priority === "URGENT" ? "FAILED" : "WARNING",
      severity: t.priority === "URGENT" ? "CRITICAL" : t.priority === "HIGH" ? "HIGH" : "MEDIUM",
      findingAr: t.title,
      trend: [],
      lastScanAt: t.createdAt,
      actionHref: "/dashboard/actions",
    });
  }

  // ============ الحصيلة ============
  const counts = {
    critical: checks.filter((c) => c.severity === "CRITICAL").length,
    high: checks.filter((c) => c.severity === "HIGH").length,
    medium: checks.filter((c) => c.severity === "MEDIUM").length,
    passing: checks.filter((c) => c.status === "PASS").length,
  };

  // الدرجة تنخفض بوزن الخطورة لا بعدد المشاكل - مشكلة حرجة واحدة أخطر
  // من خمس ملاحظات متوسطة، والحساب السابق كان يساوي بينها.
  const penalty = checks.reduce((s, c) => s + SEVERITY_WEIGHT[c.severity], 0);
  const healthScore = Math.max(0, Math.min(100, 100 - penalty));

  const scoreTrend = seriesFrom(snapshots, (r) =>
    r.rawConversions > 0 ? (r.verifiedConversions / r.rawConversions) * 100 : 0
  );

  const totalMonthlyImpact = checks.reduce((s, c) => s + (c.monthlyImpact ?? 0), 0);
  const lastScanAt = checks.length > 0
    ? new Date(Math.max(...checks.map((c) => c.lastScanAt.getTime())))
    : null;

  return { checks, healthScore, scoreTrend, counts, totalMonthlyImpact, lastScanAt, currency };
}
