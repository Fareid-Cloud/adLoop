// lib/diagnosticsEngine.ts
//
// محرك التشخيص: يُنتج قائمة فحوصات موحّدة الشكل، لكل فحص فئة وحالة ومصدر
// بيانات صريح وأثر مالي مقدَّر واتجاه زمني.
//
// السياق: كانت الصفحة تعرض شبكة بطاقات مبنية على DailyTask وحده، بلا مصدر
// واضح ولا أثر مقدَّر ولا اتجاه - فبدت "بطاقات فارغة". هنا كل فحص يقول
// من أين جاء رقمه، وماذا يكلّفك، وهل يتحسّن أم يسوء.

import { prisma } from "@/lib/prisma";
import { platformLabel } from "@/lib/i18n/dictionary";

export type CheckStatus = "PASS" | "WARNING" | "FAILED" | "UNKNOWN";
export type CheckSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "NONE";

export type CheckCategory =
  | "tracking" | "pricing" | "ads" | "landing" | "seo"
  | "performance" | "security" | "budget" | "quality";

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
  /** النتيجة بالإنجليزية - تُبنى بلغتها لا تُترجم حرفياً */
  findingEn?: string;
  /** الأثر المالي الشهري المقدَّر بعملة مساحة العمل */
  monthlyImpact?: number | null;
  /** اتجاه آخر 14 يوماً للرسم الصغير */
  trend: number[];
  /** المنصة المصدر إن كان الفحص خاصاً بمنصة */
  platform?: string | null;
  /** من أين جاء رقم هذا الفحص بالضبط - يُعرض في التفاصيل */
  source?: string;
  /** خطوات المعالجة الفعلية - لا يُعرض زر تفاصيل بلا محتوى حقيقي */
  remedy?: string[];
  lastScanAt: Date;
  actionHref?: string;
}

