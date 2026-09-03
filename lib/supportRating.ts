// lib/supportRating.ts
//
// **متى نسأل، وعلى إيه نسأل.** قواعدُ تقييم الدعم (CSAT) في ملفٍّ واحد،
// عشان الودجت والسيرفر مايختلفوش على الجواب - والاختلافُ هنا معناه سؤالٌ
// بيظهر ويختفي، أو بيتكرّر على نفس الردّ.
//
// ═══ الرحلة، ولماذا هي كده ═══
//
// ١) **مانسألش قبل ما يبقى فيه خدمةٌ تُقيَّم.** لازم يكون آخرُ كلامٍ في
//    المحادثة ردّاً من الدعم. سؤالُ عميلٍ لسه ما اتردّ عليه بيتقري
//    استهتاراً.
//
// ٢) **نسأل لمّا الحوار يخلص، مش وهو ماشي.** وخلاصُه علامتان: إمّا الدعم
//    قفلها صراحةً (Done/Archive)، أو عدّى وقتٌ هادي بعد آخر ردّ - ساعتان.
//    السؤالُ وسط الحوار بيقاطع، والعميلُ بيقفله بلا تفكير.
//
// ٣) **دوسةٌ واحدة تكفي.** الدرجةُ بتتحفظ لحظةَ الدوس، والباقي (الأسباب
//    والتعليق) اختياريٌّ بيظهر بعدها. الاستمارةُ اللي بتطلب كلَّ حاجة قبل
//    «إرسال» بيسيبها أغلبُ اللي بدأها، فبنخسر حتى الرقم.
//
// ٤) **«مش دلوقتي» جوابٌ محترم.** بتقفل الدورة دي، ومابنرجعش نسأل إلّا
//    بعد ردٍّ جديد من الدعم - يعني بعد خدمةٍ جديدة فعلاً.
//
// ٥) **مرّةٌ واحدة لكلّ دورة.** الدورةُ هويّتُها معرَّفُ آخر ردّ، والقيدُ
//    الفريد في قاعدة البيانات هو اللي بيفرضها لا فحصٌ في الكود.

/** الهدوءُ المطلوب بعد آخر ردٍّ قبل ما نسأل - ساعتان. */
export const RATING_QUIET_MS = 2 * 60 * 60 * 1000;

/** أقلُّ وأعلى درجة. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** الدرجةُ من ٤ فوق = راضٍ - التعريفُ المعتاد لـ«نسبة الرضا» في CSAT. */
export const RATING_POSITIVE_FROM = 4;

/**
 * أسبابٌ من قائمةٍ مغلقة، مقسومة على اتجاه الدرجة.
 *
 * مقسومةٌ عن قصد: عرضُ «كان سريعاً» على واحدٍ دَي درجةً واحدة بيخلّي
 * الاستمارة تبان مش قارية اللي قاله. والقائمةُ المغلقة (مش نصّاً حرّاً)
 * هي اللي بتخلّي «إيه أكتر شكوى بتتكرّر» سؤالاً له إجابةٌ تتجمّع.
 *
 * المفاتيحُ ثابتة والنصُّ من القاموس: النصُّ المحفوظ في قاعدة البيانات
 * لازم يكون مفتاحاً لا كلاماً معروضاً (قاعدةٌ عامة في المنتج).
 */
export const RATING_REASONS_LOW = [
  "slow",        // الردّ اتأخّر
  "unresolved",  // المشكلة ما اتحلّتش
  "unclear",     // الشرح مش واضح
  "repeat",      // اضطُرّ يكرّر كلامه
] as const;

export const RATING_REASONS_HIGH = [
  "fast",        // ردٌّ سريع
  "resolved",    // المشكلة اتحلّت
  "clear",       // شرحٌ واضح
  "friendly",    // تعاملٌ محترم
] as const;

export type RatingReason =
  | (typeof RATING_REASONS_LOW)[number]
  | (typeof RATING_REASONS_HIGH)[number];

const ALL_REASONS: readonly string[] = [...RATING_REASONS_LOW, ...RATING_REASONS_HIGH];

export function isRatingReason(v: unknown): v is RatingReason {
  return typeof v === "string" && ALL_REASONS.includes(v);
}

/** الأسبابُ المناسبة لدرجةٍ بعينها - المنخفضةُ تسأل «إيه اللي وحش». */
export function reasonsForScore(score: number): readonly string[] {
  return score >= RATING_POSITIVE_FROM ? RATING_REASONS_HIGH : RATING_REASONS_LOW;
}

export function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= RATING_MIN && v <= RATING_MAX;
}

export interface RatingAskInput {
  /** حالةُ المحادثة - القفلُ الصريح بيسأل فوراً بلا انتظار. */
  status: string;
  /** آخرُ رسالة في المحادثة. */
  last: { id: string; fromSupport: boolean; createdAt: Date | string } | null;
  /** الدورةُ دي اتسأل عليها قبل كده؟ (صفٌّ موجود بدرجةٍ أو برفض) */
  answeredTriggerIds: readonly string[];
  now?: Date;
}

/**
 * القرار: نسأل ولا لأ، وعلى أنهي ردّ.
 *
 * دالّةٌ خالصة بلا قاعدة بيانات عشان تتقري وتتفحص لوحدها - القرارُ ده
 * بيتّاخد في السيرفر بس، لكن كتابتُه هنا بتخلّيه **مقروءاً** بدل ما يبقى
 * تلات شروطٍ متفرّقة في مسار API.
 */
export function shouldAskForRating(input: RatingAskInput): { ask: boolean; triggerMessageId?: string } {
  const { status, last, answeredTriggerIds } = input;
  const now = input.now ?? new Date();

  // (١) لازم يكون آخرُ كلامٍ ردّاً من الدعم.
  if (!last || !last.fromSupport) return { ask: false };

  // (٥) الدورةُ دي خلصت - بدرجةٍ أو بـ«مش دلوقتي».
  if (answeredTriggerIds.includes(last.id)) return { ask: false };

  // (٢) خلصت صراحةً، أو هدأت ساعتين.
  const closed = status === "CLOSED" || status === "ARCHIVED";
  const quiet = now.getTime() - new Date(last.createdAt).getTime() >= RATING_QUIET_MS;
  if (!closed && !quiet) return { ask: false };

  return { ask: true, triggerMessageId: last.id };
}
