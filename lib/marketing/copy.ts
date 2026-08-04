// lib/marketing/copy.ts
//
// **نصوص الحملات.**
//
// قاعدة واحدة تحكم كلّ سطر هنا: **لا جملة تُقال بلا رقم من حساب المستلم.**
// «راجع لوحتك» بريد مهمَل؛ «ثلاثة إعلانات أنفقت 1,240 ريال بلا عميل واحد
// متحقَّق» سبب لفتحها الآن. لذلك يستقبل كلّ مُنشئ رسالة `MarketingContext`
// المحسوب من بيانات حقيقية، ويُرجع `null` إن لم تتوفّر أرقامه — رسالة
// جوفاء أسوأ من رسالة لم تُرسَل.
//
// النبرة: نتحدّث كزميل لاحظ شيئاً، لا كنظام يُبلّغ. جملة قصيرة، رقم
// واضح، خطوة واحدة. لا مبالغة ولا وعود — المنتج كلّه قائم على ألّا نصدّق
// الأرقام المتضخّمة، فبريد متضخّم يناقض ما نبيعه.

import type { EmailBlock, EmailTone } from "@/lib/emailTemplate";

export interface MarketingContext {
  locale: "ar" | "en";
  firstName: string | null;
  currency: string;
  /** قرارات معلّقة عالية الأولوية */
  pendingDecisions: number;
  /** أثر مالي مقدَّر لتلك القرارات */
  estimatedImpact: number;
  /** ما أعلنته المنصّات مقابل ما تحقّق فعلاً */
  reported: number;
  verified: number;
  /** إنفاق آخر 30 يوماً */
  spend: number;
  /** إعلانات أنفقت بلا عميل متحقَّق واحد */
  zeroVerifiedAds: number;
  zeroVerifiedSpend: number;
  /** هل فعّل رفع التحويلات للمنصّات */
  conversionSyncOn: boolean;
  daysLeft: number;
}

export interface RenderedMarketingEmail {
  subject: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  blocks: EmailBlock[];
  ctaLabel: string;
  tone: EmailTone;
}

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** «أهلاً يا فلان» حين نعرف الاسم، وإلّا تحية بلا اسم — لا «أهلاً null». */
const hi = (c: MarketingContext) =>
  c.firstName
    ? c.locale === "ar"
      ? `${c.firstName}، `
      : `${c.firstName}, `
    : "";

type Builder = (c: MarketingContext) => RenderedMarketingEmail | null;

// ══════════════════════════════════════════════════════════════════════
// حملة التفاعل
// ══════════════════════════════════════════════════════════════════════

const engageDecisions: Builder = (c) => {
  if (c.pendingDecisions < 1) return null;
  const ar = c.locale === "ar";
  return {
    tone: "neutral",
    subject: ar
      ? `${c.pendingDecisions} قرار ينتظرك في حسابك`
      : `${c.pendingDecisions} decisions are waiting in your account`,
    eyebrow: ar ? "ملخّص حسابك" : "Your account",
    title: ar
      ? `${hi(c)}راجعنا حسابك ووجدنا ${c.pendingDecisions} قراراً يستحقّ نظرة`
      : `${hi(c)}we reviewed your account and found ${c.pendingDecisions} decisions worth a look`,
    subtitle: ar
      ? "ليست تنبيهات عامّة — كلّ قرار مبنيّ على أرقام حملاتك أنت."
      : "Not generic alerts — every one is built from your own campaign numbers.",
    blocks: [
      ...(c.estimatedImpact > 0
        ? [
            {
              hero: {
                value: `${num(c.estimatedImpact)} ${c.currency}`,
                label: ar
                  ? "الأثر المالي المقدَّر لهذه القرارات شهرياً"
                  : "Estimated monthly financial impact of these decisions",
                tone: "positive" as EmailTone,
              },
            },
          ]
        : []),
      {
        text: ar
          ? "رتّبناها بالأثر المالي، فالأعلى أوّلاً. كلّ قرار يشرح سببه بالأرقام، وتوافق عليه أو ترفضه بضغطة."
          : "They are ranked by financial impact, highest first. Each one explains its reasoning with numbers, and you approve or dismiss it in one click.",
      },
    ],
    ctaLabel: ar ? "افتح قراراتي" : "Open my decisions",
  };
};

