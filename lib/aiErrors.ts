// lib/aiErrors.ts
//
// ترجمة أخطاء مزوّد الذكاء الاصطناعي إلى رسائل تخصّ المستخدم.
//
// السبب: كانت استجابة المزوّد الخام تصل إلى العميل كما هي، بما فيها
// "Your credit balance is too low… go to Plans & Billing" - وهي رسالة
// موجّهة إلى **مالك المنتج** لا إلى المشترك، وتكشف تفاصيل تشغيلية داخلية
// (نوع الخطأ، معرّف الطلب، اسم المزوّد). الخطأ التقني يُسجَّل في الخادم
// للمالك، والمشترك يرى سبباً مفهوماً وخياراً عملياً.

export type AiErrorKind =
  | "QUOTA_EXHAUSTED"   // المستخدم استهلك حصته الشهرية
  | "SERVICE_CREDIT"    // رصيد المنتج لدى المزوّد نفد - مشكلة تخصّنا نحن
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE";

export interface UserFacingAiError {
  kind: AiErrorKind;
  messageAr: string;
  messageEn: string;
  /** هل يفيد المستخدم أن يُعرض له خيار الترقية */
  showUpgrade: boolean;
}

const MAP: Record<AiErrorKind, UserFacingAiError> = {
  QUOTA_EXHAUSTED: {
    kind: "QUOTA_EXHAUSTED",
    messageAr: "استهلكت رصيد التحليلات الذكية لهذا الشهر. يتجدّد تلقائياً مع بداية الشهر، أو يمكنك الترقية للحصول على رصيد أكبر الآن.",
    messageEn: "You've used this month's AI analysis credit. It renews at the start of next month, or upgrade now for more.",
    showUpgrade: true,
  },
  SERVICE_CREDIT: {
    kind: "SERVICE_CREDIT",
    // لا نُحمّل المشترك مسؤولية مشكلة في اشتراكنا نحن لدى المزوّد
    messageAr: "خدمة التحليل الذكي غير متاحة مؤقتاً لأسباب فنية لدينا. فريقنا مُبلَّغ بالمشكلة، وبقية أجزاء المنتج تعمل بشكل طبيعي.",
    messageEn: "AI analysis is temporarily unavailable due to an issue on our side. Our team has been notified; the rest of the product works normally.",
    showUpgrade: false,
  },
  RATE_LIMITED: {
    kind: "RATE_LIMITED",
    messageAr: "الطلبات كثيرة في الوقت الحالي. أعد المحاولة بعد دقيقة.",
    messageEn: "Too many requests right now. Please try again in a minute.",
    showUpgrade: false,
  },
  TIMEOUT: {
    kind: "TIMEOUT",
    messageAr: "استغرق التحليل وقتاً أطول من المتوقع. أعد المحاولة.",
    messageEn: "The analysis took longer than expected. Please try again.",
    showUpgrade: false,
  },
  UNAVAILABLE: {
    kind: "UNAVAILABLE",
    messageAr: "تعذّر إجراء التحليل الذكي حالياً. حاول مرة أخرى بعد قليل.",
    messageEn: "AI analysis is unavailable right now. Please try again shortly.",
    showUpgrade: false,
  },
};

/**
 * يصنّف الخطأ ويُرجع رسالة المستخدم. يُسجَّل الخطأ الخام في سجل الخادم
 * دائماً - المالك يراه هناك، والمشترك لا يراه إطلاقاً.
 */
export function toUserFacingAiError(err: unknown, context: string): UserFacingAiError {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  console.error(`[AI:${context}]`, raw);

  const lower = raw.toLowerCase();

  // "credit balance is too low" تخصّ حساب المنتج لدى المزوّد، لا المشترك
  if (lower.includes("credit balance") || lower.includes("billing") || lower.includes("payment required")) {
    return MAP.SERVICE_CREDIT;
  }
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("overloaded")) {
    return MAP.RATE_LIMITED;
  }
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("etimedout")) {
    return MAP.TIMEOUT;
  }
  return MAP.UNAVAILABLE;
}

/** حصة المستخدم الشهرية نفدت - حالة مشروعة يُعرض معها خيار الترقية. */
export function quotaExhaustedError(): UserFacingAiError {
  return MAP.QUOTA_EXHAUSTED;
}
