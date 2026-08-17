// lib/truthKpis.ts
//
// كل أرقام صفحة الحقيقة في مكان واحد، محسوبة من البيانات المكتشفة فعلاً.
//
// المبدأ الحاكم لكل رقم هنا: لا نعرض مؤشراً لا نملك مصدره. حين ينقص المصدر
// تُعاد القيمة null ويُذكر السبب، بدل صفر يبدو كأنه نتيجة. صفرٌ مكانه
// "لا نعرف" هو أخطر رقم في أي لوحة تحليل.

import { prisma } from "@/lib/prisma";
import { buildConversionPaths } from "@/lib/touchpointPaths";
import { getAttributionSummaryForWorkspace } from "@/lib/attributionSummary";
import {
  compareModels,
  computeJourneyStats,
  countUnbackedClaims,
  type ModelComparisonRow,
  type JourneyStats,
} from "@/lib/attributionModels";

export interface PlatformTruthRow {
  platform: string;
  hasData: boolean;
  cost: number;
  clicks: number;
  impressions: number;
  reported: number;
  verified: number;
  revenue: number;
  verificationRatePct: number;
  verificationChangePp: number | null;
  inflationRatePct: number;
  cpaReported: number | null;
  cpaVerified: number | null;
  /** كم يزيد سعر العميل الحقيقي عن الرقم الذي تعرضه المنصة */
  cpaUnderstatementPct: number | null;
  roasReported: number | null;
  wastedSpend: number;
  reportedSeries: number[];
  verifiedSeries: number[];
}

export interface TruthTotals {
  cost: number;
  clicks: number;
  impressions: number;
  reported: number;
  verified: number;
  revenue: number;
  verificationRatePct: number;
  inflationRatePct: number;
  wastedSpend: number;
  cpaReported: number | null;
  cpaVerified: number | null;
  roasReported: number | null;
  /** فرق التكلفة الحقيقية عن المعلَنة بالعملة - "لو صدّقت المنصة، كنت ستدفع أقل مما تدفع فعلاً بهذا الفارق" */
  /** 🔴 **العائد على الاستثمار - وهو غير العائد على الإنفاق.**
   *
   *  `ROAS` يقسم الإيراد على الصرف الإعلانيّ، فيتجاهل ثمنَ البضاعة نفسها.
   *  حسابٌ بعائدٍ ٣× قد يكون **خاسراً** إن كان هامشه ٢٥٪: من كلّ ثلاثة
   *  ريالاتٍ عائدة، ريالان وربع ثمنُ المنتج، فالباقي أقلُّ ممّا دُفع للإعلان.
   *
   *  ولذلك يُحسَب من الربح لا من الإيراد: (إيراد×هامش − صرف) ÷ صرف.
   *
   *  و`null` بلا هامشٍ محدَّد: لا نخمّنه. رقمُ ربحٍ مبنيٌّ على هامشٍ مفترَض
   *  أسوأ من غياب الرقم، لأنّه يُتَّخذ عليه قرارُ ميزانية. */
  roiPct: number | null;
  cpaGapAmount: number | null;
  verificationChangePp: number | null;
  /** سلسلتا الاتّجاه لكامل المساحة - مجموعُ المنصّات يوماً بيوم.
   *  البطاقة تعرض رقمَ اليوم، وهاتان تقولان إلى أين يسير - وهي معلومةٌ
   *  مختلفة: حسابٌ استقرّ عند الرقم وآخرُ بلغه صاعداً ليسا سواءً في القرار. */
  reportedSeries: number[];
  verifiedSeries: number[];
}

export interface SyncHealth {
  enabled: boolean;
  configuredPlatforms: string[];
  totalEvents: number;
  sentEvents: number;
  failedEvents: number;
  skippedEvents: number;
  pendingEvents: number;
  avgMatchQuality: number | null;
  lastSentAt: Date | null;
  /** أكثر سبب تخطٍّ تكراراً - يوجّه المستخدم لأهم إصلاح واحد */
  topSkipReason: string | null;
}