const engageTruth: Builder = (c) => {
  if (c.reported < 1) return null;
  const ar = c.locale === "ar";
  const gap = Math.max(0, c.reported - c.verified);
  const gapPct = pct(gap, c.reported);
  if (gapPct < 10) return null; // فجوة ضئيلة لا تستحقّ رسالة
  return {
    tone: "urgent",
    subject: ar
      ? `المنصّات أعلنت ${num(c.reported)} تحويلاً — تحقّق منها ${num(c.verified)}`
      : `Platforms reported ${num(c.reported)} conversions — ${num(c.verified)} verified`,
    eyebrow: ar ? "مركز الحقيقة" : "Truth Center",
    title: ar
      ? `${hi(c)}هذا هو الفارق بين ما قيل لك وما حدث فعلاً`
      : `${hi(c)}here is the gap between what you were told and what happened`,
    subtitle: ar
      ? "الرقم الذي تدفع على أساسه ليس دائماً الرقم الذي حدث."
      : "The number you optimize against is not always the number that happened.",
    blocks: [
      { hero: { value: `${gapPct}%`, label: ar ? "من التحويلات المُعلَنة لم تتحقّق" : "of reported conversions were not verified", tone: "urgent" } },
      { stat: { label: ar ? "أعلنته المنصّات" : "Reported by platforms", value: num(c.reported), tone: "neutral" } },
      { stat: { label: ar ? "تحقّق فعلاً" : "Actually verified", value: num(c.verified), tone: "positive" } },
      {
        text: ar
          ? "الفجوة وحدها ليست مشكلة — لكنّها تعني أنّ خوارزميات المنصّات تتعلّم من أرقام أوسع ممّا حدث. مركز الحقيقة يفصل الاثنين لكلّ حملة على حدة."
          : "The gap alone is not the problem — but it means the platforms' algorithms are learning from a wider number than what happened. Truth Center separates the two, campaign by campaign.",
      },
    ],
    ctaLabel: ar ? "افتح مركز الحقيقة" : "Open Truth Center",
  };
};

const engageSync: Builder = (c) => {
  if (c.conversionSyncOn) return null; // مفعَّل بالفعل
  const ar = c.locale === "ar";
  return {
    tone: "positive",
    subject: ar ? "خطوة واحدة تجعل المنصّات تتعلّم من أرقامك الحقيقية" : "One step makes the platforms learn from your real numbers",
    eyebrow: ar ? "خطوة مقترحة" : "Suggested step",
    title: ar
      ? `${hi(c)}أنت تتحقّق من تحويلاتك — لكنّ المنصّات لا تعرف ذلك بعد`
      : `${hi(c)}you are verifying your conversions — but the platforms do not know it yet`,
    subtitle: ar
      ? "رفع التحويلات المتحقَّقة يغيّر ما تتعلّمه الخوارزمية، لا ما تراه أنت فقط."
      : "Uploading verified conversions changes what the algorithm learns, not just what you see.",
    blocks: [
      {
        text: ar
          ? "اليوم تُحسّن جوجل وميتا حملاتك بناءً على تحويلاتها المُعلَنة — بما فيها ما لم يتحقّق. حين ترفع إليها المتحقَّق وحده، تتعلّم من العملاء الحقيقيين لا من الضجيج."
          : "Today Google and Meta optimize your campaigns from their own reported conversions — including the ones that never happened. When you send back only the verified ones, they learn from real customers instead of noise.",
      },
      {
        list: ar
          ? [
              "فعّل «إعادة رفع التحويلات» من الإعدادات",
              "اختر المنصّات التي تريد الرفع إليها",
              "نرفع المتحقَّق تلقائياً كلّ يوم — بلا خطوة يدوية",
            ]
          : [
              "Turn on conversion sync in your settings",
              "Pick the platforms you want to send to",
              "We upload verified conversions daily — no manual step",
            ],
      },
      {
        text: ar
          ? "الإعداد دقيقتان، ويعمل بعدها بلا تدخّل."
          : "Setup takes two minutes, and runs on its own after that.",
      },
    ],
    ctaLabel: ar ? "فعّل رفع التحويلات" : "Turn on conversion sync",
  };
};

