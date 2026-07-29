// lib/matchQuality.ts
//
// تقدير جودة المطابقة (0-10) لحدث تحويل قبل رفعه للمنصة.
//
// لماذا يهمّ هذا الرقم أكثر من أي رقم آخر في مسار الرفع: المنصة لا تستفيد
// من حدث لا تستطيع ربطه بمستخدم لديها. حدث برقم نقرة (gclid/fbc) يُربط
// يقيناً، وحدث ببريد مُهشَّم يُربط غالباً، وحدث بعنوان IP فقط يكاد يُهمَل.
// إرسال أحداث ضعيفة المطابقة لا يحسّن الاستهداف - يستهلك حصّة الطلبات فقط.
//
// ⚠️ حدّ صريح: هذا **تقديرنا** لقوة الإشارة، وليس درجة المطابقة الرسمية
// التي تحسبها ميتا (Event Match Quality) داخلياً. الدرجة الحقيقية لا
// يعرفها إلا المنصة نفسها، ولا تُعيدها في استجابة الرفع. نخزّن ما تُعيده
// المنصة حين تُعيده في حقل منفصل، ولا نخلط الاثنين إطلاقاً.
//
// بلا استيراد - يعمل على الخادم وداخل مكوّنات العميل معاً.

export interface MatchSignals {
  emailHash?: string | null;
  phoneHash?: string | null;
  firstNameHash?: string | null;
  lastNameHash?: string | null;
  cityHash?: string | null;
  countryHash?: string | null;
  externalUserId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
}

interface SignalWeight {
  key: keyof MatchSignals;
  weight: number;
  labelAr: string;
  labelEn: string;
}

// الأوزان مرتّبة بقوة الإشارة الفعلية على الربط: معرّف النقرة يقين،
// والبريد/الهاتف مطابقة مباشرة بحساب المستخدم، والاسم/المدينة إشارات
// داعمة لا تكفي وحدها، والـ IP/المتصفح أضعفها على الإطلاق.
const SIGNAL_WEIGHTS: SignalWeight[] = [
  { key: "fbc", weight: 3.0, labelAr: "معرّف نقرة ميتا", labelEn: "Meta click ID" },
  { key: "gclid", weight: 3.0, labelAr: "معرّف نقرة جوجل", labelEn: "Google click ID" },
  { key: "ttclid", weight: 3.0, labelAr: "معرّف نقرة تيك توك", labelEn: "TikTok click ID" },
  { key: "emailHash", weight: 2.5, labelAr: "البريد الإلكتروني", labelEn: "Email" },
  { key: "phoneHash", weight: 2.5, labelAr: "رقم الهاتف", labelEn: "Phone" },
  { key: "externalUserId", weight: 1.5, labelAr: "معرّف العميل لدى المتجر", labelEn: "Store customer ID" },
  { key: "fbp", weight: 1.0, labelAr: "كوكي متصفح ميتا", labelEn: "Meta browser cookie" },
  { key: "firstNameHash", weight: 0.5, labelAr: "الاسم الأول", labelEn: "First name" },
  { key: "lastNameHash", weight: 0.5, labelAr: "اسم العائلة", labelEn: "Last name" },
  { key: "cityHash", weight: 0.3, labelAr: "المدينة", labelEn: "City" },
  { key: "countryHash", weight: 0.3, labelAr: "الدولة", labelEn: "Country" },
  { key: "clientIpAddress", weight: 0.4, labelAr: "عنوان IP", labelEn: "IP address" },
  { key: "clientUserAgent", weight: 0.4, labelAr: "بصمة المتصفح", labelEn: "User agent" },
];

// السقف الذي نعتبره "مطابقة مثالية عملياً": معرّف نقرة + بريد + هاتف +
// معرّف عميل. تجاوز ذلك لا يحسّن الربط فعلياً، فتثبيت السقف هنا يمنع
// تضخيم الدرجة بإشارات ضعيفة كثيرة.
const PRACTICAL_MAX = 3.0 + 2.5 + 2.5 + 1.5;

export interface MatchQualityResult {
  score: number; // 0-10
  presentSignals: Array<{ key: string; labelAr: string; labelEn: string; weight: number }>;
  missingHighValue: Array<{ key: string; labelAr: string; labelEn: string }>;
  /** هل الحدث يستحق الرفع أصلاً - أقل من ذلك استهلاك حصّة بلا فائدة */
  worthSending: boolean;
  gradeAr: string;
  gradeEn: string;
}

/** أقل درجة نرفع عندها. تحت هذا الحد لا تملك المنصة ما تربط به الحدث. */
export const MIN_WORTH_SENDING_SCORE = 3.0;

export function scoreMatchQuality(signals: MatchSignals): MatchQualityResult {
  const present: MatchQualityResult["presentSignals"] = [];
  let raw = 0;

  for (const s of SIGNAL_WEIGHTS) {
    const v = signals[s.key];
    if (v) {
      raw += s.weight;
      present.push({ key: String(s.key), labelAr: s.labelAr, labelEn: s.labelEn, weight: s.weight });
    }
  }

  const score = Math.round(Math.min(10, (raw / PRACTICAL_MAX) * 10) * 10) / 10;

  const highValue: Array<keyof MatchSignals> = ["emailHash", "phoneHash", "externalUserId"];
  const missingHighValue = SIGNAL_WEIGHTS.filter(
    (s) => highValue.includes(s.key) && !signals[s.key]
  ).map((s) => ({ key: String(s.key), labelAr: s.labelAr, labelEn: s.labelEn }));

  return {
    score,
    presentSignals: present,
    missingHighValue,
    worthSending: score >= MIN_WORTH_SENDING_SCORE,
    ...grade(score),
  };
}

function grade(score: number): { gradeAr: string; gradeEn: string } {
  if (score >= 8) return { gradeAr: "ممتازة", gradeEn: "Excellent" };
  if (score >= 6) return { gradeAr: "جيدة", gradeEn: "Good" };
  if (score >= MIN_WORTH_SENDING_SCORE) return { gradeAr: "مقبولة", gradeEn: "Fair" };
  return { gradeAr: "ضعيفة", gradeEn: "Poor" };
}

/** إشارات المطابقة المدعومة فعلياً لكل منصة - رفع إشارة لا تقبلها المنصة بلا معنى */
export function signalsForPlatform(platform: string, signals: MatchSignals): MatchSignals {
  switch (platform) {
    case "META_ADS":
      // ميتا لا تعرف gclid/ttclid
      return { ...signals, gclid: null, ttclid: null };
    case "GOOGLE_ADS":
      // رفع التحويلات غير المتصلة لجوجل يعتمد على gclid أو البريد/الهاتف
      // (Enhanced Conversions for Leads) - لا كوكيات ميتا
      return {
        emailHash: signals.emailHash,
        phoneHash: signals.phoneHash,
        gclid: signals.gclid,
      };
    case "TIKTOK_ADS":
      return {
        emailHash: signals.emailHash,
        phoneHash: signals.phoneHash,
        ttclid: signals.ttclid,
        clientIpAddress: signals.clientIpAddress,
        clientUserAgent: signals.clientUserAgent,
        externalUserId: signals.externalUserId,
      };
    default:
      return signals;
  }
}