/**
 * نتيجة محرّك الإسناد الاحتمالي - **طبقة مستقلّة عن نماذج اللمسات وليست
 * بديلاً عنها**، والاثنتان تكمّلان بعضهما:
 *
 * • نماذج اللمسات تجيب: "الرحلة عدّت على ماذا، ومن يستحقّ الفضل؟"
 * • هذا المحرّك يجيب سؤالاً أضيق وأصعب: "هذه محادثة وصلت **بلا كود
 *   مطابق** إطلاقاً - من أي منصة جاءت على الأرجح؟" (تطابق هاتف، قرب
 *   زمني بتلاشٍ، نمط ساعة، ثم نسبة أساس).
 *
 * أي محادثة بلا كود لا تملك لمسة مسجَّلة غالباً، فلا تدخل نماذج اللمسات
 * أصلاً - وهنا بالضبط تكمن قيمة هذه الطبقة. عرضها منفصلةً مقصود: المؤكَّد
 * لا يُخلط بالمُرجَّح في رقم واحد.
 */
export interface ProbabilisticAttribution {
  verifiedCount: number;
  modeledCount: number;
  byPlatform: Array<{ platform: string; conversions: number }>;
  /** نسبة ما احتاج ترجيحاً من إجمالي المحادثات المعالَجة */
  modeledSharePct: number;
}

export interface TruthSnapshot {
  days: number;
  totals: TruthTotals;
  previousTotals: Pick<TruthTotals, "verificationRatePct" | "cpaVerified" | "wastedSpend"> | null;
  platforms: PlatformTruthRow[];
  journey: JourneyStats;
  modelRows: ModelComparisonRow[];
  channelRows: ModelComparisonRow[];
  unbackedClaims: number;
  pathCoveragePct: number;
  conversionsWithoutTouches: number;
  totalTrackedConversions: number;
  sync: SyncHealth;
  /** هل توجد بيانات لمسات أصلاً - يحدّد إن كان قسم الإسناد يُعرض أم يُشرح */
  hasTouchpointData: boolean;
  /** 🔴 **اختار مقارنةً ولم يجد شيئاً: تُقال لا تُبتلَع.**
   *
   *  من يختار «مقابل العام الماضي» وحسابه عمره شهران تختفي الفروق أمامه
   *  بلا كلمة، فيقرأ الخيار معطّلاً. وهذه الراية تفرّق بين «لم يطلب
   *  مقارنة» و«طلبها والفترة المقابلة فارغة». */
  comparisonRequestedButEmpty: boolean;
  probabilistic: ProbabilisticAttribution;
}

const PLATFORMS = ["GOOGLE_ADS", "META_ADS", "TIKTOK_ADS", "SNAPCHAT_ADS"] as const;

interface SnapshotRow {
  date?: Date;
  platform: string;
  cost: number;
  clicks?: number;
  impressions?: number;
  rawConversions: number;
  verifiedConversions: number;
  revenue?: number | null;
}

function summarize(rows: SnapshotRow[]) {
  return rows.reduce(
    (a, r) => ({
      cost: a.cost + (r.cost ?? 0),
      clicks: a.clicks + (r.clicks ?? 0),
      impressions: a.impressions + (r.impressions ?? 0),
      raw: a.raw + (r.rawConversions ?? 0),
      verified: a.verified + (r.verifiedConversions ?? 0),
      revenue: a.revenue + (r.revenue ?? 0),
    }),
    { cost: 0, clicks: 0, impressions: 0, raw: 0, verified: 0, revenue: 0 }
  );
}

