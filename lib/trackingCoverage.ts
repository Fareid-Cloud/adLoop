// lib/trackingCoverage.ts
//
// يجيب عن سؤال حقيقي: "هل التتبع موجود فعلاً على هذه الصفحة؟" - نجلب HTML
// الصفحة ونفتّش عن بصمات أنظمة التتبع، لا نفترض.
//
// 🔴 إصلاح خلل جوهري: كانت النسخة السابقة تبحث عن نصّين فقط
// (trackCtaClick / adloop_session_id) أي **بصمة AdLoop وحدها**. أي موقع
// عليه Google Tag Manager أو Meta Pixel أو gtag - وهو الوضع الطبيعي لأي
// معلن - كان يُصنَّف "بلا تتبع" رغم أن تتبعه يعمل تماماً. النتيجة: تقرير
// مضلّل تماماً لكل مستخدم تقريباً.
//
// الآن نكتشف كل أنظمة التتبع الشائعة، ونذكر أيّها وُجد بالاسم، ونفرّق
// بين "تتبع المنصات" و"تتبع AdLoop" لأن لكل منهما دوراً مختلفاً.

export interface DetectedSystem {
  id: string;
  labelAr: string;
  labelEn: string;
  /** أساسي للمنتج: بدونه لا يمكن ربط النقرة بالمحادثة */
  isAdLoop: boolean;
}

import { auditPageHtml, type PageAuditResult } from "./pageAudit";
import { safeFetch } from "./safeFetch";
import { t } from "./i18n/dictionary";
import { trackingErrorText } from "./trackingErrorText";

export { trackingErrorText };

export interface TrackingCheckResult {
  detected: boolean;
  /** أنظمة التتبع التي عُثر عليها فعلياً */
  systems: DetectedSystem[];
  /** هل عُثر على سنيبت AdLoop تحديداً */
  adloopDetected: boolean;
  /** مؤشر على أن الوسوم تُحمَّل ديناميكياً ولا يمكن رؤيتها في HTML الخام */
  usesTagManager: boolean;
  /** 🔴 **رمزٌ يُترجَم عند العرض، لا نصُّ خطأٍ خام.**
   *
   *  كان يحمل `err.message` كما ورد من طبقة الشبكة (`getaddrinfo ENOTFOUND`،
   *  أخطاء شهادات TLS) وفرعين عربيَّين مثبَّتين - فيُعرَض للمشترك تفصيلٌ
   *  تشغيليّ لا يقول له ماذا يفعل، وبالعربية لقارئٍ إنجليزيّ. القيم:
   *  `"timeout"` · `"unreachable"` · `"http:<status>"`. */
  error: string | null;
  checkedUrl: string;
  httpStatus: number | null;
  /** فحوصات SEO والأمان وروابط المحادثة - من نفس نداء الشبكة */
  audit: PageAuditResult | null;
}

interface SignatureDef extends DetectedSystem {
  patterns: RegExp[];
}

