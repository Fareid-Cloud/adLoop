// lib/attributionEngine.ts
//
// خدمة مستقلة تماماً - مفيش أي اعتماد على باقي كود AdLoop.
// المدخل: محادثة مجهولة المصدر + قائمة الكليكات المرشحة (unmatched clicks)
// المخرج: توزيع احتمالي بين المنصات + الإشارة الأساسية المستخدمة

export interface UnmatchedClickCandidate {
  id: string;
  platform: string;
  clickedAt: Date;
  phoneHint?: string | null;
}

export interface UnattributedConversation {
  id: string;
  receivedAt: Date;
  phoneNumber?: string | null;
}

export interface PlatformBaseline {
  // من البيانات المؤكدة: نسبة كل منصة من إجمالي المحادثات المؤكدة
  // مثال: { GOOGLE_ADS: 0.7, META_ADS: 0.3 }
  ratios: Record<string, number>;
  // نمط الساعات: احتمالية كل منصة حسب ساعة اليوم (0-23)
  // مثال: { GOOGLE_ADS: [0.8, 0.75, ...24 قيمة], META_ADS: [0.2, 0.25, ...] }
  hourlyPattern?: Record<string, number[]>;
}

export interface AttributionOutput {
  distribution: Record<string, number>; // بيجمع لـ 1.0
  primarySignal: "phone_match" | "time_proximity" | "hourly_pattern" | "baseline_ratio";
}

const TIME_DECAY_HALF_LIFE_MINUTES = 60; // كل ساعة، وزن القرب الزمني بينصف

export function attributeConversation(
  conversation: UnattributedConversation,
  candidates: UnmatchedClickCandidate[],
  baseline: PlatformBaseline
): AttributionOutput {
  // ==== الإشارة 1: تطابق رقم الهاتف (أقوى إشارة، لو متاحة) ====
  if (conversation.phoneNumber) {
    const phoneMatches = candidates.filter(
      (c) => c.phoneHint === conversation.phoneNumber
    );
    if (phoneMatches.length > 0) {
      // لو فيه أكتر من كليك بنفس الرقم، ناخد الأحدث
      const best = phoneMatches.sort(
        (a, b) => b.clickedAt.getTime() - a.clickedAt.getTime()
      )[0];
      return {
        distribution: { [best.platform]: 1.0 },
        primarySignal: "phone_match",
      };
    }
  }

  // ==== الإشارة 2: القرب الزمني من كليكات مفتوحة (decay function) ====
  if (candidates.length > 0) {
    const weights: Record<string, number> = {};
    let totalWeight = 0;

    for (const candidate of candidates) {
      const minutesDiff =
        Math.abs(conversation.receivedAt.getTime() - candidate.clickedAt.getTime()) /
        60000;

      // exponential decay: وزن الكليك بيقل كل ما الفرق الزمني زاد
      const weight = Math.pow(0.5, minutesDiff / TIME_DECAY_HALF_LIFE_MINUTES);

      weights[candidate.platform] = (weights[candidate.platform] ?? 0) + weight;
      totalWeight += weight;
    }

    // لو فيه إشارة زمنية معقولة (مش كل الأوزان قريبة من صفر)
    if (totalWeight > 0.05) {
      const distribution: Record<string, number> = {};
      for (const [platform, weight] of Object.entries(weights)) {
        distribution[platform] = round4(weight / totalWeight);
      }
      return { distribution, primarySignal: "time_proximity" };
    }
  }

  // ==== الإشارة 3: نمط الساعة (لو متاح في الـ baseline) ====
  if (baseline.hourlyPattern) {
    const hour = conversation.receivedAt.getHours();
    const weights: Record<string, number> = {};
    let total = 0;

    for (const [platform, pattern] of Object.entries(baseline.hourlyPattern)) {
      const w = pattern[hour] ?? 0;
      weights[platform] = w;
      total += w;
    }

    if (total > 0) {
      const distribution: Record<string, number> = {};
      for (const [platform, w] of Object.entries(weights)) {
        distribution[platform] = round4(w / total);
      }
      return { distribution, primarySignal: "hourly_pattern" };
    }
  }

  // ==== Fallback أخير: النسبة العامة التاريخية ====
  return {
    distribution: { ...baseline.ratios },
    primarySignal: "baseline_ratio",
  };
}

// بتتحسب دورياً (يومي/أسبوعي) من البيانات المؤكدة، وتتخزن كـ baseline
// يُستخدم في المرة الجاية لما محادثة جديدة تحتاج fallback
export function computeBaseline(
  verifiedConversations: { platform: string; receivedAt: Date }[]
): PlatformBaseline {
  const counts: Record<string, number> = {};
  const hourlyCounts: Record<string, number[]> = {};

  for (const conv of verifiedConversations) {
    counts[conv.platform] = (counts[conv.platform] ?? 0) + 1;

    if (!hourlyCounts[conv.platform]) {
      hourlyCounts[conv.platform] = new Array(24).fill(0);
    }
    hourlyCounts[conv.platform][conv.receivedAt.getHours()]++;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ratios: Record<string, number> = {};
  for (const [platform, count] of Object.entries(counts)) {
    ratios[platform] = total > 0 ? round4(count / total) : 0;
  }

  // تطبيع الأنماط الساعية لكل منصة لوحدها (0-1 لكل ساعة)
  const hourlyPattern: Record<string, number[]> = {};
  for (const [platform, hours] of Object.entries(hourlyCounts)) {
    const max = Math.max(...hours, 1);
    hourlyPattern[platform] = hours.map((h) => round4(h / max));
  }

  return { ratios, hourlyPattern };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
