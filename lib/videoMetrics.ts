// lib/videoMetrics.ts
//
// مقاييس خاصة بكامبينز الفيديو (يوتيوب، فيديوهات ميتا/TikTok/Snapchat).
// منفصلة عن metricsEngine.ts لأن منطقها مختلف جوهرياً - هنا بنقيس "الاهتمام"
// (هل الناس شافوا الفيديو فعلاً) مش بس "التحويل".

export interface RawVideoMetrics {
  platform: "GOOGLE_ADS" | "META_ADS" | "TIKTOK_ADS" | "SNAPCHAT_ADS";
  impressions: number;
  cost: number;
  videoViews: number;
  // Views لأول 3 ثواني (ميتا/TikTok) - إشارة اهتمام مبدئي بس
  videoViews3Sec?: number;
  // ThruPlays: المشاهدة الكاملة أو 15 ثانية (أيهما أقل) - إشارة اهتمام حقيقي
  videoThruPlays?: number;
  totalWatchTimeSec: number;
}

export interface ComputedVideoMetrics {
  viewRate: number;          // % (views / impressions)
  thruPlayRate: number;      // % (thruplays / views) - "قد إيه الاهتمام كان حقيقي"
  avgWatchTimeSec: number;
  cpv: number;                // Cost Per View
  costPerThruPlay: number;    // أدق من CPV لأنه بيقيس اهتمام حقيقي مش مجرد ظهور
  hookRate: number;           // % (views3sec / impressions) - "قد إيه الفيديو بيلفت الانتباه أول 3 ثواني"
}

export function computeVideoMetrics(raw: RawVideoMetrics): ComputedVideoMetrics {
  const viewRate =
    raw.impressions > 0 ? round2((raw.videoViews / raw.impressions) * 100) : 0;

  const thruPlayRate =
    raw.videoViews > 0 && raw.videoThruPlays
      ? round2((raw.videoThruPlays / raw.videoViews) * 100)
      : 0;

  const avgWatchTimeSec =
    raw.videoViews > 0
      ? round2(raw.totalWatchTimeSec / raw.videoViews)
      : 0;

  const cpv = raw.videoViews > 0 ? round2(raw.cost / raw.videoViews) : 0;

  const costPerThruPlay =
    raw.videoThruPlays && raw.videoThruPlays > 0
      ? round2(raw.cost / raw.videoThruPlays)
      : 0;

  const hookRate =
    raw.impressions > 0 && raw.videoViews3Sec
      ? round2((raw.videoViews3Sec / raw.impressions) * 100)
      : 0;

  return { viewRate, thruPlayRate, avgWatchTimeSec, cpv, costPerThruPlay, hookRate };
}

import { t, Locale } from "@/lib/i18n/dictionary";

// مقارنة أداء الفيديو بين المنصات - بترتب حسب "cost per thru-play" (الأدق)
// بدل CPV العادي، لأن CPV ممكن يكون رخيص لكن مفيش حد شاف الفيديو فعلاً
export function compareVideoPerformance(
  metrics: (RawVideoMetrics & ComputedVideoMetrics)[],
  locale: Locale = "ar"
): { ranked: (RawVideoMetrics & ComputedVideoMetrics)[]; insight: string } {
  const withData = metrics.filter((m) => m.costPerThruPlay > 0);
  const ranked = [...withData].sort((a, b) => a.costPerThruPlay - b.costPerThruPlay);

  let insight = t(locale, "insights.noData");
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    insight = t(locale, "insights.videoComparison", {
      best: best.platform,
      worst: worst.platform,
      bestValue: best.costPerThruPlay,
      worstValue: worst.costPerThruPlay,
    });
  }

  return { ranked, insight };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
