// lib/competitorBoard.ts
//
// لوحة إعلانات المنافسين.
//
// **لماذا لا يوجد سحب آلي:** الـAPI الرسمي لمكتبة إعلانات ميتا يُرجع
// الإعلانات التجارية (`ad_type=ALL`) لدول الاتحاد الأوروبي وبريطانيا
// فقط - قيدٌ نابع من الـDSA لا من صلاحيات التطبيق. مصر والسعودية
// والإمارات خارج التغطية تماماً، وما يظهر لهم هو الإعلانات السياسية
// وحدها. تأكّدنا من ذلك من التوثيق قبل البناء.
//
// **ما نضيفه فوق المكتبة نفسها:** المكتبة تعرض ما يعمل الآن ولا تحتفظ
// بتاريخ رصدك أنت. الإعلان الذي يُبقيه المنافس شهرين هو إعلانه الرابح -
// لا أحد يدفع شهرين على إعلان فاشل. هذه الإشارة تُشتقّ هنا ولا توجد
// هناك، وهي أهمّ ما في الصفحة.

import { prisma } from "@/lib/prisma";

export type AdFormat = "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT";

/** حدّ يُميّز الإعلان المُختبَر عن الجديد. أقلّ من أسبوعين لا يعني شيئاً بعد. */
const PROVEN_DAYS = 21;
/** بعد هذه المدّة بلا تأكيد رصد، لم نعد نثق أنه ما زال يعمل */
const STALE_CONFIRM_DAYS = 30;

export interface CompetitorAdView {
  id: string;
  competitorId: string;
  platform: string;
  format: AdFormat;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  landingUrl: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  stillRunning: boolean;
  tags: string[];
  /** عدد الأيام بين أوّل رصد وآخر تأكيد - مدّة البقاء المؤكَّدة */
  runningDays: number;
  /** أثبت نفسه: بقي طويلاً وما زال يعمل */
  proven: boolean;
  /** لم يُؤكَّد رصده منذ مدّة - المدّة معروضة لكنها قد تكون متقادمة */
  staleConfirm: boolean;
}

export interface CompetitorView {
  id: string;
  name: string;
  pageUrl: string | null;
  country: string;
  notes: string | null;
  ads: CompetitorAdView[];
  activeCount: number;
  provenCount: number;
  /** أطول إعلان بقاءً - أقوى ما لديهم بحسب ما رصدته */
  longestRunningDays: number;
}

export interface BoardSummary {
  competitors: CompetitorView[];
  totalAds: number;
  totalActive: number;
  totalProven: number;
  /** أطول إعلان بقاءً عبر كل المنافسين - يُعرض كبطاقة مؤشّر */
  topRunningDays: number;
  /** الشكل الأكثر استخداماً بينهم - إشارة إلى ما يشتغل في سوقك */
  dominantFormat: AdFormat | null;
  dominantFormatPct: number;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export async function getCompetitorBoard(workspaceId: string): Promise<BoardSummary> {
  const rows = await prisma.competitor.findMany({
    where: { workspaceId },
    include: { ads: { orderBy: { firstSeenAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const formatCount = new Map<AdFormat, number>();
  let totalAds = 0, totalActive = 0, totalProven = 0, topRunningDays = 0;

  const competitors: CompetitorView[] = rows.map((c) => {
    const ads: CompetitorAdView[] = c.ads.map((a) => {
      // المدّة تُقاس حتى آخر تأكيد لا حتى اليوم: إعلان لم تتحقّق منه منذ
      // شهر قد يكون توقّف، فعدّه ما زال يعمل ادّعاء لا دليل عليه.
      const runningDays = daysBetween(a.firstSeenAt, a.lastSeenAt);
      const sinceConfirm = daysBetween(a.lastSeenAt, now);
      const staleConfirm = a.stillRunning && sinceConfirm > STALE_CONFIRM_DAYS;
      const proven = a.stillRunning && runningDays >= PROVEN_DAYS;

      const fmt = (a.format as AdFormat) ?? "IMAGE";
      formatCount.set(fmt, (formatCount.get(fmt) ?? 0) + 1);
      totalAds++;
      if (a.stillRunning) totalActive++;
      if (proven) totalProven++;
      topRunningDays = Math.max(topRunningDays, runningDays);

      return {
        id: a.id,
        competitorId: a.competitorId,
        platform: a.platform,
        format: fmt,
        headline: a.headline,
        body: a.body,
        ctaLabel: a.ctaLabel,
        landingUrl: a.landingUrl,
        imageUrl: a.imageUrl,
        sourceUrl: a.sourceUrl,
        firstSeenAt: a.firstSeenAt.toISOString(),
        lastSeenAt: a.lastSeenAt.toISOString(),
        stillRunning: a.stillRunning,
        tags: a.tags,
        runningDays,
        proven,
        staleConfirm,
      };
    });

    // الأطول بقاءً أوّلاً: ترتيب زمني يدفن أقوى ما لديهم في آخر القائمة
    ads.sort((x, y) => y.runningDays - x.runningDays);

    return {
      id: c.id,
      name: c.name,
      pageUrl: c.pageUrl,
      country: c.country,
      notes: c.notes,
      ads,
      activeCount: ads.filter((a) => a.stillRunning).length,
      provenCount: ads.filter((a) => a.proven).length,
      longestRunningDays: ads.reduce((m, a) => Math.max(m, a.runningDays), 0),
    };
  });

  let dominantFormat: AdFormat | null = null;
  let dominantCount = 0;
  for (const [fmt, n] of formatCount) {
    if (n > dominantCount) { dominantFormat = fmt; dominantCount = n; }
  }

  return {
    competitors,
    totalAds,
    totalActive,
    totalProven,
    topRunningDays,
    dominantFormat,
    dominantFormatPct: totalAds > 0 ? Math.round((dominantCount / totalAds) * 100) : 0,
  };
}

/** رابط بحث مكتبة الإعلانات - مصدر الرصد، لا بديل عن اللوحة */
export function adLibrarySearchUrl(name: string, country: string): string {
  const q = encodeURIComponent(name);
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${q}&media_type=all`;
}