export const CATEGORY_META: Record<CheckCategory, { ar: string; en: string; color: string }> = {
  tracking: { ar: "التتبع", en: "Tracking", color: "#3B82F6" },
  pricing: { ar: "التسعير", en: "Pricing", color: "#EC4899" },
  ads: { ar: "الإعلانات", en: "Ads", color: "#8B5CF6" },
  landing: { ar: "صفحات الهبوط", en: "Landing pages", color: "#06B6D4" },
  seo: { ar: "SEO", en: "SEO", color: "#A855F7" },
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

export async function runDiagnostics(
  workspaceId: string,
  // 🔴 لم تكن تستقبل لغةً إطلاقاً، و`sourceAr`/`remedyAr` يُعرضان مباشرةً -
  // فيرى مستخدم الواجهة الإنجليزية مصدر كلّ فحص وعلاجه بالعربية.
  locale: "ar" | "en"
): Promise<DiagnosticsReport> {
  const ar = locale === "ar";
  /** يختار النصّ بلغة القارئ - أقصر من ثلاثيّة عند كلّ سطر */
  const L = (a: string, e: string) => (ar ? a : e);
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
          date: true, platform: true, campaignId: true, cost: true, clicks: true,
          impressions: true, rawConversions: true, verifiedConversions: true, revenue: true,
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
      findingEn: !isLinked ? "No campaigns linked from this platform."
        : hasData ? `Data arrived for ${rows.length} of the last 30 days.`
        : "The platform is connected but no data has arrived - check the account permissions.",
      trend: seriesFrom(rows, (r) => r.cost),
      source: `${L("جدول لقطات الأداء اليومية، منصة", "Daily performance snapshots,")} ${label}${L("، آخر 30 يوماً.", ", last 30 days.")}`,
      remedy: !isLinked
        ? [L("اربط حساب المنصة من صفحة ربط المنصات ثم اختر الحملات التي تريد متابعتها.", "Connect the platform from the Integrations page, then pick the campaigns you want tracked.")]
        : hasData ? undefined
        : [L("تأكد أن حساب الإعلانات ما زال مرتبطاً ولم تنتهِ صلاحيته.", "Check that the ad account is still connected and its access has not expired."),
           L("تأكد أن المستخدم المرتبط يملك صلاحية القراءة على الحساب.", "Check that the connected user still has read access to the account."),
           "المزامنة تعمل يومياً - البيانات الجديدة قد تحتاج دورة واحدة للظهور."],
      lastScanAt: now,
      actionHref: "/dashboard/integrations",
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
    findingEn: totals.raw === 0
      ? "No conversions recorded yet."
      : `Only ${Math.round(verificationRate)}% of reported conversions were verified (${totals.verified} of ${totals.raw}).`,
    monthlyImpact: totals.raw > 0 && verificationRate < 60 ? Math.round(wastedOnUnverified) : null,
    trend: seriesFrom(snapshots, (r) => r.verifiedConversions),
    source: L("مقارنة rawConversions (ما تعلنه المنصة) بـ verifiedConversions (ما تأكّد عبر محادثة حقيقية) خلال 30 يوماً.", "Comparing rawConversions (what the platform reports) against verifiedConversions (confirmed by a real conversation) over 30 days."),
    remedy: verificationRate >= 60 ? undefined : [
      L("تأكد من تثبيت وسم AdLoop على كل صفحة هبوط تستقبل زيارات إعلانية.", "Make sure the AdLoop tag is installed on every landing page that receives ad traffic."),
      L("تأكد أن أزرار واتساب تحمل معرّف التتبع، وإلا تصل المحادثة بلا مصدر.", "Make sure your WhatsApp buttons carry the tracking id, or the conversation arrives with no source."),
      L("اربط رقم واتساب الأعمال أو صفحة ماسنجر لتصل المحادثات إلينا.", "Connect your WhatsApp Business number or Messenger page so conversations reach us."),
    ],
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
    findingEn: pages.length === 0
      ? "No pages added for monitoring yet."
      : `${pagesWithAdloop} of ${pages.length} pages carry the AdLoop tag (${pagesChecked} checked).`,
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
    findingEn: totals.clicks === 0 ? "No clicks recorded yet."
      : totalSignals === 0 ? "Platforms report clicks but no signal has reached us from your site - the tag is probably not installed."
      : `${totalSignals} incoming signals against ${totals.clicks} reported clicks.`,
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
      findingEn: losing
        ? `Real cost of ${Math.round(cost)} ${currency} exceeds the selling price of ${Math.round(price)} ${currency}.`
        : `Margin is thin: costs of ${Math.round(cost)} ${currency} against a price of ${Math.round(price)} ${currency}.`,
      monthlyImpact: losing ? Math.round((cost - price) * 30) : null,
      trend: [],
      source: L("تكلفة المنتج + الشحن + تكلفة الإعلان للطلب + التغليف، مقارنة بسعر البيع الحالي.", "Product cost + shipping + ad cost per order + packaging, against the current selling price."),
      remedy: [
        `ارفع السعر إلى ما يغطي التكلفة الحقيقية ${Math.round(cost)} ${currency} على الأقل.`,
        L("أو اخفض تكلفة الاكتساب بتحسين استهداف الحملة.", "Or bring the acquisition cost down by tightening the campaign's targeting."),
        L("افتح المنتج في صفحة التسعير لترى انهيار التكلفة وأكبر بند فيها.", "Open the product in Pricing to see the cost breakdown and its largest line."),
      ],
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
    findingEn: totals.impressions === 0 ? "No impression data yet." : `Click-through rate ${ctr.toFixed(2)}%.`,
    trend: seriesFrom(snapshots, (r) => (r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0)),
    source: L("إجمالي النقرات ÷ إجمالي مرات الظهور من لقطات الأداء، آخر 30 يوماً.", "Total clicks ÷ total impressions from performance snapshots, last 30 days."),
    remedy: ctr >= 2 ? undefined : [
      L("راجع نص الإعلان: هل يذكر عرضاً واضحاً أم وصفاً عاماً؟", "Review the ad copy: does it state a clear offer, or just a general description?"),
      L("ضيّق الاستهداف - الوصول الواسع يخفض النقر عادةً.", "Tighten the targeting — broad reach usually drags the click rate down."),
      L("جرّب صورة أو فيديو جديداً؛ الانحدار قد يكون إرهاقاً إبداعياً.", "Try a new image or video; the decline may simply be creative fatigue."),
    ],
    lastScanAt: now,
    actionHref: "/dashboard/campaigns",
  });

  // --- إعلان لا يعمل: ينفق صفر ولا يظهر إطلاقاً ---
  // أخطر من ضعف الأداء: الحملة تبدو "نشطة" في القائمة بينما هي عملياً
  // متوقفة، فتظن أن ميزانيتك تعمل وهي لا تعمل.
  const last7 = new Date(now); last7.setDate(last7.getDate() - 7);
  const activeByCampaign = new Map<string, { impressions: number; cost: number; platform: string }>();
  for (const s of snapshots) {
    if (s.date < last7) continue;
    const key = `${s.platform}::${s.campaignId}`;
    const cur = activeByCampaign.get(key) ?? { impressions: 0, cost: 0, platform: s.platform };
    cur.impressions += s.impressions;
    cur.cost += s.cost;
    activeByCampaign.set(key, cur);
  }
  const silentCampaigns = [...activeByCampaign.entries()].filter(([, v]) => v.impressions === 0);

  if (activeByCampaign.size > 0) {
    push({
      id: "ads-not-serving",
      titleAr: "إعلانات لا تُعرض", titleEn: "Ads not serving",
      descAr: "حملات مرتبطة لم تُسجّل أي ظهور خلال آخر سبعة أيام.",
      descEn: "Linked campaigns with zero impressions in the last seven days.",
      category: "ads",
      status: silentCampaigns.length === 0 ? "PASS" : "FAILED",
      severity: silentCampaigns.length === 0 ? "NONE" : "HIGH",
      findingAr: silentCampaigns.length === 0
        ? `كل الحملات المرتبطة (${activeByCampaign.size}) تُعرض بشكل طبيعي.`
        : `${silentCampaigns.length} حملة لم تُسجّل أي ظهور خلال 7 أيام رغم أنها مرتبطة.`,
      findingEn: silentCampaigns.length === 0
        ? `All ${activeByCampaign.size} linked campaigns are serving normally.`
        : `${silentCampaigns.length} linked campaigns recorded no impressions in 7 days.`,
      source: L("مجموع مرات الظهور لكل حملة من لقطات الأداء، آخر 7 أيام.", "Impressions per campaign from performance snapshots, last 7 days."),
      remedy: silentCampaigns.length === 0 ? undefined : [
        L("تأكد أن الحملة ليست متوقفة أو خارج جدولها الزمني في المنصة.", "Check the campaign is not paused or outside its schedule on the platform."),
        L("راجع حالة الاعتماد: إعلان مرفوض يعني صفر ظهور دون إشعار واضح.", "Check the approval status: a disapproved ad means zero impressions with no clear notice."),
        L("تحقق من الميزانية اليومية وطريقة الدفع - رصيد منتهٍ يوقف العرض فوراً.", "Check the daily budget and payment method — an exhausted balance stops delivery immediately."),
        L("استهداف ضيق جداً قد يمنع دخول المزادات أصلاً.", "Targeting that is too narrow can keep you out of the auction altogether."),
      ],
      trend: seriesFrom(snapshots, (r) => r.impressions),
      lastScanAt: now,
      actionHref: "/dashboard/campaigns",
    });
  }

  // --- إنفاق بلا نتيجة: يظهر وينفق ولا يحقّق شيئاً ---
  const spendingNoConv = [...activeByCampaign.entries()].filter(([key, v]) => {
    if (v.cost <= 0) return false;
    const rows = snapshots.filter((s) => s.date >= last7 && `${s.platform}::${s.campaignId}` === key);
    return rows.reduce((a, r) => a + r.rawConversions, 0) === 0;
  });
  if (spendingNoConv.length > 0) {
    const wasted = spendingNoConv.reduce((a, [, v]) => a + v.cost, 0);
    push({
      id: "ads-spend-no-result",
      titleAr: "إنفاق بلا أي تحويل", titleEn: "Spend with no conversions",
      descAr: "حملات تُنفق فعلياً دون أن تُسجّل تحويلاً واحداً.",
      descEn: "Campaigns spending without recording a single conversion.",
      category: "ads",
      status: "FAILED", severity: "CRITICAL",
      findingAr: `${spendingNoConv.length} حملة أنفقت ${Math.round(wasted)} ${currency} خلال 7 أيام بصفر تحويل.`,
      findingEn: `${spendingNoConv.length} campaigns spent ${Math.round(wasted)} ${currency} over 7 days with zero conversions.`,
      monthlyImpact: Math.round((wasted / 7) * 30),
      source: L("الحملات التي cost > 0 و rawConversions = 0 خلال آخر 7 أيام.", "Campaigns with cost > 0 and rawConversions = 0 over the last 7 days."),
      remedy: [
        L("تحقّق أولاً من التتبع: تحويلات غير مسجّلة تبدو كصفر تحويل.", "Check tracking first: unrecorded conversions look identical to zero conversions."),
        L("راجع صفحة الهبوط - عدم تطابقها مع وعد الإعلان يقتل التحويل.", "Review the landing page — a mismatch with the ad's promise kills conversion."),
        L("أوقف الحملة مؤقتاً إن تأكد أن التتبع سليم والنتيجة صفر فعلاً.", "Pause the campaign if tracking is confirmed sound and the result is genuinely zero."),
      ],
      trend: seriesFrom(snapshots, (r) => r.rawConversions),
      lastScanAt: now,
      actionHref: "/dashboard/actions",
    });
  }

  // --- تركّز الإنفاق: حملة واحدة تبتلع الميزانية ---
  if (activeByCampaign.size >= 3 && monthlySpend > 0) {
    const costs = [...activeByCampaign.values()].map((v) => v.cost).sort((a, b) => b - a);
    const topShare = costs[0] / Math.max(costs.reduce((a, b) => a + b, 0), 1) * 100;
    push({
      id: "ads-spend-concentration",
      titleAr: "تركّز الإنفاق", titleEn: "Spend concentration",
      descAr: "اعتماد الحساب كله على حملة واحدة يجعله هشّاً أمام أي تغيّر مفاجئ.",
      descEn: "Relying on a single campaign makes the account fragile to any sudden change.",
      category: "ads",
      status: topShare <= 70 ? "PASS" : "WARNING",
      severity: topShare <= 70 ? "NONE" : "MEDIUM",
      findingAr: `أعلى حملة تستحوذ على ${Math.round(topShare)}% من إجمالي الإنفاق.`,
      findingEn: `Your top campaign takes ${Math.round(topShare)}% of all spend.`,
      source: L("نصيب أكبر حملة من إجمالي الإنفاق خلال آخر 7 أيام.", "The largest campaign's share of total spend over the last 7 days."),
      remedy: topShare <= 70 ? undefined : [
        L("وزّع جزءاً من الميزانية على حملة ثانية مختبَرة لتقليل المخاطرة.", "Move part of the budget to a second, tested campaign to reduce the risk."),
        L("توقّف حملة واحدة مهيمنة يعني توقّف نتائجك بالكامل.", "If one dominant campaign stops, your results stop entirely."),
      ],
      trend: seriesFrom(snapshots, (r) => r.cost),
      lastScanAt: now,
      actionHref: "/dashboard/campaigns",
    });
  }

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
    findingEn: totals.raw === 0 ? "No conversions to compare yet."
      : `Platforms report ${Math.round(inflation)}% more than was actually verified.`,
    monthlyImpact: inflation > 25 ? Math.round(monthlySpend * (inflation / 100)) : null,
    trend: seriesFrom(snapshots, (r) => (r.rawConversions > 0 ? ((r.rawConversions - r.verifiedConversions) / r.rawConversions) * 100 : 0)),
    source: L("الفارق بين ما تعلنه المنصات وما تأكّد فعلياً، مقسوماً على المُعلن.", "The gap between what platforms report and what was actually verified, divided by the reported figure."),
    remedy: inflation <= 25 ? undefined : [
      L("تضخيم مرتفع قد يعني احتساب المنصة لتحويلات لم تحدث فعلاً (نماذج إحصائية).", "High inflation can mean the platform is counting conversions that never happened (statistical modelling)."),
      L("راجع إعداد التحويلات في المنصة: أحداث مكرّرة تُحتسب مرات متعددة.", "Review the conversion setup on the platform: duplicate events get counted more than once."),
      L("استخدم التكلفة الحقيقية لا المُعلنة عند اتخاذ قرارات الميزانية.", "Use the verified cost, not the reported one, when making budget decisions."),
    ],
    lastScanAt: now,
    // 🔴 كانت `/dashboard/reports`: صفحة تعرض الفجوة نفسها بصياغة أخرى ولا
    // تُغيّر فيها شيئاً. زرّ اسمه «حلّ» يفتح عرضاً آخر للمشكلة هو أسوأ من
    // غياب الزرّ - المستخدم يضغط ثمّ يعود بلا شيء. ما يُقلّص التضخيم فعلاً
    // هو تغطية التتبّع: كلّما زاد ما نتحقّق منه ضاقت الفجوة.
    actionHref: "/dashboard/diagnostics/tracking-coverage",
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
    findingEn: snapshots.length === 0 ? "No spend data yet."
      : `Spend recorded on ${daysWithSpend} of the last 30 days.`,
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
      titleEn: `${platformLabel("en", c.platform)} connection validity`,
      descAr: "انتهاء صلاحية الربط يوقف المزامنة تماماً دون إشعار من المنصة.",
      descEn: "An expired connection silently stops all syncing.",
      category: "security", platform: c.platform,
      status: daysLeft === null ? "PASS" : daysLeft <= 0 ? "FAILED" : daysLeft <= 7 ? "WARNING" : "PASS",
      severity: daysLeft === null ? "NONE" : daysLeft <= 0 ? "CRITICAL" : daysLeft <= 7 ? "HIGH" : "NONE",
      findingAr: daysLeft === null ? "الاتصال سليم." : daysLeft <= 0 ? "انتهت الصلاحية - أعد الربط الآن." : `تنتهي الصلاحية خلال ${daysLeft} يوماً.`,
      findingEn: daysLeft === null ? "Connection is healthy." : daysLeft <= 0 ? "Expired - reconnect now." : `Expires in ${daysLeft} days.`,
      trend: [],
      lastScanAt: now,
      actionHref: "/dashboard/integrations",
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
      findingEn: p.lastError ?? (p.trackingDetected === false
        ? "No tracking tag was found in the page source."
        : "Tracking is present, but the AdLoop tag was not detected."),
      trend: [],
      lastScanAt: p.lastCheckedAt ?? now,
      actionHref: "/dashboard/diagnostics/tracking-coverage",
    });
  }

  // ============ SEO والأمان وروابط المحادثة ============
  // كلها تُستخلص من نفس نداء فحص الصفحة (lib/pageAudit.ts) - لا نداء إضافي.
  const audited = pages.filter((p: any) => p.auditResult);
  if (audited.length > 0) {
    const seos = audited.map((p: any) => p.auditResult.seo).filter(Boolean);
    const secs = audited.map((p: any) => p.auditResult.security).filter(Boolean);
    const utms = audited.map((p: any) => p.auditResult.utm).filter(Boolean);

    // --- عنوان الصفحة ووصفها ---
    const badTitle = seos.filter((s: any) => !s.title || s.titleLength < 20 || s.titleLength > 65).length;
    push({
      id: "seo-title",
      titleAr: "عنوان الصفحة", titleEn: "Page title",
      descAr: "العنوان أول ما يراه الزائر في نتائج البحث وأهم عامل نقر.",
      descEn: "The first thing searchers see and the biggest driver of clicks.",
      category: "seo",
      status: badTitle === 0 ? "PASS" : badTitle === seos.length ? "FAILED" : "WARNING",
      severity: badTitle === 0 ? "NONE" : "MEDIUM",
      findingAr: badTitle === 0
        ? `عناوين ${seos.length} صفحة ضمن الطول المناسب.`
        : `${badTitle} من ${seos.length} صفحة عنوانها مفقود أو خارج النطاق المناسب (20–65 حرفاً).`,
      findingEn: badTitle === 0
        ? `Titles on all ${seos.length} pages are within a useful length.`
        : `${badTitle} of ${seos.length} pages have a missing title or one outside the useful range (20-65 characters).`,
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
    });

    const badDesc = seos.filter((s: any) => !s.metaDescription || s.metaDescriptionLength < 70).length;
    push({
      id: "seo-description",
      titleAr: "وصف الصفحة (Meta description)", titleEn: "Meta description",
      descAr: "الوصف الذي يظهر تحت العنوان في نتائج البحث.",
      descEn: "The snippet shown under your title in search results.",
      category: "seo",
      status: badDesc === 0 ? "PASS" : badDesc === seos.length ? "FAILED" : "WARNING",
      severity: badDesc === 0 ? "NONE" : "MEDIUM",
      findingAr: badDesc === 0
        ? "كل الصفحات لديها وصف مناسب."
        : `${badDesc} من ${seos.length} صفحة بلا وصف كافٍ.`,
      findingEn: badDesc === 0
        ? "Every page has an adequate description."
        : `${badDesc} of ${seos.length} pages have no adequate description.`,
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
    });

    // --- منع الأرشفة: خطأ صامت يُلغي ظهورك تماماً ---
    const noIndexed = seos.filter((s: any) => s.isNoIndex).length;
    if (noIndexed > 0) {
      push({
        id: "seo-noindex",
        titleAr: "صفحات ممنوعة من الأرشفة", titleEn: "Pages blocked from indexing",
        descAr: "وسم noindex يمنع ظهور الصفحة في البحث نهائياً - غالباً بقايا بيئة تجريبية.",
        descEn: "A noindex tag hides the page from search entirely — often a leftover from staging.",
        category: "seo",
        status: "FAILED", severity: "HIGH",
        findingAr: `${noIndexed} صفحة تحمل وسم noindex ولن تظهر في نتائج البحث.`,
        findingEn: `${noIndexed} pages carry a noindex tag and will not appear in search results.`,
        trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
      });
    }

    // --- بنية العناوين والصور ---
    const badH1 = seos.filter((s: any) => s.h1Count !== 1).length;
    const noAlt = seos.reduce((sum: number, s: any) => sum + s.imagesMissingAlt, 0);
    push({
      id: "seo-structure",
      titleAr: "بنية المحتوى", titleEn: "Content structure",
      descAr: "عنوان رئيسي واحد لكل صفحة، ونص بديل للصور.",
      descEn: "One main heading per page, and alt text on images.",
      category: "seo",
      status: badH1 === 0 && noAlt === 0 ? "PASS" : "WARNING",
      severity: badH1 === 0 && noAlt === 0 ? "NONE" : "MEDIUM",
      findingAr: badH1 === 0 && noAlt === 0
        ? "بنية العناوين والصور سليمة."
        : `${badH1} صفحة بعنوان رئيسي غير مفرد، و${noAlt} صورة بلا نص بديل.`,
      findingEn: badH1 === 0 && noAlt === 0
        ? "Heading and image structure is sound."
        : `${badH1} pages have a non-unique main heading, and ${noAlt} images have no alt text.`,
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
    });

    // --- الجوال ---
    const noViewport = seos.filter((s: any) => !s.hasViewport).length;
    push({
      id: "seo-mobile",
      titleAr: "التوافق مع الجوال", titleEn: "Mobile readiness",
      descAr: "معظم زوار الإعلانات من الجوال - صفحة بلا viewport تظهر مصغّرة وغير قابلة للاستخدام.",
      descEn: "Most ad traffic is mobile — without a viewport tag the page renders unusably small.",
      category: "seo",
      status: noViewport === 0 ? "PASS" : "FAILED",
      severity: noViewport === 0 ? "NONE" : "HIGH",
      findingAr: noViewport === 0 ? "كل الصفحات مهيّأة للجوال." : `${noViewport} صفحة بلا وسم viewport.`,
      findingEn: noViewport === 0 ? "Every page is mobile-ready." : `${noViewport} pages have no viewport tag.`,
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
    });

    // --- شهادة الأمان ---
    const notHttps = secs.filter((s: any) => !s.isHttps).length;
    const mixed = secs.reduce((sum: number, s: any) => sum + s.mixedContentCount, 0);
    push({
      id: "security-https",
      titleAr: "شهادة الأمان (SSL)", titleEn: "SSL certificate",
      descAr: "الاتصال المشفّر شرط للثقة، والمنصات تخفض جودة الإعلان بدونه.",
      descEn: "Encrypted connections build trust; platforms downgrade ad quality without them.",
      category: "security",
      status: notHttps > 0 ? "FAILED" : mixed > 0 ? "WARNING" : "PASS",
      severity: notHttps > 0 ? "CRITICAL" : mixed > 0 ? "MEDIUM" : "NONE",
      findingAr: notHttps > 0
        ? `${notHttps} صفحة تعمل بدون HTTPS.`
        : mixed > 0
        ? `الاتصال مشفّر، لكن ${mixed} مورداً يُحمَّل عبر HTTP وسيُحجب في المتصفحات.`
        : "كل الصفحات تعمل عبر اتصال مشفّر سليم.",
      findingEn: notHttps > 0
        ? `${notHttps} pages run without HTTPS.`
        : mixed > 0
        ? `The connection is encrypted, but ${mixed} resources load over HTTP and browsers will block them.`
        : "Every page runs over a healthy encrypted connection.",
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
    });

    // --- روابط المحادثة: نقطة التحويل الفعلية في هذا المنتج ---
    const convTotal = utms.reduce((s: number, u: any) => s + u.conversationLinks, 0);
    const convTracked = utms.reduce((s: number, u: any) => s + u.conversationLinksWithTracking, 0);
    push({
      id: "tracking-conversation-links",
      titleAr: "روابط المحادثة", titleEn: "Conversation links",
      descAr: "أزرار واتساب/ماسنجر يجب أن تحمل معرّفاً يربط المحادثة بالإعلان.",
      descEn: "WhatsApp/Messenger buttons must carry an identifier linking the chat to its ad.",
      category: "tracking",
      status: convTotal === 0 ? "UNKNOWN" : convTracked === convTotal ? "PASS" : convTracked > 0 ? "WARNING" : "FAILED",
      severity: convTotal === 0 ? "NONE" : convTracked === convTotal ? "NONE" : convTracked > 0 ? "HIGH" : "CRITICAL",
      findingAr: convTotal === 0
        ? "لم نعثر على روابط محادثة في الصفحات المفحوصة."
        : `${convTracked} من ${convTotal} رابط محادثة يحمل معرّف تتبع.`,
      findingEn: convTotal === 0
        ? "No chat links were found on the pages we checked."
        : `${convTracked} of ${convTotal} chat links carry a tracking id.`,
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
    });

    // --- وسوم UTM ---
    const utmLinks = utms.reduce((s: number, u: any) => s + u.linksWithUtm, 0);
    push({
      id: "tracking-utm",
      titleAr: "وسوم UTM", titleEn: "UTM parameters",
      descAr: "وسوم المصدر تسمح بتتبع مصدر الزيارة عبر الأدوات التحليلية.",
      descEn: "Source parameters let analytics tools attribute traffic correctly.",
      category: "tracking",
      status: utmLinks > 0 ? "PASS" : "WARNING",
      severity: "NONE",
      findingAr: utmLinks > 0
        ? `${utmLinks} رابطاً يحمل وسوم UTM.`
        : "لم نعثر على وسوم UTM في روابط الصفحات - قد تكون مضبوطة على مستوى الحملة بدلاً من ذلك.",
      findingEn: utmLinks > 0
        ? `${utmLinks} links carry UTM tags.`
        : "No UTM tags were found in your page links - they may be set at campaign level instead.",
      trend: [], lastScanAt: now, actionHref: "/dashboard/diagnostics/tracking-coverage",
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
      findingEn: t.title,
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