const engageGap: Builder = (c) => {
  if (c.zeroVerifiedAds < 1 || c.zeroVerifiedSpend <= 0) return null;
  const ar = c.locale === "ar";
  return {
    tone: "urgent",
    subject: ar
      ? `${c.zeroVerifiedAds} إعلان أنفق ${num(c.zeroVerifiedSpend)} ${c.currency} بلا عميل متحقَّق`
      : `${c.zeroVerifiedAds} ads spent ${num(c.zeroVerifiedSpend)} ${c.currency} with zero verified customers`,
    eyebrow: ar ? "يستحقّ نظرة اليوم" : "Worth a look today",
    title: ar
      ? `${hi(c)}إعلانات تُنفق ولا تُنتج عميلاً واحداً مؤكّداً`
      : `${hi(c)}ads that keep spending without producing a single confirmed customer`,
    subtitle: ar
      ? "قد تكون مشكلة تتبّع، وقد تكون إنفاقاً ضائعاً — والفرق يظهر في دقيقة."
      : "It might be a tracking gap, it might be wasted spend — and the difference shows in a minute.",
    blocks: [
      { hero: { value: `${num(c.zeroVerifiedSpend)} ${c.currency}`, label: ar ? `موزّعة على ${c.zeroVerifiedAds} إعلاناً بصفر تحقّق` : `across ${c.zeroVerifiedAds} ads with zero verification`, tone: "urgent" } },
      {
        text: ar
          ? "لا نطلب منك إيقافها — نطلب أن تراها. أحياناً يكون السبب وسم تتبّع ناقص، وأحياناً يكون الإعلان نفسه. الصفحة تفصل الحالتين."
          : "We are not asking you to pause them — we are asking you to see them. Sometimes the cause is a missing tracking tag, sometimes it is the ad itself. The page separates the two.",
      },
    ],
    ctaLabel: ar ? "افحص هذه الإعلانات" : "Review these ads",
  };
};

// ══════════════════════════════════════════════════════════════════════
// دورة التجربة والاستعادة
// ══════════════════════════════════════════════════════════════════════

const trialBefore: Builder = (c) => {
  const ar = c.locale === "ar";
  const d = c.daysLeft;
  const soon = d <= 1;
  return {
    tone: soon ? "urgent" : "neutral",
    subject: ar
      ? soon
        ? "تجربتك تنتهي غداً — لا تفقد ما بنيته"
        : `${d} أيام متبقّية في تجربتك`
      : soon
        ? "Your trial ends tomorrow — do not lose what you built"
        : `${d} days left in your trial`,
    eyebrow: ar ? "تجربتك" : "Your trial",
    title: ar
      ? soon
        ? `${hi(c)}تجربتك تنتهي غداً`
        : `${hi(c)}بقي ${d} أيام في تجربتك`
      : soon
        ? `${hi(c)}your trial ends tomorrow`
        : `${hi(c)}${d} days left in your trial`,
    subtitle: ar
      ? "حسابك وربطك وإعداداتك تبقى كما هي — الاشتراك يبقيها تعمل."
      : "Your account, connections and settings all stay — subscribing keeps them running.",
    blocks: [
      ...(c.verified > 0
        ? [{ stat: { label: ar ? "عملاء تحقّقنا منهم لك" : "Customers we verified for you", value: num(c.verified), tone: "positive" as EmailTone } }]
        : []),
      ...(c.spend > 0
        ? [{ stat: { label: ar ? "إنفاق راقبناه" : "Spend we watched", value: `${num(c.spend)} ${c.currency}`, tone: "neutral" as EmailTone } }]
        : []),
      { divider: true },
      {
        text: ar
          ? "بعد انتهاء التجربة تتوقّف المزامنة اليومية والتنبيهات والقرارات. البيانات تبقى محفوظة، لكنّها تتوقّف عن التحدّث."
          : "When the trial ends, daily syncing, alerts and decisions stop. Your data stays, but it stops speaking.",
      },
    ],
    ctaLabel: ar ? "اختر باقتك" : "Choose your plan",
  };
};