export async function getTruthSnapshot(
  workspaceId: string,
  /** 🔴🔴 **كان `days: number` وحده، فكان المنتقي زينةً على هذه الصفحة.**
   *
   *  من يختار «يناير» في مارس كان يُحسَب له **آخر واحدٍ وثلاثين يوماً من
   *  اليوم** - أي مارس وفبراير - ويُعرَض له باعتباره يناير. لم يكن الرقم
   *  غير مقارَن، بل **عن فترةٍ أخرى تماماً**. والعدد وحده لا يكفي: مدّةُ
   *  الفترة شيء، وموضعُها من التقويم شيءٌ آخر.
   *
   *  فصارت الحدود صريحةً تُمرَّر كما اختارها القارئ. */
  range: { from: Date; to: Date },
  /** الفترة التي يُقارَن بها - ما اختاره القارئ في المنتقي إن اختار،
   *  وإلّا فالسابقة مباشرةً بالطول نفسه. وطرفان بمدّتين مختلفتين لا تصحّ
   *  بينهما نسبة، فالطول محفوظٌ في الحالين. */
  compareRange?: { from: Date; to: Date } | null
): Promise<TruthSnapshot> {
  const since = range.from;
  const to = range.to;

  // 🔴 **«بلا مقارنة» كانت تُقارِن.** كان الغياب يُفهَم «لم يختر بعد»
  // فتُحسَب الفترة السابقة تلقائياً - فيطفئ القارئ المقارنة صراحةً
  // وتبقى «٤٪ مقابل الفترة السابقة» تحت كلّ رقم. وخيارٌ لا أثر له
  // خيارٌ كاذب.
  //
  // والافتراضيّ في هذا المنتج مطفأ (راجع `periodFromParams`)، فمن يريد
  // المقارنة يطلبها - وحينها وحدها تُحسَب.
  const spanMs = to.getTime() - since.getTime();
  const prevFrom = compareRange?.from ?? null;
  const prevTo = compareRange?.to ?? null;

  // هامشُ الربح من المساحة: بدونه لا يُحسَب العائد على الاستثمار - ولا
  // يُخمَّن. رقمُ ربحٍ مبنيٌّ على هامشٍ مفترَض تُتَّخذ عليه قرارات ميزانية.
  const workspaceSettings = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { profitMarginPct: true },
  });
  const profitMarginPct = workspaceSettings?.profitMarginPct ?? null;

  const [current, previous, paths, syncLogs, syncConfig, probabilisticRaw] = await Promise.all([
    prisma.metricSnapshot.findMany({
      // حدّان لا حدّ: `gte` وحدها تبتلع كلّ ما بعد البداية إلى اليوم،
      // فتُحسَب فترةٌ منتهية وكأنّها ممتدّة إلى الآن.
      where: { workspaceId, date: { gte: since, lte: to } },
      select: {
        date: true, platform: true, cost: true, clicks: true, impressions: true,
        rawConversions: true, verifiedConversions: true, revenue: true,
      },
      orderBy: { date: "asc" },
    }),
    // بلا فترةِ مقارنة لا استعلامَ أصلاً: مصفوفةٌ فارغة تُسقط كلّ فرقٍ
    // إلى `null`، فلا يُرسَم شيء.
    prevFrom && prevTo ? prisma.metricSnapshot.findMany({
      where: { workspaceId, date: { gte: prevFrom, lte: prevTo } },
      select: {
        platform: true, cost: true, rawConversions: true, verifiedConversions: true, revenue: true,
      },
    }) : Promise.resolve([]),
    buildConversionPaths(workspaceId, since, to),
    prisma.conversionSyncLog.findMany({
      where: { workspaceId, createdAt: { gte: since, lte: to } },
      select: { status: true, platform: true, matchQualityScore: true, sentAt: true, errorMessage: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        conversionSyncEnabled: true, metaPixelId: true, metaCapiToken: true,
        googleConversionActionId: true, tiktokPixelCode: true, tiktokCapiToken: true,
      },
    }),
    // محرّك الإسناد الاحتمالي القائم - يعمل جنباً إلى جنب مع نماذج اللمسات
    getAttributionSummaryForWorkspace(workspaceId, since, to),
  ]);

  // ==== إجماليات الفترة ====
  const t = summarize(current);
  const pt = summarize(previous);

  const verificationRatePct = t.raw > 0 ? round1((t.verified / t.raw) * 100) : 0;
  const prevVerificationRate = pt.raw > 0 ? round1((pt.verified / pt.raw) * 100) : null;

  const cpaReported = t.raw > 0 ? round2(t.cost / t.raw) : null;
  const cpaVerified = t.verified > 0 ? round2(t.cost / t.verified) : null;

  const totals: TruthTotals = {
    cost: Math.round(t.cost),
    clicks: t.clicks,
    impressions: t.impressions,
    reported: round1(t.raw),
    verified: t.verified,
    revenue: Math.round(t.revenue),
    verificationRatePct,
    inflationRatePct: t.raw > 0 ? round1(((t.raw - t.verified) / t.raw) * 100) : 0,
    // الإنفاق المقابل للتحويلات التي لم تتحقّق. ليس "مالاً ضائعاً" حرفياً -
    // هو الجزء من الإنفاق الذي لا يقابله عميل مؤكَّد، وقد يكون بعضه حقيقياً
    // لم يُلتقط. التسمية في الواجهة تقول ذلك صراحةً.
    wastedSpend: t.raw > 0 ? Math.round(t.cost * (1 - t.verified / t.raw)) : 0,
    cpaReported,
    cpaVerified,
    roasReported: t.cost > 0 && t.revenue > 0 ? round2(t.revenue / t.cost) : null,
    cpaGapAmount: cpaReported !== null && cpaVerified !== null ? round2(cpaVerified - cpaReported) : null,
    roiPct:
      profitMarginPct !== null && profitMarginPct > 0 && t.cost > 0 && t.revenue > 0
        ? round1((((t.revenue * (profitMarginPct / 100)) - t.cost) / t.cost) * 100)
        : null,
    verificationChangePp:
      prevVerificationRate !== null ? round1(verificationRatePct - prevVerificationRate) : null,
    // تُملأ بعد بناء المنصّات أدناه: سلاسلُها هي مصدرها.
    reportedSeries: [],
    verifiedSeries: [],
  };

  // ==== لكل منصة ====
  const platforms: PlatformTruthRow[] = PLATFORMS.map((p) => {
    const rows = current.filter((r) => r.platform === p);
    const prevRows = previous.filter((r) => r.platform === p);
    const s = summarize(rows);
    const ps = summarize(prevRows);

    const rate = s.raw > 0 ? round1((s.verified / s.raw) * 100) : 0;
    const prevRate = ps.raw > 0 ? round1((ps.verified / ps.raw) * 100) : null;
    const cpaRep = s.raw > 0 ? round2(s.cost / s.raw) : null;
    const cpaVer = s.verified > 0 ? round2(s.cost / s.verified) : null;

    const byDay = new Map<string, { raw: number; verified: number }>();
    for (const r of rows) {
      const k = r.date.toISOString().slice(0, 10);
      const cur = byDay.get(k) ?? { raw: 0, verified: 0 };
      cur.raw += r.rawConversions;
      cur.verified += r.verifiedConversions;
      byDay.set(k, cur);
    }
    const dayKeys = [...byDay.keys()].sort();

    return {
      platform: p,
      hasData: rows.length > 0,
      cost: Math.round(s.cost),
      clicks: s.clicks,
      impressions: s.impressions,
      reported: round1(s.raw),
      verified: s.verified,
      revenue: Math.round(s.revenue),
      verificationRatePct: rate,
      verificationChangePp: prevRate !== null ? round1(rate - prevRate) : null,
      inflationRatePct: s.raw > 0 ? round1(((s.raw - s.verified) / s.raw) * 100) : 0,
      cpaReported: cpaRep,
      cpaVerified: cpaVer,
      cpaUnderstatementPct:
        cpaRep !== null && cpaVer !== null && cpaRep > 0 ? round1(((cpaVer - cpaRep) / cpaRep) * 100) : null,
      roasReported: s.cost > 0 && s.revenue > 0 ? round2(s.revenue / s.cost) : null,
      wastedSpend: s.raw > 0 ? Math.round(s.cost * (1 - s.verified / s.raw)) : 0,
      reportedSeries: dayKeys.map((k) => byDay.get(k)!.raw),
      verifiedSeries: dayKeys.map((k) => byDay.get(k)!.verified),
    };
  });

  // ==== الإسناد متعدد اللمسات ====
  const journey = computeJourneyStats(paths.paths);
  const modelRows = compareModels(paths.paths, "platform");
  const channelRows = compareModels(paths.paths, "channel");

  // ==== صحة إعادة الرفع ====
  const configured: string[] = [];
  if (syncConfig?.metaPixelId && syncConfig?.metaCapiToken) configured.push("META_ADS");
  if (syncConfig?.googleConversionActionId) configured.push("GOOGLE_ADS");
  if (syncConfig?.tiktokPixelCode && syncConfig?.tiktokCapiToken) configured.push("TIKTOK_ADS");

  const sent = syncLogs.filter((l) => l.status === "SENT");
  const withQuality = sent.filter((l) => l.matchQualityScore !== null);
  const skipped = syncLogs.filter((l) => l.status === "SKIPPED");

  const skipReasons = new Map<string, number>();
  for (const l of skipped) {
    if (!l.errorMessage) continue;
    skipReasons.set(l.errorMessage, (skipReasons.get(l.errorMessage) ?? 0) + 1);
  }
  const topSkip = [...skipReasons.entries()].sort((a, b) => b[1] - a[1])[0];

  const sentTimes = sent.map((l) => l.sentAt).filter((d): d is Date => !!d);

  const sync: SyncHealth = {
    enabled: syncConfig?.conversionSyncEnabled ?? false,
    configuredPlatforms: configured,
    totalEvents: paths.totalConversions,
    sentEvents: sent.length,
    failedEvents: syncLogs.filter((l) => l.status === "FAILED").length,
    skippedEvents: skipped.length,
    pendingEvents: Math.max(0, paths.totalConversions * configured.length - syncLogs.length),
    avgMatchQuality:
      withQuality.length > 0
        ? round1(withQuality.reduce((s, l) => s + (l.matchQualityScore ?? 0), 0) / withQuality.length)
        : null,
    lastSentAt: sentTimes.length > 0 ? new Date(Math.max(...sentTimes.map((d) => d.getTime()))) : null,
    topSkipReason: topSkip ? `${topSkip[0]} (${topSkip[1]} حدث)` : null,
  };

  // 🔴 سلاسل المساحة كلّها = مجموعُ سلاسل منصّاتها يوماً بيوم. تُبنى هنا
  // لا مع بقيّة `totals`، لأنّ `platforms` - مصدرَها - لا يوجد قبل هذا
  // السطر. والمنصّات تشترك في المدى الزمنيّ نفسه، فالفهرسُ يقابل اليومَ
  // نفسه في جميعها.
  const dayCount = Math.max(0, ...platforms.map((p) => p.reportedSeries.length));
  const sumAcrossPlatforms = (pick: (p: (typeof platforms)[number]) => number[]) =>
    Array.from({ length: dayCount }, (_, i) =>
      platforms.reduce((acc, p) => acc + (pick(p)[i] ?? 0), 0),
    );
  totals.reportedSeries = sumAcrossPlatforms((p) => p.reportedSeries);
  totals.verifiedSeries = sumAcrossPlatforms((p) => p.verifiedSeries);

  return {
    // العدد يُشتقّ من الفترة نفسها لا يُمرَّر بجانبها - فلا يفترقان.
    days: Math.max(1, Math.round(spanMs / 86_400_000) + 1),
    totals,
    comparisonRequestedButEmpty: !!(prevFrom && prevTo) && previous.length === 0,
    previousTotals:
      prevVerificationRate !== null
        ? {
            verificationRatePct: prevVerificationRate,
            cpaVerified: pt.verified > 0 ? round2(pt.cost / pt.verified) : null,
            wastedSpend: pt.raw > 0 ? Math.round(pt.cost * (1 - pt.verified / pt.raw)) : 0,
          }
        : null,
    platforms,
    journey,
    modelRows,
    channelRows,
    unbackedClaims: countUnbackedClaims(paths.paths),
    pathCoveragePct: paths.pathCoveragePct,
    conversionsWithoutTouches: paths.conversionsWithoutTouches,
    totalTrackedConversions: paths.totalConversions,
    sync,
    hasTouchpointData: paths.paths.length > 0,
    probabilistic: {
      verifiedCount: probabilisticRaw.verifiedCount,
      modeledCount: probabilisticRaw.modeledCount,
      byPlatform: Object.entries(probabilisticRaw.byPlatform)
        .map(([platform, conversions]) => ({ platform, conversions: round1(conversions) }))
        .sort((a, b) => b.conversions - a.conversions),
      modeledSharePct:
        probabilisticRaw.verifiedCount + probabilisticRaw.modeledCount > 0
          ? round1(
              (probabilisticRaw.modeledCount /
                (probabilisticRaw.verifiedCount + probabilisticRaw.modeledCount)) *
                100
            )
          : 0,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
