// lib/i18n/dictionary.ts
//
// نظام لغتين حقيقي: كل نص في النظام (UI + رسائل مولّدة) بيمر من هنا،
// مش نصوص عربي متناثرة في كل ملف. أي إضافة نص جديد للنظام لازم تتحط هنا
// بالعربي والإنجليزي مع بعض، مش تتكتب مباشرة جوه الكومبوننت.

export type Locale = "ar" | "en";

export const dictionary = {
  ar: {
    auth: {
      loginTitle: "تسجيل الدخول",
      signupTitle: "إنشاء حساب",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      passwordHint: "8 أحرف على الأقل، بحروف كبيرة وصغيرة وأرقام ورموز",
      loginButton: "دخول",
      loginLoading: "جارٍ تسجيل الدخول...",
      signupButton: "إنشاء الحساب",
      signupLoading: "جارٍ إنشاء الحساب...",
      noAccount: "ليس لديك حساب؟",
      createAccount: "أنشئ حساباً جديداً",
      hasAccount: "لديك حساب بالفعل؟",
      goToLogin: "سجّل الدخول",
      invalidCredentials: "بيانات الدخول غير صحيحة",
      emailExists: "هذا البريد الإلكتروني مسجل بالفعل، سجّل الدخول بدلاً من إنشاء حساب جديد",
      googleContinue: "المتابعة بحساب Google",
      googleSignup: "التسجيل بحساب Google",
      facebookContinue: "المتابعة بحساب Facebook",
      facebookSignup: "التسجيل بحساب Facebook",
      or: "أو",
      name: "الاسم",
      forgotPassword: "هل نسيت كلمة المرور؟",
      mfaTitle: "رمز التحقق",
      mfaHint: "افتح تطبيق المصادقة (مثل Google Authenticator) وأدخل الرمز المكوّن من 6 أرقام.",
      mfaConfirm: "تأكيد",
      mfaVerifying: "جارٍ التحقق...",
      mfaInvalid: "الرمز غير صحيح",
      forgotTitle: "استعادة كلمة المرور",
      forgotSent: "إذا كان هذا البريد مسجّلاً لدينا، فسيصلك رابط إعادة التعيين خلال دقائق.",
      sendResetLink: "إرسال رابط إعادة التعيين",
      sending: "جارٍ الإرسال...",
      resetTitle: "كلمة مرور جديدة",
      newPassword: "كلمة المرور الجديدة (8 أحرف على الأقل)",
      savePassword: "حفظ كلمة المرور الجديدة",
      saving: "جارٍ الحفظ...",
      resetSuccess: "تم تغيير كلمة المرور بنجاح، جارٍ تحويلك إلى تسجيل الدخول...",
      invalidLink: "الرابط غير صالح.",
      verifying: "جارٍ التحقق...",
      verifySuccess: "تم تأكيد بريدك الإلكتروني ✓",
      goToDashboard: "الذهاب إلى لوحة التحكم ←",
      verifyFailed: "تعذّر التحقق",
      genericError: "حدث خطأ، حاول مرة أخرى.",
    },
    dashboard: {
      workspaces: "مساحات العمل",
      newWorkspace: "مساحة عمل جديدة",
      metrics: {
        impressions: "مرات الظهور",
        clicks: "النقرات",
        ctr: "نسبة النقر إلى الظهور",
        cpc: "تكلفة النقرة",
        cplRaw: "تكلفة العميل المحتمل (حسب المنصة)",
        cplVerified: "تكلفة العميل المحتمل الموثّق",
        roas: "العائد على الإنفاق الإعلاني",
        roi: "العائد على الاستثمار",
      },
    },
    aiQuota: {
      monthlyExhausted: "لقد استنفدت رصيدك الشهري من التحديثات اليدوية (120 مرة). سيتجدد الرصيد في بداية الشهر القادم.",
      hourlyExhausted: "يمكنك التحديث مرتين فقط في الساعة، يرجى المحاولة مرة أخرى بعد {minutes} دقيقة.",
    },
    tasks: {
      searchTermsNever: "راجع تقرير مصطلحات البحث (Search Terms) - لم تتم هذه المراجعة من قبل",
      searchTermsSince: "راجع تقرير مصطلحات البحث (Search Terms) - آخر مراجعة منذ {days} يوماً",
      negativeKeywords: "حدّث قائمة الكلمات المفتاحية السلبية المشتركة",
      pacingFast: "تنبيه: معدّل الإنفاق أسرع من تقدّم الشهر بنسبة {pct}% - ستنفد الميزانية قبل نهاية الشهر",
      pacingSlow: "معدّل الإنفاق أبطأ من المتوقع بنسبة {pct}% - تحقق من عدم وجود حملة متوقفة عن طريق الخطأ",
      adFatigue: "معدّل التكرار مرتفع على {platform} ({freq}x) - حان وقت تحديث المحتوى الإبداعي",
      disapprovedAds: "يوجد {count} إعلاناً مرفوضاً من المنصة - راجعها قبل أن تؤثر على توزيع الميزانية",
      trackingHealth: "تنبيه عاجل: صفر تحويلات موثّقة أمس رغم أن المعدل طبيعي - تحقق من أن نظام التتبع (webhook) يعمل بشكل صحيح",
      tagHealth: "تنبيه عاجل: توجد نقرات مسجّلة عند المنصة الإعلانية، لكن لم تصل أي إشارة لنظام التتبع - وسم التتبع (tracking tag) على الأرجح معطّل أو محذوف من الصفحة",
      ctrDrop: "انخفاض حاد في نسبة النقر (CTR) بنسبة {pct}% مقارنة بمتوسط آخر 30 يوماً",
      pageSpeed: "صفحة الهبوط تستغرق {seconds} ثانية للتحميل - بطء التحميل يقلل معدل التحويل بشكل مباشر",
    },
    insights: {
      platformComparison: "منصة {best} تحقق تكلفة عميل حقيقي أقل بنسبة {pct}% مقارنة بمنصة {worst} ({bestValue} مقابل {worstValue} لكل عميل حقيقي).",
      videoComparison: "تحقق إعلانات {best} مشاهدات كاملة بتكلفة أقل بكثير من {worst} ({bestValue} مقابل {worstValue}).",
      roasGapSmall: "الفرق طفيف ({pct}%) - قيمة العائد الظاهرة قريبة من القيمة الحقيقية.",
      roasGapWarning: "تنبيه: قيمة العائد الظاهرة ({displaced}) توحي بربح أعلى بنسبة {pct}% من الواقع. بعد خصم تكلفة المنتج والشحن والمرتجعات، العائد الحقيقي هو {trueRoas} فقط.",
      noData: "لا توجد بيانات كافية للمقارنة.",
    },
    diagnosis: {
      returns: "نسبة مرتجعات هذا المنتج ({rate}%) أعلى بوضوح من متوسط باقي المنتجات ({avg}%) - المشكلة في معدل الإرجاع، وليست في السعر.",
      staleCogs: "تكلفة المنتج (COGS) المسجّلة لم تُحدَّث منذ {days} يوماً - راجع التكلفة الفعلية الحالية قبل الحكم على السعر.",
      shippingOutlier: "تكلفة شحن هذا المنتج ({cost}) أعلى بوضوح من المتوسط ({avg}) - المشكلة في تكلفة الشحن، وليست في السعر.",
      discountCodes: "{pct}% من مبيعات هذا المنتج تمت باستخدام كود خصم قد لا يكون محتسباً في معادلة الهامش - راجع حساب الهامش أولاً.",
      missingGatewayFee: "عمولة بوابة الدفع غير مُدرَجة في معادلة حساب الهامش - هذا خطأ في الحساب، وليس مشكلة في السعر.",
      pricing: "تم استبعاد المرتجعات وتحديث التكلفة وتكلفة الشحن وأكواد الخصم وعمولة بوابة الدفع كأسباب محتملة. السبب الأرجح: السعر الحالي قريب جداً من التكلفة الفعلية، ويحتاج مراجعة.",
    },
    automation: {
      pauseCampaign: "إيقاف الحملة",
      reduceBudget: "تقليل الميزانية بنسبة {pct}%",
      increaseBudget: "زيادة الميزانية بنسبة {pct}%",
      alertOnly: "إرسال تنبيه فقط",
    },
    experiments: {
      improved: "تحسّن",
      worsened: "ساء",
      insufficientData: "لسه بدري نحكم - محتاجين بيانات أكتر ({days} يوم بس لحد دلوقتي).",
      preliminary: "مؤشر أولي: {metric} {direction} بنسبة {pct}% - لسه محتاج وقت أطول للتأكيد.",
      reliable: "نتيجة موثوقة: {metric} {direction} بنسبة {pct}%.",
    },
    actionFeed: {
      cooldownBlocked: "{ruleName}: تحقق الشرط، لكن الإجراء مؤجَّل بسبب فترة التهدئة",
      conditionDetail: "القيمة الحالية: {value} - تحقق الشرط لمدة {days} يوم متتالٍ",
      unavailable: "غير متاحة",
    },
    notifications: {
      urgentTasksTitle: "{count} مهمة عاجلة تحتاج انتباهك",
    },
    metricLabels: {
      impressions: "الظهور",
      clicks: "الكليكات",
      ctr: "نسبة النقر (CTR)",
      cpc: "تكلفة النقرة (CPC)",
      cpl_raw: "تكلفة العميل المحتمل (حسب المنصة)",
      cpl_verified: "تكلفة العميل المحتمل الحقيقي (موثّق)",
      inflation_rate: "نسبة تضخيم المنصة",
      roas: "العائد على الإنفاق الإعلاني (ROAS)",
      roi: "العائد على الاستثمار (ROI)",
      video_view_rate: "نسبة مشاهدة الفيديو",
      video_hook_rate: "نسبة جذب أول 3 ثوانٍ",
      video_cost_per_thruplay: "تكلفة المشاهدة الكاملة",
      response_time: "سرعة استجابة الفريق",
      unattributed_rate: "نسبة المحادثات مجهولة المصدر",
      cogs_margin: "هامش الربح بعد التكلفة",
      rto_rate: "نسبة المرتجعات (RTO)",
      shipping_cost_impact: "أثر تكلفة الشحن",
    },
    pricingHealth: {
      safe: "السعر الحالي ({price}) يحقق الهامش المستهدف بشكل آمن (السعر المقترح للمقارنة: {suggested}).",
      warning: "تنبيه مبكر: السعر الحالي ({price}) أقل من السعر المطلوب بنسبة {gap}% لتحقيق الهامش المستهدف ({suggested}). راجع السعر قبل أن يتحول إلى خسارة فعلية.",
      critical: "تحذير عاجل: السعر الحالي ({price}) أقل بشكل خطير من السعر المطلوب بنسبة {gap}% ({suggested}). هذا المنتج يُباع على الأرجح بخسارة فعلية الآن.",
    },
  },
  en: {
    auth: {
      loginTitle: "Log in",
      signupTitle: "Create an account",
      email: "Email",
      password: "Password",
      passwordHint: "At least 8 characters, with uppercase, lowercase, numbers, and symbols",
      loginButton: "Log in",
      loginLoading: "Logging in...",
      signupButton: "Create account",
      signupLoading: "Creating account...",
      noAccount: "Don't have an account?",
      createAccount: "Create a new account",
      hasAccount: "Already have an account?",
      goToLogin: "Log in",
      invalidCredentials: "Invalid login credentials",
      emailExists: "This email is already registered. Please log in instead.",
      googleContinue: "Continue with Google",
      googleSignup: "Sign up with Google",
      facebookContinue: "Continue with Facebook",
      facebookSignup: "Sign up with Facebook",
      or: "or",
      name: "Name",
      forgotPassword: "Forgot your password?",
      mfaTitle: "Verification code",
      mfaHint: "Open your authenticator app (e.g. Google Authenticator) and enter the 6-digit code.",
      mfaConfirm: "Confirm",
      mfaVerifying: "Verifying...",
      mfaInvalid: "Invalid code",
      forgotTitle: "Reset your password",
      forgotSent: "If this email is registered with us, a reset link will arrive within a few minutes.",
      sendResetLink: "Send reset link",
      sending: "Sending...",
      resetTitle: "New password",
      newPassword: "New password (at least 8 characters)",
      savePassword: "Save new password",
      saving: "Saving...",
      resetSuccess: "Password changed successfully. Redirecting you to log in...",
      invalidLink: "Invalid link.",
      verifying: "Verifying...",
      verifySuccess: "Your email has been verified ✓",
      goToDashboard: "Go to dashboard →",
      verifyFailed: "Verification failed",
      genericError: "Something went wrong, please try again.",
    },
    dashboard: {
      workspaces: "Workspaces",
      newWorkspace: "New Workspace",
      metrics: {
        impressions: "Impressions",
        clicks: "Clicks",
        ctr: "Click-Through Rate",
        cpc: "Cost Per Click",
        cplRaw: "Cost Per Lead (platform-reported)",
        cplVerified: "Verified Cost Per Lead",
        roas: "Return on Ad Spend",
        roi: "Return on Investment",
      },
    },
    aiQuota: {
      monthlyExhausted: "You've used your full monthly quota of manual refreshes (120). It resets at the start of next month.",
      hourlyExhausted: "You can refresh twice per hour. Please try again in {minutes} minutes.",
    },
    tasks: {
      searchTermsNever: "Review the Search Terms report - this has never been reviewed",
      searchTermsSince: "Review the Search Terms report - last reviewed {days} days ago",
      negativeKeywords: "Update the shared negative keywords list",
      pacingFast: "Warning: spend is pacing {pct}% faster than the month's progress - budget will run out early",
      pacingSlow: "Spend is pacing {pct}% slower than expected - check for any campaign accidentally paused",
      adFatigue: "Frequency is high on {platform} ({freq}x) - time to refresh the creative",
      disapprovedAds: "{count} ad(s) disapproved by the platform - review before it affects delivery",
      trackingHealth: "Urgent: zero verified conversions yesterday despite a normal average - check that the tracking webhook is working correctly",
      tagHealth: "Urgent: clicks are being recorded on the ad platform, but no signal is reaching our tracking system - the tracking tag is likely broken or removed from the page",
      ctrDrop: "Sharp CTR drop of {pct}% compared to the last 30-day average",
      pageSpeed: "The landing page takes {seconds} seconds to load - slow load times directly reduce conversion rate",
    },
    insights: {
      platformComparison: "{best} delivers a lower true cost per lead by {pct}% compared to {worst} ({bestValue} vs {worstValue} per verified lead).",
      videoComparison: "{best} achieves complete views at a much lower cost than {worst} ({bestValue} vs {worstValue}).",
      roasGapSmall: "The gap is small ({pct}%) - the displayed ROAS is close to the real figure.",
      roasGapWarning: "Warning: the displayed ROAS ({displaced}) overstates profit by {pct}% versus reality. After deducting product cost, shipping, and returns, the true ROAS is only {trueRoas}.",
      noData: "Not enough data for comparison.",
    },
    diagnosis: {
      returns: "This product's return rate ({rate}%) is clearly higher than the average across other products ({avg}%) - the issue is the return rate, not the price.",
      staleCogs: "The recorded product cost (COGS) hasn't been updated in {days} days - check the current actual cost before judging the price.",
      shippingOutlier: "This product's shipping cost ({cost}) is clearly higher than average ({avg}) - the issue is shipping cost, not price.",
      discountCodes: "{pct}% of this product's sales used a discount code that may not be accounted for in the margin formula - review the margin calculation first.",
      missingGatewayFee: "Payment gateway fees are not included in the margin formula - this is a calculation error, not a pricing problem.",
      pricing: "Returns, cost updates, shipping cost, discount codes, and gateway fees have all been ruled out as likely causes. Most likely reason: the current price is genuinely too close to the actual cost and needs review.",
    },
    automation: {
      pauseCampaign: "Pause the campaign",
      reduceBudget: "Reduce budget by {pct}%",
      increaseBudget: "Increase budget by {pct}%",
      alertOnly: "Send an alert only",
    },
    experiments: {
      improved: "improved",
      worsened: "worsened",
      insufficientData: "Too early to tell - need more data ({days} day(s) so far).",
      preliminary: "Early signal: {metric} {direction} by {pct}% - still needs more time to confirm.",
      reliable: "Reliable result: {metric} {direction} by {pct}%.",
    },
    actionFeed: {
      cooldownBlocked: "{ruleName}: condition met, but the action is delayed due to the cooldown period",
      conditionDetail: "Current value: {value} - condition held for {days} consecutive day(s)",
      unavailable: "unavailable",
    },
    notifications: {
      urgentTasksTitle: "{count} urgent task(s) need your attention",
    },
    metricLabels: {
      impressions: "Impressions",
      clicks: "Clicks",
      ctr: "Click-Through Rate (CTR)",
      cpc: "Cost Per Click (CPC)",
      cpl_raw: "Cost Per Lead (platform-reported)",
      cpl_verified: "Verified Cost Per Lead",
      inflation_rate: "Platform Inflation Rate",
      roas: "Return on Ad Spend (ROAS)",
      roi: "Return on Investment (ROI)",
      video_view_rate: "Video View Rate",
      video_hook_rate: "First-3-Seconds Hook Rate",
      video_cost_per_thruplay: "Cost per Complete View",
      response_time: "Team Response Time",
      unattributed_rate: "Unattributed Conversation Rate",
      cogs_margin: "Margin After Cost",
      rto_rate: "Return Rate (RTO)",
      shipping_cost_impact: "Shipping Cost Impact",
    },
    pricingHealth: {
      safe: "The current price ({price}) safely achieves the target margin (suggested price for comparison: {suggested}).",
      warning: "Early warning: the current price ({price}) is {gap}% below what's needed to hit the target margin ({suggested}). Review the price before it turns into an actual loss.",
      critical: "Urgent: the current price ({price}) is dangerously {gap}% below what's needed ({suggested}). This product is likely being sold at an active loss right now.",
    },
  },
} as const;

// دالة مساعدة بتاخد مسار زي "auth.loginTitle" وتديك النص باللغة المطلوبة،
// مع دعم استبدال متغيرات زي {minutes}
export function t(
  locale: Locale,
  path: string,
  vars?: Record<string, string | number>
): string {
  const keys = path.split(".");
  let value: any = dictionary[locale];

  for (const key of keys) {
    value = value?.[key];
  }

  if (typeof value !== "string") {
    console.warn(`Missing translation for path: ${path} (${locale})`);
    return path;
  }

  if (vars) {
    return Object.entries(vars).reduce(
      (str, [key, val]) => str.replace(`{${key}}`, String(val)),
      value
    );
  }

  return value;
}

// بيحدد اللغة من الطلب - أولوية: تفضيل محفوظ للمستخدم، ثم Accept-Language
// header بتاع المتصفح، ثم افتراضي عربي
export function detectLocale(acceptLanguageHeader: string | null): Locale {
  if (!acceptLanguageHeader) return "ar";
  return acceptLanguageHeader.toLowerCase().startsWith("en") ? "en" : "ar";
}