const trialAfter: Builder = (c) => {
  const ar = c.locale === "ar";
  return {
    tone: "neutral",
    subject: ar ? "حسابك ما زال كما تركته" : "Your account is exactly as you left it",
    eyebrow: ar ? "حسابك" : "Your account",
    title: ar ? `${hi(c)}كلّ شيء محفوظ — والمزامنة وحدها متوقّفة` : `${hi(c)}everything is saved — only syncing has paused`,
    subtitle: ar
      ? "ربطك وإعداداتك وتاريخك كما هي. الاشتراك يعيد تشغيلها من حيث توقّفت."
      : "Your connections, settings and history are intact. Subscribing resumes them from where they stopped.",
    blocks: [
      {
        list: ar
          ? [
              "لا إعادة ربط للحسابات الإعلانية",
              "لا إعادة ضبط للإعدادات أو الحملات المختارة",
              "التاريخ الذي جُمع أثناء التجربة يبقى كاملاً",
            ]
          : [
              "No reconnecting your ad accounts",
              "No re-doing settings or campaign selection",
              "The history collected during the trial stays intact",
            ],
      },
    ],
    ctaLabel: ar ? "استأنف حسابي" : "Resume my account",
  };
};

const winback: Builder = (c) => {
  const ar = c.locale === "ar";
  return {
    tone: "neutral",
    subject: ar ? "سؤال واحد قبل أن نتوقّف عن المتابعة" : "One question before we stop following up",
    eyebrow: ar ? "نودّ أن نعرف" : "We would like to know",
    title: ar ? `${hi(c)}ما الذي لم يقنعك؟` : `${hi(c)}what did not convince you?`,
    subtitle: ar
      ? "ردّ بسطر واحد على هذه الرسالة — يصلنا مباشرةً ونقرؤه كلّه."
      : "Reply to this email with one line — it reaches us directly and we read all of it.",
    blocks: [
      {
        text: ar
          ? "بنينا AdLoop لأنّ أرقام المنصّات لا تُصدَّق كما هي. إن لم يثبت لك ذلك في حسابك، فهذه معلومة نحتاجها أكثر ممّا نحتاج اشتراكاً."
          : "We built AdLoop because platform numbers cannot be taken at face value. If that did not prove itself in your account, that is something we need to know more than we need a subscription.",
      },
      {
        text: ar
          ? "وإن كان التوقيت وحده هو السبب، حسابك في مكانه متى عدت."
          : "And if it was only timing, your account is right where you left it whenever you come back.",
      },
    ],
    ctaLabel: ar ? "عُد إلى حسابي" : "Go back to my account",
  };
};

/** ربط كلّ رسالة بمُنشئها. مفتاح غير معروف يعني رسالة لا تُرسَل. */
export const BUILDERS: Record<string, Builder> = {
  "engage-decisions": engageDecisions,
  "engage-truth": engageTruth,
  "engage-sync": engageSync,
  "engage-gap": engageGap,
  "trial-d7": trialBefore,
  "trial-d3": trialBefore,
  "trial-d1": trialBefore,
  "trial-after1": trialAfter,
  "trial-after3": trialAfter,
  "trial-after7": trialAfter,
  "winback-w2": trialAfter,
  "winback-w3": winback,
  "winback-w4": winback,
  "winback-w5": winback,
  "winback-w6": winback,
};