// بصمات مؤكدة من الأكواد الرسمية لكل نظام
const SIGNATURES: SignatureDef[] = [
  {
    id: "adloop", labelAr: "تتبع AdLoop", labelEn: "AdLoop tracking", isAdLoop: true,
    patterns: [/trackCtaClick/i, /adloop_session_id/i, /adloop[-_]?tracking/i],
  },
  {
    id: "gtm", labelAr: "Google Tag Manager", labelEn: "Google Tag Manager", isAdLoop: false,
    patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]{4,}/],
  },
  {
    id: "gtag", labelAr: "وسم Google (gtag)", labelEn: "Google tag (gtag)", isAdLoop: false,
    patterns: [/googletagmanager\.com\/gtag\/js/i, /gtag\s*\(\s*['"]config['"]/i, /AW-\d{6,}/],
  },
  {
    id: "ga4", labelAr: "Google Analytics 4", labelEn: "Google Analytics 4", isAdLoop: false,
    patterns: [/G-[A-Z0-9]{8,}/, /google-analytics\.com\/g\/collect/i],
  },
  {
    id: "meta_pixel", labelAr: "بيكسل ميتا", labelEn: "Meta Pixel", isAdLoop: false,
    patterns: [/connect\.facebook\.net\/[^"']*\/fbevents\.js/i, /fbq\s*\(\s*['"]init['"]/i],
  },
  {
    id: "tiktok_pixel", labelAr: "بيكسل تيك توك", labelEn: "TikTok Pixel", isAdLoop: false,
    patterns: [/analytics\.tiktok\.com/i, /ttq\.(load|track)/i],
  },
  {
    id: "snap_pixel", labelAr: "بيكسل سناب شات", labelEn: "Snap Pixel", isAdLoop: false,
    patterns: [/sc-static\.net\/scevent/i, /snaptr\s*\(/i],
  },
  {
    id: "x_pixel", labelAr: "بيكسل X", labelEn: "X Pixel", isAdLoop: false,
    patterns: [/static\.ads-twitter\.com/i, /twq\s*\(/i],
  },
  {
    id: "linkedin", labelAr: "LinkedIn Insight", labelEn: "LinkedIn Insight", isAdLoop: false,
    patterns: [/snap\.licdn\.com/i, /_linkedin_partner_id/i],
  },
  {
    id: "hotjar", labelAr: "Hotjar", labelEn: "Hotjar", isAdLoop: false,
    patterns: [/static\.hotjar\.com/i, /hjSettings/i],
  },
  {
    id: "clarity", labelAr: "Microsoft Clarity", labelEn: "Microsoft Clarity", isAdLoop: false,
    patterns: [/clarity\.ms\/tag/i],
  },
];

const FETCH_TIMEOUT_MS = 12000;

export async function checkTrackingPresence(rawUrl: string): Promise<TrackingCheckResult> {
  const base: TrackingCheckResult = {
    detected: false, systems: [], adloopDetected: false,
    usesTagManager: false, error: null, checkedUrl: rawUrl, httpStatus: null,
    audit: null,
  };

  // بروتوكول ناقص سبب شائع جداً لفشل الفحص بلا سبب واضح للمستخدم
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  // 🔴 عبر `safeFetch` لا `fetch` خام: هذا المسار يقبل رابطاً من المستخدم
  // (صفحة يراد فحص تتبّعها) ثمّ يجلبه ويعكس نتيجته - أي SSRF مباشر لو تُرك
  // خاماً (رابطٌ إلى `169.254.169.254` أو شبكةٍ داخلية). `safeFetch` يرفض
  // النطاقات الخاصة، ويعيد التحقّق بعد كلّ توجيه، وله حدّه الزمنيّ وحدّ حجمه.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await safeFetch(url, {
      headers: {
        // ترويسة متصفح حقيقية: كثير من الاستضافات تحجب الوكلاء غير المعروفين
        // فتُرجع 403 فيبدو الموقع كأنه بلا تتبع - وهو سبب آخر للنتيجة الخاطئة.
        "User-Agent": "Mozilla/5.0 (compatible; AdLoopMonitor/2.0; +https://adloop.app/bot)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.9",
      },
    });

    base.checkedUrl = res.url || url;
    base.httpStatus = res.status;

    if (!res.ok) {
      base.error = `http:${res.status}`;
      return base;
    }

    const html = await res.text();

    const found = SIGNATURES.filter((s) => s.patterns.some((p) => p.test(html)));
    base.systems = found.map(({ id, labelAr, labelEn, isAdLoop }) => ({ id, labelAr, labelEn, isAdLoop }));
    base.adloopDetected = found.some((s) => s.isAdLoop);
    base.usesTagManager = found.some((s) => s.id === "gtm");
    base.detected = found.length > 0;

    // نفس ملف HTML يخدم فحوصات SEO والأمان وروابط المحادثة - لا داعي
    // لتحميل الصفحة مرة أخرى لكل فحص
    base.audit = auditPageHtml(html, base.checkedUrl, url);

    return base;
  } catch (err) {
    // التفصيل يُسجَّل عندنا ولا يُعرَض: نصُّ الشبكة الخام يشخّص لنا ولا
    // يقول للمشترك شيئاً يفعله.
    if (!(err instanceof Error && err.name === "AbortError")) {
      console.error("[trackingCoverage] تعذّر الوصول إلى الصفحة:", err);
    }
    base.error = err instanceof Error && err.name === "AbortError" ? "timeout" : "unreachable";
    return base;
  } finally {
    clearTimeout(timer);
  }
}

/** رسالة تشرح النتيجة بدقة - بما فيها الحد الحقيقي لهذا الفحص. */
export function explainTrackingResult(r: TrackingCheckResult, locale: "ar" | "en"): string {
  const ar = locale === "ar";

  if (r.error) return trackingErrorText(r.error, locale) ?? t(locale, "trackErr.unreachable");

  if (!r.detected) {
    return ar
      ? "لم نعثر على أي كود تتبع في مصدر الصفحة. إن كنت تستخدم أداة تُحمّل الوسوم بعد فتح الصفحة، فقد لا تظهر في هذا الفحص."
      : "No tracking code found in the page source. If your tags load after page open, this check may not see them.";
  }

  const names = r.systems.map((s) => (ar ? s.labelAr : s.labelEn)).join("، ");

  if (!r.adloopDetected) {
    const viaGtm = r.usesTagManager
      ? ar ? " وقد يكون وسم AdLoop مُضافاً داخل Tag Manager فلا يظهر هنا."
           : " AdLoop's tag may be inside Tag Manager, which this check cannot see."
      : "";
    return ar
      ? `التتبع يعمل: ${names}. لكن وسم AdLoop غير موجود، وبدونه لا يمكن ربط النقرة بالمحادثة الحقيقية.${viaGtm}`
      : `Tracking is active: ${names}. AdLoop's tag is missing though — without it we cannot link a click to a real conversation.${viaGtm}`;
  }

  return ar
    ? `التتبع مكتمل: ${names}.`
    : `Tracking is complete: ${names}.`;
}
